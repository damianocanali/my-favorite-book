// Apple App Attest client. Proves to the backend that paid AI requests
// come from a genuine, untampered copy of this app — protecting the
// operator's Together/Anthropic spend from scripted abuse with a stolen
// session token.
//
// Flow (server side: api/attest/* + api/_appAttest.js):
//   1. Once per install: generate a Secure Enclave key, attest it with a
//      server challenge, register the public key (/api/attest/register).
//   2. Per paid request: sign SHA256(request body) with the key and send
//      the assertion in headers; the server verifies and grants the full
//      rate/daily caps.
//
// Everything degrades gracefully: on simulators (isSupported == false),
// before registration completes, or on any error, requests simply go out
// unattested and land in the server's reduced-cap tier.
import CryptoKit
import DeviceCheck
import Foundation

actor AppAttestService {
    static let shared = AppAttestService()

    private let service = DCAppAttestService.shared
    private let keyIdDefaultsKey = "app_attest_key_id"
    private let registeredDefaultsKey = "app_attest_registered"

    /// Dedupes concurrent registration attempts.
    private var registrationTask: Task<String?, Never>?
    /// Don't hammer the server when registration keeps failing.
    private var lastFailedAttempt: Date?
    private let retryCooldown: TimeInterval = 60

    /// Assertion headers for a paid request, or nil when attestation
    /// isn't available — the request should be sent anyway.
    func assertionHeaders(for body: Data, bearerToken: String) async -> [String: String]? {
        guard service.isSupported else { return nil }
        guard let keyId = await registeredKeyId(bearerToken: bearerToken) else { return nil }
        do {
            let clientDataHash = Data(SHA256.hash(data: body))
            let assertion = try await service.generateAssertion(keyId, clientDataHash: clientDataHash)
            return [
                "x-attest-key-id": keyId,
                "x-attest-assertion": assertion.base64EncodedString(),
            ]
        } catch {
            // A permanently invalid key (e.g. backup restored to another
            // device) must be regenerated from scratch.
            if (error as? DCError)?.code == .invalidKey { reset() }
            return nil
        }
    }

    // MARK: - Registration

    private func registeredKeyId(bearerToken: String) async -> String? {
        let defaults = UserDefaults.standard
        if defaults.bool(forKey: registeredDefaultsKey),
           let keyId = defaults.string(forKey: keyIdDefaultsKey) {
            return keyId
        }
        if let task = registrationTask { return await task.value }
        if let last = lastFailedAttempt, Date().timeIntervalSince(last) < retryCooldown {
            return nil
        }

        let task = Task<String?, Never> { await register(bearerToken: bearerToken) }
        registrationTask = task
        let result = await task.value
        registrationTask = nil
        if result == nil { lastFailedAttempt = Date() }
        return result
    }

    private func register(bearerToken: String) async -> String? {
        do {
            let defaults = UserDefaults.standard
            let keyId: String
            if let existing = defaults.string(forKey: keyIdDefaultsKey) {
                keyId = existing
            } else {
                keyId = try await service.generateKey()
                defaults.set(keyId, forKey: keyIdDefaultsKey)
            }

            let challenge = try await APIClient.shared.attestChallenge(bearerToken: bearerToken)
            // Hash the UTF-8 bytes of the challenge string — the server
            // passes the identical string to its verifier.
            let clientDataHash = Data(SHA256.hash(data: Data(challenge.challenge.utf8)))
            let attestation = try await service.attestKey(keyId, clientDataHash: clientDataHash)
            try await APIClient.shared.registerAttestation(
                challengeId: challenge.challengeId,
                keyId: keyId,
                attestation: attestation.base64EncodedString(),
                bearerToken: bearerToken
            )
            defaults.set(true, forKey: registeredDefaultsKey)
            return keyId
        } catch {
            if (error as? DCError)?.code == .invalidKey { reset() }
            return nil
        }
    }

    private func reset() {
        UserDefaults.standard.removeObject(forKey: keyIdDefaultsKey)
        UserDefaults.standard.set(false, forKey: registeredDefaultsKey)
    }
}

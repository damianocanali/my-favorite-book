// Biometric sign-in. After a successful login the user can opt to
// "remember" their login. The Supabase session tokens are stored in
// the Keychain behind a biometric access-control flag, so retrieving
// them triggers Face ID / Touch ID. On the login screen a "Sign in
// with Face ID" button reads them back and restores the session — no
// typing.
//
// Security notes:
//   - We store session tokens, NOT the password. The refresh token can
//     be revoked server-side (sign out everywhere, password change),
//     and the user's actual password never persists on the device.
//   - Earlier app versions stored {email, password}; `retrieve` still
//     decodes that legacy shape so existing users migrate seamlessly
//     (AuthStore signs in once with it, then overwrites with tokens).
//   - The Keychain item uses `.biometryCurrentSet` protection via
//     SecAccessControl, so the secret is gated by the device's current
//     biometric enrollment and never leaves the Secure Enclave-backed
//     keychain.
//   - kSecAttrAccessibleWhenUnlockedThisDeviceOnly means it never
//     syncs to iCloud Keychain and is wiped on device erase.
import Foundation
import LocalAuthentication
import Security

/// What's behind the biometric prompt. `.session` is the current
/// format; `.password` only appears for items written by old builds.
enum StoredLogin {
    case session(email: String, accessToken: String, refreshToken: String)
    case password(email: String, password: String)
}

/// On-disk JSON shape. One struct covers both versions: v2 items have
/// tokens, legacy items (no `v` field) have a password.
private struct StoredLoginPayload: Codable {
    var v: Int?
    var email: String
    var password: String?
    var accessToken: String?
    var refreshToken: String?

    var login: StoredLogin? {
        if let accessToken, let refreshToken {
            return .session(email: email, accessToken: accessToken, refreshToken: refreshToken)
        }
        if let password {
            return .password(email: email, password: password)
        }
        return nil
    }
}

enum BiometricCredentials {
    private static let service = "com.myfavoritebook.app.biometric-login"
    private static let account = "primary"

    // MARK: - Biometry availability / labeling

    static var isAvailable: Bool {
        var error: NSError?
        return LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    static var biometryLabel: String {
        let ctx = LAContext()
        _ = ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch ctx.biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        default: return "Biometrics"
        }
    }

    /// True if we have credentials stored. This does NOT trigger a
    /// biometric prompt — it only checks the item exists, so the login
    /// screen can decide whether to show the "Sign in with Face ID"
    /// button.
    static var hasStoredCredentials: Bool {
        var query: [String: Any] = baseQuery()
        query[kSecReturnData as String] = false
        query[kSecUseAuthenticationUI as String] = kSecUseAuthenticationUIFail
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        // errSecInteractionNotAllowed means the item exists but needs
        // auth to read — which is exactly our biometric item.
        return status == errSecSuccess || status == errSecInteractionNotAllowed
    }

    // MARK: - Save

    /// Save (or refresh) the session tokens. Keychain WRITES to a
    /// biometry-protected item don't prompt Face ID — only reads do —
    /// so AuthStore calls this freely on every token rotation.
    static func save(email: String, accessToken: String, refreshToken: String) throws {
        // Remove any existing item first.
        SecItemDelete(baseQuery() as CFDictionary)

        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .biometryCurrentSet,
            nil
        ) else {
            throw NSError(domain: "BiometricCredentials", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Couldn't create access control"])
        }

        let data = try JSONEncoder().encode(StoredLoginPayload(
            v: 2, email: email, accessToken: accessToken, refreshToken: refreshToken
        ))
        var attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessControl as String: accessControl,
        ]
        attributes[kSecUseAuthenticationContext as String] = LAContext()

        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NSError(domain: "BiometricCredentials", code: Int(status),
                          userInfo: [NSLocalizedDescriptionKey: "Keychain save failed (\(status))"])
        }
    }

    // MARK: - Retrieve (triggers biometric prompt)

    /// Why a retrieve failed, as a value rather than a message.
    ///
    /// Callers used to branch on `error.localizedDescription.contains("credential")`,
    /// which only works while the app is English — iOS localizes system error
    /// text, so on an Italian device no branch matched and the user could get
    /// stuck in a Face ID loop. Branch on these cases instead.
    enum RetrieveError: LocalizedError {
        /// The person dismissed the Face ID / Touch ID prompt. Not an error
        /// worth showing — they chose this.
        case cancelled
        /// Nothing is stored, or the item was invalidated because the
        /// device's enrolled biometrics changed (`.biometryCurrentSet`).
        case notFound
        /// Anything else the Keychain reported.
        case keychain(OSStatus)

        var errorDescription: String? {
            switch self {
            case .cancelled: return "Cancelled"
            case .notFound: return "No saved login found."
            case .keychain(let status): return "Couldn't read saved login (\(status))."
            }
        }
    }

    static func retrieve(reason: String) async throws -> StoredLogin {
        let context = LAContext()
        context.localizedReason = reason

        var query: [String: Any] = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecUseAuthenticationContext as String] = context

        return try await withCheckedThrowingContinuation { continuation in
            // SecItemCopyMatching blocks while presenting biometric UI,
            // so run it off the main thread.
            DispatchQueue.global().async {
                var item: CFTypeRef?
                let status = SecItemCopyMatching(query as CFDictionary, &item)
                if status == errSecSuccess, let data = item as? Data,
                   let login = (try? JSONDecoder().decode(StoredLoginPayload.self, from: data))?.login {
                    continuation.resume(returning: login)
                } else if status == errSecUserCanceled {
                    continuation.resume(throwing: RetrieveError.cancelled)
                } else if status == errSecItemNotFound {
                    continuation.resume(throwing: RetrieveError.notFound)
                } else if status == errSecSuccess {
                    // Item read but the payload no longer decodes — a stored
                    // login we can't use is the same as not having one.
                    continuation.resume(throwing: RetrieveError.notFound)
                } else {
                    continuation.resume(throwing: RetrieveError.keychain(status))
                }
            }
        }
    }

    // MARK: - Clear

    static func clear() {
        SecItemDelete(baseQuery() as CFDictionary)
    }

    // MARK: - Helpers

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}

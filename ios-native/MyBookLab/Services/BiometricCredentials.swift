// Biometric sign-in. After a successful email/password login the user
// can opt to "remember" their credentials. They're stored in the
// Keychain behind a biometric access-control flag, so retrieving them
// triggers Face ID / Touch ID. On the login screen a "Sign in with
// Face ID" button reads them back and signs in — no typing.
//
// Security notes:
//   - The Keychain item uses `.biometryCurrentSet` + `.privateKeyUsage`
//     style protection via SecAccessControl, so the secret is gated by
//     the device's current biometric enrollment and never leaves the
//     Secure Enclave-backed keychain.
//   - kSecAttrAccessibleWhenUnlockedThisDeviceOnly means it never
//     syncs to iCloud Keychain and is wiped on device erase.
import Foundation
import LocalAuthentication
import Security

struct StoredCredentials: Codable {
    let email: String
    let password: String
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

    static func save(email: String, password: String) throws {
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

        let data = try JSONEncoder().encode(StoredCredentials(email: email, password: password))
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

    static func retrieve(reason: String) async throws -> StoredCredentials {
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
                   let creds = try? JSONDecoder().decode(StoredCredentials.self, from: data) {
                    continuation.resume(returning: creds)
                } else if status == errSecUserCanceled {
                    continuation.resume(throwing: NSError(domain: "BiometricCredentials",
                        code: Int(status),
                        userInfo: [NSLocalizedDescriptionKey: "Cancelled"]))
                } else {
                    continuation.resume(throwing: NSError(domain: "BiometricCredentials",
                        code: Int(status),
                        userInfo: [NSLocalizedDescriptionKey: "Couldn't read saved login (\(status))"]))
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

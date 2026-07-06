// Holds the current user + access token. Uses the Supabase Swift SDK
// for the actual auth work — sign-in, sign-up, OAuth (Google/Apple),
// password reset, sign-out.
//
// The web side uses a Zustand store that mirrors `user` and selectors
// for display name. We do the equivalent here with @Observable so any
// SwiftUI view that observes AuthStore re-renders when the user
// changes.
import Foundation
import Observation
import Supabase
import AuthenticationServices

@Observable
@MainActor
final class AuthStore: NSObject {
    static let shared = AuthStore()

    private(set) var user: User?
    private(set) var session: Session?
    private(set) var loading: Bool = true
    private(set) var error: String?
    /// Locally-stored avatar data URL. Observable so views update the
    /// moment it changes. Hydrated from UserDefaults on sign-in.
    private(set) var storedAvatar: String?

    let supabase: SupabaseClient

    override init() {
        let cfg = AppConfig.shared
        self.supabase = SupabaseClient(supabaseURL: cfg.supabaseURL, supabaseKey: cfg.supabaseAnonKey)
        super.init()
    }

    // MARK: - Convenience

    var isSignedIn: Bool { user != nil }

    var accessToken: String? { session?.accessToken }

    /// What to show as the user's name. Mirrors selectDisplayName on
    /// the web — prefer the explicitly-set display_name, fall back to
    /// OAuth full_name / name, then to email-prefix.
    var displayName: String? {
        let meta = user?.userMetadata
        if let v = meta?["display_name"]?.stringValue, !v.isEmpty { return v }
        if let v = meta?["full_name"]?.stringValue, !v.isEmpty { return v }
        if let v = meta?["name"]?.stringValue, !v.isEmpty { return v }
        if let email = user?.email { return String(email.split(separator: "@").first ?? "") }
        return nil
    }

    // MARK: - Lifecycle

    /// Call once from MyBookLabApp.init or .task on root. Rehydrates the
    /// session from secure storage and listens for changes.
    func bootstrap() async {
        loading = true
        defer { loading = false }
        do {
            session = try await supabase.auth.session
            user = session?.user
            loadStoredAvatar()
        } catch {
            // No active session — fine, user just needs to sign in.
            session = nil
            user = nil
        }

        // Listen for future auth changes (sign in / sign out from any flow).
        Task { [weak self] in
            guard let self else { return }
            for await change in self.supabase.auth.authStateChanges {
                await MainActor.run {
                    self.session = change.session
                    self.user = change.session?.user
                    self.loadStoredAvatar()
                    // Supabase rotates the refresh token on every
                    // refresh, so a saved biometric login goes stale
                    // unless we re-save the newest pair. Keychain
                    // writes don't prompt Face ID, so this is free.
                    if change.session != nil, BiometricCredentials.hasStoredCredentials {
                        self.saveBiometricLogin()
                    }
                }
            }
        }
    }

    // MARK: - Biometric (Face ID / Touch ID) login

    /// Thrown when the saved session tokens can no longer mint a
    /// session (revoked from another device, or expired). The stale
    /// keychain item has already been cleared.
    enum BiometricLoginError: LocalizedError {
        case expired
        var errorDescription: String? {
            "Saved login is out of date. Please sign in with your password."
        }
    }

    /// Store the current session behind Face ID so the user can sign
    /// back in with one tap. Works for email AND OAuth accounts — we
    /// keep tokens, never the password.
    func saveBiometricLogin() {
        guard let session, BiometricCredentials.isAvailable else { return }
        try? BiometricCredentials.save(
            email: user?.email ?? "",
            accessToken: session.accessToken,
            refreshToken: session.refreshToken
        )
    }

    // MARK: - Email + password

    func signIn(email: String, password: String) async throws {
        let s = try await supabase.auth.signIn(email: email, password: password)
        self.session = s
        self.user = s.user
    }

    /// Sign in using the login saved in the biometric Keychain.
    /// Triggers the Face ID / Touch ID prompt to unlock it.
    func signInWithStoredCredentials() async throws {
        let stored = try await BiometricCredentials.retrieve(
            reason: "Sign in to My Book Lab"
        )
        switch stored {
        case .session(_, let accessToken, let refreshToken):
            do {
                // setSession refreshes automatically when the access
                // token is expired (the usual case at unlock time).
                let s = try await supabase.auth.setSession(
                    accessToken: accessToken, refreshToken: refreshToken
                )
                self.session = s
                self.user = s.user
            } catch {
                // Refresh token revoked or past its window — the saved
                // login can never work again, so stop offering it.
                BiometricCredentials.clear()
                throw BiometricLoginError.expired
            }
        case .password(let email, let password):
            // Legacy item from builds that stored the raw password.
            // Sign in once with it, then overwrite with session tokens
            // so the password stops living on the device.
            try await signIn(email: email, password: password)
            saveBiometricLogin()
        }
    }

    func signUp(email: String, password: String, displayName: String?) async throws {
        var data: [String: AnyJSON] = [:]
        if let displayName, !displayName.isEmpty {
            data["display_name"] = .string(displayName)
        }
        _ = try await supabase.auth.signUp(email: email, password: password, data: data.isEmpty ? nil : data)
    }

    func signOut() async {
        if BiometricCredentials.hasStoredCredentials {
            // Keep the saved biometric login so the user can Face-ID
            // back in. Snapshot the freshest tokens, then sign out
            // LOCALLY only — a global sign-out would revoke the very
            // refresh token we just saved. Trade-off: "sign out" leaves
            // a resurrection token on this device, exactly like the old
            // password storage did, but revocable server-side.
            saveBiometricLogin()
            try? await supabase.auth.signOut(scope: .local)
        } else {
            try? await supabase.auth.signOut()
        }
        session = nil
        user = nil
    }

    func updateDisplayName(_ newName: String) async throws {
        let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw NSError(domain: "AuthStore", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Name cannot be empty"])
        }
        let updated = try await supabase.auth.update(user: UserAttributes(data: [
            "display_name": .string(trimmed)
        ]))
        self.user = updated
    }

    /// Avatar resolution order:
    ///   1. Locally-saved avatar (what the user picked in the editor —
    ///      stored on-device like the web keeps it in localStorage,
    ///      keyed by user id so it survives sign-out/in).
    ///   2. OAuth provider's `picture` (Google profile photo) so
    ///      Google sign-in users get an avatar for free.
    ///   3. nil → AvatarView shows a gradient initial.
    var avatarURL: String? {
        if let local = storedAvatar, !local.isEmpty { return local }
        // userMetadata is a non-optional [String: AnyJSON]; only `user`
        // is optional, so the chain is user?.userMetadata["picture"].
        if let v = user?.userMetadata["picture"]?.stringValue, !v.isEmpty { return v }
        return nil
    }

    private var avatarDefaultsKey: String {
        "avatar_\(user?.id.uuidString ?? "anon")"
    }

    /// Load the on-device avatar for the current user. Call after the
    /// user is known (bootstrap + auth changes).
    private func loadStoredAvatar() {
        storedAvatar = UserDefaults.standard.string(forKey: avatarDefaultsKey)
    }

    /// Save a new avatar. Stored on-device (UserDefaults) as a base64
    /// data URL — NOT in Supabase user_metadata. The auth user record
    /// isn't a blob store; pushing a ~20KB image there fails with a
    /// bearer-token error. The web keeps the avatar in localStorage for
    /// the same reason. Cross-device sync can come later via Storage.
    func updateAvatar(_ image: UIImage) async throws {
        let resized = image.resizedSquare(to: 256)
        guard let jpeg = resized.jpegData(compressionQuality: 0.85) else {
            throw NSError(domain: "AuthStore", code: -3,
                          userInfo: [NSLocalizedDescriptionKey: "Couldn't encode avatar"])
        }
        let dataURL = "data:image/jpeg;base64,\(jpeg.base64EncodedString())"
        UserDefaults.standard.set(dataURL, forKey: avatarDefaultsKey)
        storedAvatar = dataURL   // observable → views refresh instantly
    }

    // MARK: - OAuth (Apple uses the native SDK; Google uses Supabase OAuth via system browser)

    /// Sign in with Apple via the native AuthenticationServices flow.
    /// Returns the resulting Supabase session.
    func signInWithApple() async throws {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        let nonce = Self.randomNonce()
        request.nonce = Self.sha256(nonce)

        let credential: ASAuthorizationAppleIDCredential = try await withCheckedThrowingContinuation { continuation in
            let controller = ASAuthorizationController(authorizationRequests: [request])
            let coordinator = AppleAuthCoordinator(continuation: continuation)
            controller.delegate = coordinator
            controller.presentationContextProvider = coordinator
            self.appleCoordinator = coordinator // retain
            controller.performRequests()
        }

        guard let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            throw NSError(domain: "AuthStore", code: -2,
                          userInfo: [NSLocalizedDescriptionKey: "No Apple identity token"])
        }
        let session = try await supabase.auth.signInWithIdToken(
            credentials: .init(provider: .apple, idToken: identityToken, nonce: nonce)
        )
        self.session = session
        self.user = session.user
    }

    /// Sign in with Google. We fetch the OAuth URL from Supabase,
    /// open it in an ASWebAuthenticationSession (the system in-app
    /// browser), wait for the callback URL on our custom scheme, then
    /// hand it back to Supabase to mint a session.
    func signInWithGoogle() async throws {
        let redirect = URL(string: "com.myfavoritebook.app://auth/callback")!
        let oauthURL = try await supabase.auth.getOAuthSignInURL(
            provider: .google,
            redirectTo: redirect
        )

        let callbackURL: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: oauthURL,
                callbackURLScheme: "com.myfavoritebook.app"
            ) { url, error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else if let url = url {
                    continuation.resume(returning: url)
                } else {
                    continuation.resume(throwing: NSError(domain: "AuthStore", code: -3,
                        userInfo: [NSLocalizedDescriptionKey: "No callback URL"]))
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }

        let s = try await supabase.auth.session(from: callbackURL)
        self.session = s
        self.user = s.user
    }

    /// Handle the deep-link return from any OAuth flow that doesn't go
    /// through ASWebAuthenticationSession (e.g. external Safari).
    /// Wire up from MyBookLabApp.onOpenURL.
    func handleDeepLink(_ url: URL) {
        Task {
            try? await supabase.auth.session(from: url)
        }
    }

    // MARK: - Apple coordinator retention
    private var appleCoordinator: AppleAuthCoordinator?

    // MARK: - Nonce helpers

    private static func randomNonce(length: Int = 32) -> String {
        precondition(length > 0)
        let charset: [Character] =
            Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            var random: UInt8 = 0
            _ = withUnsafeMutableBytes(of: &random) { SecRandomCopyBytes(kSecRandomDefault, 1, $0.baseAddress!) }
            if random < charset.count {
                result.append(charset[Int(random) % charset.count])
                remaining -= 1
            }
        }
        return result
    }

    private static func sha256(_ input: String) -> String {
        let data = Data(input.utf8)
        var hash = [UInt8](repeating: 0, count: 32)
        data.withUnsafeBytes { ptr in
            _ = CC_SHA256(ptr.baseAddress, CC_LONG(data.count), &hash)
        }
        return hash.map { String(format: "%02x", $0) }.joined()
    }
}

// Apple Sign In needs a UIWindow context and a delegate; this isolates
// that ceremony so AuthStore stays focused on the session lifecycle.
private final class AppleAuthCoordinator: NSObject,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding
{
    let continuation: CheckedContinuation<ASAuthorizationAppleIDCredential, Error>
    init(continuation: CheckedContinuation<ASAuthorizationAppleIDCredential, Error>) {
        self.continuation = continuation
    }
    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithAuthorization authorization: ASAuthorization) {
        if let cred = authorization.credential as? ASAuthorizationAppleIDCredential {
            continuation.resume(returning: cred)
        } else {
            continuation.resume(throwing: NSError(domain: "AppleAuth", code: -1))
        }
    }
    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithError error: Error) {
        continuation.resume(throwing: error)
    }
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? UIWindow()
    }
}

import CommonCrypto
import UIKit

// Lets ASWebAuthenticationSession find the window to present from.
extension AuthStore: ASWebAuthenticationPresentationContextProviding {
    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        DispatchQueue.main.sync {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow } ?? UIWindow()
        }
    }
}

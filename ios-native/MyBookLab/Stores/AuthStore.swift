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

    /// What actually happened, so the UI doesn't promise an email that was
    /// never sent.
    enum SignUpOutcome {
        /// A confirmation email is genuinely on its way.
        case confirmationSent
        /// Confirmations are off — the account is active immediately.
        case active
        /// The address already has an account. Supabase returns success and
        /// sends NOTHING (it won't confirm whether an account exists), so
        /// telling the user to check their inbox leaves them waiting
        /// forever. The tell is an empty `identities` array.
        case alreadyRegistered
    }

    @discardableResult
    func signUp(email: String, password: String, displayName: String?) async throws -> SignUpOutcome {
        var data: [String: AnyJSON] = [:]
        if let displayName, !displayName.isEmpty {
            data["display_name"] = .string(displayName)
        }
        let response = try await supabase.auth.signUp(
            email: email, password: password, data: data.isEmpty ? nil : data
        )
        if response.user.identities?.isEmpty == true {
            return .alreadyRegistered
        }
        return response.session != nil ? .active : .confirmationSent
    }

    /// Emails a password-reset link. The link opens the web reset page
    /// rather than deep-linking back into the app: mybooklab.app already
    /// handles recovery tokens, and pushing that flow through the custom
    /// URL scheme would be a second place to get token handling wrong.
    func sendPasswordReset(email: String) async throws {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.contains("@") else {
            throw NSError(domain: "AuthStore", code: -5, userInfo: [
                NSLocalizedDescriptionKey: "Enter your email address first.",
            ])
        }
        try await supabase.auth.resetPasswordForEmail(
            trimmed,
            redirectTo: URL(string: "https://mybooklab.app/reset-password")
        )
    }

    /// Turns Supabase's raw auth errors into something a parent can act on.
    /// The catch-all used to be "Check your credentials", which is simply
    /// wrong for an unconfirmed account — that user's password is fine,
    /// they just never clicked the link, and telling them otherwise sends
    /// them round in circles.
    static func friendlyAuthMessage(_ error: Error, signingUp: Bool) -> String {
        let msg = error.localizedDescription.lowercased()

        if msg.contains("not confirmed") || msg.contains("email_not_confirmed") {
            return "Please confirm your email first — check your inbox for the link we sent."
        }
        if msg.contains("invalid login") || msg.contains("invalid_credentials") {
            return "That email and password don't match. Try again, or reset your password."
        }
        if msg.contains("rate limit") || msg.contains("only request this after")
            || msg.contains("too many") {
            return "Too many attempts just now. Please wait a minute and try again."
        }
        if msg.contains("password") && msg.contains("6") {
            return "Passwords need to be at least 6 characters."
        }
        if msg.contains("network") || msg.contains("offline")
            || msg.contains("internet connection") {
            return "Can't reach the internet. Check your connection and try again."
        }
        return signingUp
            ? "Couldn't create your account. Please try again."
            : "Couldn't sign in. Please try again."
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
    /// bearer-token error. It now ALSO uploads to Storage and records the
    /// URL on `user_inventory`, so the avatar follows the account to the
    /// web and to a second device instead of being stuck on this one.
    /// The local copy is kept so the picture appears instantly and still
    /// shows if the upload fails.
    func updateAvatar(_ image: UIImage) async throws {
        let resized = image.resizedSquare(to: 256)
        guard let jpeg = resized.jpegData(compressionQuality: 0.85) else {
            throw NSError(domain: "AuthStore", code: -3,
                          userInfo: [NSLocalizedDescriptionKey: "Couldn't encode avatar"])
        }
        let dataURL = "data:image/jpeg;base64,\(jpeg.base64EncodedString())"
        UserDefaults.standard.set(dataURL, forKey: avatarDefaultsKey)
        storedAvatar = dataURL   // observable → views refresh instantly

        // Best-effort: a storage or network blip must not lose the avatar
        // the user just picked, which is already saved locally above.
        if let url = try? await IllustrationUploader.upload(resized, kind: "avatar") {
            try? await saveRemoteAvatar(url)
            UserDefaults.standard.set(url, forKey: avatarDefaultsKey)
            storedAvatar = url
        }
    }

    /// Writes the avatar URL to `user_inventory`. Column privileges let a
    /// client set only this field — owned styles/items stay server-owned.
    private func saveRemoteAvatar(_ url: String) async throws {
        guard let userId = user?.id else { return }
        struct InventoryUpsert: Encodable {
            let user_id: String
            let avatar_url: String
        }
        try await supabase
            .from("user_inventory")
            .upsert(
                InventoryUpsert(user_id: userId.uuidString.lowercased(), avatar_url: url),
                onConflict: "user_id"
            )
            .execute()
    }

    /// Adopt an avatar URL discovered on another device.
    func adoptRemoteAvatar(_ url: String) {
        guard storedAvatar != url else { return }
        UserDefaults.standard.set(url, forKey: avatarDefaultsKey)
        storedAvatar = url
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

        let session: Session
        do {
            session = try await supabase.auth.signInWithIdToken(
                credentials: .init(provider: .apple, idToken: identityToken, nonce: nonce)
            )
        } catch {
            // Apple sets the token's `aud` to this app's bundle id. Supabase
            // rejects it unless that id is listed under the Apple provider's
            // Client IDs, and the raw message ("Unacceptable audience in
            // id_token") means nothing to a parent staring at a phone.
            if error.localizedDescription.localizedCaseInsensitiveContains("audience") {
                throw NSError(domain: "AuthStore", code: -4, userInfo: [
                    NSLocalizedDescriptionKey:
                        "Sign in with Apple isn't set up yet. Please use email or Google for now.",
                ])
            }
            throw error
        }

        self.session = session
        self.user = session.user

        // Apple sends the user's name ONLY on the very first authorization
        // and never again, so if we don't persist it here it's lost for
        // good and the account shows no display name.
        if let name = credential.fullName {
            let parts = [name.givenName, name.familyName].compactMap { $0 }
            let full = parts.joined(separator: " ").trimmingCharacters(in: .whitespaces)
            let existing = session.user.userMetadata["display_name"]?.stringValue ?? ""
            if !full.isEmpty && existing.isEmpty {
                try? await updateDisplayName(full)
            }
        }
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
//
// This must NOT be `nonisolated` with a DispatchQueue.main.sync hop.
// signInWithGoogle() starts the session from the main actor, and
// ASWebAuthenticationSession calls back for its anchor on the main
// thread — so dispatching *synchronously* to main from main deadlocked
// the app the moment anyone tapped Sign in with Google.
//
// AuthStore is already @MainActor, so this satisfies the (main-actor
// bound) protocol requirement directly, with no hop at all.
extension AuthStore: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow } ?? UIWindow()
    }
}

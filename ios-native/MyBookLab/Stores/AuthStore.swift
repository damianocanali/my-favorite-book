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

    /// The cached access token, possibly EXPIRED. Never send it to the API:
    /// Supabase access tokens last about an hour, and an iPad that slept
    /// through that sent a dead JWT with every call (401 → "Something went
    /// wrong" all over the teacher area). API calls use validAccessToken().
    /// Kept only for synchronous "is anyone signed in with a token" checks.
    var accessToken: String? { session?.accessToken }

    /// A usable access token for an API call, refreshed first if it has
    /// expired (the SDK's `session` getter refreshes an expired session and
    /// dedupes concurrent refreshes).
    ///
    /// nil when nobody is signed in or the session is gone for good (the SDK
    /// then emits signedOut and the listener in bootstrap() clears the user).
    /// On a transient failure (offline, a 5xx from the auth server) the user
    /// is NOT signed out, same rule as bootstrap(): the cached token is
    /// returned instead, so the call fails with its real network error — or
    /// gets its one 401 retry in APIClient — rather than silently doing
    /// nothing and leaving a screen spinning.
    func validAccessToken() async -> String? {
        guard session != nil || supabase.auth.currentSession != nil else { return nil }
        do {
            let fresh = try await supabase.auth.session
            adopt(fresh)
            return fresh.accessToken
        } catch {
            if Self.sessionIsGone(error) { return nil }
            return session?.accessToken
        }
    }

    /// What a refresh after a 401 came to.
    enum RefreshOutcome: Sendable {
        /// A new token to retry with.
        case fresh(String)
        /// The session can never work again (missing, or its refresh token
        /// refused): only signing in again helps.
        case gone
        /// The refresh itself failed for a passing reason (offline, auth
        /// 5xx, 429). The session may be fine; report a network failure.
        case transient(Error)
    }

    /// Called by APIClient after the server answered 401 to `rejected`.
    /// Another call may already have refreshed the session meanwhile — then
    /// its token is used as is, rather than rotating the refresh token again.
    /// Otherwise the session is refreshed now.
    func tokenAfterUnauthorized(rejected: String) async -> RefreshOutcome {
        if let current = supabase.auth.currentSession,
           current.accessToken != rejected, !current.isExpired {
            adopt(current)
            return .fresh(current.accessToken)
        }
        do {
            let fresh = try await supabase.auth.refreshSession()
            adopt(fresh)
            return fresh.accessToken == rejected ? .gone : .fresh(fresh.accessToken)
        } catch {
            return Self.sessionIsGone(error) ? .gone : .transient(error)
        }
    }

    /// Keeps the cached session in step with a refreshed one. `user` is only
    /// replaced when it is a different person — a refresh must not make every
    /// view that reads the user re-render.
    private func adopt(_ fresh: Session) {
        guard fresh.accessToken != session?.accessToken else { return }
        session = fresh
        if user?.id != fresh.user.id { user = fresh.user }
    }

    /// The SDK only starts its background token refresh on a
    /// didBecomeActive notification observed AFTER the client exists — and
    /// AuthStore.shared is created after launch's first one, so without this
    /// the refresher never ran until the app had been backgrounded once.
    /// Wired to scenePhase in MyBookLabApp.
    ///
    /// Serialized, latest wins: a fast active → inactive → active flip must
    /// not end with the refresher stopped. Each call waits for the previous
    /// one and does nothing if a newer call has superseded it. The SDK's own
    /// start/stop each hop through an unstructured Task, so their order
    /// isn't guaranteed either; the wanted state is therefore applied again
    /// once things have settled (both calls are idempotent).
    func setAutoRefresh(active: Bool) {
        wantsAutoRefresh = active
        let previous = autoRefreshTask
        autoRefreshTask = Task { [weak self] in
            await previous?.value
            for pass in 0..<2 {
                if pass == 1 { try? await Task.sleep(for: .milliseconds(300)) }
                guard let self, self.wantsAutoRefresh == active else { return }
                if active {
                    await self.supabase.auth.startAutoRefresh()
                } else {
                    await self.supabase.auth.stopAutoRefresh()
                }
            }
        }
    }

    @ObservationIgnored private var wantsAutoRefresh = false
    @ObservationIgnored private var autoRefreshTask: Task<Void, Never>?

    /// A child signed in through their class (picture password). Read from
    /// `app_metadata` ONLY: that is set by the server's service role and a
    /// user can't write it. `user_metadata` is user-writable, so trusting it
    /// here would let anyone mark themselves a student — or, worse, let a
    /// student clear the flag and get the adult treatment (Face ID save,
    /// shop, grown-up screens).
    var isStudent: Bool {
        user?.appMetadata["role"]?.stringValue == "student"
    }

    /// A teacher account. UI-only, same as the web's selectIsTeacher:
    /// `user_metadata` is user-writable, so this may decide whether a link
    /// is shown but never whether a request succeeds — the server re-checks
    /// class ownership on every classroom endpoint.
    var isTeacher: Bool {
        guard let user, !isStudent else { return false }
        return user.userMetadata["role"]?.stringValue == "teacher"
            || user.userMetadata["classroom"]?.boolValue == true
    }

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
            // No active session — fine, user just needs to sign in. But if
            // the session is really gone (missing, or its refresh token was
            // rejected) the last person's check-ins, owned items and rewards
            // are still on the device, and the next sign-in may be someone
            // else — a child's class sign-in on the family iPad, whose
            // inventory would otherwise be unioned with the parent's.
            // Anything else (offline, a 5xx, a decoding hiccup) keeps the
            // data: check-in history exists only on this device, and a parent
            // must not lose it because the wifi dropped at launch.
            session = nil
            user = nil
            if Self.sessionIsGone(error) { clearLocalUserData() }
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
                    // Never for a student: the saved login belongs to whoever
                    // chose "remember me" (usually a parent), and overwriting
                    // it with a child's class session would hand the parent's
                    // Face ID button to the child's account.
                    if change.session != nil, !self.isStudent,
                       BiometricCredentials.hasStoredCredentials {
                        self.saveBiometricLogin()
                    }
                }
            }
        }
    }

    /// True only for errors meaning the stored session can never work again:
    /// no session at all, or the auth server refusing it with a 4xx (an
    /// invalid or revoked refresh token). A 429 is "try later", not "gone".
    private static func sessionIsGone(_ error: Error) -> Bool {
        guard let authError = error as? AuthError else { return false }
        switch authError {
        case .sessionMissing:
            return true
        case .api(_, _, _, let response):
            return (400..<500).contains(response.statusCode) && response.statusCode != 429
        default:
            return false
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
        // Class iPads are shared: a child's session must never outlive them
        // behind somebody's Face ID.
        guard let session, !isStudent, BiometricCredentials.isAvailable else { return }
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
            do {
                try await signIn(email: email, password: password)
            } catch {
                // The password changed elsewhere, so this item can never
                // work again. Report it as expired rather than letting the
                // caller guess from the error text — that guess only worked
                // in English.
                BiometricCredentials.clear()
                throw BiometricLoginError.expired
            }
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
    func signUp(email: String, password: String, displayName: String?,
                role: String? = nil) async throws -> SignUpOutcome {
        var data: [String: AnyJSON] = [:]
        if let displayName, !displayName.isEmpty {
            data["display_name"] = .string(displayName)
        }
        // "teacher" from the Teacher sign-up, matching the web's /signup
        // role toggle. UI hint only — see isTeacher.
        if let role { data["role"] = .string(role) }
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
            return String(appLocalized: AppText("auth.error.not_confirmed", defaultValue: "Please confirm your email first — check your inbox for the link we sent."))
        }
        if msg.contains("invalid login") || msg.contains("invalid_credentials") {
            return String(appLocalized: AppText("auth.error.invalid_credentials", defaultValue: "That email and password don't match. Try again, or reset your password."))
        }
        if msg.contains("rate limit") || msg.contains("only request this after")
            || msg.contains("too many") {
            return String(appLocalized: AppText("auth.error.rate_limited", defaultValue: "Too many attempts just now. Please wait a minute and try again."))
        }
        if msg.contains("password") && msg.contains("6") {
            return String(appLocalized: AppText("auth.error.password_short", defaultValue: "Passwords need to be at least 6 characters."))
        }
        if msg.contains("network") || msg.contains("offline")
            || msg.contains("internet connection") {
            return String(appLocalized: AppText("auth.error.offline", defaultValue: "Can't reach the internet. Check your connection and try again."))
        }
        return signingUp
            ? String(appLocalized: AppText("auth.error.signup_failed", defaultValue: "Couldn't create your account. Please try again."))
            : String(appLocalized: AppText("auth.error.signin_failed", defaultValue: "Couldn't sign in. Please try again."))
    }

    func signOut() async {
        // Everything this device keeps about the outgoing person goes BEFORE
        // the session does — class iPads and family iPads are shared, and
        // the next person must not see the last one's books, draft, feelings
        // or picture. Matches clearLocalUserData() in the web's useAuthStore.
        //
        // A teacher's push token is forgotten first, while the session can
        // still authorize the DELETE: the next person on this iPad must not
        // get their alerts. Bounded to a few seconds; a class account never
        // registered one.
        if !isStudent { await PushRegistrar.shared.forget() }
        TeacherStore.shared.reset()
        TeacherNotificationsStore.shared.clear()
        clearLocalUserData()

        if isStudent {
            // A class session is never kept for Face ID. Local scope ends
            // this device's session only, so the child stays signed in on
            // the other class iPad they may be using.
            try? await supabase.auth.signOut(scope: .local)
        } else if BiometricCredentials.hasStoredCredentials {
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
        storedAvatar = nil
    }

    /// Per-person data held on this device. Some of it was already dropped
    /// by MyBookLabApp's `onChange(of: auth.user?.id)` — but that fires
    /// after the fact and can coalesce an A → nil → B switch into A → B,
    /// and the draft and inventory were never cleared at all.
    ///
    /// Deliberately KEPT across a class account's sign-out (owner ruling):
    /// worksheet drafts (WorksheetDrafts) and "seen" assignment markers
    /// (AssignmentSeen). Both are keyed by the child's user id, pruned on
    /// every assignments load, and unreadable by anyone else — so autosave
    /// survives a shared class iPad changing hands. Device-level settings
    /// (class device, language, music, App Attest key) also stay.
    ///
    /// Deliberately NOT cleared: on-device illustrations (IllustrationStore).
    /// The cloud copy of a book holds only "[saved-locally]" markers, so
    /// deleting them would destroy the owner's pictures for good; they are
    /// keyed by book id and unreachable without that person's book rows.
    private func clearLocalUserData() {
        // Feelings are per-child and never leave the device.
        CheckInStore.shared.clear()
        BookshelfStore.shared.clear()
        BookDraftStore.shared.clear()
        CoinsStore.shared.clearLocal()
        RewardsStore.shared.clearLocal()
        // The avatar may be a photo-derived picture of a child. It is also
        // saved to user_inventory, and CoinsStore.loadInventory adopts it
        // back on the next sign-in.
        if user != nil {
            UserDefaults.standard.removeObject(forKey: avatarDefaultsKey)
        }
        storedAvatar = nil
    }

    /// Children's class sign-in. api/school/sign-in has already checked the
    /// picture password and handed back a session for the student's account.
    ///
    /// Whoever was signed in goes first — a parent's session or the previous
    /// child's — with the full signOut(), so their local data is gone before
    /// the new session lands rather than whenever the auth listener gets to
    /// it. Never offers or writes a Face ID login (see saveBiometricLogin).
    func signInAsStudent(accessToken: String, refreshToken: String) async throws {
        if isSignedIn { await signOut() }
        // Unconditionally, not only when someone was signed in: a session
        // that went stale leaves nobody signed in in memory but the previous
        // person's draft, badges and owned items still on the device, and
        // CoinsStore.loadInventory would union those into the child's.
        clearLocalUserData()
        let s = try await supabase.auth.setSession(
            accessToken: accessToken, refreshToken: refreshToken
        )
        self.session = s
        self.user = s.user
        loadStoredAvatar()
        // RevenueCat is not logged out by signOut(), so it may still hold the
        // previous parent's customer and cached entitlements. A class account
        // never reads them and never buys anything; drop the identity now.
        await SubscriptionStore.shared.enterStudentMode()
    }

    /// Records that this account runs a classroom, so the Classroom
    /// dashboard shows up. Same flag the web sets (markClassroomOwner).
    func markClassroomOwner() async {
        guard user != nil, !isStudent, !isTeacher else { return }
        if let updated = try? await supabase.auth.update(
            user: UserAttributes(data: ["classroom": .bool(true)])
        ) {
            self.user = updated
        }
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

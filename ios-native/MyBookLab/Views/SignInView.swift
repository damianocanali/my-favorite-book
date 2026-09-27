// Modal sign-in. Presented from AccountView (and any gated action that
// requires auth). Cosmic-themed background matches the web landing.
//
// Opens on "Who's signing in?" — the same three doors as the web's /login:
// a child in a class (picture sign-in, ClassSignInView, full screen),
// a parent/family, or a teacher. The last choice is remembered
// (UserDefaults `signInWho`: kid | family | teacher, same values as the
// web) so a returning person lands straight on their own door, with
// "Not you? Choose again" to get back.
//
// Both OAuth flows are driven from AuthStore. The Apple button calls
// our native ASAuthorization flow directly (no SignInWithAppleButton
// overlay hack); the Google button opens the OAuth URL in an
// ASWebAuthenticationSession.
import SwiftUI
import AuthenticationServices

struct SignInView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var loading = false
    @State private var error: String?
    @State private var rememberWithBiometrics = true
    @State private var hasStoredCredentials = BiometricCredentials.hasStoredCredentials
    @State private var resetSent = false
    @AppStorage("signInWho") private var whoRaw: String = ""
    @State private var showingClass = false

    enum Mode { case signIn, signUp }

    enum Who: String { case kid, family, teacher }

    private var who: Who? { Who(rawValue: whoRaw) }

    var body: some View {
        ZStack {
            CosmicBackground()
                .ignoresSafeArea()
            ScrollView {
                Group {
                    switch who {
                    case nil: chooser
                    case .kid: kidDoor
                    case .family, .teacher: form
                    }
                }
                .padding(.vertical)
                .contentColumn(maxWidth: 360)
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Close") { dismiss() }.foregroundStyle(.white)
            }
        }
        .onChange(of: auth.isSignedIn) { _, signedIn in
            if signedIn {
                showingClass = false
                dismiss()
            }
        }
        .task {
            // A remembered child goes straight to their class screen. After
            // the sheet has landed: presenting a cover while the sheet is
            // still animating in is silently dropped.
            guard who == .kid else { return }
            try? await Task.sleep(for: .milliseconds(450))
            if who == .kid, !auth.isSignedIn { showingClass = true }
        }
        .fullScreenCover(isPresented: $showingClass) {
            ClassSignInView(onChooseAgain: chooseAgain)
                .environment(auth)
        }
    }

    // MARK: - Who's signing in?

    private func choose(_ choice: Who) {
        Haptics.tap()
        whoRaw = choice.rawValue
        mode = .signIn
        error = nil
        resetSent = false
        if choice == .kid { showingClass = true }
    }

    private func chooseAgain() {
        showingClass = false
        whoRaw = ""
        error = nil
    }

    private var chooser: some View {
        VStack(spacing: 16) {
            Image("AppLogo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 18))
                .shadow(color: .purple.opacity(0.4), radius: 16, y: 6)

            Text("Who's signing in?")
                .font(.system(.title, design: .rounded, weight: .bold))
                .foregroundStyle(.white)
                .accessibilityAddTraits(.isHeader)
                .padding(.bottom, 4)

            // The child's door is first and the loudest: it is the one a
            // six-year-old has to find without reading the other two.
            Button { choose(.kid) } label: {
                HStack(spacing: 12) {
                    Mascot(mood: .wave, size: 88)
                        .frame(width: 76)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("I'm in a class")
                            .font(.system(.title3, design: .rounded, weight: .heavy))
                        Text("For kids — sign in with your pictures")
                            .font(.subheadline)
                            .opacity(0.9)
                    }
                    .multilineTextAlignment(.leading)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.headline)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, minHeight: 128)
                .background(
                    LinearGradient(colors: [Color(red: 1.0, green: 0.55, blue: 0.3),
                                            Color(red: 0.93, green: 0.3, blue: 0.6),
                                            Color(red: 0.55, green: 0.3, blue: 0.95)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 24)
                )
                .shadow(color: .pink.opacity(0.35), radius: 14, y: 6)
                .contentShape(RoundedRectangle(cornerRadius: 24))
            }
            .buttonStyle(.plain)

            chooserCard(icon: "figure.2.and.child.holdinghands", tint: .cyan,
                        title: "Parent or family",
                        subtitle: "Write and save stories at home") { choose(.family) }

            chooserCard(icon: "graduationcap.fill", tint: .yellow,
                        title: "Teacher",
                        subtitle: "Set up and run your classroom") { choose(.teacher) }
        }
        .padding(.horizontal)
    }

    private func chooserCard(icon: String, tint: Color, title: LocalizedStringKey,
                             subtitle: LocalizedStringKey,
                             action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.system(size: 30))
                    .foregroundStyle(tint)
                    .frame(width: 56, height: 56)
                    .background(tint.opacity(0.15), in: RoundedRectangle(cornerRadius: 16))
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(.title3, design: .rounded, weight: .bold))
                        .foregroundStyle(.white)
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.7))
                }
                .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.headline)
                    .foregroundStyle(.white.opacity(0.5))
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: 120)
            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(.white.opacity(0.12)))
            .contentShape(RoundedRectangle(cornerRadius: 24))
        }
        .buttonStyle(.plain)
    }

    private var chooseAgainLink: some View {
        Button(action: chooseAgain) {
            Text("Not you? Choose again")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.75))
                .underline()
                .frame(minHeight: 44)
        }
    }

    /// Shown behind the class screen when a remembered child closes it, so
    /// the sheet isn't a dead end.
    private var kidDoor: some View {
        VStack(spacing: 18) {
            Mascot(mood: .wave, size: 120)
            SparkleButton(action: { showingClass = true }, size: .large) {
                Text("I'm in a class")
            }
            .padding(.horizontal)
            chooseAgainLink
        }
        .padding(.top, 24)
    }

    // MARK: - Parent / teacher form

    private var isTeacher: Bool { who == .teacher }

    private var title: LocalizedStringKey {
        switch (isTeacher, mode) {
        case (false, .signIn): "Welcome Back!"
        case (false, .signUp): "Create an Account"
        case (true, .signIn): "Sign in to your classroom"
        case (true, .signUp): "Create a teacher account"
        }
    }

    private var subtitle: LocalizedStringKey {
        switch (isTeacher, mode) {
        case (false, .signIn): "Sign in to sync your stories"
        case (false, .signUp): "Save and sync across devices"
        case (true, .signIn): "Manage your classes and students"
        case (true, .signUp): "Create classes and picture sign-in cards"
        }
    }

    private var form: some View {
                VStack(spacing: 18) {
                    Image("AppLogo")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 72, height: 72)
                        .clipShape(RoundedRectangle(cornerRadius: 20))
                        .shadow(color: .purple.opacity(0.4), radius: 16, y: 6)

                    VStack(spacing: 4) {
                        Text(title)
                            .font(.system(.title, design: .rounded, weight: .bold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.center)
                        Text(subtitle)
                            .foregroundStyle(.white.opacity(0.7))
                            .font(.subheadline)
                            .multilineTextAlignment(.center)
                    }

                    // Face ID quick sign-in — only when the user has
                    // previously chosen to remember their login.
                    if mode == .signIn && hasStoredCredentials && BiometricCredentials.isAvailable {
                        Button(action: { Task { await signInBiometric() } }) {
                            HStack(spacing: 8) {
                                Image(systemName: biometricIcon)
                                Text("Sign in with \(BiometricCredentials.biometryLabel)").bold()
                            }
                            .frame(maxWidth: .infinity)
                            .padding(14)
                            .background(.purple, in: RoundedRectangle(cornerRadius: 14))
                            .foregroundStyle(.white)
                        }
                        .disabled(loading)
                        .padding(.horizontal)
                    }

                    // Apple + Google up top — they're the fastest path for
                    // most users; email is below as the fallback.
                    VStack(spacing: 10) {
                        Button(action: { Task { await signInApple() } }) {
                            HStack(spacing: 8) {
                                Image(systemName: "apple.logo")
                                Text("Continue with Apple").bold()
                            }
                            .frame(maxWidth: .infinity)
                            .padding(14)
                            .background(.black, in: RoundedRectangle(cornerRadius: 14))
                            .foregroundStyle(.white)
                        }
                        Button(action: { Task { await signInGoogle() } }) {
                            HStack(spacing: 8) {
                                Text("G").font(.headline.bold()).foregroundStyle(.blue)
                                Text("Continue with Google").bold()
                            }
                            .frame(maxWidth: .infinity)
                            .padding(14)
                            .background(.white, in: RoundedRectangle(cornerRadius: 14))
                            .foregroundStyle(.black)
                        }
                    }
                    .disabled(loading)
                    .padding(.horizontal)

                    HStack {
                        Rectangle().fill(.white.opacity(0.2)).frame(height: 1)
                        Text("or").font(.caption).foregroundStyle(.white.opacity(0.6))
                        Rectangle().fill(.white.opacity(0.2)).frame(height: 1)
                    }
                    .padding(.horizontal)

                    VStack(spacing: 12) {
                        if mode == .signUp {
                            TextField("", text: $displayName, prompt: Text("Your name").foregroundStyle(.white.opacity(0.4)))
                                .textInputAutocapitalization(.words)
                                .padding(12)
                                .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                                .foregroundStyle(.white)
                        }
                        TextField("", text: $email, prompt: Text("Email").foregroundStyle(.white.opacity(0.4)))
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .padding(12)
                            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(.white)
                        SecureField("", text: $password, prompt: Text("Password").foregroundStyle(.white.opacity(0.4)))
                            .textContentType(mode == .signIn ? .password : .newPassword)
                            .padding(12)
                            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(.white)

                        if BiometricCredentials.isAvailable {
                            Toggle(isOn: $rememberWithBiometrics) {
                                HStack(spacing: 6) {
                                    Image(systemName: biometricIcon)
                                    Text("Remember me with \(BiometricCredentials.biometryLabel)")
                                        .font(.caption)
                                }
                                .foregroundStyle(.white.opacity(0.8))
                            }
                            .tint(.purple)
                        }

                        SparkleButton(action: { Task { await submitEmail() } }) {
                            HStack {
                                if loading { ProgressView().tint(.white) }
                                Text(loading
                                     ? (mode == .signIn ? "Signing in…" : "Creating account…")
                                     : (mode == .signIn ? "Sign In" : "Create Account"))
                            }
                        }
                        .disabled(loading || email.isEmpty || password.isEmpty)

                        // There was no way to recover an account from the
                        // app at all — the only route was the website.
                        if mode == .signIn {
                            Button {
                                Task { await sendPasswordReset() }
                            } label: {
                                Text("Forgot your password?")
                                    .font(.footnote)
                                    .foregroundStyle(.white.opacity(0.7))
                            }
                            .disabled(loading)
                            .padding(.top, 2)
                        }
                    }
                    .padding(.horizontal)

                    if resetSent {
                        Text("Check your email for a link to reset your password.")
                            .font(.footnote)
                            .foregroundStyle(.green.opacity(0.9))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }

                    if let error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red.opacity(0.9))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }

                    Button {
                        mode = (mode == .signIn) ? .signUp : .signIn
                        self.error = nil
                        self.resetSent = false
                    } label: {
                        Text(mode == .signIn
                             ? (isTeacher ? "New teacher? Create an account" : "New here? Create an account")
                             : "Already have an account? Sign in")
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.7))
                    }
                    .padding(.top, 8)

                    chooseAgainLink
                }
    }

    private var biometricIcon: String {
        switch BiometricCredentials.biometryLabel {
        case "Face ID": return "faceid"
        case "Touch ID": return "touchid"
        case "Optic ID": return "opticid"
        default: return "lock.shield"
        }
    }

    private func submitEmail() async {
        loading = true; error = nil
        defer { loading = false }
        do {
            if mode == .signIn {
                try await auth.signIn(email: email, password: password)
                if isTeacher { await auth.markClassroomOwner() }
                // Offer remembered login: save the session tokens (not
                // the password) behind biometrics so next time is a
                // one-tap Face ID sign-in.
                if rememberWithBiometrics {
                    auth.saveBiometricLogin()
                }
            } else {
                let outcome = try await auth.signUp(
                    email: email, password: password, displayName: displayName,
                    role: isTeacher ? "teacher" : nil
                )
                switch outcome {
                case .confirmationSent:
                    error = "Check your email to confirm your account."
                case .active:
                    error = nil
                case .alreadyRegistered:
                    // No email was sent, so don't send them to their inbox.
                    mode = .signIn
                    error = "That email already has an account — sign in instead."
                }
            }
        } catch {
            self.error = AuthStore.friendlyAuthMessage(error, signingUp: mode == .signUp)
        }
    }

    private func sendPasswordReset() async {
        loading = true; error = nil; resetSent = false
        defer { loading = false }
        do {
            try await auth.sendPasswordReset(email: email)
            resetSent = true
            error = nil
        } catch {
            self.error = AuthStore.friendlyAuthMessage(error, signingUp: false)
        }
    }

    private func signInBiometric() async {
        loading = true; error = nil
        defer { loading = false }
        do {
            try await auth.signInWithStoredCredentials()
            if isTeacher { await auth.markClassroomOwner() }
        } catch is AuthStore.BiometricLoginError {
            // Tokens revoked/expired, or a legacy password item that no
            // longer works — AuthStore already cleared the Keychain.
            hasStoredCredentials = false
            self.error = "Saved login is out of date. Please sign in with your password."
        } catch BiometricCredentials.RetrieveError.cancelled {
            // They dismissed the prompt on purpose. Not an error.
            self.error = nil
        } catch BiometricCredentials.RetrieveError.notFound {
            // Nothing stored, or the item was invalidated because the
            // device's enrolled biometrics changed. Stop offering it.
            hasStoredCredentials = false
            self.error = "Saved login is out of date. Please sign in with your password."
        } catch {
            self.error = "\(BiometricCredentials.biometryLabel) sign-in failed."
        }
    }

    private func signInApple() async {
        loading = true; error = nil
        defer { loading = false }
        do {
            try await auth.signInWithApple()
            if isTeacher { await auth.markClassroomOwner() }
            // Token-based storage means Face ID re-login works for
            // OAuth accounts too — honor the same remember toggle.
            if rememberWithBiometrics { auth.saveBiometricLogin() }
        } catch {
            self.error = "Apple sign-in failed: \(error.localizedDescription)"
        }
    }

    private func signInGoogle() async {
        loading = true; error = nil
        defer { loading = false }
        do {
            try await auth.signInWithGoogle()
            if isTeacher { await auth.markClassroomOwner() }
            if rememberWithBiometrics { auth.saveBiometricLogin() }
        } catch {
            self.error = "Google sign-in failed: \(error.localizedDescription)"
        }
    }
}

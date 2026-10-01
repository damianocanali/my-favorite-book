// Sign-in, rendered in place — never presented. Signed out, it is the app's
// root (MyBookLabApp's AppRootView); for a guest who chose "Explore first"
// it is the Account tab's content. No sheet and no cover: on iPad a tap
// outside a sheet dismissed it and everything typed was lost, and a cover
// still read as a modal. Nothing in this flow can be swiped or tapped away;
// every exit is a button, and a Back that would throw away typed text asks
// first.
//
// Where it opens:
//   - a class iPad (ClassDeviceStore) with nobody signed in: that class's
//     name list, with a "Not in <class>?" link to the welcome screen;
//   - otherwise the welcome screen: three doors (student, family, teacher)
//     and a quiet "Explore first", because signed-out people can use the
//     app as a guest (bookshelf, create) and that stays.
//
// Nothing about "who" is remembered between sign-ins. The old flow saved
// the last door and the last class code, so after any sign-out the next
// person on a shared iPad landed in someone else's flow.
//
// Both OAuth flows are driven from AuthStore. The Apple button calls our
// native ASAuthorization flow directly; the Google button opens the OAuth
// URL in an ASWebAuthenticationSession.
import SwiftUI
import AuthenticationServices

struct SignInFlowView: View {
    @Environment(AppRouter.self) private var router
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    typealias Door = SignInDoor

    /// Inside the Account tab (a guest's inline sign-in) rather than the
    /// app's root: the tab already has its background and is the guest's
    /// way to keep exploring, so no "Explore first".
    var embedded = false

    private var classDevice: ClassDevice? { ClassDeviceStore.shared.device }

    var body: some View {
        // Screen state lives in AppRouter, so the language switch (which
        // rebuilds this view) keeps it.
        @Bindable var router = router
        ZStack {
            if !embedded { CosmicBackground().ignoresSafeArea() }
            Group {
                switch router.signInDoor {
                case .student:
                    ClassSignInView(mode: .open, onExit: { router.signInDoor = nil })
                case .family:
                    AccountSignInForm(isTeacher: false, onBack: { router.signInDoor = nil })
                case .teacher:
                    AccountSignInForm(isTeacher: true, onBack: { router.signInDoor = nil })
                case nil:
                    if let classDevice, !router.signInWelcomeOverClass {
                        ClassSignInView(mode: .device(classDevice),
                                        onExit: { router.signInWelcomeOverClass = true })
                            // A fresh class list whenever it comes back.
                            .id(classDevice.classId)
                    } else {
                        WelcomeDoorsView(
                            onChoose: { router.signInDoor = $0 },
                            onBackToClass: classDevice == nil ? nil : { router.signInWelcomeOverClass = false },
                            onExplore: embedded ? nil : { router.exploreAsGuest() })
                    }
                }
            }
            .transition(.opacity)
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: router.signInDoor)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: router.signInWelcomeOverClass)
    }
}

/// The top bar every sign-in screen shares: Back first, so VoiceOver (and
/// a reader's eye) meets it before anything else, rather than an overlay
/// read last. An empty bar keeps the same height.
struct SignInTopBar: View {
    var onBack: (() -> Void)?
    /// The language menu, top-trailing: on the screens someone meets
    /// before choosing anything (welcome, a class iPad's name list).
    var showsLanguage = false

    var body: some View {
        HStack(spacing: 12) {
            if let onBack { SignInBackButton(action: onBack) }
            Spacer(minLength: 0)
            if showsLanguage { LanguageMenu() }
        }
        .frame(minHeight: 48)
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
}

// MARK: - Welcome: three doors

private struct WelcomeDoorsView: View {
    var onChoose: (SignInFlowView.Door) -> Void
    /// Set on a class iPad: Back returns to the class's name list.
    var onBackToClass: (() -> Void)?
    /// nil inside the Account tab (see SignInFlowView.embedded).
    var onExplore: (() -> Void)?

    @Environment(\.horizontalSizeClass) private var hSize
    private var regular: Bool { hSize == .regular }

    var body: some View {
        VStack(spacing: 0) {
            // Before choosing a door: someone who can't read English has to
            // be able to find Italian first — top-trailing, out of the doors'
            // column.
            SignInTopBar(onBack: onBackToClass, showsLanguage: true)
            ScrollView { content }
        }
    }

    private var content: some View {
            VStack(spacing: regular ? 20 : 16) {
                Image("AppLogo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: regular ? 88 : 72, height: regular ? 88 : 72)
                    .clipShape(RoundedRectangle(cornerRadius: 20))
                    .shadow(color: .purple.opacity(0.4), radius: 16, y: 6)
                    .accessibilityHidden(true)

                Text(SignInCopy.welcomeTitle)
                    .font(.system(regular ? .largeTitle : .title, design: .rounded, weight: .bold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)
                    .padding(.bottom, 4)

                // The student's door is first and the loudest: it is the one a
                // six-year-old has to find without reading the other two.
                Button { Haptics.tap(); onChoose(.student) } label: {
                    HStack(spacing: 14) {
                        Mascot(mood: .wave, size: regular ? 104 : 88)
                            .frame(width: regular ? 92 : 76)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(SignInCopy.doorStudent)
                                .font(.system(regular ? .title : .title2, design: .rounded, weight: .heavy))
                            Text(SignInCopy.doorStudentHint)
                                .font(.callout)
                                .opacity(0.9)
                        }
                        .multilineTextAlignment(.leading)
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right").font(.title3.weight(.bold))
                            .accessibilityHidden(true)
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                    .frame(maxWidth: .infinity, minHeight: regular ? 150 : 128)
                    .background(
                        LinearGradient(colors: [Color(red: 1.0, green: 0.55, blue: 0.3),
                                                Color(red: 0.93, green: 0.3, blue: 0.6),
                                                Color(red: 0.55, green: 0.3, blue: 0.95)],
                                       startPoint: .topLeading, endPoint: .bottomTrailing),
                        in: RoundedRectangle(cornerRadius: 26)
                    )
                    .shadow(color: .pink.opacity(0.35), radius: 14, y: 6)
                    .contentShape(RoundedRectangle(cornerRadius: 26))
                }
                .buttonStyle(.plain)

                doorCard(icon: "figure.2.and.child.holdinghands", tint: .cyan,
                         title: SignInCopy.doorFamily, subtitle: SignInCopy.doorFamilyHint) { onChoose(.family) }

                doorCard(icon: "graduationcap.fill", tint: .yellow,
                         title: SignInCopy.doorTeacher, subtitle: SignInCopy.doorTeacherHint) { onChoose(.teacher) }

                // Not on a class iPad: its way out is the class list, not
                // guest browsing on the classroom's device.
                if onBackToClass == nil, let onExplore {
                    Button(action: onExplore) {
                        Text(SignInCopy.exploreFirst)
                            .font(.callout)
                            .foregroundStyle(.white.opacity(0.7))
                            .underline()
                            .frame(minWidth: 120, minHeight: 48)
                    }
                    .padding(.top, 4)
                }
            }
            .padding(.horizontal)
            .padding(.top, 8)
            .padding(.bottom, 24)
            .contentColumn(maxWidth: 520)
    }

    private func doorCard(icon: String, tint: Color, title: LocalizedStringResource,
                          subtitle: LocalizedStringResource,
                          action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.system(size: 30))
                    .foregroundStyle(tint)
                    .frame(width: 60, height: 60)
                    .background(tint.opacity(0.15), in: RoundedRectangle(cornerRadius: 16))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(regular ? .title2 : .title3, design: .rounded, weight: .bold))
                        .foregroundStyle(.white)
                    Text(subtitle)
                        .font(.callout)
                        .foregroundStyle(.white.opacity(0.75))
                }
                .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.headline)
                    .foregroundStyle(.white.opacity(0.5))
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity, minHeight: regular ? 124 : 112)
            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(.white.opacity(0.12)))
            .contentShape(RoundedRectangle(cornerRadius: 24))
        }
        .buttonStyle(.plain)
    }
}

/// The language switch: a small globe menu ("English ▾" / "Italiano ▾"),
/// each language named in its own language. Its label never wraps; at the
/// accessibility text sizes it is the globe alone (VoiceOver still hears
/// "Language, English"). Switching is live, behind the root's "Changing
/// language…" overlay.
struct LanguageMenu: View {
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let current = AppLanguage.uiLanguage
        let currentName = AppLanguage.supported.first { $0.code == current }?.name ?? current
        Menu {
            Picker(selection: Binding(
                get: { current },
                set: { code in
                    guard code != current else { return }
                    AppLanguage.choose(code)
                }
            )) {
                ForEach(AppLanguage.supported, id: \.code) { lang in
                    // Verbatim: a language's own name is never translated.
                    Text(verbatim: lang.name).tag(lang.code)
                }
            } label: {
                Text("Language")
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "globe")
                if !typeSize.isAccessibilitySize {
                    Text(verbatim: currentName)
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.bold))
                }
            }
            .font(.system(.subheadline, design: .rounded, weight: .semibold))
            .lineLimit(1)
            .fixedSize()
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .frame(minWidth: 48, minHeight: 44)
            .background(.white.opacity(0.14), in: Capsule())
            .contentShape(Capsule())
        }
        .accessibilityLabel(Text("Language"))
        .accessibilityValue(Text(verbatim: currentName))
        // One switch at a time: the rebuild is under way.
        .disabled(AppLanguageState.shared.switching != nil)
    }
}

// MARK: - Shared pieces

/// A big, plain "‹ Back" for the top-left of every door.
struct SignInBackButton: View {
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: "chevron.left").font(.headline.weight(.bold))
                Text(SignInCopy.back).font(.system(.headline, design: .rounded))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .frame(minHeight: 48)
            .background(.white.opacity(0.14), in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

extension View {
    /// "Discard what you typed?" — only ever raised when there IS typed text.
    func discardTypedConfirmation(isPresented: Binding<Bool>, onDiscard: @escaping () -> Void) -> some View {
        alert(Text(SignInCopy.discardTitle), isPresented: isPresented) {
            Button(role: .destructive, action: onDiscard) { Text(SignInCopy.discardConfirm) }
            Button(role: .cancel) {} label: { Text(SignInCopy.discardKeep) }
        }
    }
}

// MARK: - Family / teacher: email, Apple, Google, Face ID

struct AccountSignInForm: View {
    let isTeacher: Bool
    var onBack: () -> Void

    @Environment(AuthStore.self) private var auth

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var displayName = ""
    @State private var loading = false
    @State private var error: String?
    /// Off by default on a class iPad: a grown-up signing in there must opt
    /// in to leaving a Face ID login on a shared classroom device.
    @State private var rememberWithBiometrics = ClassDeviceStore.shared.device == nil
    @State private var hasStoredCredentials = BiometricCredentials.hasStoredCredentials
    @State private var resetSent = false
    @State private var confirmingBack = false
    @FocusState private var focus: Field?

    enum Mode { case signIn, signUp }
    enum Field: Hashable { case name, email, password }

    private var hasInput: Bool { !email.isEmpty || !password.isEmpty || !displayName.isEmpty }

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

    var body: some View {
        VStack(spacing: 0) {
            SignInTopBar {
                if hasInput { confirmingBack = true } else { onBack() }
            }
            ScrollView {
                form
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                    .contentColumn(maxWidth: 420)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .discardTypedConfirmation(isPresented: $confirmingBack, onDiscard: onBack)
        // VoiceOver hears an inline error the moment it appears.
        .onChange(of: error) { _, message in
            if let message { AccessibilityNotification.Announcement(message).post() }
        }
    }

    private var fieldBackground: some ShapeStyle { .white.opacity(0.08) }

    private var form: some View {
        VStack(spacing: 18) {
            Image("AppLogo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 72, height: 72)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .shadow(color: .purple.opacity(0.4), radius: 16, y: 6)
                .accessibilityHidden(true)

            VStack(spacing: 4) {
                Text(title)
                    .font(.system(.title, design: .rounded, weight: .bold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)
                Text(subtitle)
                    .foregroundStyle(.white.opacity(0.7))
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
            }

            // Face ID quick sign-in — only when the user has previously
            // chosen to remember their login.
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

            // Apple + Google up top — they're the fastest path for most
            // users; email is below as the fallback.
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
                        .textContentType(.name)
                        .textInputAutocapitalization(.words)
                        .submitLabel(.next)
                        .focused($focus, equals: .name)
                        .onSubmit { focus = .email }
                        .padding(14)
                        .background(fieldBackground, in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)
                }
                TextField("", text: $email, prompt: Text("Email").foregroundStyle(.white.opacity(0.4)))
                    // .username, not .emailAddress: it's what pairs the field
                    // with the password below for Passwords/AutoFill.
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.next)
                    .focused($focus, equals: .email)
                    .onSubmit { focus = .password }
                    .padding(14)
                    .background(fieldBackground, in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.white)
                SecureField("", text: $password, prompt: Text("Password").foregroundStyle(.white.opacity(0.4)))
                    .textContentType(mode == .signIn ? .password : .newPassword)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.go)
                    .focused($focus, equals: .password)
                    .onSubmit {
                        guard canSubmit else { return }
                        Task { await submitEmail() }
                    }
                    .padding(14)
                    .background(fieldBackground, in: RoundedRectangle(cornerRadius: 12))
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
                .disabled(!canSubmit)

                // Inline, right under the form, and the typed text stays.
                if let error {
                    Text(error)
                        .font(.callout)
                        .foregroundStyle(Color(red: 1, green: 0.8, blue: 0.8))
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(12)
                        .background(.red.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
                        .accessibilityAddTraits(.updatesFrequently)
                }
                if resetSent {
                    Text("Check your email for a link to reset your password.")
                        .font(.footnote)
                        .foregroundStyle(.green.opacity(0.9))
                        .multilineTextAlignment(.center)
                }

                // There was no way to recover an account from the app at
                // all — the only route was the website.
                if mode == .signIn {
                    Button {
                        Task { await sendPasswordReset() }
                    } label: {
                        Text("Forgot your password?")
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.7))
                            .frame(minHeight: 44)
                    }
                    .disabled(loading)
                }
            }
            .padding(.horizontal)

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
                    .frame(minHeight: 44)
            }
        }
        .padding(.horizontal)
    }

    private var canSubmit: Bool { !loading && !email.isEmpty && !password.isEmpty }

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
                // Offer remembered login: save the session tokens (not the
                // password) behind biometrics so next time is a one-tap
                // Face ID sign-in.
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
                    error = String(appLocalized: AppText("auth.error.confirm_email", defaultValue: "Check your email to confirm your account."))
                case .active:
                    error = nil
                case .alreadyRegistered:
                    // No email was sent, so don't send them to their inbox.
                    mode = .signIn
                    error = String(appLocalized: AppText("auth.error.email_taken", defaultValue: "That email already has an account — sign in instead."))
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
            self.error = String(appLocalized: AppText("auth.error.saved_login_stale", defaultValue: "Saved login is out of date. Please sign in with your password."))
        } catch BiometricCredentials.RetrieveError.cancelled {
            // They dismissed the prompt on purpose. Not an error.
            self.error = nil
        } catch BiometricCredentials.RetrieveError.notFound {
            // Nothing stored, or the item was invalidated because the
            // device's enrolled biometrics changed. Stop offering it.
            hasStoredCredentials = false
            self.error = String(appLocalized: AppText("auth.error.saved_login_stale", defaultValue: "Saved login is out of date. Please sign in with your password."))
        } catch {
            self.error = String(appLocalized: AppText("auth.error.biometric_failed", defaultValue: "\(BiometricCredentials.biometryLabel) sign-in failed."))
        }
    }

    private func signInApple() async {
        loading = true; error = nil
        defer { loading = false }
        do {
            try await auth.signInWithApple()
            if isTeacher { await auth.markClassroomOwner() }
            // Token-based storage means Face ID re-login works for OAuth
            // accounts too — honor the same remember toggle.
            if rememberWithBiometrics { auth.saveBiometricLogin() }
        } catch {
            self.error = String(appLocalized: AppText("auth.error.apple_failed", defaultValue: "Apple sign-in failed: \(error.localizedDescription)"))
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
            self.error = String(appLocalized: AppText("auth.error.google_failed", defaultValue: "Google sign-in failed: \(error.localizedDescription)"))
        }
    }
}

// MARK: - Copy

/// Sign-in flow and class-iPad strings. Italian lives in
/// Localizable.xcstrings under the same keys.
enum SignInCopy {
    static var welcomeTitle: LocalizedStringResource { AppText("signin.welcome.title", defaultValue: "Who's signing in?") }
    static var doorStudent: LocalizedStringResource { AppText("signin.welcome.student", defaultValue: "I'm a student") }
    static var doorStudentHint: LocalizedStringResource { AppText("signin.welcome.student_hint", defaultValue: "Sign in with your pictures") }
    static var doorFamily: LocalizedStringResource { AppText("signin.welcome.family", defaultValue: "Family") }
    static var doorFamilyHint: LocalizedStringResource { AppText("signin.welcome.family_hint", defaultValue: "Write and save stories at home") }
    static var doorTeacher: LocalizedStringResource { AppText("signin.welcome.teacher", defaultValue: "Teacher") }
    static var doorTeacherHint: LocalizedStringResource { AppText("signin.welcome.teacher_hint", defaultValue: "Set up and run your classroom") }
    static var exploreFirst: LocalizedStringResource { AppText("signin.welcome.explore", defaultValue: "Explore first") }
    static var back: LocalizedStringResource { AppText("signin.back", defaultValue: "Back") }
    static var tryAgain: LocalizedStringResource { AppText("signin.try_again", defaultValue: "Try again") }
    static var discardTitle: LocalizedStringResource { AppText("signin.discard.title", defaultValue: "Discard what you typed?") }
    static var discardConfirm: LocalizedStringResource { AppText("signin.discard.confirm", defaultValue: "Discard") }
    static var discardKeep: LocalizedStringResource { AppText("signin.discard.keep", defaultValue: "Keep typing") }

    // Class iPad, child side. A class name is data, never translated.
    static func classBanner(_ name: String) -> LocalizedStringResource {
        AppText("signin.class_device.banner", defaultValue: "Class \(name)")
    }
    static func notInClass(_ name: String) -> LocalizedStringResource {
        AppText("signin.class_device.not_in", defaultValue: "Not in \(name)?")
    }
    static var deviceProblemHeading: LocalizedStringResource {
        AppText("signin.class_device.problem_heading", defaultValue: "We can't open your class right now")
    }
    static var deviceNetwork: LocalizedStringResource {
        AppText("signin.class_device.network", defaultValue: "We can't reach My Book Lab. Check the internet and try again.")
    }
    static func askOwner(_ name: String) -> LocalizedStringResource {
        AppText("classdevice.ask_owner", defaultValue: "Ask \(name)'s teacher to change this.")
    }
    static var saveFailed: LocalizedStringResource {
        AppText("classdevice.save_failed", defaultValue: "Couldn't set up this iPad. Please try again.")
    }
    static var deviceClassUnavailable: LocalizedStringResource {
        AppText("signin.class_device.unavailable", defaultValue: "This iPad's class isn't available — ask your teacher")
    }

    // Class iPad, teacher side.
    static var setUpThisIPad: LocalizedStringResource { AppText("classdevice.setup", defaultValue: "Set up this iPad for this class") }
    static func setUpFor(_ name: String) -> LocalizedStringResource {
        AppText("classdevice.status", defaultValue: "This iPad is set up for \(name)")
    }
    static var remove: LocalizedStringResource { AppText("classdevice.remove", defaultValue: "Remove class from this iPad") }
    static func confirmTitle(_ name: String) -> LocalizedStringResource {
        AppText("classdevice.confirm.title", defaultValue: "Set up this iPad for \(name)?")
    }
    static func confirmBody(_ name: String) -> LocalizedStringResource {
        AppText("classdevice.confirm.body", defaultValue: "When nobody is signed in, this iPad opens straight on \(name)'s name list. Children tap their name and pick their pictures — no class code to type. When a child signs out, it goes back to the list.")
    }
    static var confirmNote: LocalizedStringResource {
        AppText("classdevice.confirm.note", defaultValue: "Your own sign-in isn't affected. Only a teacher can remove the class from this iPad.")
    }
    static func confirmReplaces(_ name: String) -> LocalizedStringResource {
        AppText("classdevice.confirm.replaces", defaultValue: "This replaces \(name) on this iPad.")
    }
    static var confirmAction: LocalizedStringResource { AppText("classdevice.confirm.action", defaultValue: "Set up this iPad") }
    static func removeTitle(_ name: String) -> LocalizedStringResource {
        AppText("classdevice.remove_confirm.title", defaultValue: "Remove \(name) from this iPad?")
    }
    static var removeBody: LocalizedStringResource {
        AppText("classdevice.remove_confirm.body", defaultValue: "Children will need the class code to sign in on this iPad again.")
    }
    static var accountHeading: LocalizedStringResource { AppText("classdevice.account.heading", defaultValue: "Class iPad") }
    static var accountNone: LocalizedStringResource { AppText("classdevice.account.none", defaultValue: "This iPad isn't set up for a class.") }
    static var accountPick: LocalizedStringResource { AppText("classdevice.account.pick", defaultValue: "Set up this iPad for a class") }
    static var accountNoClasses: LocalizedStringResource { AppText("classdevice.account.no_classes", defaultValue: "Create a class first, in Classes.") }
    static var loadFailed: LocalizedStringResource { AppText("classdevice.account.load_failed", defaultValue: "Couldn't load your classes.") }
}

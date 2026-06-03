// Modal sign-in. Presented from AccountView (and any gated action that
// requires auth). Cosmic-themed background matches the web landing.
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

    enum Mode { case signIn, signUp }

    var body: some View {
        ZStack {
            CosmicBackground()
                .ignoresSafeArea()
            ScrollView {
                VStack(spacing: 24) {
                    Spacer().frame(height: 24)

                    Image("AppLogo")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 88, height: 88)
                        .clipShape(RoundedRectangle(cornerRadius: 20))
                        .shadow(color: .purple.opacity(0.4), radius: 16, y: 6)

                    VStack(spacing: 4) {
                        Text(mode == .signIn ? "Welcome Back!" : "Create an Account")
                            .font(.system(.title, design: .rounded, weight: .bold))
                            .foregroundStyle(.white)
                        Text(mode == .signIn ? "Sign in to sync your stories"
                                             : "Save and sync across devices")
                            .foregroundStyle(.white.opacity(0.7))
                            .font(.subheadline)
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
                    }
                    .padding(.horizontal)

                    if let error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red.opacity(0.9))
                            .padding(.horizontal)
                    }

                    Button {
                        mode = (mode == .signIn) ? .signUp : .signIn
                        self.error = nil
                    } label: {
                        Text(mode == .signIn
                             ? "New here? Create an account"
                             : "Already have an account? Sign in")
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.7))
                    }
                    .padding(.top, 8)

                    Spacer()
                }
                .padding(.vertical)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Close") { dismiss() }.foregroundStyle(.white)
            }
        }
        .onChange(of: auth.isSignedIn) { _, signedIn in
            if signedIn { dismiss() }
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
                // Offer remembered login: save credentials behind
                // biometrics so next time is a one-tap Face ID sign-in.
                if rememberWithBiometrics && BiometricCredentials.isAvailable {
                    try? BiometricCredentials.save(email: email, password: password)
                }
            } else {
                try await auth.signUp(email: email, password: password, displayName: displayName)
                error = "Check your email to confirm your account."
            }
        } catch {
            self.error = mode == .signIn
                ? "Couldn't sign in. Check your credentials."
                : "Couldn't create account: \(error.localizedDescription)"
        }
    }

    private func signInBiometric() async {
        loading = true; error = nil
        defer { loading = false }
        do {
            try await auth.signInWithStoredCredentials()
        } catch {
            // If the stored password no longer works (e.g. user changed
            // it elsewhere), clear it so the prompt stops appearing.
            let msg = error.localizedDescription.lowercased()
            if msg.contains("credential") || msg.contains("password") || msg.contains("invalid") {
                BiometricCredentials.clear()
                hasStoredCredentials = false
                self.error = "Saved login is out of date. Please sign in with your password."
            } else {
                self.error = "\(BiometricCredentials.biometryLabel) sign-in failed."
            }
        }
    }

    private func signInApple() async {
        loading = true; error = nil
        defer { loading = false }
        do { try await auth.signInWithApple() }
        catch {
            self.error = "Apple sign-in failed: \(error.localizedDescription)"
        }
    }

    private func signInGoogle() async {
        loading = true; error = nil
        defer { loading = false }
        do { try await auth.signInWithGoogle() }
        catch {
            self.error = "Google sign-in failed: \(error.localizedDescription)"
        }
    }
}

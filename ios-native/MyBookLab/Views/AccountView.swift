import SwiftUI

struct AccountView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(SubscriptionStore.self) private var subs
    @Environment(AudioService.self) private var audio
    @Environment(CoinsStore.self) private var coins
    @State private var showingSignIn = false
    @State private var showingPaywall = false
    @State private var showingBuyCoins = false
    @State private var editingName = false
    @State private var nameDraft = ""
    @State private var showDeleteConfirm = false
    @State private var deleteConfirmText = ""
    @State private var deleteBusy = false
    @State private var deletionScheduledFor: String?   // ISO date when pending
    @State private var deleteError: String?

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()
                if auth.isSignedIn {
                    signedInView
                } else {
                    signedOutView
                }
            }
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .sheet(isPresented: $showingSignIn) {
                NavigationStack { SignInView() }
                    .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showingPaywall) {
                NavigationStack { PaywallView() }
                    .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showingBuyCoins) {
                NavigationStack { BuyCoinsSheet() }
                    .presentationDragIndicator(.visible)
            }
        }
    }

    private var signedInView: some View {
        ScrollView {
            VStack(spacing: 16) {
                deletionBanner
                profileCard
                coinsCard
                rowsCard
                musicCard
                signOutCard
                deleteAccountCard
            }
            .padding()
            .contentColumn(maxWidth: ContentWidth.form)
        }
        .scrollContentBackground(.hidden)
        .task { await loadDeletionStatus() }
    }

    private var coinsCard: some View {
        HStack(spacing: 14) {
            Text("🪙").font(.title)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(coins.balance) coins")
                    .font(.headline)
                    .foregroundStyle(.white)
                Text("Spend on magical art styles and items")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.65))
            }
            Spacer()
            NavigationLink {
                CoinStoreView()
            } label: {
                Text("Store")
                    .font(.callout.bold())
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(.purple.opacity(0.6), in: Capsule())
                    .foregroundStyle(.white)
            }
            // In-app coin buying is gated off for 2.0.0 (see
            // coinPurchasesEnabled). Users spend their existing balance.
            if coinPurchasesEnabled {
                Button {
                    showingBuyCoins = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.yellow)
                }
            }
        }
        .padding(16)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
    }

    private var musicCard: some View {
        HStack(spacing: 14) {
            Image(systemName: audio.muted ? "speaker.slash.fill" : "music.note")
                .foregroundStyle(audio.muted ? .white.opacity(0.4) : .yellow)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text("Background music")
                    .foregroundStyle(.white)
                Text(audio.muted ? "Off" : "On")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.65))
            }
            Spacer()
            Toggle("", isOn: Binding(
                get: { !audio.muted },
                set: { audio.setMuted(!$0) }
            ))
            .labelsHidden()
            .tint(.purple)
        }
        .padding(16)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
    }

    private var profileCard: some View {
        VStack(spacing: 16) {
            // Tappable avatar — opens the editor where the user can
            // pick a photo (cartoonified by AI) or an emoji.
            NavigationLink {
                AvatarEditorView()
            } label: {
                ZStack(alignment: .bottomTrailing) {
                    AvatarView(
                        urlString: auth.avatarURL,
                        fallbackInitial: auth.displayName?.first.map { String($0).uppercased() },
                        size: 128
                    )
                    Image(systemName: "pencil.circle.fill")
                        .symbolRenderingMode(.palette)
                        .foregroundStyle(.white, .purple)
                        .font(.title2)
                        .background(Circle().fill(.black.opacity(0.001))) // expand tap area
                        .offset(x: -4, y: -4)
                }
            }
            .buttonStyle(.plain)

            // Name + email — centered, name editable inline.
            VStack(spacing: 4) {
                if editingName {
                    HStack(spacing: 8) {
                        TextField("Your name", text: $nameDraft)
                            .textInputAutocapitalization(.words)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(.white)
                            .font(.system(.title3, design: .rounded).bold())
                        Button {
                            Task {
                                try? await auth.updateDisplayName(nameDraft)
                                editingName = false
                            }
                        } label: {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.title3)
                                .foregroundStyle(.green)
                        }
                        Button { editingName = false } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.title3)
                                .foregroundStyle(.white.opacity(0.5))
                        }
                    }
                } else {
                    HStack(spacing: 8) {
                        Text(auth.displayName ?? "—")
                            .font(.system(.title2, design: .rounded).bold())
                            .foregroundStyle(.white)
                        Button {
                            nameDraft = auth.displayName ?? ""
                            editingName = true
                        } label: {
                            Image(systemName: "pencil")
                                .font(.subheadline)
                                .foregroundStyle(.white.opacity(0.6))
                        }
                    }
                }
                Text(auth.user?.email ?? "")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .padding(.horizontal, 16)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 22))
    }

    private var rowsCard: some View {
        VStack(spacing: 0) {
            Button {
                showingPaywall = true
            } label: {
                HStack(spacing: 14) {
                    Image(systemName: "star.fill").foregroundStyle(.yellow).frame(width: 24)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(subs.isPaid ? "Manage subscription" : "Unlock the full magic")
                            .foregroundStyle(.white)
                        Text(subs.isPaid
                             ? "Current plan: \(subs.planKey.capitalized)"
                             : "Subscribe for unlimited stories")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.65))
                    }
                    Spacer()
                    Image(systemName: "chevron.right").foregroundStyle(.white.opacity(0.5)).font(.caption)
                }
                .padding(16)
            }
        }
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
    }

    private func row(icon: String, label: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon).foregroundStyle(.yellow).frame(width: 24)
            Text(label).foregroundStyle(.white)
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.white.opacity(0.5)).font(.caption)
        }
        .padding(16)
    }

    private var signOutCard: some View {
        Button {
            Task { await auth.signOut() }
        } label: {
            Text("Sign out")
                .foregroundStyle(.red.opacity(0.9))
                .frame(maxWidth: .infinity)
                .padding(14)
                .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 18))
        }
    }

    @ViewBuilder
    private var deletionBanner: some View {
        if let scheduledFor = deletionScheduledFor, !scheduledFor.isEmpty {
            VStack(spacing: 8) {
                Text("Your account is scheduled for deletion\(deletionDateText(scheduledFor)).")
                    .font(.subheadline.bold()).multilineTextAlignment(.center).foregroundStyle(.white)
                Button {
                    Task { await cancelDeletion() }
                } label: {
                    Text(deleteBusy ? "Cancelling…" : "Keep my account")
                        .font(.footnote.bold())
                        .padding(.vertical, 8).padding(.horizontal, 16)
                        .background(.white.opacity(0.2), in: Capsule())
                        .foregroundStyle(.white)
                }
                .disabled(deleteBusy)
            }
            .padding(14).frame(maxWidth: .infinity)
            .background(.red.opacity(0.7), in: RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal)
        }
    }

    private func deletionDateText(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        guard let date = f.date(from: iso) else { return "" }
        let out = DateFormatter(); out.dateStyle = .medium
        return " on " + out.string(from: date)
    }

    private func cancelDeletion() async {
        guard let token = auth.accessToken else { return }
        deleteBusy = true
        defer { deleteBusy = false }
        do {
            try await APIClient.shared.cancelAccountDeletion(bearerToken: token)
            deletionScheduledFor = nil
        } catch {
            deleteError = "Couldn't cancel. Please try again."
        }
    }

    private func loadDeletionStatus() async {
        guard let token = auth.accessToken else { return }
        if let status = try? await APIClient.shared.deletionStatus(bearerToken: token) {
            deletionScheduledFor = status.pending ? (status.scheduled_for ?? "") : nil
        }
    }

    private var deleteAccountCard: some View {
        Button(role: .destructive) {
            deleteConfirmText = ""
            deleteError = nil
            showDeleteConfirm = true
        } label: {
            Text("Delete account").frame(maxWidth: .infinity)
        }
        .padding(.vertical, 6)
        .sheet(isPresented: $showDeleteConfirm) {
            deleteConfirmSheet.presentationDetents([.medium])
        }
    }

    private var deleteConfirmSheet: some View {
        VStack(spacing: 16) {
            Text("Delete your account?")
                .font(.system(.title3, design: .rounded).bold())
            Text("Your account and all your books will be scheduled for deletion. You'll have 7 days to change your mind before anything is permanently removed.")
                .font(.subheadline).multilineTextAlignment(.center).foregroundStyle(.secondary)
            Text("Type DELETE to confirm").font(.caption).foregroundStyle(.secondary)
            TextField("DELETE", text: $deleteConfirmText)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .multilineTextAlignment(.center)
                .padding(12)
                .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            if let deleteError {
                Text(deleteError).font(.footnote).foregroundStyle(.red)
            }
            Button(role: .destructive) {
                Task { await scheduleDeletion() }
            } label: {
                HStack {
                    if deleteBusy { ProgressView() }
                    Text("Schedule deletion")
                }
                .frame(maxWidth: .infinity).padding(12)
            }
            .background(.red.opacity(deleteConfirmText == "DELETE" ? 0.8 : 0.3), in: RoundedRectangle(cornerRadius: 12))
            .foregroundStyle(.white)
            .disabled(deleteConfirmText != "DELETE" || deleteBusy)

            Button("Keep my account") { showDeleteConfirm = false }.padding(.top, 4)
            Spacer()
        }
        .padding()
    }

    private func scheduleDeletion() async {
        guard let token = auth.accessToken else { return }
        deleteBusy = true; deleteError = nil
        defer { deleteBusy = false }
        do {
            let scheduledFor = try await APIClient.shared.requestAccountDeletion(bearerToken: token)
            deletionScheduledFor = scheduledFor ?? ""
            showDeleteConfirm = false
        } catch {
            deleteError = "Couldn't schedule deletion. Please try again."
        }
    }

    private var signedOutView: some View {
        VStack(spacing: 22) {
            Image("AppLogo")
                .resizable().aspectRatio(contentMode: .fit)
                .frame(width: 96, height: 96)
                .clipShape(RoundedRectangle(cornerRadius: 22))
                .shadow(color: .purple.opacity(0.6), radius: 18, y: 8)
            Text("Sign in to save your stories")
                .font(.system(.title2, design: .rounded).bold())
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
            Text("Sync books across devices, order printed copies, and pick up where you left off.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.75))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            SparkleButton(action: { showingSignIn = true }) {
                Text("Sign in")
            }
            .frame(maxWidth: 360)
            .padding(.horizontal, 32)
        }
        .contentColumn(maxWidth: ContentWidth.form)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

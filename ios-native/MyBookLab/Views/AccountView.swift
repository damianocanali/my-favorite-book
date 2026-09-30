import SwiftUI

struct AccountView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(SubscriptionStore.self) private var subs
    @Environment(AudioService.self) private var audio
    @Environment(CoinsStore.self) private var coins
    @Environment(RewardsStore.self) private var rewards
    @Environment(TeacherStore.self) private var teacher
    @State private var showingPaywall = false
    @State private var showingBuyCoins = false
    @State private var editingName = false
    @State private var nameDraft = ""
    @State private var showDeleteConfirm = false
    @State private var deleteConfirmText = ""

    /// The word the user must type to arm account deletion.
    ///
    /// Read from ONE place and used both as the field's placeholder and as the
    /// comparison, because those two must never diverge. Translating the
    /// placeholder alone would leave an Italian user typing "ELIMINA" at a
    /// button gated on "DELETE" — account deletion becomes impossible, which
    /// is also an App Store Guideline 5.1.1(v) failure.
    private var deleteConfirmWord: String {
        String(appLocalized: AppText("account.delete.confirm_word", defaultValue: "DELETE",
               comment: "Typed by the user to confirm account deletion. MUST match the placeholder; uppercase."))
    }
    @State private var deleteBusy = false
    @State private var deletionScheduledFor: String?   // ISO date when pending
    // App-authored copy, so it must be localizable. (Contrast with the
    // stores' `.error(String)` channels, which pass through OS/URLSession
    // text that iOS has already localized.)
    @State private var deleteError: LocalizedStringResource?

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
                // A class (student) account is never sold anything and owns
                // nothing it could delete — the teacher manages it — so it
                // gets no deletion, coins or subscription (the web's
                // AccountPage hides the same sections).
                if !auth.isStudent { deletionBanner }
                profileCard
                // A teacher who is also a parent picks which home they see.
                if auth.isTeacher { viewModeCard }
                if auth.isTeacher { TeacherNotificationSettingsCard() }
                // Which class this iPad opens on when nobody is signed in.
                if auth.isTeacher { ClassDeviceAccountCard() }
                // In teacher mode the classroom is the app itself.
                if auth.isTeacher && !teacherMode { classroomCard }
                // No shop and no prices anywhere in the teacher area.
                if !auth.isStudent && !teacherMode { coinsCard }
                rewardsCard
                // Locked icons are unlocked with coins: not in teacher mode.
                if !teacherMode { appIconCard }
                if !auth.isStudent && !teacherMode { rowsCard }
                // A teacher account never hears music (AudioService), so a
                // music switch would be a control that does nothing.
                if !auth.isTeacher { musicCard }
                languageCard
                signOutCard
                // Below the badges and above the danger zone: something to look
                // at, never something to act on.
                FeelingConstellation()

                if !auth.isStudent { deleteAccountCard }
            }
            .padding()
            .contentColumn(maxWidth: ContentWidth.form)
        }
        .scrollContentBackground(.hidden)
        .task {
            if !auth.isStudent { await loadDeletionStatus() }
        }
    }

    private var teacherMode: Bool { teacher.isTeacherMode(auth) }

    /// "Switch to family view" / "Switch to teacher view" (web: viewMode).
    private var viewModeCard: some View {
        Button {
            if teacherMode {
                teacher.setViewMode(.family)
                // Land on the same Account screen in the family tabs.
                AppRouter.shared.selectedTab = .account
            } else {
                teacher.setViewMode(.teacher)
            }
        } label: {
            HStack(spacing: 14) {
                Image(systemName: teacherMode ? "house.fill" : "graduationcap.fill")
                    .foregroundStyle(.yellow).frame(width: 24)
                Text(teacherMode ? TeacherCopy.switchToFamily : TeacherCopy.switchToTeacher)
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: "arrow.left.arrow.right").foregroundStyle(.white.opacity(0.5)).font(.caption)
            }
            .padding(16)
        }
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
    }

    /// For a teacher in family view: straight back to their classes, in the
    /// app (the teacher area is fully native).
    private var classroomCard: some View {
        Button {
            teacher.setViewMode(.teacher)
            teacher.selectedTab = .classes
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "graduationcap.fill")
                    .font(.title2)
                    .foregroundStyle(.yellow)
                    .frame(width: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Classroom dashboard")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("Classes, students and sign-in cards")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.65))
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(.white.opacity(0.7))
            }
            .padding(16)
            .frame(minHeight: 64)
        }
        .background(.purple.opacity(0.35), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(.purple.opacity(0.6)))
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
                .accessibilityLabel("Buy coins")
            }
        }
        .padding(16)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
    }

    private var rewardsCard: some View {
        NavigationLink {
            BadgesView()
        } label: {
            HStack(spacing: 14) {
                Text("🔥").font(.title)
                VStack(alignment: .leading, spacing: 2) {
                    Text(rewards.currentStreak > 0
                         ? "\(rewards.currentStreak) day writing streak"
                         : "Start a writing streak!")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("\(rewards.earnedBadges.count) of \(RewardsStore.catalog.count) badges earned")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.65))
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(.white.opacity(0.5)).font(.caption)
            }
            .padding(16)
        }
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
    }

    private var appIconCard: some View {
        NavigationLink {
            AppIconPickerView()
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "app.gift.fill").foregroundStyle(.yellow).frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text("App icon").foregroundStyle(.white)
                    // A class account only sees the free icons.
                    (auth.isStudent
                        ? Text("Pick a look for your app icon")
                        : Text("Unlock new looks with coins and streaks"))
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.65))
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(.white.opacity(0.5)).font(.caption)
            }
            .padding(16)
        }
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
    }

    /// Switching is live (AppLanguage.choose rebuilds the app in the new
    /// language, behind the root's "Changing language…" overlay), so there
    /// is nothing to tell the user afterwards.
    private var languageCard: some View {
        HStack(spacing: 14) {
            Image(systemName: "globe")
                .foregroundStyle(.cyan)
                .frame(width: 24)
                .accessibilityHidden(true)
            // Never broken over two lines ("Lingua" / "Language").
            Text("Language")
                .foregroundStyle(.white)
                .lineLimit(1)
                .fixedSize()
                .accessibilityHidden(true)
            Spacer(minLength: 8)
            LanguageMenu()
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
            // pick a photo (cartoonified by AI) or an emoji. A class account
            // just sees theirs: the teacher makes it.
            if auth.isStudent {
                AvatarView(
                    urlString: auth.avatarURL,
                    fallbackInitial: auth.displayName?.first.map { String($0).uppercased() },
                    size: 128
                )
            } else {
                NavigationLink {
                    AvatarEditorView(hidesStore: teacherMode)
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
            }

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
                        .accessibilityLabel("Save name")
                        Button { editingName = false } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.title3)
                                .foregroundStyle(.white.opacity(0.5))
                        }
                        .accessibilityLabel("Cancel editing name")
                    }
                } else {
                    HStack(spacing: 8) {
                        Text(auth.displayName ?? "—")
                            .font(.system(.title2, design: .rounded).bold())
                            .foregroundStyle(.white)
                        // The teacher sets a class account's name — it is
                        // what the class sign-in tiles show.
                        if !auth.isStudent {
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
                }
                // A class account's email is a generated placeholder that
                // means nothing to a child.
                if !auth.isStudent {
                    Text(auth.user?.email ?? "")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.7))
                }
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
                             ? "Current plan: \(planDisplayName)"
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

    /// `planKey` is the RevenueCat / Stripe entitlement identifier — a
    /// wire value. `.capitalized` on it happened to read as English;
    /// in any other language it just prints the raw key. Map it to a
    /// translatable display name instead.
    private var planDisplayName: String {
        switch subs.planKey {
        case "family":
            return String(appLocalized: AppText("plan.family.name", defaultValue: "Family"))
        case "classroom":
            return String(appLocalized: AppText("plan.classroom.name", defaultValue: "Classroom"))
        case "free":
            return String(appLocalized: AppText("plan.free.name", defaultValue: "Free"))
        default:
            // Unknown/new server plan: a neutral word beats a raw key.
            return String(appLocalized: AppText("plan.unknown.name", defaultValue: "Premium"))
        }
    }

    private func row(icon: String, label: LocalizedStringKey) -> some View {
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
                // One sentence, one key, the date as an argument. Gluing
                // " on " + date made the preposition and the word order
                // untranslatable — Italian wants "…il 3 marzo 2026".
                deletionSentence(scheduledFor)
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

    /// The dated and undated sentences are two separate keys rather than
    /// one key with an optional fragment, because a translator has to be
    /// able to rewrite each whole sentence.
    private func deletionSentence(_ iso: String) -> Text {
        guard let date = Self.parseISODate(iso) else {
            return Text("Your account is scheduled for deletion.")
        }
        return Text("Your account is scheduled for deletion on \(date, format: .dateTime.day().month(.abbreviated).year()).")
    }

    private static func parseISODate(_ iso: String) -> Date? {
        // The server formats scheduled_for via toISOString(), which always emits
        // fractional seconds (…T03:00:00.000Z). A bare ISO8601DateFormatter rejects
        // those, so parse with fractional seconds first and fall back to without.
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        return withFraction.date(from: iso) ?? plain.date(from: iso)
    }

    private func cancelDeletion() async {
        deleteBusy = true
        defer { deleteBusy = false }
        guard let token = await auth.validAccessToken() else { return }
        do {
            try await APIClient.shared.cancelAccountDeletion(bearerToken: token)
            deletionScheduledFor = nil
        } catch {
            deleteError = AppText(
                "account.delete.cancel_failed",
                defaultValue: "Couldn't cancel. Please try again.")
        }
    }

    private func loadDeletionStatus() async {
        guard let token = await auth.validAccessToken() else { return }
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
            TextField(deleteConfirmWord, text: $deleteConfirmText)
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
            .background(.red.opacity(deleteConfirmText == deleteConfirmWord ? 0.8 : 0.3), in: RoundedRectangle(cornerRadius: 12))
            .foregroundStyle(.white)
            .disabled(deleteConfirmText != deleteConfirmWord || deleteBusy)

            Button("Keep my account") { showDeleteConfirm = false }.padding(.top, 4)
            Spacer()
        }
        .padding()
    }

    private func scheduleDeletion() async {
        deleteBusy = true; deleteError = nil
        defer { deleteBusy = false }
        guard let token = await auth.validAccessToken() else { return }
        do {
            let scheduledFor = try await APIClient.shared.requestAccountDeletion(bearerToken: token)
            deletionScheduledFor = scheduledFor ?? ""
            showDeleteConfirm = false
        } catch {
            deleteError = AppText(
                "account.delete.schedule_failed",
                defaultValue: "Couldn't schedule deletion. Please try again.")
        }
    }

    /// A guest (who chose "Explore first") signs in right here: the
    /// welcome screen, its doors and their forms, in place in this tab —
    /// never a sheet or a cover. Bookshelf and Create's "Sign in" buttons
    /// bring the guest to this tab (AppRouter.openSignIn). The welcome
    /// screen carries the language menu.
    private var signedOutView: some View {
        SignInFlowView(embedded: true)
    }
}

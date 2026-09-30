import CoreSpotlight
import SwiftUI
import RevenueCat

@main
struct MyBookLabApp: App {
    // APNs token callbacks and notification taps (teacher alerts).
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var auth = AuthStore.shared
    @State private var bookshelf = BookshelfStore.shared
    @State private var router = AppRouter.shared
    @State private var subs = SubscriptionStore.shared
    @State private var audio = AudioService.shared
    @State private var coins = CoinsStore.shared
    @State private var rewards = RewardsStore.shared
    @State private var checkIn = CheckInStore.shared
    @State private var teacher = TeacherStore.shared
    @State private var teacherBell = TeacherNotificationsStore.shared
    @State private var push = PushRegistrar.shared
    @State private var language = AppLanguageState.shared
    @Environment(\.scenePhase) private var scenePhase
    /// The launch work below runs once per launch. The root is rebuilt on
    /// every language switch, and re-running it there made each switch
    /// slow (a second auth listener, bookshelf/coins/rewards/purchases
    /// reloads) for nothing.
    @State private var launched = false

    init() {
        // Before any string is looked up: the chosen language's .lproj.
        AppLanguage.bootstrap()
        // Leftover sign-in card PDFs from a previous run never outlive it.
        SignInCardsFiles.purge()
        // The old implicit "who's signing in" and class-code memory.
        ClassDeviceStore.purgeLegacyKeys()
        Purchases.logLevel = .warn
        Purchases.configure(withAPIKey: AppConfig.shared.revenueCatAPIKey)
    }

    var body: some Scene {
        WindowGroup {
            AppRootView()
                // INSIDE the .environment() calls below, not after them. An
                // environment value only reaches views nested inside the
                // modifier that sets it; applied after `.environment(checkIn)`,
                // the host's own @Environment(CheckInStore.self) looked upward,
                // found nothing, and crashed the app on its first frame.
                .checkInHost()
                .environment(auth)
                .environment(bookshelf)
                .environment(router)
                .environment(subs)
                .environment(audio)
                .environment(coins)
                .environment(rewards)
                .environment(checkIn)
                .environment(teacher)
                .environment(teacherBell)
                .environment(push)
                // Live language switch: every Text resolves in this locale,
                // and a new id rebuilds the tree so nothing already on
                // screen stays in the old language. Navigation state lives
                // in the stores (AppRouter, TeacherStore), so it survives.
                .environment(\.locale, language.locale)
                .id(language.code)
                .task {
                    guard !launched else { return }
                    launched = true
                    PrintOrderActivityManager.cleanup()
                    await auth.bootstrap()
                    // Nobody signed in: AppRootView already shows the front
                    // door (or, on a class iPad, the class's name list).
                    // Music only once the session is known. AudioService
                    // itself refuses for a teacher account (any view mode);
                    // family users, students and the signed-out get it.
                    audio.play(.home)
                    if let id = auth.user?.id.uuidString {
                        await bookshelf.load(userId: id)
                    }
                    await subs.bootstrap()
                    await coins.refresh()
                    await coins.loadInventory()
                    await rewards.refresh()
                    // A teacher who already allowed alerts is re-registered
                    // on every launch (the token can rotate). No-op otherwise.
                    await push.registerIfAllowed()
                }
                // Keep the access token fresh while the app is in front, and
                // stop the refresher in the background (see setAutoRefresh).
                .onChange(of: scenePhase, initial: true) { _, phase in
                    auth.setAutoRefresh(active: phase == .active)
                }
                // A role change on the same account (e.g. metadata refresh
                // marking it a teacher) must silence the music too.
                .onChange(of: auth.isTeacher) { _, _ in audio.applyAccountPolicy() }
                .onChange(of: auth.user?.id) { oldValue, newValue in
                    audio.applyAccountPolicy()
                    // AppRootView follows the session by itself; this only
                    // resets the flow's screen state. Signed out (or the
                    // session ended): the next person starts at the front
                    // door — on a class iPad, the class's name list.
                    if newValue != nil {
                        router.signedIn()
                    } else if oldValue != nil {
                        router.sessionEnded()
                    }
                    // Any change of who is signed in — including a session
                    // that simply expired — drops unprinted picture cards.
                    teacher.clearPendingCards()
                    Task {
                        if let id = newValue?.uuidString {
                            await bookshelf.load(userId: id)
                            await subs.bootstrap()
                            await coins.refresh()
                            await coins.loadInventory()
                            await push.registerIfAllowed()
                        } else {
                            bookshelf.clear()
                        }
                        await rewards.refresh()
                    }
                }
                .onOpenURL { url in
                    // mybooklab://<tab> comes from the widget; anything
                    // else is an OAuth callback for Supabase.
                    if url.scheme == "mybooklab" {
                        switch url.host() {
                        case "books": router.selectedTab = .books
                        case "orders": router.selectedTab = .orders
                        default: router.selectedTab = .create
                        }
                    } else {
                        auth.handleDeepLink(url)
                    }
                }
                // Spotlight: tapping an indexed book opens the shelf.
                .onContinueUserActivity(CSSearchableItemActionType) { _ in
                    router.selectedTab = .books
                }
                // Outside the rebuilt subtree, so it stays up across it.
                .overlay { LanguageSwitchOverlay(target: language.switching) }
                .animation(.easeInOut(duration: 0.25), value: language.switching)
                .preferredColorScheme(.dark)
        }
    }
}

/// Signed out, the app's root IS the sign-in flow (welcome → doors → form,
/// or a class iPad's name list), rendered in place: nothing slides up, and
/// nothing can be tapped or swiped away. Signed in, or a guest who chose
/// "Explore first": the tabs. The switch follows the session, so a session
/// that ends lands here on its own — there is no presentation to go wrong.
/// A sheet a screen had open when the session ended goes with that screen.
private struct AppRootView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(AppRouter.self) private var router
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var showsSignIn: Bool {
        !auth.loading && !auth.isSignedIn && !router.guestExploring
    }

    var body: some View {
        ZStack {
            if showsSignIn {
                SignInFlowView()
                    .transition(.opacity)
            } else {
                // Also the launch spinner while the session is being read.
                MainTabView()
                    .transition(.opacity)
            }
        }
        // A plain crossfade, never a slide.
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: showsSignIn)
    }
}

/// "Changing language…" while AppLanguage.choose rebuilds the app, written
/// in the language being switched to.
private struct LanguageSwitchOverlay: View {
    let target: String?

    var body: some View {
        if let target {
            ZStack {
                Color.black.opacity(0.45).ignoresSafeArea()
                VStack(spacing: 14) {
                    ProgressView()
                        .controlSize(.large)
                        .tint(.white)
                    Text(verbatim: AppLanguage.string(
                        "account.language.switching", defaultValue: "Changing language…", in: target))
                        .font(.system(.headline, design: .rounded))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, 28)
                .padding(.vertical, 22)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))
                .accessibilityElement(children: .combine)
            }
            .transition(.opacity)
            // Swallows taps while the tree is being replaced.
            .contentShape(Rectangle())
        }
    }
}

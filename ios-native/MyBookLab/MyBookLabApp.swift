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

    init() {
        // Before any string is looked up: the chosen language's .lproj.
        AppLanguage.bootstrap()
        // Leftover sign-in card PDFs from a previous run never outlive it.
        SignInCardsFiles.purge()
        Purchases.logLevel = .warn
        Purchases.configure(withAPIKey: AppConfig.shared.revenueCatAPIKey)
    }

    var body: some Scene {
        WindowGroup {
            MainTabView()
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
                    PrintOrderActivityManager.cleanup()
                    await auth.bootstrap()
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
                    Task { await auth.setAutoRefresh(active: phase == .active) }
                }
                // A role change on the same account (e.g. metadata refresh
                // marking it a teacher) must silence the music too.
                .onChange(of: auth.isTeacher) { _, _ in audio.applyAccountPolicy() }
                .onChange(of: auth.user?.id) { _, newValue in
                    audio.applyAccountPolicy()
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
                .preferredColorScheme(.dark)
        }
    }
}

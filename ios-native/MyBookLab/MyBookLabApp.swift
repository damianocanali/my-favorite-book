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

    init() {
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
                .task {
                    audio.play(.home)
                    PrintOrderActivityManager.cleanup()
                    await auth.bootstrap()
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
                .onChange(of: auth.user?.id) { _, newValue in
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

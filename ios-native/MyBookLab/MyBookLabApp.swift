import CoreSpotlight
import SwiftUI
import RevenueCat

@main
struct MyBookLabApp: App {
    @State private var auth = AuthStore.shared
    @State private var bookshelf = BookshelfStore.shared
    @State private var router = AppRouter.shared
    @State private var subs = SubscriptionStore.shared
    @State private var audio = AudioService.shared
    @State private var coins = CoinsStore.shared
    @State private var rewards = RewardsStore.shared

    init() {
        Purchases.logLevel = .warn
        Purchases.configure(withAPIKey: AppConfig.shared.revenueCatAPIKey)
    }

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .environment(auth)
                .environment(bookshelf)
                .environment(router)
                .environment(subs)
                .environment(audio)
                .environment(coins)
                .environment(rewards)
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
                }
                .onChange(of: auth.user?.id) { _, newValue in
                    Task {
                        if let id = newValue?.uuidString {
                            await bookshelf.load(userId: id)
                            await subs.bootstrap()
                            await coins.refresh()
                            await coins.loadInventory()
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

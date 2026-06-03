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
                .task {
                    audio.play(.home)
                    await auth.bootstrap()
                    if let id = auth.user?.id.uuidString {
                        await bookshelf.load(userId: id)
                    }
                    await subs.bootstrap()
                    await coins.refresh()
                }
                .onChange(of: auth.user?.id) { _, newValue in
                    Task {
                        if let id = newValue?.uuidString {
                            await bookshelf.load(userId: id)
                            await subs.bootstrap()
                            await coins.refresh()
                        } else {
                            bookshelf.clear()
                        }
                    }
                }
                .onOpenURL { url in
                    auth.handleDeepLink(url)
                }
                .preferredColorScheme(.dark)
        }
    }
}

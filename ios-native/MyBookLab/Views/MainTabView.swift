import SwiftUI

struct MainTabView: View {
    init() {
        // Style the tab bar to read against the cosmic gradient.
        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithTransparentBackground()
        tabAppearance.backgroundEffect = UIBlurEffect(style: .systemUltraThinMaterialDark)
        UITabBar.appearance().standardAppearance = tabAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabAppearance

        // Rounded, kid-friendly font for navigation titles. The
        // system rounded design (UIFontDescriptor.SystemDesign.rounded)
        // matches SF Pro Rounded, the same family that makes Apple's
        // own apps for kids feel approachable.
        let titleFont = roundedSystemFont(size: 17, weight: .bold)
        let largeTitleFont = roundedSystemFont(size: 28, weight: .heavy)

        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithTransparentBackground()
        navAppearance.backgroundEffect = UIBlurEffect(style: .systemUltraThinMaterialDark)
        navAppearance.titleTextAttributes = [
            .foregroundColor: UIColor.white,
            .font: titleFont,
        ]
        navAppearance.largeTitleTextAttributes = [
            .foregroundColor: UIColor.white,
            .font: largeTitleFont,
        ]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
        UINavigationBar.appearance().compactAppearance = navAppearance
        UINavigationBar.appearance().tintColor = .white
    }

    @Environment(AppRouter.self) private var router
    @Environment(AudioService.self) private var audio
    @State private var storyIdea: String?

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.selectedTab) {
            BookshelfView()
                .tabItem { Label("Books", systemImage: "books.vertical.fill") }
                .tag(AppTab.books)

            GalleryView()
                .tabItem { Label("Gallery", systemImage: "star.fill") }
                .tag(AppTab.gallery)

            CreateBookView()
                .tabItem { Label("Create", systemImage: "plus.circle.fill") }
                .tag(AppTab.create)

            OrdersListView()
                .tabItem { Label("Orders", systemImage: "shippingbox.fill") }
                .tag(AppTab.orders)

            AccountView()
                .tabItem { Label("Account", systemImage: "person.crop.circle.fill") }
                .tag(AppTab.account)
        }
        .tint(.white)
        .background(Color.clear)
        // Shake anywhere → a story idea pops up. Attached once here so
        // every tab gets it without duplicate listeners.
        .onShake {
            guard storyIdea == nil else { return }
            Haptics.bigTap()
            audio.playSFX(.sparkle)
            withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
                storyIdea = StoryIdeas.random()
            }
        }
        .overlay { StoryIdeaCard(idea: $storyIdea) }
        .overlay { BadgePopup() }
        .onChange(of: router.selectedTab) { _, newValue in
            // Match the web behavior — different scenes get different
            // moods. Each tab change crossfades to its own track.
            switch newValue {
            case .books:   audio.play(.bookshelf)
            case .gallery: audio.play(.gallery)
            case .create:  audio.play(.wizard)
            case .orders:  audio.play(.home)
            case .account: audio.play(.home)
            }
        }
    }
}

// Helper: builds a UIFont in the system rounded design (SF Pro Rounded).
// Falls back to the regular system font if the rounded variant is
// unavailable, which shouldn't happen on iOS 13+.
func roundedSystemFont(size: CGFloat, weight: UIFont.Weight) -> UIFont {
    let base = UIFont.systemFont(ofSize: size, weight: weight)
    if let descriptor = base.fontDescriptor.withDesign(.rounded) {
        return UIFont(descriptor: descriptor, size: size)
    }
    return base
}

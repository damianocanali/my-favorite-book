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
    @Environment(AuthStore.self) private var auth
    @Environment(TeacherStore.self) private var teacher

    /// A teacher gets Dashboard · Classes · Account instead of the family
    /// tabs (TeacherStore decides; a class account never does). "Preview the
    /// kids' app" shows the family tabs under a slim way back.
    var body: some View {
        if teacher.isTeacherMode(auth) {
            TeacherTabView()
        } else {
            familyTabs
                .safeAreaInset(edge: .top, spacing: 0) {
                    if teacher.showsPreviewBanner(auth) { KidsPreviewBanner() }
                }
        }
    }

    @ViewBuilder private var familyTabs: some View {
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

            // Print orders are a paid family feature; a class account never
            // has one to check on (the web's TabBar drops it the same way).
            if !auth.isStudent {
                OrdersListView()
                    .tabItem { Label("Orders", systemImage: "shippingbox.fill") }
                    .tag(AppTab.orders)
            }

            AccountView()
                .tabItem { Label("Account", systemImage: "person.crop.circle.fill") }
                .tag(AppTab.account)
        }
        .tint(.white)
        .background(Color.clear)
        .overlay { BadgePopup() }
        .overlay { WelcomeBackMoment() }
        // A widget link or a stale selection must not land a class account
        // on a tab that isn't there.
        .onChange(of: auth.isStudent) { _, student in
            if student, router.selectedTab == .orders { router.selectedTab = .create }
        }
        .onChange(of: router.selectedTab) { _, newValue in
            if newValue == .orders, auth.isStudent {
                router.selectedTab = .create
                return
            }
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

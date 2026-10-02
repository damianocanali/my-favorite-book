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
    @Environment(BookshelfStore.self) private var bookshelf
    @Environment(\.scenePhase) private var scenePhase
    /// Bumped when the AI disclosure is acknowledged, so the cover's
    /// binding re-reads UserDefaults.
    @State private var aiDisclosureTick = 0

    /// Family (consumer) accounts see the AI disclosure once, before the
    /// app is usable (App Store 5.1.2(i)); class accounts never do.
    private var showAIDisclosure: Binding<Bool> {
        Binding(
            get: {
                _ = aiDisclosureTick
                return auth.user != nil && !auth.isStudent
                    && !AIDisclosure.isAcknowledged(userId: auth.user?.id.uuidString)
            },
            set: { _ in }
        )
    }

    /// A teacher gets Dashboard · Classes · Account instead of the family
    /// tabs (TeacherStore decides; a class account never does).
    var body: some View {
        // Until the session is known, neither set of tabs: a teacher must
        // not glimpse the family tabs (and their music) on every launch.
        if auth.loading {
            ZStack {
                CosmicBackground()
                ProgressView().tint(.white)
            }
        } else if teacher.isTeacherMode(auth) {
            TeacherTabView()
        } else {
            familyTabs
        }
    }

    @ViewBuilder private var familyTabs: some View {
        @Bindable var router = router
        TabView(selection: $router.selectedTab) {
            // A class account's home ("From your teacher" on top) is its
            // "Class" tab, badged with new assignments + an unread nudge
            // (web: TabBar's STUDENT_HOME_TAB).
            BookshelfView()
                .tabItem {
                    if auth.isStudent {
                        Label {
                            Text(AppText("tabs.class", defaultValue: "Class"))
                        } icon: {
                            Image(systemName: "graduationcap.fill")
                        }
                    } else {
                        Label("Books", systemImage: "books.vertical.fill")
                    }
                }
                .badge(auth.isStudent ? router.classBadge : 0)
                .tag(AppTab.books)

            // Owner decision: a class (student) account must never see the
            // public Gallery of other families' published books (the web's
            // TabBar drops it the same way — see ConsumerOnlyRoute).
            if !auth.isStudent {
                GalleryView()
                    .tabItem { Label("Gallery", systemImage: "star.fill") }
                    .tag(AppTab.gallery)
            }

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
        .fullScreenCover(isPresented: showAIDisclosure) {
            AIDisclosureView {
                AIDisclosure.acknowledge(userId: auth.user?.id.uuidString)
                aiDisclosureTick += 1
            }
        }
        .overlay { BadgePopup() }
        .overlay { WelcomeBackMoment() }
        // A widget link or a stale selection must not land a class account
        // on a tab that isn't there. Orders moves to Create (the middle,
        // always-visible tab); Gallery moves to Books, matching the web's
        // ConsumerOnlyRoute redirect to /bookshelf.
        // A class account's home is Books ("From your teacher" is there).
        // The Create tab's hero is the family landing, so a child who opens
        // the app (or signs in) with no book in progress starts on Books.
        // Once per launch per child: this view is rebuilt on a language
        // switch, which must leave the child on whatever tab they were.
        .onChange(of: auth.user?.id, initial: true) { _, id in
            guard auth.isStudent, let id, router.studentHomeLandedFor != id else { return }
            router.studentHomeLandedFor = id
            if router.selectedTab == .create, BookDraftStore.shared.book == nil {
                router.selectedTab = .books
            }
        }
        // MyAssignmentsSection updates the badge the moment something
        // changes while it is on screen; this poll keeps it fresh everywhere
        // else — other tabs, and a book opened from the Class tab (which
        // takes the section off screen). Same minute rhythm, active app only.
        // A new child on a shared iPad starts from zero.
        .task(id: BadgePollKey(
            student: auth.isStudent, userId: auth.user?.id, active: scenePhase == .active
        )) {
            guard auth.isStudent, auth.user != nil else {
                router.classBadge = 0
                return
            }
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                await refreshClassBadge()
                try? await Task.sleep(for: SchoolAssignments.pollInterval)
            }
        }
        .onChange(of: auth.user?.id) { _, _ in router.classBadge = 0 }
        .onChange(of: auth.isStudent) { _, student in
            guard student else { return }
            if router.selectedTab == .orders { router.selectedTab = .create }
            if router.selectedTab == .gallery { router.selectedTab = .books }
        }
        .onChange(of: router.selectedTab) { _, newValue in
            if newValue == .orders, auth.isStudent {
                router.selectedTab = .create
                return
            }
            if newValue == .gallery, auth.isStudent {
                router.selectedTab = .books
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

private struct BadgePollKey: Equatable {
    let student: Bool
    let userId: UUID?
    let active: Bool
}

extension MainTabView {
    /// Same reads and rules as MyAssignmentsSection; a failed read keeps
    /// whatever the badge shows.
    fileprivate func refreshClassBadge() async {
        guard let list = await SchoolAssignments.list(), !Task.isCancelled else { return }
        let nudge = await SchoolAssignments.nudge() ?? nil
        let userId = auth.user?.id.uuidString
        let seen = AssignmentSeen.ids(userId: userId)
        let books = bookshelf.books
        let draftAssignment = BookDraftStore.shared.book?.assignmentId
        let count = StudentAssignment.classBadgeCount(
            list, seen: seen,
            isStarted: { a in
                draftAssignment == a.id || books.contains { $0.assignmentId == a.id }
                    || (a.isWorksheet && WorksheetDrafts.hasDraft(userId: userId, assignmentId: a.id))
            },
            hasNudge: nudge.map { !router.dismissedNudges.contains($0.id) } ?? false
        )
        guard !Task.isCancelled else { return }
        router.classBadge = count
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

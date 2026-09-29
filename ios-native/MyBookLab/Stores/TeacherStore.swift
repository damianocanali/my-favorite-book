// Whether the signed-in grown-up sees the teacher area, and where inside it
// they are. Mirrors src/lib/viewMode.js: a teacher who is also a parent can
// choose the family view (remembered), and "Preview the kids' app" is a
// one-session detour (never persisted — gone on the next launch).
//
// Teacher mode is UI only. `isTeacher` comes from user-writable metadata, so
// it may decide which tabs show but never whether a request succeeds: the
// server re-checks class ownership on every classroom endpoint.
import Foundation
import Observation

enum TeacherTab: Hashable, Sendable {
    case dashboard, classes, account
}

@Observable
@MainActor
final class TeacherStore {
    static let shared = TeacherStore()

    private static let viewModeKey = "viewMode"
    private static let classKey = "teacherDashboardClassId"

    enum ViewMode: String { case teacher, family }

    /// Remembered across launches. Anything but an explicit "family" reads
    /// as teacher — the safer default, same as the web.
    private(set) var viewMode: ViewMode

    /// "Preview the kids' app": session-only, so a relaunch always comes
    /// back to the dashboard.
    private(set) var previewingKids = false

    var selectedTab: TeacherTab = .dashboard

    /// Set by a bell row or a push tap; the destination screen consumes it.
    var pendingRoute: TeacherRoute?

    private init() {
        viewMode = UserDefaults.standard.string(forKey: Self.viewModeKey) == ViewMode.family.rawValue
            ? .family : .teacher
    }

    /// computeTeacherMode on the web. A class account never gets the teacher
    /// area whatever the stored view says, and neither does anyone while the
    /// session is still loading.
    func isTeacherMode(_ auth: AuthStore) -> Bool {
        guard !auth.loading, !previewingKids else { return false }
        return auth.isTeacher && !auth.isStudent && viewMode == .teacher
    }

    /// The preview banner only makes sense for someone who is otherwise in
    /// teacher mode.
    func showsPreviewBanner(_ auth: AuthStore) -> Bool {
        previewingKids && auth.isTeacher && !auth.isStudent && viewMode == .teacher
    }

    func setViewMode(_ mode: ViewMode) {
        viewMode = mode
        previewingKids = false
        UserDefaults.standard.set(mode.rawValue, forKey: Self.viewModeKey)
        if mode == .teacher { selectedTab = .account }
    }

    /// Lands on the bookshelf, like the web's link to /bookshelf.
    func enterKidsPreview() {
        previewingKids = true
        AppRouter.shared.selectedTab = .books
    }

    func exitKidsPreview() {
        previewingKids = false
        selectedTab = .dashboard
    }

    /// A bell row or a push tap: leaves any kids' preview and lands on the
    /// right tab; the screen there picks up `pendingRoute`.
    func open(_ route: TeacherRoute) {
        previewingKids = false
        switch route {
        case .dashboard: selectedTab = .dashboard
        case .classDetail, .review: selectedTab = .classes
        }
        pendingRoute = route
    }

    // MARK: Remembered class (web: dashboardClass.js)

    var rememberedClassId: String? {
        get { UserDefaults.standard.string(forKey: Self.classKey) }
        set { UserDefaults.standard.set(newValue, forKey: Self.classKey) }
    }

    /// Sign-out: the next person on a shared iPad starts from scratch.
    func reset() {
        previewingKids = false
        selectedTab = .dashboard
        pendingRoute = nil
        UserDefaults.standard.removeObject(forKey: Self.classKey)
    }
}

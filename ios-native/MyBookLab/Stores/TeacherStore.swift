// Whether the signed-in grown-up sees the teacher area, and where inside it
// they are. Mirrors src/lib/viewMode.js: a teacher who is also a parent can
// choose the family view (remembered). Teachers see a child's books from
// the student's details, so there is no "preview the kids' app" detour.
//
// Teacher mode is UI only. `isTeacher` comes from user-writable metadata, so
// it may decide which tabs show but never whether a request succeeds: the
// server re-checks class ownership on every classroom endpoint.
import Foundation
import Observation

enum TeacherTab: Hashable, Sendable {
    case dashboard, classes, worksheets, account
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

    var selectedTab: TeacherTab = .dashboard

    /// Set by a bell row or a push tap; the destination screen consumes it.
    var pendingRoute: TeacherRoute?

    /// Freshly made picture passwords not yet dismissed, per class. Held here
    /// (memory only, never persisted) rather than in the roster screen, so a
    /// push tap that tears the roster down can't lose the only copy: the
    /// class screen offers them again until the teacher closes the cards.
    private(set) var pendingCards: [String: PendingSignInCards] = [:]

    /// Adds children to the class's pending batch (a child whose pictures
    /// were made again replaces their older card).
    func addPendingCards(classId: String, className: String, classCode: String, students: [TeacherNewPictures]) {
        var batch = pendingCards[classId] ?? PendingSignInCards(classId: classId, className: className, classCode: classCode, students: [])
        let ids = Set(students.map(\.id))
        batch.students = batch.students.filter { !ids.contains($0.id) } + students
        batch.className = className
        batch.classCode = classCode
        pendingCards[classId] = batch
    }

    /// Account change (sign-out, expired session, someone else signing in):
    /// the pictures and their share-sheet PDFs go with it.
    func clearPendingCards() {
        pendingCards = [:]
        SignInCardsFiles.purge()
    }

    /// Only ever called by the teacher closing the cards.
    func dismissPendingCards(classId: String) {
        pendingCards[classId] = nil
    }

    private init() {
        viewMode = UserDefaults.standard.string(forKey: Self.viewModeKey) == ViewMode.family.rawValue
            ? .family : .teacher
    }

    /// computeTeacherMode on the web. A class account never gets the teacher
    /// area whatever the stored view says, and neither does anyone while the
    /// session is still loading.
    func isTeacherMode(_ auth: AuthStore) -> Bool {
        guard !auth.loading else { return false }
        return auth.isTeacher && !auth.isStudent && viewMode == .teacher
    }

    func setViewMode(_ mode: ViewMode) {
        viewMode = mode
        UserDefaults.standard.set(mode.rawValue, forKey: Self.viewModeKey)
        if mode == .teacher { selectedTab = .account }
    }

    /// A bell row or a push tap: lands on the right tab; the screen there
    /// picks up `pendingRoute`.
    func open(_ route: TeacherRoute) {
        // A teacher in family view who taps an alert wants the teacher area.
        if viewMode == .family {
            viewMode = .teacher
            UserDefaults.standard.set(ViewMode.teacher.rawValue, forKey: Self.viewModeKey)
        }
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
        clearPendingCards()
        selectedTab = .dashboard
        pendingRoute = nil
        UserDefaults.standard.removeObject(forKey: Self.classKey)
    }
}

/// One class's sign-in cards waiting to be printed or saved.
struct PendingSignInCards: Identifiable, Equatable {
    let classId: String
    var className: String
    var classCode: String
    var students: [TeacherNewPictures]
    var id: String { classId }
}

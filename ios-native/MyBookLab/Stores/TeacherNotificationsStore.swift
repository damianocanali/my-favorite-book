// The teacher's bell: the latest 50 notifications and the unread count.
// Mirrors src/components/school/NotificationBell.jsx — polled every 60 s
// while the teacher area is on screen (TeacherTabView owns that loop), and
// refreshed whenever a push arrives in the foreground.
import Foundation
import Observation

@Observable
@MainActor
final class TeacherNotificationsStore {
    static let shared = TeacherNotificationsStore()

    private(set) var items: [TeacherNotification] = []
    private(set) var unread = 0
    private(set) var failed = false

    static let pollInterval: Duration = .seconds(60)

    private var token: String? {
        let auth = AuthStore.shared
        return auth.isTeacher && !auth.isStudent ? auth.accessToken : nil
    }

    func load() async {
        guard let token else { return }
        do {
            let res = try await APIClient.shared.teacherNotifications(bearerToken: token)
            items = res.notifications ?? []
            unread = res.unread ?? 0
            failed = false
        } catch {
            failed = true
        }
    }

    /// Optimistic; a failed write reloads the truth.
    func markAllRead() async {
        guard let token else { return }
        let now = TeacherDates.iso(Date())
        items = items.map { var n = $0; if n.read_at == nil { n.read_at = now }; return n }
        unread = 0
        do {
            try await APIClient.shared.teacherMarkNotificationsRead(ids: nil, bearerToken: token)
        } catch {
            await load()
        }
    }

    func markRead(_ n: TeacherNotification) {
        guard n.read_at == nil, let token else { return }
        if let i = items.firstIndex(where: { $0.id == n.id }) {
            items[i].read_at = TeacherDates.iso(Date())
        }
        unread = max(0, unread - 1)
        Task { try? await APIClient.shared.teacherMarkNotificationsRead(ids: [n.id], bearerToken: token) }
    }

    /// "9+" past nine, nil at zero (web: unreadBadge).
    var badge: String? {
        guard unread > 0 else { return nil }
        return unread > 9 ? "9+" : String(unread)
    }

    func clear() {
        items = []
        unread = 0
        failed = false
    }
}

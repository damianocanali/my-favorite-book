// Types shared between the main app and the MyBookLabWidgets extension
// (this file is a member of BOTH targets — see project.yml). Keep it
// dependency-free: no Book model, no stores, just plain Codable data
// flowing through the App Group.
import ActivityKit
import Foundation

enum WidgetShared {
    static let appGroupId = "group.com.myfavoritebook.app"
    static let snapshotKey = "widget_snapshot"

    static var defaults: UserDefaults? { UserDefaults(suiteName: appGroupId) }

    static func loadSnapshot() -> WidgetSnapshot? {
        guard let data = defaults?.data(forKey: snapshotKey) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    static func save(_ snapshot: WidgetSnapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        defaults?.set(data, forKey: snapshotKey)
    }
}

/// What the home-screen widget renders. Written by the app whenever the
/// bookshelf or streak changes.
struct WidgetSnapshot: Codable {
    var latestBookId: String?
    var latestBookTitle: String?
    var latestBookEmoji: String?
    var latestCoverColorHex: String?
    var booksCount: Int = 0
    var currentStreak: Int = 0
    var updatedAt: Date = Date()
}

/// Live Activity for a print order's journey (created → printing →
/// shipped → delivered). Updated while the app is foregrounded and
/// polling order status — there's no push pipeline yet, so `staleDate`
/// marks the activity stale after a few hours instead of lying.
struct PrintOrderActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var status: String // PrintOrderStatus rawValue
        var updatedAt: Date
    }

    var orderId: String
    var bookTitle: String
}

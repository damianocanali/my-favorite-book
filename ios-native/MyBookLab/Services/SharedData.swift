// App-side bridge to the widget: snapshots the bookshelf + streak into
// the App Group whenever they change, then asks WidgetKit to redraw.
// (Widget-side reading lives in WidgetShared.swift, which both targets
// compile.)
import Foundation
import WidgetKit

@MainActor
enum SharedData {
    static func updateBooks(_ books: [Book]) {
        var snapshot = WidgetShared.loadSnapshot() ?? WidgetSnapshot()
        let latest = books.first
        snapshot.latestBookId = latest?.id
        snapshot.latestBookTitle = latest?.title
        snapshot.latestBookEmoji = latest?.characters.first?.emoji ?? latest?.setting?.emoji
        snapshot.latestCoverColorHex = latest?.colors?.cover
        snapshot.booksCount = books.count
        snapshot.updatedAt = Date()
        WidgetShared.save(snapshot)
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func updateStreak(_ streak: Int) {
        var snapshot = WidgetShared.loadSnapshot() ?? WidgetSnapshot()
        guard snapshot.currentStreak != streak else { return }
        snapshot.currentStreak = streak
        snapshot.updatedAt = Date()
        WidgetShared.save(snapshot)
        WidgetCenter.shared.reloadAllTimelines()
    }
}

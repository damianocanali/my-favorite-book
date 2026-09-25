// Check-in state, and the only place entries are written.
//
// UserDefaults, never the network. This is the single most important
// constraint in the design: the moment these are posted anywhere they become
// sensitive data about a child under GDPR, they trigger a DPIA, and — more
// practically — children answer dishonestly once they know a grown-up is
// reading. The web side has a test that fails if any file importing the store
// gains a network call; the equivalent discipline here is that this file
// imports Foundation and nothing else.
//
// Deliberately NOT in the App Group suite that WidgetShared uses. The widget
// has no business reading a child's feelings, and putting them in the shared
// container is how it would start.

import Foundation
import Observation

@Observable
final class CheckInStore {
    /// What the sheet is currently showing, or nil when it is closed.
    enum Stage: Equatable {
        case feeling
        case need(Feeling)
    }

    static let shared = CheckInStore()

    private(set) var entries: [CheckInEntry] = []
    var stage: Stage?

    /// Set when a child picks "I need help". The check-in host cannot open
    /// Story Buddy itself — StoryBuddyView needs the current book and page,
    /// which only the editor knows — so the request is published here and the
    /// editor answers it. One-shot: whoever handles it clears it.
    var wantsStoryBuddy = false

    /// The most recent entry, which the host watches to decide what to open.
    var latest: CheckInEntry? { entries.last }

    private let defaults: UserDefaults
    private let storageKey = "checkin.entries.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        load()
    }

    // MARK: - Flow

    func open() { stage = .feeling }

    /// Step 1. Recording nothing yet: a child who closes here has said nothing,
    /// and forcing disclosure teaches them to dismiss the sheet on sight.
    func choose(_ feeling: Feeling) { stage = .need(feeling) }

    /// Step 2. Writes the entry and closes.
    func choose(_ need: Need) {
        guard case .need(let feeling) = stage else { return }
        append(CheckInEntry(at: Date(), feeling: feeling, need: need))
        stage = nil
    }

    /// Closing the sheet. From step 2 the feeling is kept without a need —
    /// they told us how they were, just not what would help.
    func dismiss() {
        if case .need(let feeling) = stage {
            append(CheckInEntry(at: Date(), feeling: feeling, need: nil))
        }
        stage = nil
    }

    // MARK: - Lifecycle

    /// Entries are per-child and never leave the device, so they must not
    /// survive a change of who is using the app. Called on sign-out and on any
    /// identity change, matching the web's useAuthStore.
    func clear() {
        entries = []
        stage = nil
        defaults.removeObject(forKey: storageKey)
    }

    // MARK: - Storage

    private func append(_ entry: CheckInEntry) {
        entries = pruneCheckIns(entries + [entry])
        save()
    }

    private func load() {
        guard let data = defaults.data(forKey: storageKey) else { return }
        // A decode failure drops the history rather than crashing. Losing a
        // few stars is survivable; refusing to open the app is not.
        let decoded = (try? JSONDecoder().decode([CheckInEntry].self, from: data)) ?? []
        entries = pruneCheckIns(decoded)
        // Pruning on load is what actually enforces the 30-day cap — a child
        // who does not check in for a month would otherwise keep old entries
        // indefinitely, since nothing else runs.
        if entries.count != decoded.count { save() }
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(entries) else { return }
        defaults.set(data, forKey: storageKey)
    }
}

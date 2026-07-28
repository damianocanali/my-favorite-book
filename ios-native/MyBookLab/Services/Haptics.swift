// Tiny haptics wrapper so feedback feels consistent app-wide.
// Generators are kept around as static instances so the first
// invocation is instant (prepare() warms the haptic engine).
import UIKit

enum Haptics {
    private static let lightImpact: UIImpactFeedbackGenerator = {
        let g = UIImpactFeedbackGenerator(style: .light); g.prepare(); return g
    }()
    private static let mediumImpact: UIImpactFeedbackGenerator = {
        let g = UIImpactFeedbackGenerator(style: .medium); g.prepare(); return g
    }()
    private static let success: UINotificationFeedbackGenerator = {
        let g = UINotificationFeedbackGenerator(); g.prepare(); return g
    }()

    @MainActor static func tap()      { lightImpact.impactOccurred() }
    @MainActor static func bigTap()   { mediumImpact.impactOccurred() }
    @MainActor static func celebrate() { success.notificationOccurred(.success) }

    /// A little drumroll of taps after the success buzz — for the big
    /// moments (finishing a book, earning a badge).
    ///
    /// Uses a Task with sleeps rather than DispatchQueue.asyncAfter: the
    /// escaping closure there isn't actor-isolated, so calling the
    /// @MainActor bigTap() from it trips strict-concurrency checking.
    @MainActor static func burst() {
        celebrate()
        Task { @MainActor in
            for gap in [0.18, 0.16, 0.14] {
                try? await Task.sleep(nanoseconds: UInt64(gap * 1_000_000_000))
                bigTap()
            }
        }
    }
}

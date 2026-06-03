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
}

// Device-shake detection for SwiftUI. UIKit delivers shakes through the
// responder chain (`motionEnded`), and the UIWindow is always the last
// responder — so overriding it there catches shakes no matter which
// view or text field currently has focus. The override posts a
// notification that the `.onShake` modifier subscribes to.
import Combine
import SwiftUI
import UIKit

extension UIWindow {
    static let deviceDidShake = Notification.Name("deviceDidShake")

    open override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        if motion == .motionShake {
            NotificationCenter.default.post(name: UIWindow.deviceDidShake, object: nil)
        }
        super.motionEnded(motion, with: event)
    }
}

extension View {
    /// Runs `action` when the user shakes the device. The notification
    /// is app-wide, so attach this once per concern (e.g. at the tab
    /// root), not on every screen.
    func onShake(perform action: @escaping () -> Void) -> some View {
        onReceive(NotificationCenter.default.publisher(for: UIWindow.deviceDidShake)) { _ in
            action()
        }
    }
}

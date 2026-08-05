// Respecting the "Reduce Motion" accessibility setting.
//
// The app leans hard on perpetual motion — drifting nebulae, a pulsing
// logo, shimmering placeholders, a floating mascot, confetti. That is
// the point for most kids, but for a motion-sensitive child (or an adult
// with a vestibular disorder reading over their shoulder) it is the
// difference between usable and not. iOS already asks the user; we just
// have to listen.
//
// Two helpers, because there are two cases:
//   - looping ambience, which should simply not loop
//   - one-shot celebrations, which should still happen, just calmly
import SwiftUI

extension View {
    /// Runs `body` inside `withAnimation` on appear — unless Reduce
    /// Motion is on, in which case the state change is applied without
    /// animation so the view settles into its resting pose immediately.
    ///
    /// Use for the perpetual `repeatForever` ambience. Those animations
    /// never reach a resting state on their own, so gating them at the
    /// call site is the only way to stop them.
    func loopingAnimation(
        _ animation: Animation,
        enabled: Bool = true,
        _ body: @escaping () -> Void
    ) -> some View {
        modifier(LoopingAnimation(animation: animation, enabled: enabled, body: body))
    }
}

private struct LoopingAnimation: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let animation: Animation
    let enabled: Bool
    let body: () -> Void

    func body(content: Content) -> some View {
        content.onAppear {
            guard enabled else { return }
            if reduceMotion {
                // No withAnimation: the property still moves to its final
                // value, so anything depending on it stays correct.
                body()
            } else {
                withAnimation(animation) { body() }
            }
        }
    }
}

// For the one-shot cases — skipping confetti, swapping a spring for a
// fade — read `@Environment(\.accessibilityReduceMotion)` directly in
// the view. There is no wrapper worth adding over a single property.

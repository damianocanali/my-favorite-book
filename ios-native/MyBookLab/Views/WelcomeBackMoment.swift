// The launch beat. Streak and coins existed but only surfaced on the
// Account screen, so a child never saw the numbers they were earning.
//
// SwiftUI port of src/components/ui/WelcomeBackMoment.jsx. Deliberately
// once per launch and tap-anywhere to dismiss: for ages 4-8 a
// celebration that blocks the way becomes the thing they learn to tap
// through. It also never shows when signed out, since there is nothing
// to welcome anyone back to.
import SwiftUI

/// Mascot art is optional — falls back to a star until the asset exists,
/// so this ships ahead of the artwork exactly as the web version does.
private struct Mascot: View {
    @State private var floating = false

    private var artwork: Image? {
        UIImage(named: "Mascot").map { Image(uiImage: $0) }
    }

    var body: some View {
        Group {
            if let artwork {
                artwork
                    .resizable()
                    .scaledToFit()
                    .frame(width: 112, height: 112)
                    .shadow(color: Color(red: 0.75, green: 0.35, blue: 0.95).opacity(0.6), radius: 24, y: 8)
                    .offset(y: floating ? -8 : 0)
                    .animation(.easeInOut(duration: 1.3).repeatForever(autoreverses: true), value: floating)
            } else {
                Text("⭐")
                    .font(.system(size: 72))
                    .rotationEffect(.degrees(floating ? 6 : -6))
                    .animation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true), value: floating)
            }
        }
        .onAppear { floating = true }
        .accessibilityHidden(true)
    }
}

struct WelcomeBackMoment: View {
    @Environment(AuthStore.self) private var auth
    @Environment(RewardsStore.self) private var rewards
    @Environment(CoinsStore.self) private var coins
    @Environment(AudioService.self) private var audio

    /// The iOS analog of the web's sessionStorage flag: static, so it
    /// survives view rebuilds and tab switches, but resets on a cold
    /// launch — which is exactly what "once per session" should mean.
    @MainActor private static var shownThisLaunch = false

    @State private var open = false

    // Matches the web: wait for the streak/coins reads kicked off at
    // launch so the numbers are real rather than animating up from zero.
    private let appearDelay: Duration = .milliseconds(900)
    private let holdDuration: Duration = .milliseconds(4200)

    /// Signing out mid-celebration cancels the task that would have
    /// auto-dismissed it, so gate on the session too rather than leaving
    /// a stranded overlay. Mirrors the web's `if (!user) return null`.
    private var visible: Bool { open && auth.isSignedIn }

    var body: some View {
        ZStack {
            if visible {
                // Material first, tint on top: reversing these clips the
                // blur to the tint's pre-ignoresSafeArea bounds.
                Color.black.opacity(0.55)
                    .background(.ultraThinMaterial)
                    .ignoresSafeArea()
                    .onTapGesture { dismiss() }

                VStack(spacing: 20) {
                    Mascot()

                    HStack(spacing: 12) {
                        StatPill(icon: "🔥", value: rewards.currentStreak, label: "Day streak", tone: .flame)
                        StatPill(icon: "🪙", value: coins.balance, label: "Coins")
                    }

                    Text(rewards.currentStreak > 0
                         ? "Write today to reach day \(rewards.currentStreak + 1)!"
                         : "Write something today to start a streak!")
                        .font(.system(.subheadline, design: .rounded))
                        .foregroundStyle(.white.opacity(0.7))
                        .multilineTextAlignment(.center)

                    Text("Tap anywhere to continue")
                        .font(.system(.caption, design: .rounded))
                        .foregroundStyle(.white.opacity(0.4))
                }
                .padding(.horizontal, 24)
                .padding(.top, 140)
                .contentShape(Rectangle())
                .onTapGesture { dismiss() }
                .transition(.scale(scale: 0.9).combined(with: .opacity))
            }
        }
        // Full-screen and stable in both states, so the banner overlay
        // has real geometry to align against on the frame it appears.
        // Hit testing is off while closed or the invisible overlay would
        // swallow taps meant for the tab bar underneath.
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .allowsHitTesting(visible)
        .gameBanner(
            show: visible,
            text: "Welcome back!",
            sub: auth.displayName.map { "Good to see you, \($0)" }
        )
        .task(id: auth.user?.id) {
            guard auth.isSignedIn, !Self.shownThisLaunch else { return }
            try? await Task.sleep(for: appearDelay)
            guard !Task.isCancelled, auth.isSignedIn else { return }

            Self.shownThisLaunch = true
            audio.playSFX(.sparkle)
            Haptics.bigTap()
            withAnimation(.spring(response: 0.42, dampingFraction: 0.7)) { open = true }

            try? await Task.sleep(for: holdDuration)
            guard !Task.isCancelled else { return }
            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { open = false }
        }
    }

    private func dismiss() {
        guard open else { return }
        Haptics.tap()
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { open = false }
    }
}

#Preview {
    ZStack {
        CosmicBackground()
        WelcomeBackMoment()
    }
    .environment(AuthStore.shared)
    .environment(RewardsStore.shared)
    .environment(CoinsStore.shared)
    .environment(AudioService.shared)
}

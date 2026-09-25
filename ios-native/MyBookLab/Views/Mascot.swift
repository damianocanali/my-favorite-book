// The mascot, shared by every celebration so the character stays
// consistent. SwiftUI counterpart of src/components/ui/Mascot.jsx — same
// moods, same poses, same motion presets.
//
// Each mood maps to its own drawn pose plus motion chosen to suit it: a
// waving pose rocks, a mid-jump pose bounces, an arms-open pose breathes.
// Animating every pose identically would waste the fact that they are
// drawn differently.
//
// Art is optional at every level. A missing pose falls back to the generic
// "Mascot" image, and a missing mascot falls back to an emoji, so nothing
// renders broken while the asset catalog is still empty.
import SwiftUI

enum MascotMood: String {
    case idle, wave, welcome, cheer, think, proud, badge

    /// Asset-catalog name for this pose.
    var asset: String {
        switch self {
        case .idle, .wave, .think: "MascotWelcoming"
        case .welcome:             "MascotWelcomeBack"
        case .cheer:               "MascotCheering"
        case .proud, .badge:       "MascotBadge"
        }
    }

    /// Whether this mood pulses with a warm bloom. Previously this named a
    /// second imageset to cross-fade; see the comment on the shadow in `body`
    /// for why that was wrong.
    var glows: Bool {
        switch self {
        case .proud, .badge: true
        default:             false
        }
    }

    var emoji: String {
        switch self {
        case .idle:            "⭐"
        case .wave:            "👋"
        case .welcome:         "🤗"
        case .cheer:           "🎉"
        case .think:           "🤔"
        case .proud, .badge:   "🏅"
        }
    }
}

private struct Motion {
    var yTravel: CGFloat = 0
    var rotation: Double = 0
    var scaleTo: CGFloat = 1
    var duration: Double = 2.8
    /// false = a burst that settles. A cheer that never stops stops
    /// reading as a cheer.
    var loops: Bool = true
}

private func motion(for mood: MascotMood) -> Motion {
    switch mood {
    case .idle:          Motion(yTravel: -8, duration: 2.8)
    case .wave:          Motion(rotation: 5, duration: 1.4)
    case .welcome:       Motion(yTravel: -5, scaleTo: 1.04, duration: 3.2)
    case .cheer:         Motion(yTravel: -28, scaleTo: 1.06, duration: 0.62, loops: false)
    case .think:         Motion(yTravel: -4, rotation: -4, duration: 2.6)
    case .proud, .badge: Motion(yTravel: -6, duration: 2.4)
    }
}

struct Mascot: View {
    var mood: MascotMood = .idle
    var size: CGFloat = 112

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var animating = false
    @State private var glowing = false

    private var artwork: Image? {
        if let img = UIImage(named: mood.asset) { return Image(uiImage: img) }
        if let generic = UIImage(named: "Mascot") { return Image(uiImage: generic) }
        return nil
    }


    var body: some View {
        let m = motion(for: mood)

        Group {
            if let artwork {
                artwork
                    .resizable()
                    .scaledToFit()
                    // Height, not a square. The poses are not square and are
                    // not even a consistent shape — welcoming is 0.66 wide-to-
                    // tall, badge is 0.85 — so a size x size frame rendered
                    // welcoming at 66% of the box and badge at 85%, which is
                    // why he looked small, and why he changed size whenever the
                    // mood changed. He is a standing character; his height is
                    // the thing that should stay put.
                    .frame(height: size)
                    // A real bloom rather than a second image. The old glow
                    // cross-faded MascotBadgeGlow over MascotBadge as if they
                    // were two frames of one drawing. They are two different
                    // poses — different stance, different arm, different badge
                    // — sliced from different cells of the sheet, so the
                    // cross-fade morphed him instead of lighting him up, and
                    // the two rendered 37pt apart in width besides.
                    .shadow(
                        color: Color(red: 1.0, green: 0.85, blue: 0.4)
                            .opacity(mood.glows && !reduceMotion ? (glowing ? 0.85 : 0.25) : 0),
                        radius: glowing ? 26 : 12
                    )
                    .animation(
                        mood.glows && !reduceMotion
                            ? .easeInOut(duration: 1.8).repeatForever(autoreverses: true)
                            : nil,
                        value: glowing
                    )
                    .shadow(color: Color(red: 0.75, green: 0.35, blue: 0.95).opacity(0.45), radius: 20, y: 8)
            } else {
                Text(mood.emoji)
                    .font(.system(size: size * 0.64))
            }
        }
        .offset(y: animating ? m.yTravel : 0)
        .rotationEffect(.degrees(animating ? m.rotation : -m.rotation))
        .scaleEffect(animating ? m.scaleTo : 1)
        .animation(loopAnimation(m), value: animating)
        .onAppear {
            animating = true
            glowing = true
        }
        .accessibilityHidden(true)
    }

    /// nil under Reduce Motion, so the pose settles into place and stays put.
    private func loopAnimation(_ m: Motion) -> Animation? {
        guard !reduceMotion else { return nil }
        let base = Animation.easeInOut(duration: m.duration)
        return m.loops ? base.repeatForever(autoreverses: true) : base.repeatCount(2, autoreverses: true)
    }
}

#Preview {
    ZStack {
        CosmicBackground()
        VStack(spacing: 24) {
            HStack(spacing: 20) {
                Mascot(mood: .wave, size: 90)
                Mascot(mood: .cheer, size: 90)
                Mascot(mood: .welcome, size: 90)
            }
            Mascot(mood: .badge, size: 110)
        }
    }
}

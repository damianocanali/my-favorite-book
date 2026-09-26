// The child's own check-ins, as a constellation of named feelings.
//
// No counts, no charts, no streaks. The obvious version of this panel reads
// "angry: 8 this week", which teaches a child that some feelings are a bad
// score. So each feeling they have noticed appears ONCE, as a star with its
// word beneath it, and the stars are joined by a faint line in the order each
// was last felt. The layout's message is: all of these are normal, and you
// noticed them.
//
// It used to be one unlabelled dot per check-in, which read as confetti: a
// child could not tell which colour was which feeling.
//
// Never surfaced in a celebration, never mentioned by the mascot, never shown
// unprompted. It lives on the Account screen and waits to be looked at.

import SwiftUI

struct FeelingConstellation: View {
    @Environment(CheckInStore.self) private var store

    /// The panel keeps the web's 320x200 shape, which is the geometry the
    /// no-overlap test in tests/constellation.test.js is written against.
    private let aspect: CGFloat = 320.0 / 200.0

    var body: some View {
        let feelings = constellationFeelings(store.entries)

        VStack(alignment: .leading, spacing: 10) {
            Text("How you've been")
                .font(.system(.headline, design: .rounded))
                .foregroundStyle(.white)

            if feelings.isEmpty {
                Text("Your check-ins will show up here, as stars.")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.6))
            } else {
                GeometryReader { geo in
                    let pts = points(for: feelings, in: geo.size)
                    ZStack(alignment: .topLeading) {
                        backgroundStars(in: geo.size)

                        if pts.count > 1 {
                            Path { path in
                                path.move(to: pts[0])
                                for p in pts.dropFirst() { path.addLine(to: p) }
                            }
                            .stroke(.white.opacity(0.28),
                                    style: StrokeStyle(lineWidth: 1, lineCap: .round, dash: [2, 3]))
                        }

                        ForEach(Array(feelings.enumerated()), id: \.element) { i, feeling in
                            star(feeling, at: pts[i], width: geo.size.width)
                        }
                    }
                }
                .aspectRatio(aspect, contentMode: .fit)
                .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 16))
                // One sentence for the whole picture, in the child's language.
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text(feelings.map { String(localized: $0.displayName) }
                                            .formatted(.list(type: .and))))
            }
        }
    }

    private func points(for feelings: [Feeling], in size: CGSize) -> [CGPoint] {
        let layout = constellationLayouts[min(feelings.count, constellationLayouts.count - 1)]
        return layout.map { CGPoint(x: $0.x * size.width, y: $0.y * size.height) }
    }

    private func star(_ feeling: Feeling, at p: CGPoint, width: CGFloat) -> some View {
        let tone = color(for: feeling)
        // The word sits in a fixed-width box anchored the way the web anchors
        // its SVG text: left-aligned from just left of the star near the left
        // edge, right-aligned near the right edge, centred elsewhere. Plain
        // .position, no measuring, so it lands the same way every time.
        let box = width * 0.46
        let (align, x): (Alignment, CGFloat) =
            p.x < width * 0.2 ? (.leading, p.x - 6 + box / 2)
          : p.x > width * 0.8 ? (.trailing, p.x + 6 - box / 2)
          : (.center, p.x)
        return ZStack {
            ZStack {
                Circle().fill(tone).frame(width: 10, height: 10).blur(radius: 3)
                Circle().fill(tone).frame(width: 10, height: 10)
                Circle().fill(.white).frame(width: 4, height: 4)
            }
            .position(p)

            Text(feeling.displayName)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(tone)
                .lineLimit(1)
                .frame(width: box, alignment: align)
                // The web draws the baseline 19 below the star; the text's
                // centre sits ~15 below.
                .position(x: x, y: p.y + 15)
        }
    }

    /// A few fixed faint stars, so a single feeling still sits in a sky.
    private func backgroundStars(in size: CGSize) -> some View {
        let dots: [CGPoint] = [.init(x: 0.08, y: 0.11), .init(x: 0.94, y: 0.15), .init(x: 0.47, y: 0.06),
                               .init(x: 0.19, y: 0.9), .init(x: 0.88, y: 0.92), .init(x: 0.6, y: 0.7)]
        return ForEach(dots.indices, id: \.self) { i in
            Circle().fill(.white.opacity(0.35)).frame(width: 2, height: 2)
                .position(x: dots[i].x * size.width, y: dots[i].y * size.height)
        }
    }

    private func color(for feeling: Feeling) -> Color {
        switch feeling.tone {
        case "gold":   return Color(red: 1.0, green: 0.84, blue: 0.04)
        case "purple": return Color(red: 0.75, green: 0.35, blue: 0.95)
        case "blue":   return Color(red: 0.39, green: 0.82, blue: 1.0)
        case "cyan":   return Color(red: 0.4, green: 0.85, blue: 1.0)
        case "pink":   return Color(red: 1.0, green: 0.22, blue: 0.37)
        default:       return Color(red: 0.65, green: 0.55, blue: 1.0)
        }
    }
}

/// The permanent way in. Unlimited and never interrupting — this is the one
/// that matters for a child who is actually struggling, and the reason the
/// spec rejected a random prompt: interrupting an ADHD child who has finally
/// reached flow is actively harmful.
struct CheckInButton: View {
    @Environment(CheckInStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var nudge = false

    var body: some View {
        Button { store.open() } label: {
            VStack(spacing: 2) {
                Mascot(mood: .welcome, size: 38)
                    // A small wiggle every few seconds, so a child reads the
                    // mascot as something to tap rather than decoration. It
                    // repeats rather than playing once: a child who missed it
                    // the first time is exactly the one who needs it. Never an
                    // interruption — no sound, no haptic, nothing that pulls
                    // focus from the writing — and absent under Reduce Motion.
                    .rotationEffect(.degrees(nudge ? 8 : 0), anchor: .bottom)
                // The words do the rest: a picture alone does not say "for you".
                Text("How are you?")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.85))
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .multilineTextAlignment(.center)
            }
            .frame(width: 58)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("How are you doing?")
        .accessibilityHint("Opens a check-in")
        .task {
            guard !reduceMotion else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(6))
                for _ in 0..<2 {
                    withAnimation(.easeInOut(duration: 0.12)) { nudge = true }
                    try? await Task.sleep(for: .milliseconds(130))
                    withAnimation(.easeInOut(duration: 0.12)) { nudge = false }
                    try? await Task.sleep(for: .milliseconds(130))
                }
            }
        }
    }
}

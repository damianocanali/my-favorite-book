// The "announcement" beat from casual games: chunky extruded lettering on
// a ribbon that springs in, holds, and springs out. Used for WELCOME BACK
// and the other moments that currently pass by silently.
//
// SwiftUI port of src/components/ui/GameBanner.jsx — same palette, same
// spring, same stacked-offset stroke, so the two platforms read as one
// product. Palette is deliberately ours (cosmic purple + gold) rather
// than the flat reference look: it has to sit on the nebula background.
import SwiftUI

struct GameBanner: View {
    let text: String
    var sub: String?

    // The stroke is drawn by stacking offset copies behind the fill.
    // SwiftUI has no text-stroke, and the obvious alternative — an
    // outline via .stroke on a Text shape — needs the glyph outlines,
    // which means dropping to Core Text for what eight copies do fine.
    private static let strokeOffsets: [CGSize] = [
        .init(width: -2, height: -2), .init(width: 2, height: -2),
        .init(width: -2, height: 2), .init(width: 2, height: 2),
        .init(width: 0, height: -3), .init(width: 0, height: 3),
        .init(width: -3, height: 0), .init(width: 3, height: 0),
    ]

    private static let gold = Color(red: 1.0, green: 0.839, blue: 0.039)      // #FFD60A
    private static let goldLight = Color(red: 1.0, green: 0.902, blue: 0.541) // #FFE68A
    private static let goldDeep = Color(red: 1.0, green: 0.624, blue: 0.039)  // #FF9F0A
    private static let strokeInk = Color(red: 0.227, green: 0.067, blue: 0.388) // #3A1163

    var body: some View {
        // Tails go in a background rather than an overlay so they emerge
        // from behind the ribbon. A GeometryReader here would be greedy
        // and stretch the banner to fill whatever it's placed in.
        ribbon
            .background(alignment: .leading) { tail.offset(x: -12) }
            .background(alignment: .trailing) { tail.offset(x: 12) }
            .allowsHitTesting(false)
    }

    private var ribbon: some View {
        VStack(spacing: 4) {
            ZStack {
                ForEach(Array(Self.strokeOffsets.enumerated()), id: \.offset) { _, shift in
                    lettering
                        .foregroundStyle(Self.strokeInk)
                        .offset(x: shift.width, y: shift.height)
                }
                lettering
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Self.goldLight, Self.gold, Self.goldDeep],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
            }
            .accessibilityElement()
            .accessibilityLabel(text)

            if let sub {
                Text(sub)
                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                    .foregroundStyle(.white.opacity(0.85))
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, 32)
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 26)
                .fill(LinearGradient(
                    colors: [Color(red: 0.290, green: 0.118, blue: 0.478),  // #4A1E7A
                             Color(red: 0.478, green: 0.180, blue: 0.588)], // #7A2E96
                    startPoint: .topLeading, endPoint: .bottomTrailing
                ))
                .overlay(
                    RoundedRectangle(cornerRadius: 26)
                        .strokeBorder(Self.gold, lineWidth: 3)
                )
                .shadow(color: .purple.opacity(0.6), radius: 24, y: 10)
        )
    }

    private var lettering: some View {
        Text(text.uppercased())
            .font(.system(size: 34, weight: .heavy, design: .rounded))
            .tracking(1.5)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
    }

    // A little gold tail, so it reads as a ribbon rather than a box.
    private var tail: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(Self.gold)
            .frame(width: 24, height: 20)
            .rotationEffect(.degrees(45))
    }
}

extension View {
    /// Presents a GameBanner over the receiver with the shared spring.
    /// Kept as a modifier so every caller gets identical motion.
    func gameBanner(show: Bool, text: String, sub: String? = nil) -> some View {
        overlay(alignment: .top) {
            if show {
                GameBanner(text: text, sub: sub)
                    .padding(.horizontal, 16)
                    .padding(.top, 120)
                    .transition(
                        .asymmetric(
                            insertion: .scale(scale: 0.55).combined(with: .opacity),
                            removal: .scale(scale: 0.7).combined(with: .opacity)
                        )
                    )
            }
        }
        .animation(.spring(response: 0.42, dampingFraction: 0.55), value: show)
    }
}

#Preview {
    ZStack {
        CosmicBackground()
        GameBanner(text: "Welcome back!", sub: "Good to see you, Theo")
    }
}

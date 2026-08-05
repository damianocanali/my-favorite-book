// The HUD counter from the reference: rounded pill, gold border, icon +
// number. Coins and the streak only ever appeared on the Account screen,
// so a child never saw them move — the pop on change is the whole point.
//
// SwiftUI port of src/components/ui/StatPill.jsx.
import SwiftUI

struct StatPill: View {
    let icon: String
    let value: Int
    let label: String
    var tone: Tone = .gold

    enum Tone {
        case gold, flame

        var border: Color {
            switch self {
            case .gold:  Color(red: 1.0, green: 0.839, blue: 0.039)  // #FFD60A
            case .flame: Color(red: 1.0, green: 0.624, blue: 0.039)  // #FF9F0A
            }
        }

        var text: Color {
            switch self {
            case .gold:  Color(red: 1.0, green: 0.902, blue: 0.541)  // #FFE68A
            case .flame: Color(red: 1.0, green: 0.769, blue: 0.541)  // #FFC48A
            }
        }

        var gradient: LinearGradient {
            let stops: [Color] = switch self {
            case .gold:  [Color(red: 0.290, green: 0.118, blue: 0.478),
                          Color(red: 0.478, green: 0.180, blue: 0.588)]
            case .flame: [Color(red: 0.353, green: 0.141, blue: 0.063),
                          Color(red: 0.576, green: 0.263, blue: 0.102)]
            }
            return LinearGradient(colors: stops, startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }

    @State private var scale: CGFloat = 1

    var body: some View {
        HStack(spacing: 6) {
            Text(icon)
                .font(.system(size: 16))
            Text("\(value)")
                .font(.system(.subheadline, design: .rounded).weight(.heavy))
                .foregroundStyle(tone.text)
                .contentTransition(.numericText())
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(tone.gradient)
                .overlay(Capsule().strokeBorder(tone.border, lineWidth: 2))
        )
        .scaleEffect(scale)
        .onChange(of: value) { _, _ in
            // Pop, then settle. Two springs rather than a keyframe so the
            // overshoot reads at any value delta.
            withAnimation(.spring(response: 0.18, dampingFraction: 0.5)) { scale = 1.25 }
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6).delay(0.18)) { scale = 1 }
        }
        .accessibilityElement()
        .accessibilityLabel(label)
        .accessibilityValue("\(value)")
    }
}

#Preview {
    ZStack {
        CosmicBackground()
        HStack(spacing: 12) {
            StatPill(icon: "🔥", value: 4, label: "Day streak", tone: .flame)
            StatPill(icon: "🪙", value: 1320, label: "Coins")
        }
    }
}

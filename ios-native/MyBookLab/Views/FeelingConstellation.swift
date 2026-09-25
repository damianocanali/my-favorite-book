// The child's own check-ins, as a constellation.
//
// No counts, no charts, no streaks. The obvious version of this panel reads
// "angry: 8 this week", which teaches a child that some feelings are a bad
// score; counts invite comparison and comparison invites shame. Each check-in
// is one star, coloured by feeling. The layout's message is: all of these are
// normal, and you noticed them.
//
// Never surfaced in a celebration, never mentioned by the mascot, never shown
// unprompted. It lives on the Account screen and waits to be looked at.

import SwiftUI

struct FeelingConstellation: View {
    @Environment(CheckInStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("How you've been")
                .font(.system(.headline, design: .rounded))
                .foregroundStyle(.white)

            if store.entries.isEmpty {
                Text("Your check-ins will show up here, as stars.")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.6))
            } else {
                GeometryReader { geo in
                    ZStack {
                        ForEach(Array(store.entries.enumerated()), id: \.element.id) { index, entry in
                            Circle()
                                .fill(color(for: entry.feeling))
                                .frame(width: 10, height: 10)
                                .position(position(index: index, total: store.entries.count, in: geo.size))
                                .opacity(0.9)
                                .accessibilityLabel(Text(accessibilityLabel(for: entry)))
                        }
                    }
                }
                .frame(height: 120)
                .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 16))
            }
        }
    }

    /// Scattered, not plotted. A deterministic hash keeps each star in the same
    /// place between launches — a constellation that reshuffles every time you
    /// open it is not a constellation — while avoiding a grid, which would
    /// read as a chart and invite exactly the counting this design refuses.
    private func position(index: Int, total: Int, in size: CGSize) -> CGPoint {
        let golden = 2.399963   // radians; spreads points without clustering
        let angle = Double(index) * golden
        let radius = sqrt(Double(index) + 0.5) / sqrt(Double(max(total, 1)))
        let x = 0.5 + 0.44 * radius * cos(angle)
        let y = 0.5 + 0.40 * radius * sin(angle)
        return CGPoint(x: x * size.width, y: y * size.height)
    }

    private func accessibilityLabel(for entry: CheckInEntry) -> String {
        let when = entry.at.formatted(date: .abbreviated, time: .omitted)
        return "\(entry.feeling.rawValue), \(when)"
    }

    private func color(for feeling: Feeling) -> Color {
        switch feeling.tone {
        case "gold":   return Color(red: 0.96, green: 0.77, blue: 0.32)
        case "purple": return Color(red: 0.65, green: 0.55, blue: 0.98)
        case "blue":   return Color(red: 0.38, green: 0.65, blue: 0.98)
        case "cyan":   return Color(red: 0.13, green: 0.83, blue: 0.93)
        case "pink":   return Color(red: 0.96, green: 0.45, blue: 0.71)
        default:       return Color(red: 0.51, green: 0.55, blue: 0.97)
        }
    }
}

/// The permanent way in. Unlimited and never interrupting — this is the one
/// that matters for a child who is actually struggling, and the reason the
/// spec rejected a random prompt: interrupting an ADHD child who has finally
/// reached flow is actively harmful.
struct CheckInButton: View {
    @Environment(CheckInStore.self) private var store

    var body: some View {
        Button { store.open() } label: {
            Mascot(mood: .welcome, size: 40)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("How are you doing?")
        .accessibilityHint("Opens a check-in")
    }
}

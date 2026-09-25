// The two-step check-in. "How are you doing?", then "What would help?".
//
// Escapable at either step. A child who closes after step 1 has recorded
// nothing; one who closes after step 2 has recorded the feeling without a need.
// Forced disclosure is worse than no check-in — a child who feels cornered
// learns to dismiss it on sight.
//
// Art is optional, exactly as on web: until the ten illustrations exist each
// tile shows a tinted dot, so the six feelings still read as six distinct
// things. Dropping Feeling<Name>/Need<Name> imagesets into Assets.xcassets is
// the only change the art needs.

import SwiftUI

struct CheckInSheet: View {
    @Environment(CheckInStore.self) private var store

    var body: some View {
        ZStack {
            CosmicBackground()
            if case .need = store.stage {
                tiles(
                    title: "What would help?",
                    items: Need.allCases.map { (id: $0.rawValue, label: label(for: $0), tone: nil as String?) },
                    columns: 2
                ) { id in
                    if let need = Need(rawValue: id) { store.choose(need) }
                }
            } else {
                tiles(
                    title: "How are you doing?",
                    items: Feeling.allCases.map { (id: $0.rawValue, label: label(for: $0), tone: $0.tone) },
                    columns: 3
                ) { id in
                    if let feeling = Feeling(rawValue: id) { store.choose(feeling) }
                }
            }
        }
    }

    private func tiles(
        title: LocalizedStringKey,
        items: [(id: String, label: LocalizedStringKey, tone: String?)],
        columns: Int,
        pick: @escaping (String) -> Void
    ) -> some View {
        VStack(spacing: 18) {
            Mascot(mood: .welcome, size: 72)

            Text(title)
                .font(.system(.title3, design: .rounded).bold())
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: columns), spacing: 12) {
                ForEach(items, id: \.id) { item in
                    Button { pick(item.id) } label: {
                        VStack(spacing: 8) {
                            CheckInTileArt(id: item.id, tone: item.tone)
                            Text(item.label)
                                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                                .foregroundStyle(.white)
                                // Italian runs long — "preoccupazione" is 14
                                // characters with nothing to wrap on — so the
                                // label gets two lines and shrinks rather than
                                // pushing its column wider than the sheet.
                                .lineLimit(2)
                                .minimumScaleFactor(0.75)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                        }
                        .padding(.vertical, 14)
                        .padding(.horizontal, 8)
                        .frame(maxWidth: .infinity)
                        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
                        .overlay(RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.15)))
                    }
                    .buttonStyle(.plain)
                }
            }

            Button("Close") { store.dismiss() }
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.6))
                .padding(.top, 2)
        }
        .padding(22)
        .frame(maxWidth: ContentWidth.form)
    }

    // The labels are separate literals rather than interpolated ids so the
    // String Catalog can extract each one and Italian can author them.
    // Italian uses NOUNS — rabbia, tristezza — never adjectives: adjectives
    // agree with the speaker's gender and the app never learns it, so
    // "sei arrabbiato/a" is the broken construction the Italian review flagged.
    private func label(for feeling: Feeling) -> LocalizedStringKey {
        switch feeling {
        case .happy:   return "Happy"
        case .proud:   return "Proud"
        case .tired:   return "Tired"
        case .worried: return "Worried"
        case .angry:   return "Angry"
        case .sad:     return "Sad"
        }
    }

    private func label(for need: Need) -> LocalizedStringKey {
        switch need {
        case .takeBreak: return "Take a break"
        case .quiet:     return "Make it quiet"
        case .help:      return "I need help"
        case .keepGoing: return "Keep going"
        }
    }
}

/// A tile's picture, falling back to a tinted dot until the art exists.
private struct CheckInTileArt: View {
    let id: String
    let tone: String?

    var body: some View {
        if let image = UIImage(named: assetName) {
            Image(uiImage: image).resizable().scaledToFit().frame(width: 48, height: 48)
        } else {
            Circle()
                .fill(color)
                .frame(width: 44, height: 44)
                .opacity(0.75)
        }
    }

    /// FeelingHappy / NeedBreak, etc. — the imageset names the art drop uses.
    private var assetName: String {
        let base = Feeling(rawValue: id) != nil ? "Feeling" : "Need"
        return base + id.split(separator: "_").map { $0.capitalized }.joined()
    }

    private var color: Color {
        switch tone {
        case "gold":   return Color(red: 0.96, green: 0.77, blue: 0.32)
        case "purple": return Color(red: 0.65, green: 0.55, blue: 0.98)
        case "blue":   return Color(red: 0.38, green: 0.65, blue: 0.98)
        case "cyan":   return Color(red: 0.13, green: 0.83, blue: 0.93)
        case "pink":   return Color(red: 0.96, green: 0.45, blue: 0.71)
        case "indigo": return Color(red: 0.51, green: 0.55, blue: 0.97)
        default:       return Color(red: 0.65, green: 0.55, blue: 0.98)
        }
    }
}

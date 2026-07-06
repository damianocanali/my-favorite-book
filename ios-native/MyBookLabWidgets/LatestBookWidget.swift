// Home-screen widget: the kid's latest book + writing streak, with a
// "Write today!" call to action. Data comes from the App Group snapshot
// the app writes (Services/SharedData.swift); tapping opens the Create
// tab via the mybooklab:// scheme.
import SwiftUI
import WidgetKit

struct LatestBookEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct LatestBookProvider: TimelineProvider {
    func placeholder(in context: Context) -> LatestBookEntry {
        LatestBookEntry(date: Date(), snapshot: WidgetSnapshot(
            latestBookTitle: "The Dragon's Bakery",
            latestBookEmoji: "🐉",
            booksCount: 3,
            currentStreak: 4
        ))
    }

    func getSnapshot(in context: Context, completion: @escaping (LatestBookEntry) -> Void) {
        completion(LatestBookEntry(date: Date(), snapshot: WidgetShared.loadSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LatestBookEntry>) -> Void) {
        // Content only changes when the app writes a new snapshot (it
        // calls reloadAllTimelines then); the hourly refresh just keeps
        // relative wording fresh.
        let entry = LatestBookEntry(date: Date(), snapshot: WidgetShared.loadSnapshot())
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600))))
    }
}

struct LatestBookWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: LatestBookEntry

    private var coverColor: Color {
        Color(fromHex: entry.snapshot?.latestCoverColorHex) ?? .purple
    }

    var body: some View {
        content
            .containerBackground(for: .widget) {
                LinearGradient(
                    colors: [Color(red: 0.10, green: 0.06, blue: 0.25),
                             Color(red: 0.22, green: 0.10, blue: 0.38)],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
            }
            .widgetURL(URL(string: "mybooklab://create"))
    }

    @ViewBuilder
    private var content: some View {
        if let snapshot = entry.snapshot, snapshot.booksCount > 0 {
            switch family {
            case .systemMedium: medium(snapshot)
            default: small(snapshot)
            }
        } else {
            emptyState
        }
    }

    private func small(_ snapshot: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            bookBadge(snapshot, size: 40)
            Spacer(minLength: 2)
            Text(snapshot.latestBookTitle ?? "My Books")
                .font(.system(.callout, design: .rounded).bold())
                .foregroundStyle(.white)
                .lineLimit(2)
            streakLine(snapshot)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func medium(_ snapshot: WidgetSnapshot) -> some View {
        HStack(spacing: 14) {
            bookBadge(snapshot, size: 64)
            VStack(alignment: .leading, spacing: 4) {
                Text(snapshot.latestBookTitle ?? "My Books")
                    .font(.system(.headline, design: .rounded).bold())
                    .foregroundStyle(.white)
                    .lineLimit(2)
                Text(snapshot.booksCount == 1 ? "1 book on your shelf"
                     : "\(snapshot.booksCount) books on your shelf")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
                streakLine(snapshot)
                Text("Tap to write today! ✨")
                    .font(.caption2.bold())
                    .foregroundStyle(.yellow)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var emptyState: some View {
        VStack(spacing: 6) {
            Text("📖").font(.system(size: 34))
            Text("Start your first story!")
                .font(.system(.caption, design: .rounded).bold())
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func bookBadge(_ snapshot: WidgetSnapshot, size: CGFloat) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: size / 5)
                .fill(LinearGradient(colors: [coverColor, coverColor.opacity(0.6)],
                                     startPoint: .top, endPoint: .bottom))
            Text(snapshot.latestBookEmoji ?? "📖")
                .font(.system(size: size * 0.55))
        }
        .frame(width: size, height: size * 1.25)
    }

    @ViewBuilder
    private func streakLine(_ snapshot: WidgetSnapshot) -> some View {
        if snapshot.currentStreak > 0 {
            Text("🔥 \(snapshot.currentStreak) day streak")
                .font(.caption2.bold())
                .foregroundStyle(.orange)
        }
    }
}

struct LatestBookWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LatestBookWidget", provider: LatestBookProvider()) { entry in
            LatestBookWidgetView(entry: entry)
        }
        .configurationDisplayName("My Latest Book")
        .description("Your newest story and writing streak.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// Local hex parser — the widget target doesn't compile the app's
// Color(hex:) helper, and this keeps the shared file UI-free.
extension Color {
    init?(fromHex hex: String?) {
        guard var hex = hex?.trimmingCharacters(in: .whitespaces), !hex.isEmpty else { return nil }
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 6, let value = UInt64(hex, radix: 16) else { return nil }
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}

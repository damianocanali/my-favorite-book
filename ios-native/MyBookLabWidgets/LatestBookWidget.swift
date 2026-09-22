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
            titleText(snapshot)
                .font(.system(.callout, design: .rounded).bold())
                .foregroundStyle(.white)
                .lineLimit(2)
                // systemSmall has no room to grow: the fixed .callout and
                // a title that runs 15-25% longer in Italian would clip
                // without a scale floor.
                .minimumScaleFactor(0.7)
            streakLine(snapshot)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func medium(_ snapshot: WidgetSnapshot) -> some View {
        HStack(spacing: 14) {
            bookBadge(snapshot, size: 64)
            VStack(alignment: .leading, spacing: 4) {
                titleText(snapshot)
                    .font(.system(.headline, design: .rounded).bold())
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                // Was a hand-rolled plural (`count == 1 ? "1 book" : "N books"`),
                // which only ever encodes English's two forms. Now one key
                // with the count as its argument, pluralized by automatic
                // grammar agreement — the catalog carries the inflection and
                // each language applies its own rules.
                //
                // It goes through `AttributedString(localized:)` on purpose:
                // `String(localized:)` does NOT run the inflection pass and
                // would render the raw "^[...](inflect: true)" markup.
                Text(AttributedString(
                    localized: "widget.shelf.book_count",
                    defaultValue: "^[\(snapshot.booksCount) book](inflect: true) on your shelf",
                    comment: "Widget subtitle counting the books on the shelf, e.g. \"3 books on your shelf\""))
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                streakLine(snapshot)
                Text("Tap to write today! ✨", comment: "Widget call to action")
                    .font(.caption2.bold())
                    .foregroundStyle(.yellow)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var emptyState: some View {
        VStack(spacing: 6) {
            Text(verbatim: "📖").font(.system(size: 34))
            Text("Start your first story!", comment: "Widget empty state, no books yet")
                .font(.system(.caption, design: .rounded).bold())
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// The book's title is user DATA and must stay verbatim; the fallback
    /// is UI copy and must be translatable.
    ///
    /// Written as one expression, `snapshot.latestBookTitle ?? "My Books"`
    /// types as `String`, which selects `Text`'s NON-localizing
    /// initializer — the fallback never reached the catalog and stayed
    /// English forever. Splitting the branches puts the fallback through a
    /// `LocalizedStringKey` literal while the title goes through
    /// `Text(verbatim:)`.
    @ViewBuilder
    private func titleText(_ snapshot: WidgetSnapshot) -> some View {
        if let title = snapshot.latestBookTitle {
            Text(verbatim: title)
        } else {
            Text("My Books", comment: "Widget title fallback when the latest book has no title")
        }
    }

    private func bookBadge(_ snapshot: WidgetSnapshot, size: CGFloat) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: size / 5)
                .fill(LinearGradient(colors: [coverColor, coverColor.opacity(0.6)],
                                     startPoint: .top, endPoint: .bottom))
            // Data, not copy — `verbatim` says so out loud.
            Text(verbatim: snapshot.latestBookEmoji ?? "📖")
                .font(.system(size: size * 0.55))
        }
        .frame(width: size, height: size * 1.25)
    }

    @ViewBuilder
    private func streakLine(_ snapshot: WidgetSnapshot) -> some View {
        if snapshot.currentStreak > 0 {
            Text(LocalizedStringResource(
                "widget.streak.days",
                defaultValue: "🔥 \(snapshot.currentStreak) day streak",
                comment: "Widget writing-streak line, e.g. \"🔥 4 day streak\""))
                .font(.caption2.bold())
                .foregroundStyle(.orange)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }
}

struct LatestBookWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LatestBookWidget", provider: LatestBookProvider()) { entry in
            LatestBookWidgetView(entry: entry)
        }
        // The `Text` overloads (rather than the bare literals) are what let
        // these carry translator comments into the catalog.
        .configurationDisplayName(Text("My Latest Book", comment: "Widget name in the widget gallery"))
        .description(Text("Your newest story and writing streak.", comment: "Widget description in the widget gallery"))
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

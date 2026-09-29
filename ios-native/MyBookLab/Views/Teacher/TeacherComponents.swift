// Small pieces shared across the teacher screens: chips, the license
// badge, feeling icons, avatars, the error-with-retry block and the card
// background. Styled like the rest of the app (white-on-cosmic, rounded
// system font) — a grown-up's screen, but the same app.
import SwiftUI

/// The translucent rounded card every teacher section sits on.
struct TeacherCard<Content: View>: View {
    var tint: Color = .white
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tint.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
    }
}

struct TeacherSectionHeading: View {
    let text: LocalizedStringResource
    var body: some View {
        Text(text)
            .font(.system(.title3, design: .rounded).bold())
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
    }
}

/// A small pill. Tone decides the colour only; the text is always spoken.
struct TeacherChip: View {
    enum Tone { case good, warn, muted, urgent }
    let text: LocalizedStringResource
    var tone: Tone = .muted

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .lineLimit(1)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .foregroundStyle(foreground)
            .background(foreground.opacity(0.15), in: Capsule())
            .overlay(Capsule().strokeBorder(foreground.opacity(0.35)))
    }

    private var foreground: Color {
        switch tone {
        case .good: Color(red: 0.43, green: 0.91, blue: 0.72)
        case .warn: Color(red: 0.99, green: 0.83, blue: 0.45)
        case .muted: .white.opacity(0.7)
        case .urgent: Color(red: 1, green: 0.45, blue: 0.45)
        }
    }
}

struct HandInChip: View {
    let state: HandInState
    var body: some View {
        TeacherChip(text: TeacherCopy.handIn(state), tone: {
            switch state {
            case .handedIn: .good
            case .late: .warn
            case .notStarted: .muted
            }
        }())
    }
}

struct AssignmentStatusChip: View {
    let status: String
    var body: some View {
        TeacherChip(text: TeacherCopy.status(status), tone: status == "published" ? .good : .muted)
    }
}

/// "Free trial: N days left" and friends. Never a price, never a buy button.
struct LicenseBadge: View {
    let license: TeacherLicense?
    var body: some View {
        let state = LicenseBadgeState(license)
        TeacherChip(text: TeacherCopy.license(state), tone: state.isWarning ? .warn : state.isGood ? .good : .muted)
    }
}

/// A check-in's art, or a tinted dot until the art exists (same fallback as
/// the check-in sheet). Decorative: callers carry the spoken label.
struct TeacherFeelingIcon: View {
    let id: String
    var size: CGFloat = 20

    var body: some View {
        if let image = UIImage(named: assetName) {
            Image(uiImage: image).resizable().scaledToFit().frame(width: size, height: size)
                .accessibilityHidden(true)
        } else {
            Circle().fill(color).frame(width: size * 0.8, height: size * 0.8)
                .frame(width: size, height: size)
                .opacity(0.85)
                .accessibilityHidden(true)
        }
    }

    private var assetName: String {
        let base = Feeling(rawValue: id) != nil ? "Feeling" : "Need"
        let alias = (id == "help_book" || id == "grownup") ? "help" : id
        return base + alias.split(separator: "_").map { $0.capitalized }.joined()
    }

    private var color: Color {
        switch Feeling(rawValue: id)?.tone {
        case "gold": Color(red: 0.96, green: 0.77, blue: 0.32)
        case "purple": Color(red: 0.65, green: 0.55, blue: 0.98)
        case "blue": Color(red: 0.38, green: 0.65, blue: 0.98)
        case "cyan": Color(red: 0.13, green: 0.83, blue: 0.93)
        case "pink": Color(red: 0.96, green: 0.45, blue: 0.71)
        case "indigo": Color(red: 0.51, green: 0.55, blue: 0.97)
        default: Color(red: 0.65, green: 0.55, blue: 0.98)
        }
    }
}

extension TeacherCheckin {
    /// "Happy · Take a break · 2 days ago" — the spoken form of one icon.
    var spokenLabel: String {
        var parts: [String] = []
        if let f = Feeling(rawValue: feeling) { parts.append(String(localized: f.displayName)) }
        if let need, let n = Need(rawValue: need) { parts.append(String(localized: n.displayName)) }
        if let when = TeacherDates.relative(created_at) { parts.append(when) }
        return parts.joined(separator: " · ")
    }
}

struct TeacherStudentAvatar: View {
    let emoji: String?
    var url: String? = nil
    var size: CGFloat = 40

    var body: some View {
        Group {
            if let url, let u = URL(string: url), url.hasPrefix("http") {
                AsyncImage(url: u) { phase in
                    if let img = phase.image { img.resizable().scaledToFill() } else { emojiView }
                }
            } else {
                emojiView
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private var emojiView: some View {
        ZStack {
            Circle().fill(Color.cyan.opacity(0.15))
            Text(verbatim: emoji ?? "🙂").font(.system(size: size * 0.5))
        }
    }
}

/// An error sentence and a Try again button.
struct TeacherErrorBlock: View {
    let message: LocalizedStringResource
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Text(message)
                .font(.subheadline)
                .foregroundStyle(Color(red: 1, green: 0.5, blue: 0.5))
                .multilineTextAlignment(.center)
            Button(action: retry) {
                Text(TeacherCopy.retry)
                    .font(.callout.bold())
                    .padding(.horizontal, 16).padding(.vertical, 8)
                    .background(.purple.opacity(0.6), in: Capsule())
                    .foregroundStyle(.white)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
    }
}

struct TeacherLoading: View {
    var body: some View {
        ProgressView().tint(.white).frame(maxWidth: .infinity).padding(.vertical, 32)
    }
}

/// The bell in every teacher screen's toolbar: unread badge, and the list in
/// a popover (a sheet on iPhone).
struct TeacherBellButton: View {
    @Environment(TeacherNotificationsStore.self) private var bell
    @State private var open = false

    var body: some View {
        Button { open = true } label: {
            Image(systemName: "bell.fill")
                .foregroundStyle(.white)
                .overlay(alignment: .topTrailing) {
                    if let badge = bell.badge {
                        Text(verbatim: badge)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 4)
                            .frame(minWidth: 16, minHeight: 16)
                            .background(.red, in: Capsule())
                            .offset(x: 9, y: -8)
                    }
                }
        }
        .accessibilityLabel(Text(TeacherCopy.bellLabel(unread: bell.unread)))
        .popover(isPresented: $open) {
            TeacherBellList { open = false }
                .frame(minWidth: 340, idealWidth: 380, minHeight: 420)
                .presentationCompactAdaptation(.sheet)
        }
    }
}

struct TeacherBellList: View {
    let dismiss: () -> Void
    @Environment(TeacherNotificationsStore.self) private var bell
    @Environment(TeacherStore.self) private var teacher

    var body: some View {
        NavigationStack {
            List {
                if bell.items.isEmpty {
                    Text(bell.failed ? TeacherCopy.bellError : TeacherCopy.bellEmpty)
                        .foregroundStyle(bell.failed ? .red : .secondary)
                }
                ForEach(bell.items) { n in
                    Button {
                        bell.markRead(n)
                        teacher.open(n.route)
                        dismiss()
                    } label: {
                        HStack(alignment: .top, spacing: 10) {
                            Circle()
                                .fill(n.read_at != nil ? Color.clear
                                      : n.kind == "help_grownup" ? Color.red : Color.cyan)
                                .frame(width: 8, height: 8)
                                .padding(.top, 6)
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(TeacherCopy.notification(n))
                                    .font(.subheadline)
                                    .foregroundStyle(n.read_at == nil ? .primary : .secondary)
                                Text(verbatim: [TeacherDates.relative(n.created_at), n.payload?.class_name]
                                    .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                Section {
                    Text(TeacherCopy.needsDisclaimer).font(.caption2).foregroundStyle(.secondary)
                }
            }
            .navigationTitle(Text(TeacherCopy.bellTitle))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if bell.unread > 0 {
                        Button { Task { await bell.markAllRead() } } label: { Text(TeacherCopy.bellMarkAll) }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: dismiss) { Text(TeacherCopy.done) }
                }
            }
            .task { await bell.load() }
        }
        .preferredColorScheme(.dark)
    }
}

// Small pieces shared across the teacher screens: chips, the license
// badge, feeling icons, avatars, the error-with-retry block and the card
// background. Styled like the rest of the app (white-on-cosmic, rounded
// system font) — a grown-up's screen, but the same app.
import SwiftUI

/// Opaque surfaces for text-heavy teacher UI (the bell, check-ins, glance
/// pills): the cosmic background never shows through behind body text.
enum TeacherTheme {
    static let cardFill = Color(red: 0.13, green: 0.11, blue: 0.27)
    static let cardFillStrong = Color(red: 0.19, green: 0.16, blue: 0.38)
    static let cardStroke = Color.white.opacity(0.12)
    /// Secondary text on the opaque fills: never below 0.7 white.
    static let secondaryText = Color.white.opacity(0.78)
    static let urgent = Color(red: 1, green: 0.42, blue: 0.42)
    /// Behind a sheet or popover's list (solid, not the starfield).
    static let sheetBackground = Color(red: 0.07, green: 0.06, blue: 0.16)
}

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
            case .revising: .warn
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
        if let f = Feeling(rawValue: feeling) { parts.append(String(appLocalized: f.displayName)) }
        if let need, let n = Need(rawValue: need) { parts.append(String(appLocalized: n.displayName)) }
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
                .frame(minWidth: 380, idealWidth: 440, minHeight: 480, idealHeight: 620)
                .presentationCompactAdaptation(.sheet)
        }
    }
}

struct TeacherBellList: View {
    let dismiss: () -> Void
    @Environment(TeacherNotificationsStore.self) private var bell
    @Environment(TeacherStore.self) private var teacher
    @State private var confirmingClear = false

    var body: some View {
        NavigationStack {
            Group {
                if bell.items.isEmpty {
                    emptyState
                } else {
                    list
                }
            }
            // A remove / clear-all the server refused: the rows are back,
            // and this says why instead of them silently reappearing.
            .safeAreaInset(edge: .top, spacing: 0) {
                if let code = bell.actionError {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(TeacherTheme.urgent)
                            .accessibilityHidden(true)
                        Text(TeacherCopy.error(code))
                            .font(.callout)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Button { bell.actionError = nil } label: {
                            Image(systemName: "xmark").font(.footnote.bold())
                                .frame(width: 44, height: 44)
                        }
                        .accessibilityLabel(Text(TeacherCopy.done))
                        .tint(.white)
                    }
                    .padding(.leading, 14)
                    .background(TeacherTheme.urgent.opacity(0.18))
                }
            }
            .background(TeacherTheme.sheetBackground.ignoresSafeArea())
            .navigationTitle(Text(TeacherCopy.bellTitle))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(TeacherTheme.sheetBackground, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                // Icons with spoken labels: two text buttons plus Done don't
                // fit a popover's bar in Italian ("Segna tutte come lette").
                ToolbarItemGroup(placement: .topBarLeading) {
                    if bell.unread > 0 {
                        Button { Task { await bell.markAllRead() } } label: {
                            Label { Text(TeacherCopy.bellMarkAll) } icon: { Image(systemName: "checkmark.circle") }
                        }
                        .labelStyle(.iconOnly)
                        .tint(.cyan)
                        .help(Text(TeacherCopy.bellMarkAll))
                    }
                    if !bell.items.isEmpty {
                        Button(role: .destructive) { confirmingClear = true } label: {
                            Label { Text(TeacherCopy.bellClearAll) } icon: { Image(systemName: "trash") }
                        }
                        .labelStyle(.iconOnly)
                        .tint(.white.opacity(0.85))
                        .help(Text(TeacherCopy.bellClearAll))
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: dismiss) { Text(TeacherCopy.done).bold() }
                        .tint(.white)
                }
            }
            .alert(Text(TeacherCopy.bellClearConfirm), isPresented: $confirmingClear) {
                Button(role: .destructive) {
                    Task { await bell.clearAll() }
                } label: {
                    Text(TeacherCopy.bellClearAction)
                }
                Button(role: .cancel) {} label: { Text(TeacherCopy.cancel) }
            }
            .task { await bell.load() }
        }
        .preferredColorScheme(.dark)
    }

    private var sections: [(title: LocalizedStringResource, rows: [TeacherNotification])] {
        let cal = Calendar.current
        let today = bell.items.filter { TeacherDates.parse($0.created_at).map(cal.isDateInToday) ?? false }
        let earlier = bell.items.filter { !(TeacherDates.parse($0.created_at).map(cal.isDateInToday) ?? false) }
        return [(TeacherCopy.bellToday, today), (TeacherCopy.bellEarlier, earlier)].filter { !$0.rows.isEmpty }
    }

    private var list: some View {
        List {
            ForEach(sections, id: \.title.key) { section in
                Section {
                    ForEach(section.rows) { n in
                        row(n)
                            // Swipe (needs the List), a long-press menu, a
                            // visible remove button and a VoiceOver action:
                            // removing a row never depends on finding a swipe.
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) { remove(n) } label: {
                                    Label { Text(TeacherCopy.bellRemove) } icon: { Image(systemName: "trash") }
                                }
                            }
                            .contextMenu {
                                Button(role: .destructive) { remove(n) } label: {
                                    Label { Text(TeacherCopy.bellRemove) } icon: { Image(systemName: "trash") }
                                }
                            }
                            .listRowBackground(n.read_at == nil ? TeacherTheme.cardFillStrong : TeacherTheme.cardFill)
                            .listRowInsets(EdgeInsets(top: 12, leading: 14, bottom: 12, trailing: 4))
                    }
                } header: {
                    Text(section.title)
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(TeacherTheme.secondaryText)
                        .textCase(.uppercase)
                }
            }
            Section {
                Text(TeacherCopy.needsDisclaimer)
                    .font(.footnote)
                    .foregroundStyle(TeacherTheme.secondaryText)
                    .listRowBackground(Color.clear)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    /// The row opens what it is about; the small × beside it removes it.
    /// Two buttons in one List row need a borderless/plain style each, or a
    /// tap anywhere would fire both.
    private func row(_ n: TeacherNotification) -> some View {
        HStack(alignment: .top, spacing: 2) {
            Button {
                bell.markRead(n)
                teacher.open(n.route)
                dismiss()
            } label: {
                TeacherBellRow(n: n)
            }
            .buttonStyle(.plain)
            .accessibilityAction(named: Text(TeacherCopy.bellRemove)) { remove(n) }

            Button { remove(n) } label: {
                Image(systemName: "xmark")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(TeacherTheme.secondaryText)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.borderless)
            .accessibilityLabel(Text(TeacherCopy.bellRemove))
            .help(Text(TeacherCopy.bellRemove))
        }
    }

    private func remove(_ n: TeacherNotification) {
        Task { await bell.remove(n) }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: bell.failed ? "exclamationmark.triangle.fill" : "bell.badge.slash.fill")
                .font(.system(size: 44))
                .foregroundStyle(bell.failed ? TeacherTheme.urgent : .cyan)
                .accessibilityHidden(true)
            Text(bell.failed ? TeacherCopy.bellError : TeacherCopy.bellEmptyTitle)
                .font(.system(.title3, design: .rounded).bold())
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
            if bell.failed {
                Button { Task { await bell.load() } } label: {
                    Text(TeacherCopy.retry).font(.callout.bold())
                        .padding(.horizontal, 18).padding(.vertical, 10)
                        .background(.purple.opacity(0.7), in: Capsule())
                        .foregroundStyle(.white)
                }
                .buttonStyle(.plain)
            } else {
                Text(TeacherCopy.bellEmptyBody)
                    .font(.body)
                    .foregroundStyle(TeacherTheme.secondaryText)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// One bell row: the kind's symbol in a tinted circle, who (bold) and one
/// short line of what happened, the time on the right, an unread dot, and —
/// for a help ask that came in outside school hours — why no alert was sent.
struct TeacherBellRow: View {
    let n: TeacherNotification

    private var unread: Bool { n.read_at == nil }
    private var style: (symbol: String, tint: Color) { TeacherBellRow.style(for: n.kind) }
    private var outsideHours: Bool { n.kind.hasPrefix("help_") && n.payload?.in_hours == false }

    static func style(for kind: String) -> (symbol: String, tint: Color) {
        switch kind {
        case "help_grownup": ("exclamationmark.bubble.fill", TeacherTheme.urgent)
        case "help_book": ("questionmark.bubble.fill", Color(red: 1, green: 0.7, blue: 0.3))
        case "hand_in": ("tray.and.arrow.down.fill", Color(red: 0.43, green: 0.91, blue: 0.72))
        case "hand_in_late": ("clock.badge.checkmark.fill", Color(red: 0.99, green: 0.83, blue: 0.45))
        case "resubmit": ("book.closed.fill", Color(red: 0.55, green: 0.75, blue: 1))
        case "all_handed_in": ("checkmark.seal.fill", Color(red: 0.75, green: 0.6, blue: 1))
        default: ("bell.fill", .cyan)
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle().fill(style.tint.opacity(0.22))
                Image(systemName: style.symbol)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(style.tint)
            }
            .frame(width: 40, height: 40)
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(verbatim: TeacherCopy.notificationSubject(n))
                        .font(.body.weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    if let when = TeacherDates.relative(n.created_at) {
                        Text(verbatim: when)
                            .font(.footnote)
                            .foregroundStyle(TeacherTheme.secondaryText)
                            .lineLimit(1)
                    }
                    Circle()
                        .fill(unread ? (n.kind == "help_grownup" ? TeacherTheme.urgent : Color.cyan) : Color.clear)
                        .frame(width: 9, height: 9)
                }
                Text(TeacherCopy.notificationLine(n))
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(unread ? 0.95 : 0.8))
                    .fixedSize(horizontal: false, vertical: true)
                if let className = n.payload?.class_name, !className.isEmpty, n.kind != "all_handed_in" {
                    Text(verbatim: className)
                        .font(.caption)
                        .foregroundStyle(TeacherTheme.secondaryText)
                }
                if outsideHours {
                    Label {
                        Text(TeacherCopy.bellOutsideHours)
                    } icon: {
                        Image(systemName: "moon.zzz.fill")
                    }
                    .font(.caption)
                    .foregroundStyle(Color(white: 0.72))
                    .padding(.top, 2)
                }
            }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: spoken))
        .accessibilityAddTraits(.isButton)
    }

    /// "Unread. Ann asked for a grown-up. Room 5. 5 minutes ago. Outside…"
    private var spoken: String {
        var parts: [String] = []
        if unread { parts.append(String(appLocalized: TeacherCopy.bellUnread)) }
        parts.append(TeacherCopy.notificationSubject(n) + " " + String(appLocalized: TeacherCopy.notificationLine(n)))
        if let c = n.payload?.class_name, !c.isEmpty, n.kind != "all_handed_in" { parts.append(c) }
        if let when = TeacherDates.relative(n.created_at) { parts.append(when) }
        if outsideHours { parts.append(String(appLocalized: TeacherCopy.bellOutsideHours)) }
        return parts.joined(separator: ". ")
    }
}

// MARK: - Plan status (Stage 4)

/// The class's plan: status, seats used of total, renewal or end date.
/// Status and seats ONLY — never a price, a purchase button or a link
/// (App Store 3.1.3). "Manage your plan on mybooklab.app" is plain text.
struct TeacherPlanCard: View {
    let license: TeacherLicense?
    let studentCount: Int

    private var dateText: String? {
        guard let date = TeacherDates.parse(license?.expires_at) else { return nil }
        return date.formatted(.dateTime.day().month(.wide).year().locale(AppLanguage.locale))
    }

    var body: some View {
        TeacherCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(TeacherCopy.planHeading).font(.headline).foregroundStyle(.white)
                    Spacer()
                    LicenseBadge(license: license)
                }
                if let license {
                    if let seats = license.seats, license.status != "trial" {
                        Text(TeacherCopy.planSeats(used: studentCount, total: seats))
                    }
                    if let pending = license.pending_seats {
                        Text(TeacherCopy.planPendingSeats(pending))
                    }
                    if let dateText, ["active", "grace", "pending_payment"].contains(license.status ?? "") {
                        Text(license.cancel_at_period_end == true ? TeacherCopy.planEnds(dateText) : TeacherCopy.planRenews(dateText))
                    }
                    if license.school_plan_id != nil {
                        Text(TeacherCopy.planSchool)
                    }
                }
                // Text(verbatim:) so the domain is never turned into a link.
                Text(verbatim: String(appLocalized: TeacherCopy.planManageOnWeb))
                    .foregroundStyle(TeacherTheme.secondaryText)
            }
            .font(.subheadline)
            .foregroundStyle(.white.opacity(0.85))
        }
    }
}

/// "We're confirming you're a teacher" (Stage 4) on the class list.
struct TeacherVerificationCard: View {
    var body: some View {
        TeacherCard(tint: .yellow) {
            Label {
                VStack(alignment: .leading, spacing: 4) {
                    Text(TeacherCopy.verifyTitle).font(.headline).foregroundStyle(.white)
                    Text(TeacherCopy.verifyBody).font(.subheadline).foregroundStyle(.white.opacity(0.85))
                }
            } icon: {
                Image(systemName: "checkmark.shield.fill").foregroundStyle(.yellow)
            }
        }
    }
}

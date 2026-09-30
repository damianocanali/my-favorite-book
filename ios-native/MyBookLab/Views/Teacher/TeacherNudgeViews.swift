// Teacher nudges: the "Nudge" sheet (whole class from the dashboard, or one
// child from their details page) and the small "Sent" / "Seen ✓" status.
// Counterpart of src/components/school/NudgeSheet.jsx.
//
// Encouraging, never nagging: suggestions are pre-ticked but the teacher
// decides; a child gets at most one unread note (a new one replaces it)
// and at most 3 a day — the server enforces both (school_send_nudge).
// No push to children: class iPads are shared.
import SwiftUI

struct TeacherNudgeSheet: View {
    let classId: String
    let students: [TeacherDashboardStudent]
    let assignments: [TeacherDashboardAssignment]
    /// One child (from their details page): only them, ticked.
    var single: Bool = false
    let onSent: (TeacherNudgeSendResult) -> Void

    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    enum Choice: Hashable { case preset(String), custom }

    @State private var selected: Set<String> = []
    @State private var choice: Choice? = .preset("story_waiting")
    @State private var custom = ""
    @State private var assignmentId: String?
    @State private var sending = false
    @State private var error: LocalizedStringResource?
    @State private var didSeed = false

    private var openAssignments: [TeacherDashboardAssignment] {
        NudgeRules.open(assignments)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                TeacherTheme.sheetBackground.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        Text(NudgeCopy.sheetIntro)
                            .font(.subheadline)
                            .foregroundStyle(TeacherTheme.secondaryText)
                        whoSection
                        messageSection
                        if let error {
                            Text(error).font(.footnote).foregroundStyle(TeacherTheme.urgent)
                        }
                        sendButton
                    }
                    .padding()
                    .contentColumn(maxWidth: ContentWidth.form)
                }
            }
            .navigationTitle(Text(NudgeCopy.sheetTitle))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(TeacherTheme.sheetBackground, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(TeacherCopy.cancel) }
                        .tint(.white)
                }
            }
        }
        .environment(\.cosmicStyle, .calm)
        .onAppear(perform: seed)
    }

    // MARK: Who

    private var whoSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                TeacherSectionHeading(text: NudgeCopy.whoHeading)
                if !single {
                    Button { selected = Set(students.prefix(NudgeRules.maxStudents).map(\.id)) } label: {
                        Text(NudgeCopy.selectAll).font(.subheadline.weight(.semibold)).foregroundStyle(.cyan)
                            .frame(minHeight: 44)
                    }
                    Button { selected = [] } label: {
                        Text(NudgeCopy.selectNone).font(.subheadline.weight(.semibold)).foregroundStyle(.cyan)
                            .frame(minHeight: 44)
                    }
                }
            }
            if !single {
                Text(NudgeCopy.suggestedNote).font(.caption).foregroundStyle(TeacherTheme.secondaryText)
            }
            VStack(spacing: 0) {
                ForEach(Array(students.enumerated()), id: \.element.id) { i, s in
                    if i > 0 { Divider().overlay(TeacherTheme.cardStroke) }
                    studentRow(s)
                }
            }
            .background(TeacherTheme.cardFill, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(TeacherTheme.cardStroke))
        }
    }

    private func studentRow(_ s: TeacherDashboardStudent) -> some View {
        let on = selected.contains(s.id)
        let reasons = NudgeRules.reasons(for: s, assignments: assignments)
        return Button {
            if on { selected.remove(s.id) } else if selected.count < NudgeRules.maxStudents { selected.insert(s.id) }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: on ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(on ? .cyan : .white.opacity(0.5))
                    .accessibilityHidden(true)
                TeacherStudentAvatar(emoji: s.avatar_emoji, url: s.avatar_url, size: 32)
                VStack(alignment: .leading, spacing: 4) {
                    Text(verbatim: s.display_name).font(.headline).foregroundStyle(.white)
                    if !reasons.isEmpty {
                        // Wraps under large text instead of truncating.
                        ViewThatFits(in: .horizontal) {
                            HStack(spacing: 6) { reasonChips(reasons) }
                            VStack(alignment: .leading, spacing: 4) { reasonChips(reasons) }
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(minHeight: 52)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(single)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    @ViewBuilder
    private func reasonChips(_ reasons: [NudgeRules.Reason]) -> some View {
        ForEach(reasons, id: \.self) { r in
            switch r {
            case .quiet: TeacherChip(text: NudgeCopy.reasonQuiet, tone: .muted)
            case .notHandedIn: TeacherChip(text: NudgeCopy.reasonNotHandedIn, tone: .warn)
            }
        }
    }

    // MARK: Message

    private var messageSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            TeacherSectionHeading(text: NudgeCopy.messageHeading)

            if !openAssignments.isEmpty {
                HStack {
                    Text(NudgeCopy.assignmentLabel).font(.subheadline).foregroundStyle(TeacherTheme.secondaryText)
                    Spacer()
                    Picker(selection: $assignmentId) {
                        Text(NudgeCopy.assignmentNone).tag(String?.none)
                        ForEach(openAssignments) { a in
                            Text(verbatim: a.title).tag(Optional(a.id))
                        }
                    } label: {
                        Text(NudgeCopy.assignmentLabel)
                    }
                    .tint(.cyan)
                }
                .frame(minHeight: 44)
                .onChange(of: assignmentId) { _, id in
                    // "Hand in" only exists with an assignment chosen.
                    if id == nil, choice == .preset("hand_in") { choice = .preset("story_waiting") }
                }
            }

            ForEach(presetKeys, id: \.self) { key in
                choiceRow(.preset(key)) {
                    if let text = NudgeCopy.preset(key, assignmentTitle: assignmentTitle) { Text(text) }
                }
            }
            choiceRow(.custom) { Text(NudgeCopy.writeOwn) }
            if choice == .custom {
                TextField(text: $custom, axis: .vertical) { Text(NudgeCopy.placeholder) }
                    .lineLimit(2...4)
                    .padding(10)
                    .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.white)
                    .onChange(of: custom) { _, v in
                        let cut = TeacherStickers.truncated(v, max: NudgeRules.messageMax)
                        if cut != v { custom = cut }
                    }
                Text(verbatim: "\(custom.utf16.count)/\(NudgeRules.messageMax)")
                    .font(.caption2).foregroundStyle(.white.opacity(0.6))
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            Text(NudgeCopy.signedAs).font(.caption).foregroundStyle(TeacherTheme.secondaryText)
        }
    }

    private var presetKeys: [String] {
        NudgeRules.presets.filter { $0 != "hand_in" || assignmentId != nil }
    }

    private var assignmentTitle: String? {
        guard let assignmentId else { return nil }
        return openAssignments.first { $0.id == assignmentId }?.title
    }

    private func choiceRow<Label: View>(_ c: Choice, @ViewBuilder label: () -> Label) -> some View {
        let on = choice == c
        return Button { choice = c } label: {
            HStack(spacing: 12) {
                Image(systemName: on ? "largecircle.fill.circle" : "circle")
                    .foregroundStyle(on ? .cyan : .white.opacity(0.5))
                    .accessibilityHidden(true)
                label()
                    .font(.body)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(12)
            .frame(minHeight: 48)
            .background(on ? Color.cyan.opacity(0.12) : TeacherTheme.cardFill, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(on ? Color.cyan.opacity(0.5) : TeacherTheme.cardStroke))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    // MARK: Send

    private var sendButton: some View {
        Button { Task { await send() } } label: {
            Text(sending ? NudgeCopy.sending : NudgeCopy.send(selected.count))
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 50)
                .background(Color.purple.opacity(sending || selected.isEmpty ? 0.35 : 0.75), in: RoundedRectangle(cornerRadius: 14))
                .foregroundStyle(.white)
        }
        .buttonStyle(.plain)
        .disabled(sending || selected.isEmpty)
    }

    private func seed() {
        guard !didSeed else { return }
        didSeed = true
        if single {
            selected = Set(students.map(\.id))
        } else {
            let suggested = students.filter { !NudgeRules.reasons(for: $0, assignments: assignments).isEmpty }
            selected = Set(suggested.prefix(NudgeRules.maxStudents).map(\.id))
        }
        // One child with exactly one open assignment they haven't handed
        // in: link it, so "hand in" is one tap away.
        if single, let s = students.first {
            let open = NudgeRules.openNotHandedIn(s, assignments: assignments)
            if open.count == 1 { assignmentId = open[0].id }
        }
    }

    private func send() async {
        error = nil
        guard !selected.isEmpty else { error = NudgeCopy.needStudents; return }
        var body = APIClient.NudgeSend(classId: classId, studentIds: Array(selected))
        switch choice {
        case .preset(let key)?:
            body.preset = key
        case .custom?:
            let trimmed = custom.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty, trimmed.utf16.count <= NudgeRules.messageMax else { error = NudgeCopy.needMessage; return }
            body.message = trimmed
        case nil:
            error = NudgeCopy.needMessage
            return
        }
        body.assignmentId = assignmentId
        guard let token = await auth.validAccessToken() else { return }
        sending = true
        defer { sending = false }
        do {
            let res = try await APIClient.shared.teacherSendNudge(body, bearerToken: token)
            onSent(res)
            dismiss()
        } catch {
            self.error = TeacherCopy.error(error)
        }
    }
}

/// "Nudge sent" / "Nudge seen ✓" on a student card; nothing without one.
struct NudgeStatusChip: View {
    let nudge: TeacherNudge?
    var body: some View {
        if let nudge {
            if nudge.seen_at != nil {
                TeacherChip(text: NudgeCopy.chipSeen, tone: .good)
            } else {
                TeacherChip(text: NudgeCopy.chipSent, tone: .muted)
            }
        }
    }
}

/// The dashboard's one-line summary after a send.
enum NudgeResultText {
    static func make(_ r: TeacherNudgeSendResult) -> String {
        var parts: [String] = []
        if !r.sent.isEmpty { parts.append(String(appLocalized: NudgeCopy.sentCount(r.sent.count))) }
        let capped = r.skipped.filter { $0.code == "daily_cap" }.count
        if capped > 0 { parts.append(String(appLocalized: NudgeCopy.cappedCount(capped))) }
        let handedIn = r.skipped.filter { $0.code == "handed_in" }.count
        if handedIn > 0 { parts.append(String(appLocalized: NudgeCopy.handedInCount(handedIn))) }
        let other = r.skipped.count - capped - handedIn
        if other > 0 || parts.isEmpty { parts.append(String(appLocalized: TeacherCopy.error("upstream"))) }
        return parts.joined(separator: " ")
    }
}

// Grading with tips, teacher side: the grade panel on one hand-in (four
// big level buttons, the tip library by skill plus the teacher's own tip,
// "Send back to revise"), the level chip on the review list, and a child's
// levels over time. Counterpart of the web's GradePanel / LevelChip in
// AssignmentReview.jsx and StudentDetailDrawer.jsx. API:
// api/school/grades.js; shapes: Models/Grading.swift.
import SwiftUI

/// A tip as the reader sees it: a library tip in the app language, a
/// custom one exactly as the teacher wrote it (never looked up).
enum GradeTipText {
    static func text(_ tip: GradeTip) -> Text {
        if let key = tip.key, let r = GradingCopy.tip(key) { return Text(r) }
        return Text(verbatim: tip.text ?? "")
    }

    /// For read-aloud.
    static func string(_ tip: GradeTip) -> String {
        if let key = tip.key, let r = GradingCopy.tip(key) { return String(appLocalized: r) }
        return tip.text ?? ""
    }

    /// Tips a client can show: a library key this build knows, or text.
    static func showable(_ tips: [GradeTip]?) -> [GradeTip] {
        (tips ?? []).filter { t in
            if let k = t.key { return GradingCopy.tip(k) != nil }
            return !(t.text ?? "").isEmpty
        }
    }
}

/// "🌿 Growing" — a level as a small pill.
struct GradeLevelChip: View {
    let level: String

    var body: some View {
        HStack(spacing: 4) {
            Text(verbatim: GradingRules.emoji(level)).accessibilityHidden(true)
            Text(GradingCopy.level(level))
        }
        .font(.caption.weight(.semibold))
        .lineLimit(1)
        .padding(.horizontal, 8).padding(.vertical, 3)
        .foregroundStyle(.white)
        .background(GradeLevelStyle.tint(level).opacity(0.22), in: Capsule())
        .overlay(Capsule().strokeBorder(GradeLevelStyle.tint(level).opacity(0.5)))
        .accessibilityElement(children: .combine)
    }
}

enum GradeLevelStyle {
    /// Soft, warm and never red: a level is encouragement, not a mark.
    static func tint(_ level: String?) -> Color {
        switch level {
        case "getting_started": Color(red: 0.62, green: 0.85, blue: 0.55)
        case "growing": Color(red: 0.43, green: 0.85, blue: 0.72)
        case "got_it": Color(red: 0.45, green: 0.75, blue: 1)
        case "wow": Color(red: 1, green: 0.82, blue: 0.4)
        default: .white
        }
    }
}

/// The grade for the version on screen: level, tips, send back. Prefilled
/// from that version's existing grade, so re-grading edits it.
struct TeacherGradePanel: View {
    let classId: String
    let submissionId: String
    let version: Int
    /// Every graded version, newest first (the hand-in detail's `grades`).
    let grades: [SubmissionGrade]
    let onSaved: (SubmissionGrade) -> Void

    @Environment(AuthStore.self) private var auth
    @State private var level: String?
    @State private var tips: [GradeTip] = []
    @State private var custom = ""
    @State private var sendBack = false
    @State private var saving = false
    @State private var savedFlash = false
    @State private var error: LocalizedStringResource?
    @State private var openSkill: String?

    private var current: SubmissionGrade? { grades.first { $0.version == version } }
    private var earlier: [SubmissionGrade] { grades.filter { $0.version != version } }
    private var full: Bool { tips.count >= GradingRules.tipsMax }

    var body: some View {
        TeacherCard {
            VStack(alignment: .leading, spacing: 14) {
                Text(GradingCopy.heading).font(.headline).foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)

                Text(GradingCopy.levelLabel).font(.subheadline.weight(.semibold)).foregroundStyle(TeacherTheme.secondaryText)
                levelPicker

                Text(GradingCopy.tipsLabel).font(.subheadline.weight(.semibold)).foregroundStyle(TeacherTheme.secondaryText)
                if !tips.isEmpty { chosenTips }
                if full {
                    Text(GradingCopy.tipsFull).font(.footnote).foregroundStyle(TeacherTheme.secondaryText)
                } else {
                    tipLibrary
                    customTip
                }

                Toggle(isOn: $sendBack) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(GradingCopy.returnLabel).foregroundStyle(.white)
                        Text(GradingCopy.returnHint).font(.caption).foregroundStyle(TeacherTheme.secondaryText)
                    }
                }
                .tint(.cyan)

                if let error { Text(error).font(.footnote).foregroundStyle(TeacherTheme.urgent) }

                HStack(spacing: 10) {
                    Button { Task { await save() } } label: {
                        Text(saving ? GradingCopy.saving : (sendBack ? GradingCopy.saveReturn : GradingCopy.save))
                            .font(.callout.bold())
                            .padding(.horizontal, 18).padding(.vertical, 10)
                            .background(.purple.opacity(0.7), in: Capsule())
                            .foregroundStyle(.white)
                    }
                    .buttonStyle(.plain)
                    .disabled(saving)
                    if savedFlash {
                        Label { Text(GradingCopy.saved) } icon: { Image(systemName: "checkmark.circle.fill") }
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Color(red: 0.43, green: 0.91, blue: 0.72))
                    }
                }

                if !earlier.isEmpty { history }
            }
        }
        .onAppear(perform: prefill)
    }

    // MARK: Level

    private var levelPicker: some View {
        // Four big, friendly buttons; two rows of two when narrow.
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) { levelButtons(minWidth: 110) }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) { levelButtons(minWidth: 0) }
        }
    }

    @ViewBuilder
    private func levelButtons(minWidth: CGFloat) -> some View {
        ForEach(GradingRules.levels, id: \.self) { id in
            let on = level == id
            Button { level = id } label: {
                VStack(spacing: 4) {
                    Text(verbatim: GradingRules.emoji(id)).font(.system(size: 30)).accessibilityHidden(true)
                    Text(GradingCopy.level(id)).font(.subheadline.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.8)
                }
                .foregroundStyle(.white)
                .frame(minWidth: minWidth, maxWidth: .infinity, minHeight: 76)
                .background(GradeLevelStyle.tint(id).opacity(on ? 0.35 : 0.08), in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(on ? GradeLevelStyle.tint(id) : .white.opacity(0.18), lineWidth: on ? 2 : 1))
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(on ? [.isSelected] : [])
        }
    }

    // MARK: Tips

    private var chosenTips: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(tips, id: \.self) { tip in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "lightbulb.fill").foregroundStyle(.yellow).font(.footnote).padding(.top, 2)
                        .accessibilityHidden(true)
                    tipText(tip).font(.subheadline).foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button { tips.removeAll { $0 == tip } } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(.white.opacity(0.6))
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Text(GradingCopy.removeTip))
                }
                .padding(8)
                .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    private var tipLibrary: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(GradingRules.skills, id: \.id) { skill in
                DisclosureGroup(isExpanded: Binding(
                    get: { openSkill == skill.id },
                    set: { openSkill = $0 ? skill.id : nil }
                )) {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(skill.tips, id: \.self) { t in
                            let key = "\(skill.id).\(t)"
                            let chosen = tips.contains(.library(key))
                            Button {
                                if chosen { tips.removeAll { $0 == .library(key) } } else if !full { tips.append(.library(key)) }
                            } label: {
                                HStack(alignment: .top, spacing: 8) {
                                    Image(systemName: chosen ? "checkmark.circle.fill" : "plus.circle")
                                        .foregroundStyle(chosen ? .cyan : .white.opacity(0.6))
                                        .accessibilityHidden(true)
                                    Text(GradingCopy.tip(key) ?? GradingCopy.skill(skill.id))
                                        .font(.subheadline).foregroundStyle(.white)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .multilineTextAlignment(.leading)
                                }
                                .padding(.vertical, 6)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(chosen ? [.isSelected] : [])
                        }
                    }
                    .padding(.top, 4)
                } label: {
                    Text(GradingCopy.skill(skill.id)).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                }
                .tint(.white.opacity(0.7))
            }
        }
    }

    private var customTip: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .trailing, spacing: 2) {
                TextField(text: $custom, axis: .vertical) { Text(GradingCopy.customPlaceholder) }
                    .lineLimit(1...3)
                    .padding(10)
                    .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.white)
                    .onChange(of: custom) { _, v in
                        let cut = TeacherStickers.truncated(v, max: GradingRules.tipTextMax)
                        if cut != v { custom = cut }
                    }
                Text(verbatim: "\(custom.utf16.count)/\(GradingRules.tipTextMax)")
                    .font(.caption2).foregroundStyle(.white.opacity(0.5))
            }
            Button(action: addCustom) {
                Text(GradingCopy.customAdd)
                    .font(.footnote.bold())
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .background(Color.cyan.opacity(0.18), in: Capsule())
                    .foregroundStyle(.cyan)
            }
            .buttonStyle(.plain)
            .disabled(custom.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    private func addCustom() {
        let t = custom.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, !full else { return }
        if !tips.contains(.custom(t)) { tips.append(.custom(t)) }
        custom = ""
    }

    private func tipText(_ tip: GradeTip) -> Text { GradeTipText.text(tip) }

    // MARK: History

    private var history: some View {
        VStack(alignment: .leading, spacing: 6) {
            Divider().overlay(.white.opacity(0.2))
            Text(GradingCopy.history).font(.subheadline.weight(.semibold)).foregroundStyle(TeacherTheme.secondaryText)
            ForEach(earlier) { g in
                HStack(spacing: 8) {
                    Text(verbatim: "v\(g.version)").font(.caption.monospacedDigit()).foregroundStyle(TeacherTheme.secondaryText)
                    GradeLevelChip(level: g.level)
                    if g.returned == true { TeacherChip(text: GradingCopy.sentBack, tone: .warn) }
                    Spacer(minLength: 0)
                    if let when = TeacherDates.relative(g.updated_at) {
                        Text(verbatim: when).font(.caption).foregroundStyle(TeacherTheme.secondaryText)
                    }
                }
                ForEach(g.tips ?? [], id: \.self) { tip in
                    tipText(tip).font(.caption).foregroundStyle(TeacherTheme.secondaryText)
                        .padding(.leading, 28)
                }
            }
        }
    }

    // MARK: Saving

    private func prefill() {
        guard let current else { return }
        level = current.level
        tips = current.tips ?? []
        sendBack = current.returned == true
    }

    private func save() async {
        guard let level else { error = GradingCopy.needLevel; return }
        // A typed tip that wasn't added yet still counts.
        addCustom()
        if sendBack && tips.isEmpty { error = GradingCopy.needTip; return }
        saving = true
        error = nil
        savedFlash = false
        defer { saving = false }
        guard let token = await auth.validAccessToken() else { return }
        do {
            let res = try await APIClient.shared.teacherGrade(
                classId: classId, submissionId: submissionId, version: version,
                level: level, tips: tips, returned: sendBack, bearerToken: token)
            onSaved(res.grade)
            savedFlash = true
        } catch {
            self.error = TeacherCopy.error(error)
        }
    }
}

/// One child's levels over time (api/school/grades.js ?studentId): every
/// graded version, oldest first. A list, not a chart or a score: what the
/// teacher looked at, when, and whether it went back for another try.
struct TeacherLevelsOverTime: View {
    let classId: String
    let studentId: String

    @Environment(AuthStore.self) private var auth
    @State private var grades: [TeacherStudentGrade]?
    @State private var loadError: String??

    var body: some View {
        Group {
            if let loadError {
                TeacherErrorBlock(message: TeacherCopy.error(loadError)) { Task { await load() } }
            } else if let grades {
                if grades.isEmpty {
                    Text(GradingCopy.noGrades).foregroundStyle(.white.opacity(0.7)).padding(.vertical, 24)
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(grades.enumerated()), id: \.element.id) { i, g in
                            if i > 0 { Divider().overlay(TeacherTheme.cardStroke) }
                            row(g)
                        }
                    }
                    .background(TeacherTheme.cardFill, in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(TeacherTheme.cardStroke))
                }
            } else {
                TeacherLoading()
            }
        }
        .task { if grades == nil { await load() } }
    }

    private func row(_ g: TeacherStudentGrade) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: g.assignment_title ?? "—").font(.body).foregroundStyle(.white).lineLimit(2)
                HStack(spacing: 4) {
                    Text(verbatim: "v\(g.version)")
                    if let when = TeacherDates.relative(g.updated_at) {
                        Text(verbatim: "·")
                        Text(verbatim: when)
                    }
                }
                .font(.caption).foregroundStyle(TeacherTheme.secondaryText)
            }
            Spacer(minLength: 8)
            if g.returned == true { TeacherChip(text: GradingCopy.sentBack, tone: .warn) }
            GradeLevelChip(level: g.level)
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .accessibilityElement(children: .combine)
    }

    func load() async {
        guard let token = await auth.validAccessToken() else { return }
        do {
            grades = try await APIClient.shared.teacherStudentGrades(classId: classId, studentId: studentId, bearerToken: token)
            loadError = nil
        } catch {
            if grades == nil { loadError = .some((error as? APIClient.TeacherError)?.code) }
        }
    }
}

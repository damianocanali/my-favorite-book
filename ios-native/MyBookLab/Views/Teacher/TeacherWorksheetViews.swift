// Worksheet assignments on the teacher's iPad (spec 2026-10-01 §2): the
// worksheet half of the new/edit assignment form (template cards, editable
// prompts), a hand-in's answers in the review, and printing — a PDF drawn
// the same way as the sign-in cards (SignInCardsPDF) and sent to AirPrint.
// Counterparts of the web's WorksheetPicker, WorksheetAnswers and
// AssignmentSheet.
import SwiftUI
import UIKit

// MARK: - Form section

/// Choose a template, then edit its prompts (pre-filled in the app's
/// language). `worksheet` nil = no template chosen yet.
struct TeacherWorksheetPicker: View {
    @Binding var worksheet: WorksheetDefinition?
    @Binding var word: String
    var canChangeTemplate: Bool = true
    /// Fired when a template is picked, so the form can fill an empty title.
    var onPicked: (String) -> Void = { _ in }

    var body: some View {
        if let def = worksheet, let template = def.template {
            Section {
                ForEach(Array(template.boxes.enumerated()), id: \.element.id) { i, box in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(WorksheetCopy.teacherBoxLabel(i + 1)).font(.caption).foregroundStyle(.secondary)
                        TextField(text: promptBinding(box.id), axis: .vertical) { Text(WorksheetCopy.teacherPromptsHeading) }
                            .lineLimit(1...4)
                    }
                }
                Button { resetPrompts() } label: {
                    Label { Text(WorksheetCopy.teacherResetPrompts) } icon: { Image(systemName: "arrow.counterclockwise") }
                }
                if canChangeTemplate {
                    Button { worksheet = nil; word = "" } label: { Text(WorksheetCopy.teacherChangeTemplate) }
                }
            } header: {
                Text(WorksheetCopy.title(def.templateId))
            } footer: {
                Text(WorksheetCopy.teacherPromptsHint)
            }
            if def.isAcrostic {
                Section {
                    TextField(text: $word) { Text(WorksheetCopy.teacherAcrosticWordLabel) }
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .onChange(of: word) { _, v in
                            let cut = String(v.filter { !$0.isWhitespace }.prefix(WorksheetTemplates.acrosticWordMax))
                            if cut != v { word = cut }
                        }
                } header: {
                    Text(WorksheetCopy.teacherAcrosticWordLabel)
                } footer: {
                    Text(WorksheetCopy.teacherAcrosticWordHint)
                }
            }
        } else {
            Section {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                    ForEach(WorksheetTemplates.all, id: \.id) { t in
                        Button { pick(t) } label: { card(t) }
                            .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 6)
            } header: {
                Text(WorksheetCopy.teacherChooseTemplate)
            }
        }
    }

    /// A tiny picture of the sheet (one bar per box, sized like the box),
    /// the name and what it's for.
    private func card(_ t: WorksheetTemplate) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            VStack(spacing: 3) {
                ForEach(t.boxes, id: \.id) { b in
                    RoundedRectangle(cornerRadius: 2)
                        .stroke(.black.opacity(0.45))
                        .frame(height: b.size == .small ? 6 : b.size == .medium ? 12 : 20)
                }
            }
            .padding(8)
            .background(.white.opacity(0.92), in: RoundedRectangle(cornerRadius: 6))
            .accessibilityHidden(true)
            Text(WorksheetCopy.title(t.id)).font(.subheadline.bold()).foregroundStyle(.primary)
            Text(WorksheetCopy.description(t.id)).font(.caption).foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(.white.opacity(0.15)))
        .contentShape(RoundedRectangle(cornerRadius: 12))
    }

    private func promptBinding(_ id: String) -> Binding<String> {
        Binding(
            get: { worksheet?.prompts[id] ?? "" },
            set: { v in
                var cut = v.replacingOccurrences(of: "\n", with: " ")
                if cut.utf16.count > WorksheetTemplates.promptMax { cut = TeacherStickers.truncated(cut, max: WorksheetTemplates.promptMax) }
                worksheet?.prompts[id] = cut
            }
        )
    }

    private func pick(_ t: WorksheetTemplate) {
        worksheet = WorksheetDefinition(templateId: t.id, prompts: Self.defaultPrompts(t.id), word: nil)
        word = ""
        onPicked(t.id)
    }

    private func resetPrompts() {
        guard let id = worksheet?.templateId else { return }
        worksheet?.prompts = Self.defaultPrompts(id)
    }

    static func defaultPrompts(_ templateId: String) -> [String: String] {
        guard let t = WorksheetTemplates.find(templateId) else { return [:] }
        var out: [String: String] = [:]
        for b in t.boxes {
            if let r = WorksheetCopy.defaultPrompt(templateId, b.id) { out[b.id] = String(appLocalized: r) }
        }
        return out
    }
}

// MARK: - Review: a hand-in's answers

struct TeacherWorksheetAnswers: View {
    let worksheet: WorksheetSnapshot
    let answers: [String: String]

    var body: some View {
        let def = worksheet.definition
        VStack(alignment: .leading, spacing: 10) {
            Text(WorksheetCopy.title(def.templateId))
                .font(.caption.bold()).foregroundStyle(.cyan).textCase(.uppercase)
            ForEach(WorksheetLayout.items(def, childWord: answers["word"])) { item in
                TeacherCard {
                    VStack(alignment: .leading, spacing: 6) {
                        switch item {
                        case .box(let id, let prompt, _):
                            prompt_(prompt)
                            answer(answers[id])
                        case .word(let prompt, _):
                            prompt_(prompt)
                            Text(verbatim: def.word ?? answers["word"] ?? "—")
                                .font(.title2.bold()).tracking(6).foregroundStyle(.white)
                        case .letters(let prompt, let letters):
                            prompt_(prompt)
                            ForEach(letters) { l in
                                HStack(alignment: .firstTextBaseline, spacing: 10) {
                                    Text(verbatim: l.letter).font(.headline).foregroundStyle(.cyan).frame(width: 22)
                                    answer(answers[l.id])
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func prompt_(_ text: String) -> some View {
        Text(verbatim: text).font(.subheadline.weight(.semibold)).foregroundStyle(TeacherTheme.secondaryText)
    }

    @ViewBuilder
    private func answer(_ text: String?) -> some View {
        if let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            Text(verbatim: text).font(.body).foregroundStyle(.white).textSelection(.enabled)
        } else {
            Text(WorksheetCopy.teacherNoAnswer).font(.callout.italic()).foregroundStyle(.white.opacity(0.5))
        }
    }
}

// MARK: - Print (AirPrint)

/// US Letter worksheets: the assignment title, the template name, Name /
/// Date, then every box's prompt with ruled lines (blank) or the child's
/// answer (filled). A filled sheet runs onto more pages when it must.
enum WorksheetPDF {
    struct Sheet {
        let studentName: String
        let answers: [String: String]?
    }

    static func make(title: String, worksheet def: WorksheetDefinition, sheets: [Sheet]) -> Data {
        let page = CGRect(x: 0, y: 0, width: 612, height: 792)
        let margin: CGFloat = 36
        let width = page.width - margin * 2
        let renderer = UIGraphicsPDFRenderer(bounds: page)
        let templateTitle = String(appLocalized: WorksheetCopy.title(def.templateId))
        let nameLabel = String(appLocalized: AppText("worksheets.sheet.header.name", defaultValue: "Name"))
        let dateLabel = String(appLocalized: AppText("worksheets.sheet.header.date", defaultValue: "Date"))

        return renderer.pdfData { ctx in
            for sheet in sheets {
                ctx.beginPage()
                var y = margin

                func height(_ text: String, _ attrs: [NSAttributedString.Key: Any], _ w: CGFloat) -> CGFloat {
                    ceil((text as NSString).boundingRect(with: CGSize(width: w, height: .greatestFiniteMagnitude),
                                                         options: [.usesLineFragmentOrigin], attributes: attrs, context: nil).height)
                }
                func ensure(_ h: CGFloat) {
                    if y + h > page.height - margin { ctx.beginPage(); y = margin }
                }
                func draw(_ text: String, _ attrs: [NSAttributedString.Key: Any], after: CGFloat = 4) {
                    let h = height(text, attrs, width)
                    ensure(h)
                    (text as NSString).draw(with: CGRect(x: margin, y: y, width: width, height: h),
                                            options: [.usesLineFragmentOrigin], attributes: attrs, context: nil)
                    y += h + after
                }
                func rule(_ count: Int) {
                    for _ in 0..<count {
                        ensure(22)
                        y += 20
                        let p = UIBezierPath()
                        p.move(to: CGPoint(x: margin, y: y)); p.addLine(to: CGPoint(x: page.width - margin, y: y))
                        p.lineWidth = 0.7
                        UIColor.black.setStroke(); p.stroke()
                        y += 2
                    }
                    y += 8
                }
                let center = NSMutableParagraphStyle(); center.alignment = .center
                draw(title, [.font: UIFont.systemFont(ofSize: 22, weight: .bold), .paragraphStyle: center], after: 2)
                draw(templateTitle, [.font: UIFont.systemFont(ofSize: 10), .foregroundColor: UIColor.darkGray, .paragraphStyle: center], after: 10)
                let name = sheet.studentName.isEmpty ? "______________________" : sheet.studentName
                draw("\(nameLabel): \(name)        \(dateLabel): ______________",
                     [.font: UIFont.systemFont(ofSize: 12)], after: 14)

                let bold: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 12, weight: .bold)]
                let body: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 12)]
                let answers = sheet.answers
                for item in WorksheetLayout.items(def, childWord: answers?["word"]) {
                    switch item {
                    case .box(let id, let prompt, let size):
                        draw(prompt, bold)
                        if let answers {
                            draw(answers[id] ?? "", body, after: 12)
                        } else {
                            rule(size == .small ? 1 : size == .medium ? 3 : 6)
                        }
                    case .word(let prompt, _):
                        draw(prompt, bold)
                        if let w = def.word ?? answers?["word"], !w.isEmpty {
                            draw(w, [.font: UIFont.systemFont(ofSize: 20, weight: .bold), .kern: 6], after: 10)
                        } else {
                            rule(1)
                        }
                    case .letters(let prompt, let letters):
                        draw(prompt, bold)
                        let rows = letters.isEmpty ? (1...8).map { WorksheetItem.Letter(id: "line_\($0)", letter: "") } : letters
                        for l in rows {
                            let text = answers?[l.id] ?? ""
                            let line = l.letter.isEmpty ? text : "\(l.letter)   \(text)"
                            if answers != nil {
                                draw(line, body, after: 6)
                            } else {
                                draw(l.letter, [.font: UIFont.systemFont(ofSize: 16, weight: .bold)], after: 0)
                                rule(1)
                            }
                        }
                    }
                }
            }
        }
    }
}

enum WorksheetPrinter {
    /// AirPrint: a popover on iPad (anchored to the middle top of the
    /// screen), the standard sheet elsewhere. Same controller set-up as the
    /// sign-in cards.
    @MainActor
    static func print(_ data: Data, jobName: String) {
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = jobName
        let controller = UIPrintInteractionController.shared
        controller.printInfo = info
        controller.printingItem = data
        if UIDevice.current.userInterfaceIdiom == .pad, let host = TopViewController.find() {
            let rect = CGRect(x: host.view.bounds.midX, y: 80, width: 1, height: 1)
            controller.present(from: rect, in: host.view, animated: true, completionHandler: nil)
        } else {
            controller.present(animated: true, completionHandler: nil)
        }
    }
}

// Worksheet assignments on the teacher's iPad (spec 2026-10-01 §2): the
// worksheet half of the new/edit assignment form (the library's 33 sheets
// with its search, shelves and grade filter; editable prompts), a hand-in's answers in the review, and printing — the
// previewed WorksheetPage as a vector PDF page (or the full-wrapping list), sent to AirPrint.
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

    // The library's search and filters (same as the Worksheets tab).
    @State private var query = ""
    @State private var category: WorksheetTemplate.Category?
    @State private var grade: WorksheetTemplate.GradeBand?

    var body: some View {
        // A template this build doesn't know (editing a newer assignment):
        // its own prompts are the boxes, as on the web.
        if let def = worksheet, def.template != nil || !def.prompts.isEmpty {
            Section {
                ForEach(Array(Self.boxIds(def).enumerated()), id: \.element) { i, id in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(WorksheetCopy.teacherBoxLabel(i + 1)).font(.caption).foregroundStyle(.secondary)
                        TextField(text: promptBinding(id), axis: .vertical) { Text(WorksheetCopy.teacherPromptsHeading) }
                            .lineLimit(1...4)
                    }
                }
                if def.template != nil {
                    Button { resetPrompts() } label: {
                        Label { Text(WorksheetCopy.teacherResetPrompts) } icon: { Image(systemName: "arrow.counterclockwise") }
                    }
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
                        // Same rule as the API's: locked once not a draft
                        // (canChangeTemplate is that same condition).
                        .disabled(!canChangeTemplate)
                        .onChange(of: word) { _, v in
                            let cut = String(v.filter { !$0.isWhitespace }.prefix(WorksheetTemplates.acrosticWordMax))
                            if cut != v { word = cut }
                        }
                } header: {
                    Text(WorksheetCopy.teacherAcrosticWordLabel)
                } footer: {
                    Text(canChangeTemplate ? WorksheetCopy.teacherAcrosticWordHint : WorksheetCopy.teacherAcrosticWordLocked)
                }
            }
        } else {
            Section {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary).accessibilityHidden(true)
                    TextField(text: $query) { Text(WorksheetCopy.librarySearchPlaceholder) }
                        .autocorrectionDisabled()
                        .accessibilityLabel(Text(WorksheetCopy.librarySearchLabel))
                    if !query.isEmpty {
                        Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                            .buttonStyle(.plain)
                            .accessibilityLabel(Text(WorksheetCopy.libraryClearSearch))
                    }
                }
                WorksheetLibraryFilters(category: $category, grade: $grade)
                    .padding(.vertical, 4)
                let list = WorksheetLibrarySearch.filter(query: query, category: category, grade: grade)
                if list.isEmpty {
                    WorksheetLibraryEmpty(query: query, onClearSearch: { query = "" },
                                          onShowAll: { query = ""; category = nil; grade = nil })
                } else {
                    ForEach(WorksheetLibrarySearch.grouped(list)) { shelf in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(WorksheetCopy.category(shelf.category)).font(.subheadline.bold())
                                .accessibilityAddTraits(.isHeader)
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                                ForEach(shelf.templates, id: \.id) { t in
                                    Button { pick(t) } label: { card(t) }
                                        .buttonStyle(.plain)
                                }
                            }
                        }
                        .padding(.vertical, 6)
                    }
                }
            } header: {
                Text(WorksheetCopy.teacherChooseTemplate)
            }
        }
    }

    /// The library's card (WorksheetLibraryCard), a size smaller: every
    /// card the same size, the sheet drawn as its page.
    private func card(_ t: WorksheetTemplate) -> some View {
        WorksheetLibraryCard(template: t, thumbnailWidth: 104, compact: true)
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

    /// The boxes whose prompts the teacher edits: the template's, or for one
    /// this build doesn't know, the assignment's own prompt keys, sorted.
    static func boxIds(_ def: WorksheetDefinition) -> [String] {
        def.template?.boxIds ?? def.prompts.keys.sorted()
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

// MARK: - Live preview (assign form)

/// The worksheet as the class will get it, redrawn as the teacher edits the
/// prompts or the acrostic word: the same page as the library's cards and
/// preview (WorksheetPage, fitted to the pane) fed with the form's draft. Beside the form on
/// iPad (regular width); in a sheet behind a "Preview" button on iPhone.
struct TeacherWorksheetLivePreview: View {
    let definition: WorksheetDefinition
    /// The form's title: the heading the printed sheet will carry.
    var title: String? = nil

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(WorksheetCopy.teacherPreviewHeading).font(.headline).foregroundStyle(.white)
                        .accessibilityAddTraits(.isHeader)
                    Text(WorksheetCopy.teacherPreviewHint).font(.caption).foregroundStyle(TeacherTheme.secondaryText)
                }
                TeacherCard {
                    WorksheetPageFitted(definition: definition, title: title)
                }
            }
            .padding(16)
        }
        .background(TeacherTheme.sheetBackground)
    }

    /// The form's draft as the saved assignment will carry it: the acrostic
    /// word cleaned the way save() (and the API) cleans it — an unusable or
    /// empty one leaves the word to each child. nil = nothing to preview yet.
    static func definition(kind: String, worksheet: WorksheetDefinition?, word: String) -> WorksheetDefinition? {
        guard kind == "worksheet", var def = worksheet, def.template != nil || !def.prompts.isEmpty else { return nil }
        def.word = def.isAcrostic ? WorksheetTemplates.cleanAcrosticWord(word) : nil
        return def
    }
}

/// How the new / edit assignment form is presented (iPad round 7): full
/// screen at regular width, so the live preview has room beside the form
/// on any iPad, in portrait too (a sheet there is narrower than the two
/// panes need, which left the preview behind a button); the ordinary sheet
/// on iPhone and in a narrow split view.
struct TeacherAssignmentFormPresentation<Item: Identifiable, Form: View>: ViewModifier {
    @Binding var item: Item?
    var onDismiss: (() -> Void)?
    let form: (Item) -> Form

    @Environment(\.horizontalSizeClass) private var hSize
    /// The style chosen when the form opened, kept until it closes: a size
    /// class change mid-edit (Split View, Stage Manager) must not swap the
    /// cover for a sheet, which would dismiss the form and lose the input.
    @State private var latchedFullScreen: Bool?

    func body(content: Content) -> some View {
        let fullScreen = latchedFullScreen ?? (hSize == .regular)
        content
            .sheet(item: fullScreen ? .constant(nil) : $item, onDismiss: onDismiss, content: form)
            .fullScreenCover(item: fullScreen ? $item : .constant(nil), onDismiss: onDismiss, content: form)
            .onChange(of: item?.id, initial: true) { _, id in
                latchedFullScreen = id == nil ? nil : (latchedFullScreen ?? (hSize == .regular))
            }
    }
}

extension View {
    func teacherAssignmentForm<Item: Identifiable, Form: View>(
        item: Binding<Item?>, onDismiss: (() -> Void)? = nil, @ViewBuilder form: @escaping (Item) -> Form
    ) -> some View {
        modifier(TeacherAssignmentFormPresentation(item: item, onDismiss: onDismiss, form: form))
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

/// US Letter worksheets for AirPrint, one page per sheet (one per name).
/// A blank sheet is the very page the teacher saw in the thumbnails and
/// previews: WorksheetPage, drawn as vectors into a 612 x 792 pt PDF page
/// (round 7). As on the web (AssignmentWorksheetSheet), a filled sheet, a
/// template this build doesn't know, or a prompt too long for its two-line
/// label prints in the full-wrapping list instead (`listPDF`), running onto
/// more pages when it must.
enum WorksheetPDF {
    struct Sheet {
        let studentName: String
        let answers: [String: String]?
    }

    /// The one-page layout applies: every sheet blank, every label fits.
    static func usesPage(_ def: WorksheetDefinition, sheets: [Sheet]) -> Bool {
        sheets.allSatisfy { $0.answers == nil } && WorksheetPrintLayout.labelsFit(def)
    }

    @MainActor
    static func make(title: String, worksheet def: WorksheetDefinition, sheets: [Sheet]) -> Data {
        usesPage(def, sheets: sheets)
            ? pagePDF(title: title, worksheet: def, sheets: sheets)
            : listPDF(title: title, worksheet: def, sheets: sheets)
    }

    /// WorksheetPage per sheet, rendered by ImageRenderer straight into a
    /// PDF context: text and lines stay vector, nothing is rasterized.
    @MainActor
    static func pagePDF(title: String, worksheet def: WorksheetDefinition, sheets: [Sheet]) -> Data {
        let data = NSMutableData()
        var box = CGRect(origin: .zero, size: WorksheetPage.size)
        guard let consumer = CGDataConsumer(data: data as CFMutableData),
              let pdf = CGContext(consumer: consumer, mediaBox: &box, nil) else {
            return listPDF(title: title, worksheet: def, sheets: sheets)
        }
        for sheet in sheets {
            let renderer = ImageRenderer(content:
                WorksheetPage(definition: def, title: title, studentName: sheet.studentName)
                    .environment(\.colorScheme, .light))
            renderer.proposedSize = ProposedViewSize(WorksheetPage.size)
            renderer.render { _, draw in
                pdf.beginPDFPage(nil)
                draw(pdf)
                pdf.endPDFPage()
            }
        }
        pdf.closePDF()
        return data as Data
    }

    /// The full-wrapping list: title, template name, Name / Date, then each
    /// prompt with ruled lines (blank) or the child's answer (filled).
    static func listPDF(title: String, worksheet def: WorksheetDefinition, sheets: [Sheet]) -> Data {
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

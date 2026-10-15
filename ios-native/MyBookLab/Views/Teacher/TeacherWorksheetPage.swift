// A worksheet as a miniature Letter page (iPad round 7): the library's
// cards and the assign form's chooser draw each sheet the way it prints on
// the web — portrait 8.5 x 11, the kid-friendly heading, Name / Date, then
// every box where the one-page layout puts it (side by side in rows, the
// storyboard's six panels, a drawing panel inside a box, the sheet's
// drawing box at the top or bottom, the word web, the feelings circles),
// each with its label and ruled lines. Laid out once at the real page size
// (72 pt per inch) and scaled into a fixed thumbnail frame, so every card
// is the same size whatever the sheet. A mirror of printLayout()
// (src/lib/worksheets/printLayout.js) and the templates' `print` hints in
// lib/school/worksheets.js; tests/worksheets-ios.test.js fails if the hints
// drift from lib.
import SwiftUI

/// One template's `print` hints (lib/school/worksheets.js).
struct WorksheetPrintHint: Sendable {
    struct Picture: Sendable {
        let atTop: Bool
        /// Inches.
        let height: Double
    }
    /// Box ids side by side, row by row (nil: one box per row).
    var rows: [[String]]? = nil
    /// Ruled lines per box (default by size: 1 / 3 / 6).
    var lines: [String: Int] = [:]
    /// A drawing panel inside a box, above its lines (inches).
    var drawIn: [String: Double] = [:]
    var picture: Picture? = nil
    /// A hand-made body (word_web, feelings_checkin, …).
    var body: String? = nil
}

enum WorksheetPrintLayout {
    // printLayout.js, in inches.
    static let labelIn = 0.4
    static let lineIn = 0.34
    static let gapIn = 0.14
    static let drawGapIn = 0.08
    static let letterRows = 8

    struct Box: Hashable {
        let id: String
        let perLetter: Bool
        let lines: Int
        let drawIn: Double
        let height: Double
    }
    struct Row: Hashable {
        let height: Double
        let boxes: [Box]
    }
    struct Layout {
        let rows: [Row]
        let picture: WorksheetPrintHint.Picture?
        /// The fixed blocks only (rows + gaps), inches.
        let rowsHeight: Double
    }

    static func defaultLines(_ size: WorksheetTemplate.Size) -> Int {
        switch size {
        case .small: 1
        case .medium: 3
        case .large: 6
        }
    }

    static func layout(_ template: WorksheetTemplate) -> Layout {
        let hint = hints[template.id] ?? WorksheetPrintHint()
        let byId = Dictionary(template.boxes.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let rowIds = hint.rows ?? template.boxes.map { [$0.id] }
        let rows: [Row] = rowIds.map { ids in
            let boxes: [Box] = ids.compactMap { id in
                guard let b = byId[id] else { return nil }
                let lines = hint.lines[id] ?? (b.perLetter ? letterRows : defaultLines(b.size))
                let draw = hint.drawIn[id] ?? 0
                let height = labelIn + (draw > 0 ? draw + drawGapIn : 0) + Double(lines) * lineIn
                return Box(id: id, perLetter: b.perLetter, lines: lines, drawIn: draw, height: height)
            }
            return Row(height: boxes.map(\.height).max() ?? 0, boxes: boxes)
        }
        let rowsHeight = rows.reduce(0) { $0 + $1.height } + gapIn * Double(max(rows.count - 1, 0))
        return Layout(rows: rows, picture: hint.picture, rowsHeight: rowsHeight)
    }

    // labelsFit (printLayout.js): a label is two lines of bold text at
    // most; 10.5 characters per inch per line, over the row's share of the
    // 7.5 in writing width (0.2 in between boxes).
    static let labelCharsPerIn = 10.5
    static let rowGapIn = 0.2
    static let writingWidthIn = 7.5

    /// How many characters fit in a box's two-line label, in a row of `n`.
    static func labelCharLimit(_ boxesInRow: Int) -> Int {
        let n = Double(max(boxesInRow, 1))
        let width = (writingWidthIn - rowGapIn * (n - 1)) / n
        return Int((width * labelCharsPerIn).rounded(.down)) * 2
    }

    /// Whether every prompt fits its label on the one-page layout. When one
    /// doesn't (prompts can be 300 characters), a blank sheet prints in the
    /// full-wrapping list instead — as on the web. Counted in UTF-16 units,
    /// like JavaScript's length.
    static func labelsFit(_ def: WorksheetDefinition) -> Bool {
        guard let template = def.template else { return false }
        return layout(template).rows.allSatisfy { row in
            row.boxes.allSatisfy { (def.prompts[$0.id] ?? "").utf16.count <= labelCharLimit(row.boxes.count) }
        }
    }

    /// Same contents as the templates' `print` in lib/school/worksheets.js.
    static let hints: [String: WorksheetPrintHint] = [
        "story_map": .init(rows: [["characters", "setting"], ["problem"], ["events"], ["ending"]]),
        "beginning_middle_end": .init(lines: ["beginning": 2, "middle": 2, "end": 2], drawIn: ["beginning": 1.1, "middle": 1.1, "end": 1.1]),
        "sequence": .init(rows: [["first", "next"], ["then", "last"]], lines: ["first": 2, "next": 2, "then": 2, "last": 2], drawIn: ["first": 2, "next": 2, "then": 2, "last": 2]),
        "storyboard": .init(rows: [["panel_one", "panel_two", "panel_three"], ["panel_four", "panel_five", "panel_six"]], lines: ["panel_one": 2, "panel_two": 2, "panel_three": 2, "panel_four": 2, "panel_five": 2, "panel_six": 2], drawIn: ["panel_one": 2, "panel_two": 2, "panel_three": 2, "panel_four": 2, "panel_five": 2, "panel_six": 2]),
        "problem_solution": .init(lines: ["tries": 5], picture: .init(atTop: false, height: 1.4)),
        "story_mountain": .init(rows: [["beginning", "build_up"], ["big_moment"], ["wind_down", "ending"]], lines: ["beginning": 4, "build_up": 4, "big_moment": 6, "wind_down": 4, "ending": 4]),
        "character_profile": .init(rows: [["name"], ["looks_like", "likes"], ["wants", "afraid_of"]], picture: .init(atTop: true, height: 2.3)),
        "setting_sketch": .init(rows: [["place", "when"], ["looks_like"], ["sounds_smells"]], picture: .init(atTop: true, height: 2.6)),
        "five_senses": .init(rows: [["place"], ["see", "hear"], ["smell", "touch"], ["taste"]], lines: ["see": 4, "hear": 4, "smell": 4, "touch": 4]),
        "character_change": .init(lines: ["at_start": 4, "what_happened": 4, "at_end": 4]),
        "sentence_starters": .init(body: "sentence_starters"),
        "describing_words": .init(rows: [["thing"], ["word_one", "word_two"], ["word_three", "word_four"], ["word_five"]], picture: .init(atTop: true, height: 2.6)),
        "word_web": .init(rows: [["center"], ["idea_one", "idea_two"], ["idea_three", "idea_four"], ["idea_five", "idea_six"]], lines: ["center": 1, "idea_one": 2, "idea_two": 2, "idea_three": 2, "idea_four": 2, "idea_five": 2, "idea_six": 2], body: "word_web"),
        "stretch_sentence": .init(rows: [["who", "did_what"], ["where", "when"], ["why"], ["my_sentence"]], lines: ["my_sentence": 8]),
        "dialogue": .init(rows: [["character_a", "character_b"], ["conversation"]], lines: ["conversation": 16]),
        "acrostic": .init(lines: ["lines": 12]),
        "haiku": .init(lines: ["line_one": 2, "line_two": 2, "line_three": 2], picture: .init(atTop: false, height: 3)),
        "i_am_poem": .init(lines: ["i_am": 2, "i_wonder": 2, "i_hear": 2, "i_see": 2, "i_want": 2, "i_am_again": 2]),
        "cinquain": .init(picture: .init(atTop: false, height: 2.2)),
        "opinion": .init(lines: ["reason": 4, "example": 4]),
        "letter": .init(lines: ["opening": 2, "closing": 2]),
        "thank_you": .init(picture: .init(atTop: false, height: 1.9)),
        "persuade": .init(lines: ["should": 2, "so": 2]),
        "book_report": .init(rows: [["title", "author"], ["about"], ["favorite", "would_recommend"]], picture: .init(atTop: false, height: 2), body: "book_report"),
        "favorite_part": .init(picture: .init(atTop: true, height: 2.7)),
        "predict": .init(lines: ["clues": 4, "prediction": 4, "what_happened": 4]),
        "compare_books": .init(rows: [["book_one", "book_two"], ["same"], ["different"]], lines: ["same": 7, "different": 7]),
        "all_about": .init(rows: [["topic"], ["fact_one", "fact_two"], ["fact_three", "wow_fact"]], picture: .init(atTop: true, height: 2.4)),
        "how_to": .init(rows: [["what"], ["need"], ["step_one", "step_two"], ["step_three", "step_four"]], lines: ["need": 2, "step_one": 2, "step_two": 2, "step_three": 2, "step_four": 2], drawIn: ["step_one": 1, "step_two": 1, "step_three": 1, "step_four": 1]),
        "about_author": .init(lines: ["i_like": 2, "i_write_about": 2, "fun_fact": 2], picture: .init(atTop: true, height: 2.2)),
        "feelings_checkin": .init(picture: .init(atTop: true, height: 2.6), body: "feelings_checkin"),
        "my_week": .init(lines: ["felt_good": 2, "next_week": 2]),
        "all_about_me": .init(rows: [["favorites", "good_at"], ["learning", "dream"]], lines: ["favorites": 4, "good_at": 4, "learning": 4, "dream": 4], picture: .init(atTop: true, height: 2.4)),
    ]
}

/// The whole sheet at its real size: 612 x 792 pt (8.5 x 11 in at 72 pt).
/// Labels are the definition's prompts (the teacher's, or the template's
/// own). Black on white, like paper, in any appearance.
struct WorksheetPage: View {
    let definition: WorksheetDefinition
    /// The assignment's title as the page heading (printing an assignment,
    /// the assign form's preview); nil or empty = the sheet's own heading.
    var title: String? = nil
    /// A per-child copy's name, written on the Name line.
    var studentName: String = ""

    static let size = CGSize(width: 612, height: 792)
    private static let inch: CGFloat = 72
    private static let margin: CGFloat = 36

    private var template: WorksheetTemplate? { definition.template }
    private func label(_ id: String) -> String { definition.prompts[id] ?? "" }
    private func px(_ inches: Double) -> CGFloat { CGFloat(inches) * Self.inch }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            headingText
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .lineLimit(2)
                .minimumScaleFactor(0.7)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .frame(height: 40)
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: 24) {
                field(AppText("worksheets.sheet.header.name", defaultValue: "Name"), value: studentName)
                field(AppText("worksheets.sheet.header.date", defaultValue: "Date"))
                    .frame(width: 170)
            }
            .frame(height: 30)
            Rectangle().fill(.black).frame(height: 1.5)
                .padding(.bottom, 12)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .clipped()
        }
        .padding(Self.margin)
        .frame(width: Self.size.width, height: Self.size.height, alignment: .top)
        .foregroundStyle(.black)
        .background(.white)
        // VoiceOver: the heading, then each label in order, kept separate.
        .accessibilityElement(children: .contain)
    }

    private var headingText: Text {
        if let title, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return Text(verbatim: title)
        }
        return Text(WorksheetCopy.heading(definition.templateId))
    }

    @ViewBuilder
    private var content: some View {
        if let template {
            switch WorksheetPrintLayout.hints[template.id]?.body {
            case "word_web": wordWeb
            case "feelings_checkin": feelings
            default: generic(template)
            }
        } else {
            // A template this build doesn't know: a plain box per prompt.
            VStack(alignment: .leading, spacing: px(WorksheetPrintLayout.gapIn)) {
                ForEach(definition.prompts.keys.sorted(), id: \.self) { id in
                    box(.init(id: id, perLetter: false, lines: 3, drawIn: 0, height: 0))
                }
            }
        }
    }

    private func generic(_ template: WorksheetTemplate) -> some View {
        let layout = WorksheetPrintLayout.layout(template)
        let picture = WorksheetCopy.picture(template.id)
        return VStack(alignment: .leading, spacing: px(WorksheetPrintLayout.gapIn)) {
            if let p = layout.picture, p.atTop { pictureBlock(picture, min: p.height) }
            ForEach(Array(layout.rows.enumerated()), id: \.offset) { _, row in
                HStack(alignment: .top, spacing: 14) {
                    ForEach(row.boxes, id: \.id) { b in box(b) }
                }
                .frame(height: px(row.height), alignment: .top)
            }
            if let p = layout.picture, !p.atTop { pictureBlock(picture, min: p.height) }
        }
    }

    private func box(_ b: WorksheetPrintLayout.Box) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // 10.5pt matches the web label the labels-fit rule is calibrated on.
            Text(verbatim: label(b.id))
                .font(.system(size: 10.5, weight: .bold))
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .frame(height: px(WorksheetPrintLayout.labelIn), alignment: .topLeading)
            if b.drawIn > 0 {
                RoundedRectangle(cornerRadius: 6).stroke(.black, lineWidth: 1.5)
                    .frame(height: px(b.drawIn))
                    .padding(.bottom, px(WorksheetPrintLayout.drawGapIn))
            }
            if b.perLetter {
                let letters = (definition.word ?? "").map(String.init)
                ForEach(0..<b.lines, id: \.self) { i in
                    HStack(alignment: .bottom, spacing: 8) {
                        Text(verbatim: i < letters.count ? letters[i] : " ")
                            .font(.system(size: 16, weight: .bold))
                            .frame(width: 24)
                            .overlay(alignment: .bottom) { Rectangle().fill(.black).frame(height: 2) }
                        Rectangle().fill(.black.opacity(0.6)).frame(height: 0.8)
                    }
                    .frame(height: px(WorksheetPrintLayout.lineIn), alignment: .bottom)
                }
            } else if b.id == "word", let word = definition.word, !word.isEmpty {
                Text(verbatim: word).font(.system(size: 20, weight: .bold)).tracking(6)
            } else {
                ruled(b.lines)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    private func ruled(_ count: Int) -> some View {
        VStack(spacing: 0) {
            ForEach(0..<count, id: \.self) { _ in
                Rectangle().fill(.black.opacity(0.6)).frame(height: 0.8)
                    .frame(height: px(WorksheetPrintLayout.lineIn), alignment: .bottom)
            }
        }
    }

    /// The drawing box: its label, then a frame taking the room left.
    private func pictureBlock(_ title: LocalizedStringResource?, min inches: Double) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if let title {
                Text(title).font(.system(size: 12, weight: .bold)).lineLimit(1)
                    .frame(height: px(WorksheetPrintLayout.labelIn), alignment: .topLeading)
            }
            RoundedRectangle(cornerRadius: 6).stroke(.black, lineWidth: 1.5)
        }
        .frame(minHeight: px(WorksheetPrintLayout.labelIn + inches), maxHeight: .infinity)
    }

    // The word web: a big idea in the middle, six bubbles round it, spokes
    // between (sheets.jsx WordWebBody, 6 in tall).
    private static let webSpots: [(CGFloat, CGFloat)] = [(0.18, 0.16), (0.5, 0.11), (0.82, 0.16), (0.82, 0.84), (0.5, 0.89), (0.18, 0.84)]
    private static let webIdeas = ["idea_one", "idea_two", "idea_three", "idea_four", "idea_five", "idea_six"]

    private var wordWeb: some View {
        let w = Self.size.width - Self.margin * 2
        let h = px(6)
        return ZStack(alignment: .topLeading) {
            Path { p in
                for (x, y) in Self.webSpots {
                    p.move(to: CGPoint(x: w / 2, y: h / 2))
                    p.addLine(to: CGPoint(x: x * w, y: y * h))
                }
            }
            .stroke(.black, lineWidth: 1.5)
            bubble(label("center"), width: px(2.8), height: px(1.6), line: 3, bold: true)
                .position(x: w / 2, y: h / 2)
            ForEach(Array(Self.webIdeas.enumerated()), id: \.offset) { i, id in
                bubble(label(id), width: px(2.1), height: px(1.15), line: 2, bold: false)
                    .position(x: Self.webSpots[i].0 * w, y: Self.webSpots[i].1 * h)
            }
        }
        .frame(width: w, height: h)
    }

    private func bubble(_ text: String, width: CGFloat, height: CGFloat, line: CGFloat, bold: Bool) -> some View {
        Ellipse().fill(.white)
            .overlay(Ellipse().stroke(.black, lineWidth: line))
            .overlay(alignment: .top) {
                Text(verbatim: text)
                    .font(.system(size: bold ? 12 : 10, weight: bold ? .bold : .semibold))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.6)
                    .padding(.horizontal, 16).padding(.top, 10)
            }
            .frame(width: width, height: height)
    }

    // The feelings check-in: circles to ring a feeling (two rows of
    // three), chips for what would help, the drawing box, then "why" and
    // "what helps" side by side (sheets.jsx FeelingsCheckinBody).
    private var feelings: some View {
        VStack(alignment: .leading, spacing: px(WorksheetPrintLayout.gapIn)) {
            Text(verbatim: label("feeling")).font(.system(size: 15, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
                .frame(height: px(WorksheetPrintLayout.labelIn), alignment: .topLeading)
            VStack(spacing: px(0.15)) {
                ForEach(0..<2, id: \.self) { _ in
                    HStack {
                        ForEach(0..<3, id: \.self) { _ in
                            Circle().stroke(.black, lineWidth: 2).frame(width: px(1), height: px(1))
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            HStack(spacing: 12) {
                ForEach(0..<4, id: \.self) { _ in
                    Capsule().stroke(.black, lineWidth: 2).frame(width: 96, height: 30)
                }
            }
            .frame(height: px(0.6), alignment: .leading)
            pictureBlock(WorksheetCopy.picture("feelings_checkin"), min: 0.6)
            HStack(alignment: .top, spacing: 16) {
                ForEach(["why", "what_helps"], id: \.self) { id in
                    VStack(alignment: .leading, spacing: 0) {
                        Text(verbatim: label(id)).font(.system(size: 12, weight: .bold)).lineLimit(2)
                            .frame(height: px(WorksheetPrintLayout.labelIn), alignment: .topLeading)
                        ruled(2)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
    }

    private func field(_ title: LocalizedStringResource, value: String = "") -> some View {
        HStack(alignment: .bottom, spacing: 6) {
            Text(title).font(.system(size: 13))
            Rectangle().fill(.black.opacity(0.6)).frame(height: 0.8)
                .overlay(alignment: .bottomLeading) {
                    if !value.isEmpty {
                        Text(verbatim: value).font(.system(size: 15, weight: .semibold)).lineLimit(1)
                            .padding(.leading, 4).padding(.bottom, 2)
                    }
                }
        }
    }
}

/// The page scaled into a fixed `width` (height follows 8.5 : 11), for a
/// card. A fixed frame, no GeometryReader: every card in a grid is the same.
struct WorksheetPageThumbnail: View {
    let definition: WorksheetDefinition
    var width: CGFloat = 130

    var height: CGFloat { (width * WorksheetPage.size.height / WorksheetPage.size.width).rounded() }

    var body: some View {
        WorksheetPage(definition: definition)
            .scaleEffect(width / WorksheetPage.size.width, anchor: .topLeading)
            .frame(width: width, height: height, alignment: .topLeading)
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

/// The page as large as its pane is wide (the library's preview, the assign
/// form's live preview): the same WorksheetPage as the cards and the print,
/// so thumbnail, preview, live preview and paper all look alike. Its height
/// follows 8.5 : 11; the surrounding ScrollView scrolls it. A tap (or the
/// corner button) opens it full screen, pinch-zoomable, so the teacher can
/// read every prompt at size. One width measurement per preview (one or two
/// on screen, never a grid of them).
struct WorksheetPageFitted: View {
    let definition: WorksheetDefinition
    var title: String? = nil

    @State private var width: CGFloat = 0
    @State private var zoomed = false

    var body: some View {
        Color.clear
            .aspectRatio(WorksheetPage.size.width / WorksheetPage.size.height, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
            .overlay(alignment: .topLeading) {
                if width > 0 {
                    WorksheetPage(definition: definition, title: title)
                        .scaleEffect(width / WorksheetPage.size.width, anchor: .topLeading)
                        .frame(width: width, height: width * WorksheetPage.size.height / WorksheetPage.size.width,
                               alignment: .topLeading)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .contentShape(Rectangle())
            .onTapGesture { zoomed = true }
            .overlay(alignment: .topTrailing) {
                Button { zoomed = true } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.body.bold())
                        .frame(width: 44, height: 44)
                        .background(TeacherTheme.cardFillStrong.opacity(0.92), in: Circle())
                        .foregroundStyle(.white)
                }
                .padding(6)
                .accessibilityLabel(Text(TeacherCopy.worksheetsViewFullSize))
            }
            .fullScreenCover(isPresented: $zoomed) {
                WorksheetPageZoomView(definition: definition, title: title)
            }
    }
}

/// The page full screen: as wide as the screen to start, pinch (or double
/// tap) to zoom up to 4x, scrolling both ways.
struct WorksheetPageZoomView: View {
    let definition: WorksheetDefinition
    var title: String? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var width: CGFloat = 0
    @State private var zoom: CGFloat = 1
    @GestureState private var pinch: CGFloat = 1

    private var scale: CGFloat {
        let fit = max(width - 32, 1) / WorksheetPage.size.width
        return fit * min(4, max(1, zoom * pinch))
    }

    var body: some View {
        NavigationStack {
            ScrollView([.horizontal, .vertical]) {
                WorksheetPage(definition: definition, title: title)
                    .scaleEffect(scale, anchor: .topLeading)
                    .frame(width: WorksheetPage.size.width * scale, height: WorksheetPage.size.height * scale,
                           alignment: .topLeading)
                    .padding(16)
            }
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
            .gesture(
                MagnifyGesture()
                    .updating($pinch) { value, state, _ in state = value.magnification }
                    .onEnded { value in zoom = min(4, max(1, zoom * value.magnification)) }
            )
            .onTapGesture(count: 2) { withAnimation(.snappy) { zoom = zoom > 1.01 ? 1 : 2 } }
            .background(TeacherTheme.sheetBackground)
            .navigationTitle(Text(TeacherCopy.worksheetsPreview))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button { dismiss() } label: { Text(TeacherCopy.done) }
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

extension WorksheetPageThumbnail {
    /// A library sheet with the template's own prompts.
    init(templateId: String, width: CGFloat = 130) {
        self.init(definition: WorksheetDefinition(templateId: templateId,
                                                  prompts: TeacherWorksheetPicker.defaultPrompts(templateId),
                                                  word: nil),
                  width: width)
    }
}

/// One library card, the same size for every sheet: the page thumbnail in
/// a fixed band, the name and what it's for in two lines each (the room is
/// kept even when shorter), and the grade band pinned to the bottom. Used
/// by the Worksheets tab and the assign form's chooser.
struct WorksheetLibraryCard: View {
    let template: WorksheetTemplate
    var thumbnailWidth: CGFloat = 150
    var compact = false

    var body: some View {
        TeacherCard {
            VStack(alignment: .leading, spacing: 8) {
                WorksheetPageThumbnail(templateId: template.id, width: thumbnailWidth)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(TeacherTheme.sheetBackground, in: RoundedRectangle(cornerRadius: 10))
                Text(WorksheetCopy.title(template.id))
                    .font(compact ? .subheadline.bold() : .headline)
                    .foregroundStyle(.primary)
                    .lineLimit(2, reservesSpace: true)
                Text(WorksheetCopy.description(template.id))
                    .font(.caption).foregroundStyle(.secondary)
                    .lineLimit(2, reservesSpace: true)
                Spacer(minLength: 0)
                Text(WorksheetCopy.grade(template.grade)).font(.caption2.bold()).foregroundStyle(.cyan)
            }
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .frame(maxHeight: .infinity)
        .contentShape(RoundedRectangle(cornerRadius: 18))
    }
}

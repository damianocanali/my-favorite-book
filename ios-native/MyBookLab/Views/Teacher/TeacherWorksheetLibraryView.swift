// The teacher's Worksheets tab (owner feedback round 5; teacher round 6B):
// the whole worksheet library — the 33 sheets of WorksheetTemplates.all, the
// mirror of lib/school/worksheets.js — shelf by shelf, with a search
// (.searchable: title, description, heading, keywords and shelf name in the
// app's language, case- and accent-insensitive), shelf chips and a grade
// filter. A card opens the sheet's full-size preview (its heading, every
// box's label and room to write, the drawing box when it has one), with
// "Print blank" (the same AirPrint PDF as an assignment's, WorksheetPDF) and
// "Assign to a class" (pick a class, then the ordinary New assignment form,
// already on this worksheet). Counterpart of the web's /worksheets.
// No prices, nothing to buy (App Store 3.1.3).
import SwiftUI

/// The library's search and filters (web: src/lib/worksheets/library.js):
/// every word of the query must appear in the sheet's title, description,
/// heading, keywords or shelf name, in the app's language, ignoring case
/// and accents.
enum WorksheetLibrarySearch {
    static func normalized(_ s: String) -> String {
        s.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
            .split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    static func text(_ t: WorksheetTemplate) -> String {
        var parts = [WorksheetCopy.title(t.id), WorksheetCopy.description(t.id), WorksheetCopy.heading(t.id),
                     WorksheetCopy.category(t.category)].map { String(appLocalized: $0) }
        if let k = WorksheetCopy.keywords(t.id) { parts.append(String(appLocalized: k)) }
        return normalized(parts.joined(separator: " "))
    }

    static func filter(query: String, category: WorksheetTemplate.Category?, grade: WorksheetTemplate.GradeBand?,
                       in templates: [WorksheetTemplate] = WorksheetTemplates.all) -> [WorksheetTemplate] {
        let words = normalized(query).split(separator: " ").map(String.init)
        return templates.filter { t in
            if let category, t.category != category { return false }
            if !t.matches(grade: grade) { return false }
            if words.isEmpty { return true }
            let hay = text(t)
            return words.allSatisfy { hay.contains($0) }
        }
    }

    struct Shelf: Identifiable {
        let category: WorksheetTemplate.Category
        let templates: [WorksheetTemplate]
        var id: WorksheetTemplate.Category { category }
    }

    /// Shelf by shelf, empty shelves left out.
    static func grouped(_ templates: [WorksheetTemplate]) -> [Shelf] {
        WorksheetTemplate.Category.allCases.compactMap { c in
            let list = templates.filter { $0.category == c }
            return list.isEmpty ? nil : Shelf(category: c, templates: list)
        }
    }
}

/// Shelf chips (All + the eight shelves) and the grade filter, shared by the
/// Worksheets tab and the assignment form's picker.
struct WorksheetLibraryFilters: View {
    @Binding var category: WorksheetTemplate.Category?
    @Binding var grade: WorksheetTemplate.GradeBand?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip(Text(WorksheetCopy.libraryAllCategories), selected: category == nil) { category = nil }
                    ForEach(WorksheetTemplate.Category.allCases, id: \.self) { c in
                        chip(Text(WorksheetCopy.category(c)), selected: category == c) { category = category == c ? nil : c }
                    }
                }
                .padding(.vertical, 2)
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel(Text(WorksheetCopy.libraryCategoryLabel))
            Picker(selection: $grade) {
                Text(WorksheetCopy.libraryAllGrades).tag(WorksheetTemplate.GradeBand?.none)
                Text(WorksheetCopy.grade(.k2)).tag(WorksheetTemplate.GradeBand?.some(.k2))
                Text(WorksheetCopy.grade(.g35)).tag(WorksheetTemplate.GradeBand?.some(.g35))
            } label: { Text(WorksheetCopy.libraryGradeLabel) }
            .pickerStyle(.segmented)
        }
    }

    private func chip(_ label: Text, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            label.font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12).padding(.vertical, 7)
                .foregroundStyle(selected ? .white : .primary)
                .background(selected ? Color.purple : Color.clear, in: Capsule())
                .overlay(Capsule().strokeBorder(selected ? Color.purple : Color.white.opacity(0.3)))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// "No worksheet matches…" with the way back.
struct WorksheetLibraryEmpty: View {
    let query: String
    let onClearSearch: () -> Void
    let onShowAll: () -> Void

    var body: some View {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        VStack(spacing: 12) {
            Text(q.isEmpty ? WorksheetCopy.libraryNoResultsFilters : WorksheetCopy.libraryNoResults(q))
                .multilineTextAlignment(.center)
            HStack(spacing: 12) {
                if !q.isEmpty {
                    Button(action: onClearSearch) { Text(WorksheetCopy.libraryClearSearch) }
                        .buttonStyle(.bordered)
                }
                Button(action: onShowAll) { Text(WorksheetCopy.libraryShowAll) }
                    .buttonStyle(.borderless)
            }
            .tint(.cyan)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }
}

struct TeacherWorksheetLibraryView: View {
    @State private var query = ""
    @State private var category: WorksheetTemplate.Category?
    @State private var grade: WorksheetTemplate.GradeBand?

    private var results: [WorksheetTemplate] {
        WorksheetLibrarySearch.filter(query: query, category: category, grade: grade)
    }
    private var filtering: Bool {
        !WorksheetLibrarySearch.normalized(query).isEmpty || category != nil || grade != nil
    }
    /// As before round 6B: one column on an iPhone, as many as fit on an iPad.
    private let columns = [GridItem(.adaptive(minimum: 200), spacing: 14)]

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(TeacherCopy.worksheetsIntro)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                        WorksheetLibraryFilters(category: $category, grade: $grade)
                        let list = results
                        if list.isEmpty {
                            WorksheetLibraryEmpty(query: query, onClearSearch: { query = "" },
                                                  onShowAll: { query = ""; category = nil; grade = nil })
                        } else if filtering {
                            grid(list)
                        } else {
                            ForEach(WorksheetLibrarySearch.grouped(list)) { shelf in
                                Text(WorksheetCopy.category(shelf.category))
                                    .font(.title3.bold())
                                    .padding(.top, 8)
                                    .accessibilityAddTraits(.isHeader)
                                grid(shelf.templates)
                            }
                        }
                    }
                    .padding()
                    .frame(maxWidth: 1000)
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle(Text(TeacherCopy.worksheetsTitle))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .searchable(text: $query, prompt: Text(WorksheetCopy.librarySearchPlaceholder))
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { TeacherBellButton() }
            }
            .navigationDestination(for: String.self) { id in
                TeacherWorksheetDetailView(templateId: id)
            }
        }
    }

    private func grid(_ templates: [WorksheetTemplate]) -> some View {
        LazyVGrid(columns: columns, spacing: 14) {
            ForEach(templates, id: \.id) { t in
                NavigationLink(value: t.id) { TeacherWorksheetCard(template: t) }
                    .buttonStyle(.plain)
            }
        }
    }
}

/// A tiny picture of the sheet (one bar per box, sized like the box), the
/// name, what it's for and the grade band — on the teacher area's card.
struct TeacherWorksheetCard: View {
    let template: WorksheetTemplate

    var body: some View {
        TeacherCard {
            VStack(alignment: .leading, spacing: 8) {
                WorksheetMiniature(template: template, scale: 1)
                Text(WorksheetCopy.title(template.id)).font(.headline).foregroundStyle(.primary)
                Text(WorksheetCopy.description(template.id)).font(.caption).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(WorksheetCopy.grade(template.grade)).font(.caption2.bold()).foregroundStyle(.cyan)
            }
        }
        .contentShape(RoundedRectangle(cornerRadius: 18))
    }
}

/// One bar per box, sized like the box, on a white page (the drawing box
/// shown as a taller frame when the sheet has one on paper).
struct WorksheetMiniature: View {
    let template: WorksheetTemplate
    var scale: CGFloat = 1

    var body: some View {
        VStack(spacing: 3 * scale) {
            if WorksheetCopy.picture(template.id) != nil {
                RoundedRectangle(cornerRadius: 2).stroke(.black.opacity(0.6), lineWidth: 1.2)
                    .frame(height: 22 * scale)
            }
            ForEach(template.boxes, id: \.id) { b in
                RoundedRectangle(cornerRadius: 2)
                    .stroke(.black.opacity(0.45))
                    .frame(height: (b.size == .small ? 6 : b.size == .medium ? 12 : 20) * scale)
            }
        }
        .padding(10 * scale)
        .background(.white.opacity(0.92), in: RoundedRectangle(cornerRadius: 6))
        .accessibilityHidden(true)
    }
}

struct TeacherWorksheetDetailView: View {
    let templateId: String

    @Environment(TeacherStore.self) private var teacher
    @State private var picking = false
    /// Chosen in the picker; the form opens once the picker has fully gone,
    /// so the two sheets never race.
    @State private var pendingClass: TeacherClass?
    @State private var formClass: TeacherClass?
    @State private var savedIn: TeacherClass?

    private var definition: WorksheetDefinition {
        WorksheetDefinition(templateId: templateId,
                            prompts: TeacherWorksheetPicker.defaultPrompts(templateId),
                            word: nil)
    }
    private var template: WorksheetTemplate? { WorksheetTemplates.find(templateId) }

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(WorksheetCopy.description(templateId))
                        .font(.subheadline).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if let template {
                        Text(verbatim: "\(String(appLocalized: WorksheetCopy.category(template.category))) · \(String(appLocalized: WorksheetCopy.grade(template.grade)))")
                            .font(.caption.bold()).foregroundStyle(.cyan)
                    }

                    if let savedIn {
                        HStack(spacing: 10) {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                            Text(TeacherCopy.worksheetsSaved(savedIn.name ?? "")).font(.subheadline)
                            Spacer(minLength: 0)
                            Button {
                                teacher.open(.classDetail(classId: savedIn.id))
                            } label: { Text(TeacherCopy.worksheetsOpenClass) }
                            .tint(.cyan)
                        }
                        .padding(12)
                        .background(.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                    }

                    HStack(spacing: 12) {
                        Button { printBlank() } label: {
                            Label { Text(WorksheetCopy.teacherPrintBlank) } icon: { Image(systemName: "printer.fill") }
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        Button { picking = true } label: {
                            Label { Text(TeacherCopy.worksheetsAssign) } icon: { Image(systemName: "paperplane.fill") }
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .controlSize(.large)
                    .tint(.cyan)

                    Text(TeacherCopy.worksheetsPreview).font(.headline)
                    WorksheetSheetPreview(definition: definition)
                }
                .padding()
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
        }
        .navigationTitle(Text(WorksheetCopy.title(templateId)))
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .sheet(isPresented: $picking, onDismiss: {
            if let c = pendingClass { pendingClass = nil; formClass = c }
        }) {
            TeacherWorksheetClassPicker { c in
                pendingClass = c
                picking = false
            }
        }
        .sheet(item: $formClass) { c in
            TeacherAssignmentForm(classId: c.id, existing: nil, presetTemplateId: templateId) { _, _ in
                formClass = nil
                savedIn = c
            }
        }
    }

    private func printBlank() {
        let title = String(appLocalized: WorksheetCopy.heading(templateId))
        let data = WorksheetPDF.make(title: title, worksheet: definition,
                                     sheets: [.init(studentName: "", answers: nil)])
        WorksheetPrinter.print(data, jobName: title)
    }
}

/// The blank sheet, drawn natively: a white page with the sheet's heading,
/// Name / Date, the drawing box when it has one on paper, and every box's
/// label with ruled lines (one per small box, three per medium, six per
/// large; twelve letter rows for the acrostic). Not pixel-identical to the
/// printed page — the same structure, readable at full width.
struct WorksheetSheetPreview: View {
    let definition: WorksheetDefinition

    private var picture: LocalizedStringResource? { WorksheetCopy.picture(definition.templateId) }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(WorksheetCopy.heading(definition.templateId)).font(.title2.bold())
                .frame(maxWidth: .infinity)
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: 16) {
                field(AppText("worksheets.sheet.header.name", defaultValue: "Name"))
                field(AppText("worksheets.sheet.header.date", defaultValue: "Date"))
            }
            Rectangle().fill(.black).frame(height: 1.5)
            if let picture {
                VStack(alignment: .leading, spacing: 6) {
                    Text(picture).font(.subheadline.bold())
                    RoundedRectangle(cornerRadius: 6).stroke(.black, lineWidth: 1.5).frame(height: 150)
                }
            }
            ForEach(WorksheetLayout.items(definition)) { item in
                switch item {
                case .box(_, let prompt, let size):
                    promptAndLines(prompt, size == .small ? 1 : size == .medium ? 3 : 6)
                case .word(let prompt, _):
                    // The teacher's word (the assign form's live preview),
                    // else a line for the child to choose one.
                    if let word = definition.word, !word.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(verbatim: prompt).font(.subheadline.bold())
                            Text(verbatim: word).font(.title2.bold()).tracking(6)
                        }
                    } else {
                        promptAndLines(prompt, 1)
                    }
                case .letters(let prompt, let letters):
                    VStack(alignment: .leading, spacing: 0) {
                        Text(verbatim: prompt).font(.subheadline.bold())
                        // One row per letter of the word; twelve blank rows without one.
                        let rows = letters.isEmpty ? (0..<12).map { WorksheetItem.Letter(id: "line_\($0 + 1)", letter: "") } : letters
                        ForEach(rows) { l in
                            HStack(alignment: .bottom, spacing: 8) {
                                if l.letter.isEmpty {
                                    Rectangle().fill(.black).frame(width: 22, height: 1.5)
                                } else {
                                    Text(verbatim: l.letter).font(.headline.bold()).frame(width: 22)
                                }
                                Rectangle().fill(.black.opacity(0.35)).frame(height: 0.7)
                            }
                            .padding(.top, 18)
                        }
                    }
                }
            }
        }
        .foregroundStyle(.black)
        .padding(24)
        .background(.white, in: RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .contain)
    }

    private func field(_ label: LocalizedStringResource) -> some View {
        HStack(alignment: .bottom, spacing: 4) {
            Text(label).font(.footnote)
            Rectangle().fill(.black.opacity(0.5)).frame(height: 0.7)
        }
    }

    private func promptAndLines(_ prompt: String, _ lines: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(verbatim: prompt).font(.subheadline.bold())
            ForEach(0..<lines, id: \.self) { _ in
                Rectangle().fill(.black.opacity(0.35)).frame(height: 0.7).padding(.top, 18)
            }
        }
    }
}

/// "Assign to a class": the teacher's classes, one tap each.
struct TeacherWorksheetClassPicker: View {
    let onPick: (TeacherClass) -> Void

    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @State private var classes: [TeacherClass]?
    @State private var failed = false

    var body: some View {
        NavigationStack {
            List {
                if let classes {
                    if classes.isEmpty {
                        Text(TeacherCopy.worksheetsNoClasses).foregroundStyle(.secondary)
                    }
                    ForEach(classes) { c in
                        Button { onPick(c) } label: {
                            HStack {
                                Text(verbatim: c.name ?? "").foregroundStyle(.primary)
                                Spacer()
                                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                } else if failed {
                    Button { Task { await load() } } label: { Text(TeacherCopy.retry) }
                } else {
                    ProgressView().frame(maxWidth: .infinity)
                }
            }
            .navigationTitle(Text(TeacherCopy.worksheetsPickClass))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(TeacherCopy.cancel) }
                }
            }
            .task { await load() }
        }
        .preferredColorScheme(.dark)
    }

    private func load() async {
        failed = false
        guard let token = await auth.validAccessToken() else { failed = true; return }
        do {
            classes = try await APIClient.shared.teacherClasses(bearerToken: token)
        } catch {
            failed = true
        }
    }
}

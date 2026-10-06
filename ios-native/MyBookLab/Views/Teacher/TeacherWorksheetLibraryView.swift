// The teacher's Worksheets tab (owner feedback round 5): the nine
// assignable worksheet templates (WorksheetTemplates.all — the mirror of
// lib/school/worksheets.js), each with a preview, "Print blank" (the same
// AirPrint PDF as an assignment's, WorksheetPDF) and "Assign to a class"
// (pick a class, then the ordinary New assignment form, already on this
// worksheet). Counterpart of the web's /worksheets tab + "Assign a
// worksheet" link. No prices, nothing to buy (App Store 3.1.3).
import SwiftUI

struct TeacherWorksheetLibraryView: View {
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
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 200), spacing: 14)], spacing: 14) {
                            ForEach(WorksheetTemplates.all, id: \.id) { t in
                                NavigationLink(value: t.id) { TeacherWorksheetCard(template: t) }
                                    .buttonStyle(.plain)
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
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { TeacherBellButton() }
            }
            .navigationDestination(for: String.self) { id in
                TeacherWorksheetDetailView(templateId: id)
            }
        }
    }
}

/// A tiny picture of the sheet (one bar per box, sized like the box), the
/// name and what it's for — same look as the form's template cards.
struct TeacherWorksheetCard: View {
    let template: WorksheetTemplate

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            VStack(spacing: 3) {
                ForEach(template.boxes, id: \.id) { b in
                    RoundedRectangle(cornerRadius: 2)
                        .stroke(.black.opacity(0.45))
                        .frame(height: b.size == .small ? 8 : b.size == .medium ? 16 : 26)
                }
            }
            .padding(10)
            .background(.white.opacity(0.92), in: RoundedRectangle(cornerRadius: 6))
            .accessibilityHidden(true)
            Text(WorksheetCopy.title(template.id)).font(.headline).foregroundStyle(.primary)
            Text(WorksheetCopy.description(template.id)).font(.caption).foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(.white.opacity(0.15)))
        .contentShape(RoundedRectangle(cornerRadius: 14))
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

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text(WorksheetCopy.description(templateId))
                        .font(.subheadline).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)

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
                    preview
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

    /// The blank sheet as it prints: a white page, every box's prompt and
    /// ruled lines.
    private var preview: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(WorksheetCopy.title(templateId)).font(.title3.bold())
                .frame(maxWidth: .infinity)
            ForEach(WorksheetLayout.items(definition)) { item in
                switch item {
                case .box(_, let prompt, let size):
                    promptAndLines(prompt, size == .small ? 1 : size == .medium ? 3 : 5)
                case .word(let prompt, _):
                    promptAndLines(prompt, 1)
                case .letters(let prompt, _):
                    promptAndLines(prompt, 5)
                }
            }
        }
        .foregroundStyle(.black)
        .padding(20)
        .background(.white, in: RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
    }

    private func promptAndLines(_ prompt: String, _ lines: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(verbatim: prompt).font(.subheadline.bold())
            ForEach(0..<lines, id: \.self) { _ in
                Rectangle().fill(.black.opacity(0.35)).frame(height: 0.7).padding(.top, 18)
            }
        }
    }

    private func printBlank() {
        let title = String(appLocalized: WorksheetCopy.title(templateId))
        let data = WorksheetPDF.make(title: title, worksheet: definition,
                                     sheets: [.init(studentName: "", answers: nil)])
        WorksheetPrinter.print(data, jobName: title)
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

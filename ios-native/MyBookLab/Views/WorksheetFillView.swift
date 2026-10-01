// A child filling in a worksheet assignment (spec 2026-10-01 §2), full
// screen from the Class tab card: big boxes, the teacher's prompt above
// each with read-aloud (SpeechSpeaker, app language), autosave on this iPad,
// and "Hand in" through the same endpoint as a book. Dictation is the
// keyboard's own microphone key (the app has no speech recognizer of its
// own). After a hand-in: "Turn into book pages". Counterpart of the web's
// WorksheetFill.jsx.
import SwiftUI

struct WorksheetFillView: View {
    let assignment: StudentAssignment
    var onHandedIn: () -> Void = {}
    /// Make book pages from the answers: into `book`, or a new book (nil).
    var onMakePages: (_ texts: [String], _ book: Book?) -> Void = { _, _ in }

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthStore.self) private var auth
    @Environment(BookshelfStore.self) private var bookshelf

    /// nil while the starting answers load (draft, else the hand-in).
    @State private var answers: [String: String]?
    @State private var loadFailed = false
    @State private var sending = false
    @State private var error: String?
    @State private var handedIn = false
    @State private var showPages = false
    @State private var speaker = SpeechSpeaker()

    private var definition: WorksheetDefinition {
        assignment.worksheet ?? WorksheetDefinition(templateId: "", prompts: [:], word: nil)
    }
    private var userId: String? { auth.user?.id.uuidString }
    private var items: [WorksheetItem] { WorksheetLayout.items(definition, childWord: answers?["word"]) }
    private var canSubmit: Bool { assignment.canSubmit }
    private var ready: Bool { WorksheetLayout.hasAnswers(answers ?? [:]) }
    private var pageTexts: [String] {
        WorksheetPages.pages(definition, answers: WorksheetLayout.answersForSubmit(definition, answers ?? [:]))
    }
    private var canMakePages: Bool { (handedIn || assignment.my_submission != nil) && !pageTexts.isEmpty }

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        header
                        if loadFailed {
                            Text(HandInCopy.error("generic")).foregroundStyle(.red)
                        }
                        if answers == nil && !loadFailed {
                            ProgressView().tint(.white).frame(maxWidth: .infinity).padding(.vertical, 40)
                        } else if answers != nil {
                            ForEach(items) { item in itemView(item) }
                        }
                        footer
                    }
                    .padding(20)
                    .contentColumn(maxWidth: ContentWidth.reading)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { close() } label: { Image(systemName: "xmark").font(.body.bold()) }
                        .accessibilityLabel(Text(WorksheetCopy.studentClose))
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
        }
        .preferredColorScheme(.dark)
        .task { await loadStart() }
        .onDisappear { speaker.stop() }
        .sheet(isPresented: $showPages) {
            WorksheetPagesSheet(texts: pageTexts, books: bookshelf.books) { book in
                showPages = false
                speaker.stop()
                onMakePages(pageTexts, book)
                dismiss()
            }
        }
    }

    // MARK: Pieces

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(WorksheetCopy.title(definition.templateId))
                .font(.caption.bold()).foregroundStyle(.cyan).textCase(.uppercase)
            Text(verbatim: assignment.title)
                .font(.system(.largeTitle, design: .rounded).bold())
                .foregroundStyle(.white)
            if let p = assignment.prompt, !p.isEmpty, p != assignment.title {
                promptRow(p, font: .body, color: .white.opacity(0.8))
            }
        }
    }

    private func promptRow(_ text: String, font: Font = .system(.title3, design: .rounded).bold(),
                           color: Color = .white) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(verbatim: text).font(font).foregroundStyle(color)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button { speaker.toggle(text) } label: {
                Image(systemName: speaker.isSpeaking(text) ? "stop.fill" : "speaker.wave.2.fill")
                    .font(.body)
                    .frame(width: 44, height: 44)
                    .background(.cyan.opacity(0.18), in: Circle())
                    .foregroundStyle(.cyan)
            }
            .accessibilityLabel(Text(speaker.isSpeaking(text) ? AssignmentCopy.stopReading : WorksheetCopy.studentListen))
        }
    }

    @ViewBuilder
    private func itemView(_ item: WorksheetItem) -> some View {
        switch item {
        case .box(let id, let prompt, let size):
            card {
                if !prompt.isEmpty { promptRow(prompt) }
                editor(id: id, minHeight: Self.height(size))
            }
        case .word(let prompt, let fixed):
            card {
                if !prompt.isEmpty { promptRow(prompt) }
                if fixed {
                    Text(verbatim: definition.word ?? "")
                        .font(.system(size: 40, weight: .bold, design: .rounded))
                        .tracking(10)
                        .foregroundStyle(.cyan)
                } else {
                    TextField(text: binding("word", max: WorksheetTemplates.acrosticWordMax, noSpaces: true)) {
                        Text(WorksheetCopy.studentWordPlaceholder)
                    }
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .padding(12)
                    .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                    .accessibilityLabel(Text(WorksheetCopy.studentWordLabel))
                }
            }
        case .letters(let prompt, let letters):
            card {
                if !prompt.isEmpty { promptRow(prompt) }
                ForEach(letters) { l in
                    HStack(alignment: .top, spacing: 12) {
                        Text(verbatim: l.letter)
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                            .foregroundStyle(.cyan)
                            .frame(width: 40)
                            .accessibilityHidden(true)
                        editor(id: l.id, minHeight: 60)
                            .accessibilityLabel(Text(WorksheetCopy.studentLineFor(l.letter)))
                    }
                }
            }
        }
    }

    private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10, content: content)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 20))
    }

    private func editor(id: String, minHeight: CGFloat) -> some View {
        TextField(text: binding(id, max: WorksheetTemplates.answerMax), axis: .vertical) { EmptyView() }
            .font(.system(.title2, design: .rounded))
            .foregroundStyle(.white)
            .lineLimit(2...20)
            .padding(14)
            .frame(minHeight: minHeight, alignment: .topLeading)
            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(.white.opacity(0.15)))
    }

    private static func height(_ size: WorksheetTemplate.Size) -> CGFloat {
        switch size {
        case .small: 64
        case .medium: 130
        case .large: 220
        }
    }

    /// Every keystroke is saved on this iPad (per child and assignment).
    private func binding(_ id: String, max: Int, noSpaces: Bool = false) -> Binding<String> {
        Binding(
            get: { answers?[id] ?? "" },
            set: { v in
                var text = noSpaces ? v.filter { !$0.isWhitespace } : v
                if text.count > max { text = String(text.prefix(max)) }
                var next = answers ?? [:]
                next[id] = text
                answers = next
                error = nil
                WorksheetDrafts.write(next, userId: userId, assignmentId: assignment.id)
            }
        )
    }

    @ViewBuilder
    private var footer: some View {
        Label { Text(WorksheetCopy.studentSavedHere) } icon: { Image(systemName: "checkmark.circle") }
            .font(.caption).foregroundStyle(.white.opacity(0.6))

        if let error {
            Text(HandInCopy.error(error)).font(.subheadline.bold()).foregroundStyle(.red)
        }
        if handedIn {
            VStack(spacing: 4) {
                Text(HandInCopy.successTitle).font(.headline).foregroundStyle(.green)
                Text(HandInCopy.successBody).font(.subheadline).foregroundStyle(.white.opacity(0.8))
            }
            .frame(maxWidth: .infinity)
            .padding(14)
            .background(.green.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
        }

        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) { actions }
            VStack(alignment: .leading, spacing: 10) { actions }
        }
        .padding(.bottom, 30)
    }

    @ViewBuilder
    private var actions: some View {
        if canSubmit {
            SparkleButton(action: { Task { await handIn() } }, size: .regular) {
                Label {
                    Text(sending ? WorksheetCopy.studentHandingIn : WorksheetCopy.studentHandIn)
                } icon: { Image(systemName: "paperplane.fill") }
            }
            .fixedSize()
            .disabled(!ready || sending)
            .opacity(!ready || sending ? 0.5 : 1)
        }
        if canMakePages {
            Button { showPages = true } label: {
                Label { Text(WorksheetCopy.studentMakePages) } icon: { Image(systemName: "book.pages") }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.vertical, 12).padding(.horizontal, 16)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(.white.opacity(0.3)))
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: Actions

    /// This iPad's draft, else (already handed in elsewhere) the hand-in.
    private func loadStart() async {
        guard answers == nil else { return }
        if let draft = WorksheetDrafts.read(userId: userId, assignmentId: assignment.id) {
            answers = draft
        } else if let sid = assignment.my_submission?.id {
            if let handed = await SchoolAssignments.handedInAnswers(submissionId: sid) {
                answers = handed
            } else {
                loadFailed = true
            }
        } else {
            answers = [:]
        }
    }

    private func handIn() async {
        guard ready, !sending, let answers else { return }
        sending = true
        error = nil
        defer { sending = false }
        let code = await SchoolAssignments.handInWorksheet(
            assignmentId: assignment.id, answers: WorksheetLayout.answersForSubmit(definition, answers))
        if let code {
            error = code
        } else {
            handedIn = true
            onHandedIn()
        }
    }

    private func close() {
        speaker.stop()
        dismiss()
    }
}

/// "Make book pages": a new book, or added to one of theirs.
private struct WorksheetPagesSheet: View {
    let texts: [String]
    let books: [Book]
    let onPick: (Book?) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(WorksheetCopy.studentMakePagesHint).foregroundStyle(.secondary)
                    Button { onPick(nil) } label: {
                        Label { Text(WorksheetCopy.studentMakePagesNew).bold() } icon: { Image(systemName: "plus.rectangle.on.rectangle") }
                    }
                }
                if !books.isEmpty {
                    Section {
                        ForEach(books) { b in
                            let full = b.pages.count >= WorksheetTemplates.bookPagesMax
                            Button { onPick(b) } label: {
                                HStack {
                                    Text(verbatim: b.title.isEmpty ? "—" : b.title)
                                    Spacer()
                                    if full { Text(WorksheetCopy.studentMakePagesFull).font(.caption).foregroundStyle(.secondary) }
                                }
                            }
                            .disabled(full)
                        }
                    } header: { Text(WorksheetCopy.studentMakePagesAppend) }
                }
            }
            .navigationTitle(Text(WorksheetCopy.studentMakePagesHeading))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel(Text(WorksheetCopy.studentClose))
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

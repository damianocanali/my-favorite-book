// "My Writing Year", teacher side (spec 2026-10-01 §3): the "Add to Writing
// Year" toggle under the grade panel, the class's Writing Year screen (every
// child's book at a glance), one child's book (Move up / Move down, remove,
// approve suggestions, the teacher's note, preview, the free PDF), and
// "Print the class books" (address → summary → request → status).
// Web: WritingYearToggle / WritingYearSection / WritingYearChild /
// ClassPrintFlow. API: api/school/writing-year.js.
//
// No prices and no buying (App Store 3.1.3): a class that can't print is
// told only that printing isn't available yet.
import SwiftUI

// MARK: - The grade panel toggle

struct WritingYearToggle: View {
    let classId: String
    let submissionId: String
    let graded: Bool

    @Environment(AuthStore.self) private var auth
    @State private var item: APIClient.WYItemState??
    @State private var busy = false
    @State private var error: LocalizedStringResource?

    private var on: Bool { (item ?? nil)?.approved == true }

    var body: some View {
        TeacherCard {
            VStack(alignment: .leading, spacing: 6) {
                Toggle(isOn: Binding(get: { on }, set: { _ in Task { await toggle() } })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Label { Text(WritingYearCopy.toggleLabel) } icon: { Image(systemName: "book.closed.fill") }
                            .foregroundStyle(.white)
                        Text(hint).font(.caption).foregroundStyle(TeacherTheme.secondaryText)
                    }
                }
                .tint(.cyan)
                .disabled(!graded || busy || item == nil)
                if let error { Text(error).font(.footnote).foregroundStyle(TeacherTheme.urgent) }
            }
        }
        .task(id: submissionId) { await load() }
    }

    private var hint: LocalizedStringResource {
        if !graded { return WritingYearCopy.toggleNeedsGrade }
        if let current = item ?? nil, !current.approved { return WritingYearCopy.toggleWaiting }
        return WritingYearCopy.toggleHint
    }

    private func load() async {
        guard let token = await auth.validAccessToken() else { return }
        item = .some(try? await APIClient.shared.writingYearItem(classId: classId, submissionId: submissionId, bearerToken: token))
    }

    private func toggle() async {
        guard let token = await auth.validAccessToken() else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            if on, let current = item ?? nil {
                try await APIClient.shared.writingYearRemove(classId: classId, itemId: current.id, bearerToken: token)
                item = .some(nil)
            } else {
                item = .some(try await APIClient.shared.writingYearAdd(classId: classId, submissionId: submissionId, bearerToken: token))
            }
        } catch {
            self.error = WritingYearCopy.error(error)
        }
    }
}

// MARK: - The class's Writing Year

struct TeacherWritingYearView: View {
    let classId: String

    @Environment(AuthStore.self) private var auth
    @State private var overview: WYOverview?
    @State private var loadError: LocalizedStringResource?
    @State private var openChild: WYChildSummary?

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(WritingYearCopy.sectionSub).font(.subheadline).foregroundStyle(TeacherTheme.secondaryText)
                    if let loadError {
                        TeacherCard { TeacherErrorBlock(message: loadError) { Task { await load() } } }
                    } else if let overview {
                        childrenGrid(overview)
                        TeacherClassPrintView(
                            classId: classId,
                            canPrint: overview.can_print,
                            schoolYear: overview.school_year,
                            request: WritingYearRules.liveRequest(overview.requests, year: overview.school_year)
                        ) { Task { await load() } }
                    } else {
                        TeacherLoading()
                    }
                }
                .padding()
                .contentColumn(maxWidth: ContentWidth.reading)
            }
            .scrollContentBackground(.hidden)
            .refreshable { await load() }
        }
        .navigationTitle(Text(WritingYearCopy.sectionHeading))
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .task { await load() }
        .sheet(item: $openChild, onDismiss: { Task { await load() } }) { child in
            NavigationStack {
                TeacherWritingYearChildView(classId: classId, child: child)
            }
        }
    }

    @ViewBuilder
    private func childrenGrid(_ o: WYOverview) -> some View {
        if o.children.isEmpty {
            TeacherCard { Text(WritingYearCopy.noChildren).foregroundStyle(.white.opacity(0.75)).frame(maxWidth: .infinity) }
        } else {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 200), spacing: 10)], spacing: 10) {
                ForEach(o.children) { c in
                    Button { openChild = c } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 6) {
                                Text(verbatim: c.avatar_emoji ?? "").accessibilityHidden(true)
                                Text(verbatim: c.display_name).font(.headline).lineLimit(1)
                            }
                            .foregroundStyle(.white)
                            Text(WritingYearCopy.piecesCount(c.item_count)).font(.footnote).foregroundStyle(TeacherTheme.secondaryText)
                            if c.pending_count > 0 {
                                Text(WritingYearCopy.waitingCount(c.pending_count)).font(.footnote).foregroundStyle(.yellow)
                            }
                            Text(c.about_me_done ? WritingYearCopy.aboutDone : WritingYearCopy.aboutMissing)
                                .font(.footnote).foregroundStyle(TeacherTheme.secondaryText)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
                        .background(TeacherTheme.cardFill, in: RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(TeacherTheme.cardStroke))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func load() async {
        guard let token = await auth.validAccessToken() else { return }
        do {
            overview = try await APIClient.shared.writingYearOverview(classId: classId, bearerToken: token)
            loadError = nil
        } catch {
            if overview == nil { loadError = WritingYearCopy.error(error) }
        }
    }
}

// MARK: - One child's book

struct TeacherWritingYearChildView: View {
    let classId: String
    let child: WYChildSummary

    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @State private var items: [WYItem]?
    @State private var note = ""
    @State private var coverTitle = ""
    @State private var error: LocalizedStringResource?
    @State private var saving = false
    @State private var savedFlash = false
    @State private var preview: WYBook?
    @State private var pendingRemove: WYItem?
    @State private var pdfURL: URL?
    @State private var downloading = false

    private var approved: [WYItem] { (items ?? []).filter(\.approved).sorted { $0.position < $1.position } }
    private var waiting: [WYItem] { (items ?? []).filter { !$0.approved }.sorted { $0.position < $1.position } }

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let error { Text(error).font(.footnote).foregroundStyle(TeacherTheme.urgent) }
                    if items == nil {
                        TeacherLoading()
                    } else {
                        if !waiting.isEmpty { waitingSection }
                        piecesSection
                        noteSection
                        actions
                        if let preview { WritingYearBookView(book: preview) }
                    }
                }
                .padding()
                .contentColumn(maxWidth: ContentWidth.reading)
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle(Text(WritingYearCopy.childHeading(child.display_name)))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button { dismiss() } label: { Text(TeacherCopy.done) }
            }
        }
        .task { await load() }
        .confirmationDialog(
            Text(WritingYearCopy.removeConfirm),
            isPresented: Binding(get: { pendingRemove != nil }, set: { if !$0 { pendingRemove = nil } }),
            titleVisibility: .visible,
            presenting: pendingRemove
        ) { item in
            Button(role: .destructive) {
                pendingRemove = nil
                Task { await remove(item) }
            } label: { Text(WritingYearCopy.remove) }
            Button(role: .cancel) { pendingRemove = nil } label: { Text(WritingYearCopy.cancel) }
        }
    }

    private func kind(_ i: WYItem) -> LocalizedStringResource {
        i.kind == "book" ? WritingYearCopy.kindBook : WritingYearCopy.kindSubmission
    }

    private var waitingSection: some View {
        TeacherCard {
            VStack(alignment: .leading, spacing: 10) {
                Text(WritingYearCopy.suggested).font(.subheadline.weight(.semibold)).foregroundStyle(.yellow)
                ForEach(waiting) { i in
                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(verbatim: i.title ?? "—").foregroundStyle(.white)
                            Text(kind(i)).font(.caption).foregroundStyle(TeacherTheme.secondaryText)
                        }
                        Spacer()
                        Button { Task { await approve(i) } } label: { Text(WritingYearCopy.approve) }
                            .buttonStyle(.borderedProminent).tint(.purple)
                        Button { Task { await remove(i) } } label: { Text(WritingYearCopy.decline) }
                            .buttonStyle(.bordered).tint(.white)
                    }
                }
            }
        }
    }

    private var piecesSection: some View {
        TeacherCard {
            VStack(alignment: .leading, spacing: 10) {
                if approved.isEmpty {
                    Text(WritingYearCopy.emptyChild).foregroundStyle(.white.opacity(0.75))
                }
                ForEach(Array(approved.enumerated()), id: \.element.id) { idx, i in
                    HStack(spacing: 8) {
                        Text(verbatim: "\(idx + 1)").font(.footnote.monospacedDigit()).foregroundStyle(TeacherTheme.secondaryText)
                            .frame(width: 22)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(verbatim: i.title ?? "—").foregroundStyle(.white)
                            Text(kind(i)).font(.caption).foregroundStyle(TeacherTheme.secondaryText)
                        }
                        Spacer()
                        iconButton("arrow.up", WritingYearCopy.moveUp, disabled: idx == 0) { await move(idx, idx - 1) }
                        iconButton("arrow.down", WritingYearCopy.moveDown, disabled: idx == approved.count - 1) { await move(idx, idx + 1) }
                        iconButton("trash", WritingYearCopy.remove, disabled: false) { pendingRemove = i }
                    }
                }
            }
        }
    }

    private func iconButton(_ symbol: String, _ label: LocalizedStringResource, disabled: Bool,
                            action: @escaping () async -> Void) -> some View {
        Button { Task { await action() } } label: {
            Image(systemName: symbol).font(.body.weight(.semibold)).frame(width: 44, height: 44)
        }
        .buttonStyle(.plain)
        .foregroundStyle(.white.opacity(disabled ? 0.25 : 0.85))
        .disabled(disabled)
        .accessibilityLabel(Text(label))
    }

    private var noteSection: some View {
        TeacherCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(WritingYearCopy.coverTitleLabel).font(.subheadline.weight(.semibold)).foregroundStyle(TeacherTheme.secondaryText)
                TextField(text: $coverTitle) { Text(WritingYearCopy.cardHeading) }
                    .textFieldStyle(.roundedBorder)
                    .onChange(of: coverTitle) { _, v in if v.count > WritingYearRules.coverTitleMax { coverTitle = String(v.prefix(WritingYearRules.coverTitleMax)) } }
                Text(WritingYearCopy.noteLabel).font(.subheadline.weight(.semibold)).foregroundStyle(TeacherTheme.secondaryText)
                TextEditor(text: $note)
                    .frame(minHeight: 110)
                    .scrollContentBackground(.hidden)
                    .padding(6)
                    .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                    .foregroundStyle(.white)
                    .onChange(of: note) { _, v in if v.count > WritingYearRules.noteMax { note = String(v.prefix(WritingYearRules.noteMax)) } }
                Text(verbatim: "\(note.count)/\(WritingYearRules.noteMax)").font(.caption).foregroundStyle(TeacherTheme.secondaryText)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                HStack(spacing: 10) {
                    Button { Task { await saveNote() } } label: {
                        Text(saving ? WritingYearCopy.saving : WritingYearCopy.save).font(.callout.bold())
                            .padding(.horizontal, 18).padding(.vertical, 10)
                            .background(.purple.opacity(0.7), in: Capsule()).foregroundStyle(.white)
                    }
                    .buttonStyle(.plain)
                    .disabled(saving)
                    if savedFlash {
                        Label { Text(WritingYearCopy.saved) } icon: { Image(systemName: "checkmark.circle.fill") }
                            .font(.footnote.weight(.semibold)).foregroundStyle(.green)
                    }
                }
            }
        }
    }

    private var actions: some View {
        HStack(spacing: 10) {
            Button { Task { await togglePreview() } } label: {
                Label { Text(WritingYearCopy.preview) } icon: { Image(systemName: "eye") }
            }
            .buttonStyle(.bordered).tint(.cyan)
            if let pdfURL {
                ShareLink(item: pdfURL) {
                    Label { Text(WritingYearCopy.downloadPdf) } icon: { Image(systemName: "square.and.arrow.up") }
                }
                .buttonStyle(.bordered).tint(.cyan)
            } else {
                Button { Task { await downloadPdf() } } label: {
                    Label { Text(downloading ? WritingYearCopy.downloading : WritingYearCopy.downloadPdf) } icon: { Image(systemName: "doc.richtext") }
                }
                .buttonStyle(.bordered).tint(.cyan)
                .disabled(downloading)
            }
        }
    }

    // MARK: Actions

    private func load() async {
        guard let token = await auth.validAccessToken() else { return }
        do {
            let d = try await APIClient.shared.writingYearChild(classId: classId, studentId: child.student_id, bearerToken: token)
            items = d.items
            note = d.meta.teacher_note ?? ""
            coverTitle = d.meta.cover_title ?? ""
            error = nil
        } catch {
            self.error = WritingYearCopy.error(error)
            if items == nil { items = [] }
        }
    }

    private func move(_ from: Int, _ to: Int) async {
        let next = WritingYearRules.move(approved, from: from, to: to)
        let ids = (next + waiting).map(\.id)
        let previous = items
        items = (next + waiting).enumerated().map { idx, i in
            WYItem(id: i.id, kind: i.kind, title: i.title, position: idx + 1, approved: i.approved,
                   added_by: i.added_by, submission_id: i.submission_id, book_id: i.book_id)
        }
        guard let token = await auth.validAccessToken() else { return }
        do {
            try await APIClient.shared.writingYearReorder(classId: classId, studentId: child.student_id, itemIds: ids, bearerToken: token)
        } catch {
            items = previous
            self.error = WritingYearCopy.error(error)
            await load()
        }
    }

    private func approve(_ i: WYItem) async {
        guard let token = await auth.validAccessToken() else { return }
        do {
            try await APIClient.shared.writingYearApprove(classId: classId, itemId: i.id, bearerToken: token)
            await load()
        } catch { self.error = WritingYearCopy.error(error) }
    }

    private func remove(_ i: WYItem) async {
        guard let token = await auth.validAccessToken() else { return }
        do {
            try await APIClient.shared.writingYearRemove(classId: classId, itemId: i.id, bearerToken: token)
            items?.removeAll { $0.id == i.id }
        } catch { self.error = WritingYearCopy.error(error) }
    }

    private func saveNote() async {
        guard let token = await auth.validAccessToken() else { return }
        saving = true
        savedFlash = false
        defer { saving = false }
        do {
            try await APIClient.shared.writingYearNote(classId: classId, studentId: child.student_id, note: note,
                                                       coverTitle: coverTitle, bearerToken: token)
            savedFlash = true
        } catch { self.error = WritingYearCopy.error(error) }
    }

    private func togglePreview() async {
        if preview != nil { preview = nil; return }
        guard let token = await auth.validAccessToken() else { return }
        do {
            preview = try await APIClient.shared.writingYearPreview(classId: classId, studentId: child.student_id, bearerToken: token)
        } catch { self.error = WritingYearCopy.error(error) }
    }

    private func downloadPdf() async {
        guard let token = await auth.validAccessToken() else { return }
        downloading = true
        defer { downloading = false }
        do {
            let data = try await APIClient.shared.writingYearPdf(classId: classId, studentId: child.student_id, bearerToken: token)
            let safe = child.display_name.filter { $0.isLetter || $0.isNumber || $0 == " " }
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(safe.isEmpty ? "writing-year" : safe).pdf")
            try data.write(to: url, options: .atomic)
            pdfURL = url
        } catch { self.error = WritingYearCopy.error(error) }
    }
}

// MARK: - Print the class books

struct TeacherClassPrintView: View {
    let classId: String
    let canPrint: Bool
    let schoolYear: String
    let request: WYPrintRequest?
    let onChanged: () -> Void

    @Environment(AuthStore.self) private var auth
    @State private var step: Step = .idle
    @State private var address: [String: String] = [:]
    @State private var summary: WYPrintSummary?
    @State private var busy = false
    @State private var error: LocalizedStringResource?
    @State private var confirmCancel = false

    enum Step { case idle, address, summary }

    private var complete: Bool {
        WritingYearRules.addressFields
            .filter { !WritingYearRules.optionalAddressFields.contains($0) }
            .allSatisfy { !(address[$0] ?? "").trimmingCharacters(in: .whitespaces).isEmpty }
    }

    var body: some View {
        TeacherCard {
            VStack(alignment: .leading, spacing: 12) {
                if let request {
                    status(request)
                } else if !canPrint {
                    Text(WritingYearCopy.printHeading).font(.headline).foregroundStyle(.white)
                    Text(WritingYearCopy.printNotAvailable).font(.subheadline).foregroundStyle(TeacherTheme.secondaryText)
                } else {
                    switch step {
                    case .idle: idle
                    case .address: addressForm
                    case .summary: summaryView
                    }
                }
                if let error { Text(error).font(.footnote).foregroundStyle(TeacherTheme.urgent) }
            }
        }
        .confirmationDialog(Text(WritingYearCopy.cancelConfirm), isPresented: $confirmCancel, titleVisibility: .visible) {
            Button(role: .destructive) { Task { await cancelRequest() } } label: { Text(WritingYearCopy.cancelRequest) }
            Button(role: .cancel) {} label: { Text(WritingYearCopy.cancel) }
        }
    }

    private var idle: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(WritingYearCopy.printHeading).font(.headline).foregroundStyle(.white)
            Text(WritingYearCopy.printIntro).font(.subheadline).foregroundStyle(TeacherTheme.secondaryText)
            Button {
                if address["country_code"] == nil { address["country_code"] = AppLanguage.uiLanguage.hasPrefix("it") ? "IT" : "US" }
                step = .address
            } label: {
                Label { Text(WritingYearCopy.printHeading) } icon: { Image(systemName: "printer.fill") }
            }
            .buttonStyle(.borderedProminent).tint(.purple)
        }
    }

    private var addressForm: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(WritingYearCopy.addressHeading).font(.headline).foregroundStyle(.white)
            ForEach(WritingYearRules.addressFields, id: \.self) { f in
                VStack(alignment: .leading, spacing: 4) {
                    Text(WritingYearCopy.field(f)).font(.caption.weight(.semibold)).foregroundStyle(TeacherTheme.secondaryText)
                    TextField(text: Binding(get: { address[f] ?? "" }, set: { address[f] = $0 })) { Text(WritingYearCopy.field(f)) }
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(f == "country_code" || f == "state_code" ? .characters : (f == "contact_email" ? .never : .words))
                        .keyboardType(f == "contact_email" ? .emailAddress : (f == "contact_phone" ? .phonePad : .default))
                        .autocorrectionDisabled(f == "contact_email")
                }
            }
            HStack(spacing: 10) {
                Button { step = .idle; error = nil } label: { Text(WritingYearCopy.cancel) }.buttonStyle(.bordered).tint(.white)
                Button { Task { await loadSummary() } } label: { Text(WritingYearCopy.next) }
                    .buttonStyle(.borderedProminent).tint(.purple)
                    .disabled(!complete || busy)
            }
        }
    }

    @ViewBuilder
    private var summaryView: some View {
        if let summary {
            VStack(alignment: .leading, spacing: 8) {
                Text(WritingYearCopy.summaryHeading).font(.headline).foregroundStyle(.white)
                Text(WritingYearCopy.summaryIncluded(summary.included.count)).foregroundStyle(.white)
                if !summary.excluded.isEmpty {
                    Text(WritingYearCopy.summaryExcluded(summary.excluded.map(\.display_name).joined(separator: ", ")))
                        .font(.subheadline).foregroundStyle(.yellow)
                }
                Text(WritingYearCopy.summaryReview).font(.footnote).foregroundStyle(TeacherTheme.secondaryText)
                HStack(spacing: 10) {
                    Button { step = .address } label: { Text(WritingYearCopy.back) }.buttonStyle(.bordered).tint(.white)
                    Button { Task { await send() } } label: { Text(busy ? WritingYearCopy.sending : WritingYearCopy.printSubmit) }
                        .buttonStyle(.borderedProminent).tint(.purple)
                        .disabled(busy || summary.included.isEmpty)
                }
            }
        }
    }

    private func status(_ r: WYPrintRequest) -> some View {
        let at = WritingYearRules.statusSteps.firstIndex(of: r.status) ?? -1
        return VStack(alignment: .leading, spacing: 10) {
            Text(WritingYearCopy.requestsHeading(WritingYearRules.yearLabel(r.school_year))).font(.headline).foregroundStyle(.white)
            if r.status == "requested" {
                Text(WritingYearCopy.printSent).font(.footnote).foregroundStyle(TeacherTheme.secondaryText)
            }
            if r.status == "failed" {
                Text(WritingYearCopy.failedHint).font(.subheadline).foregroundStyle(.yellow)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(WritingYearRules.statusSteps.enumerated()), id: \.offset) { i, s in
                        HStack(spacing: 8) {
                            Image(systemName: i < at ? "checkmark.circle.fill" : (i == at ? "circle.inset.filled" : "circle"))
                                .foregroundStyle(i <= at ? .cyan : .white.opacity(0.35))
                                .accessibilityHidden(true)
                            Text(WritingYearCopy.status(s)).foregroundStyle(i <= at ? .white : .white.opacity(0.55))
                        }
                        .accessibilityElement(children: .combine)
                        .accessibilityAddTraits(i == at ? [.isSelected] : [])
                    }
                }
            }
            if let n = r.children_count {
                Text(WritingYearCopy.summaryIncluded(n)).font(.footnote).foregroundStyle(TeacherTheme.secondaryText)
            }
            if let s = r.tracking?.url, let url = URL(string: s) {
                Link(destination: url) { Text(WritingYearCopy.track) }.tint(.cyan)
            }
            if r.status == "requested" {
                Button { confirmCancel = true } label: { Text(WritingYearCopy.cancelRequest) }
                    .buttonStyle(.bordered).tint(.white).disabled(busy)
            }
        }
    }

    private func loadSummary() async {
        guard let token = await auth.validAccessToken() else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            summary = try await APIClient.shared.writingYearPrintSummary(classId: classId, bearerToken: token)
            step = .summary
        } catch { self.error = WritingYearCopy.error(error) }
    }

    private func send() async {
        guard let token = await auth.validAccessToken() else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let clean = address.mapValues { $0.trimmingCharacters(in: .whitespaces) }
            try await APIClient.shared.writingYearPrint(classId: classId, address: clean, bearerToken: token)
            step = .idle
            onChanged()
        } catch {
            if (error as? APIClient.TeacherError)?.code == "bad_address" { step = .address }
            self.error = WritingYearCopy.error(error)
        }
    }

    private func cancelRequest() async {
        guard let request, let token = await auth.validAccessToken() else { return }
        busy = true
        defer { busy = false }
        do {
            try await APIClient.shared.writingYearCancelPrint(classId: classId, requestId: request.id, bearerToken: token)
            onChanged()
        } catch { self.error = WritingYearCopy.error(error) }
    }
}

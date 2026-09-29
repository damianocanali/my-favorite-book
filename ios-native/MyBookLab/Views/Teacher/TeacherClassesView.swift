// The teacher's Classes tab: the class list (license badge, never a price),
// each class's assignments (create / edit / publish / close / reopen /
// delete-when-empty, same API and rules as the web's AssignmentsSection),
// and the way into Review.
//
// Roster management — adding students, new picture passwords, printing
// sign-in cards — and anything to do with buying stay on the web (App Store
// 3.1.3): the class screen links to mybooklab.app in an in-app Safari sheet.
import SwiftUI

enum TeacherClassesDest: Hashable {
    case classDetail(String)
    case review(classId: String, assignmentId: String)
}

struct TeacherClassesView: View {
    @Environment(AuthStore.self) private var auth
    @Environment(TeacherStore.self) private var teacher

    @State private var path: [TeacherClassesDest] = []
    @State private var classes: [TeacherClass]?
    @State private var error: String??
    @State private var webPage: TeacherWebPage?

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                CosmicBackground()
                content
            }
            .navigationTitle(Text(TeacherCopy.classesTitle))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { TeacherBellButton() }
            }
            .navigationDestination(for: TeacherClassesDest.self) { dest in
                switch dest {
                case .classDetail(let id):
                    TeacherClassDetailView(classId: id, summary: classes?.first { $0.id == id })
                case .review(let classId, let assignmentId):
                    TeacherReviewView(classId: classId, assignmentId: assignmentId)
                }
            }
            .sheet(item: $webPage) { page in
                SafariView(url: page.url).ignoresSafeArea()
            }
        }
        .task { await load() }
        .onAppear { consumeRoute() }
        .onChange(of: teacher.pendingRoute) { _, _ in consumeRoute() }
    }

    @ViewBuilder
    private var content: some View {
        if let error {
            TeacherErrorBlock(message: TeacherCopy.error(error)) { Task { await load() } }
                .contentColumn()
        } else if let classes {
            ScrollView {
                VStack(spacing: 12) {
                    if classes.isEmpty {
                        Text(TeacherCopy.classesEmpty)
                            .foregroundStyle(.white.opacity(0.75))
                            .multilineTextAlignment(.center)
                            .padding(.top, 32)
                    }
                    ForEach(classes) { c in
                        NavigationLink(value: TeacherClassesDest.classDetail(c.id)) {
                            classRow(c)
                        }
                        .buttonStyle(.plain)
                    }
                    Button {
                        webPage = TeacherWebPage(url: TeacherWeb.url("/teacher/classes"))
                    } label: {
                        Label { Text(TeacherCopy.createOnWeb) } icon: { Image(systemName: "safari") }
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.cyan)
                    }
                    .padding(.top, 8)
                }
                .padding()
                .contentColumn(maxWidth: ContentWidth.reading)
            }
            .scrollContentBackground(.hidden)
            .refreshable { await load() }
        } else {
            TeacherLoading()
        }
    }

    private func classRow(_ c: TeacherClass) -> some View {
        TeacherCard {
            HStack(spacing: 12) {
                Image(systemName: "graduationcap.fill")
                    .font(.title2).foregroundStyle(.yellow).frame(width: 32)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(verbatim: c.name ?? "—").font(.headline).foregroundStyle(.white)
                    HStack(spacing: 8) {
                        Text(TeacherCopy.studentCount(c.student_count ?? 0))
                        if let code = c.code { Text(TeacherCopy.classCode(code)) }
                    }
                    .font(.caption).foregroundStyle(.white.opacity(0.65))
                    LicenseBadge(license: c.license)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.white.opacity(0.5))
            }
        }
    }

    private func load() async {
        guard let token = auth.accessToken else { return }
        do {
            classes = try await APIClient.shared.teacherClasses(bearerToken: token)
            error = nil
        } catch {
            if classes == nil { self.error = .some((error as? APIClient.TeacherError)?.code) }
        }
    }

    private func consumeRoute() {
        switch teacher.pendingRoute {
        case .classDetail(let classId):
            teacher.pendingRoute = nil
            path = [.classDetail(classId)]
        case .review(let classId, let assignmentId):
            teacher.pendingRoute = nil
            path = [.classDetail(classId), .review(classId: classId, assignmentId: assignmentId)]
        default:
            break
        }
    }
}

// MARK: - One class

struct TeacherClassDetailView: View {
    let classId: String
    let summary: TeacherClass?

    @Environment(AuthStore.self) private var auth

    @State private var assignments: [TeacherAssignment]?
    @State private var loadError: String??
    @State private var banner: String??
    @State private var busyId: String?
    @State private var formTarget: FormTarget?
    @State private var pendingDelete: TeacherAssignment?
    @State private var webPage: TeacherWebPage?

    enum FormTarget: Identifiable {
        case new
        case edit(TeacherAssignment)
        var id: String {
            switch self {
            case .new: "new"
            case .edit(let a): a.id
            }
        }
    }

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    rosterLink
                    assignmentsSection
                }
                .padding()
                .contentColumn(maxWidth: ContentWidth.reading)
            }
            .scrollContentBackground(.hidden)
            .refreshable { await load() }
        }
        .navigationTitle(Text(verbatim: summary?.name ?? ""))
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { formTarget = .new } label: {
                    Label { Text(TeacherCopy.newAssignment) } icon: { Image(systemName: "plus") }
                }
            }
        }
        .task { await load() }
        .sheet(item: $formTarget) { target in
            TeacherAssignmentForm(classId: classId, existing: {
                if case .edit(let a) = target { return a }
                return nil
            }()) { saved, wasNew in
                formTarget = nil
                // A new assignment's POST response has no counts; reload for
                // the real "x of N" instead of guessing.
                if wasNew { Task { await load() } } else { upsert(saved) }
            }
        }
        .sheet(item: $webPage) { page in
            SafariView(url: page.url).ignoresSafeArea()
        }
        .confirmationDialog(
            Text(TeacherCopy.deleteConfirm(pendingDelete?.title ?? "")),
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible,
            presenting: pendingDelete
        ) { a in
            Button(role: .destructive) {
                pendingDelete = nil
                Task { await delete(a) }
            } label: { Text(TeacherCopy.delete) }
            Button(role: .cancel) { pendingDelete = nil } label: { Text(TeacherCopy.cancel) }
        }
    }

    @ViewBuilder
    private var header: some View {
        if let summary {
            HStack(spacing: 10) {
                Text(TeacherCopy.studentCount(summary.student_count ?? 0))
                if let code = summary.code { Text(TeacherCopy.classCode(code)) }
                Spacer()
                LicenseBadge(license: summary.license)
            }
            .font(.subheadline)
            .foregroundStyle(.white.opacity(0.75))
        }
    }

    private var rosterLink: some View {
        Button {
            webPage = TeacherWebPage(url: TeacherWeb.url("/teacher/class/\(classId)"))
        } label: {
            TeacherCard(tint: .purple) {
                HStack(spacing: 12) {
                    Image(systemName: "person.3.fill").foregroundStyle(.yellow).frame(width: 32)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(TeacherCopy.manageRoster).font(.headline).foregroundStyle(.white)
                        Text(TeacherCopy.manageRosterHint).font(.caption).foregroundStyle(.white.opacity(0.65))
                    }
                    Spacer()
                    Image(systemName: "arrow.up.right.square").foregroundStyle(.white.opacity(0.6))
                }
            }
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var assignmentsSection: some View {
        TeacherSectionHeading(text: TeacherCopy.assignmentsHeading)
        if let banner {
            Text(TeacherCopy.error(banner)).font(.footnote).foregroundStyle(.red)
        }
        if let loadError {
            TeacherCard { TeacherErrorBlock(message: TeacherCopy.error(loadError)) { Task { await load() } } }
        } else if let assignments {
            if assignments.isEmpty {
                TeacherCard {
                    Text(TeacherCopy.assignmentsEmpty)
                        .foregroundStyle(.white.opacity(0.7))
                        .frame(maxWidth: .infinity)
                }
            }
            ForEach(assignments) { a in assignmentRow(a) }
        } else {
            TeacherLoading()
        }
    }

    private func assignmentRow(_ a: TeacherAssignment) -> some View {
        let busy = busyId == a.id
        return TeacherCard {
            VStack(alignment: .leading, spacing: 10) {
                NavigationLink(value: TeacherClassesDest.review(classId: classId, assignmentId: a.id)) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 8) {
                                Text(verbatim: a.title).font(.headline).foregroundStyle(.white)
                                AssignmentStatusChip(status: a.status)
                            }
                            HStack(spacing: 6) {
                                if let due = TeacherDates.dueString(a.due_at) {
                                    Text(TeacherCopy.due(due))
                                } else {
                                    Text(TeacherCopy.noDueDate)
                                }
                                Text(verbatim: "·")
                                Text(TeacherCopy.handedInCount(a.counts?.handed_in ?? 0, a.counts?.total_students ?? 0))
                            }
                            .font(.caption).foregroundStyle(.white.opacity(0.65))
                        }
                        Spacer()
                        Text(TeacherCopy.review).font(.caption.bold()).foregroundStyle(.cyan)
                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(.white.opacity(0.5))
                    }
                }
                .buttonStyle(.plain)

                HStack(spacing: 8) {
                    ForEach(a.nextStatuses, id: \.self) { status in
                        actionButton(
                            status == "published" && a.status == "closed" ? TeacherCopy.reopen
                                : status == "published" ? TeacherCopy.publish : TeacherCopy.closeAction,
                            disabled: busy
                        ) { Task { await setStatus(a, status) } }
                    }
                    actionButton(TeacherCopy.edit, systemImage: "pencil", disabled: busy) { formTarget = .edit(a) }
                    if a.canDelete {
                        actionButton(TeacherCopy.delete, systemImage: "trash", destructive: true, disabled: busy) {
                            pendingDelete = a
                        }
                    }
                    if busy { ProgressView().tint(.white) }
                }
            }
        }
    }

    private func actionButton(_ title: LocalizedStringResource, systemImage: String? = nil,
                              destructive: Bool = false, disabled: Bool,
                              action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let systemImage { Image(systemName: systemImage) }
                Text(title)
            }
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10).padding(.vertical, 6)
            .overlay(Capsule().strokeBorder(.white.opacity(destructive ? 0 : 0.3)))
            .foregroundStyle(destructive ? Color(red: 1, green: 0.5, blue: 0.5) : .white)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? 0.6 : 1)
    }

    // MARK: Actions

    private func load() async {
        guard let token = auth.accessToken else { return }
        do {
            assignments = try await APIClient.shared.teacherAssignments(classId: classId, bearerToken: token)
            loadError = nil
        } catch {
            if assignments == nil { loadError = .some((error as? APIClient.TeacherError)?.code) }
        }
    }

    private func upsert(_ updated: TeacherAssignment) {
        var list = assignments ?? []
        if let i = list.firstIndex(where: { $0.id == updated.id }) {
            // A PATCH response has no counts; keep the row's real ones.
            var merged = updated
            merged.counts = updated.counts ?? list[i].counts
            list[i] = merged
        } else {
            list.insert(updated, at: 0)
        }
        assignments = list
    }

    private func setStatus(_ a: TeacherAssignment, _ status: String) async {
        guard let token = auth.accessToken else { return }
        busyId = a.id
        banner = nil
        defer { busyId = nil }
        do {
            let saved = try await APIClient.shared.teacherSaveAssignment(
                .init(classId: classId, id: a.id, status: status), bearerToken: token)
            upsert(saved)
        } catch {
            banner = .some((error as? APIClient.TeacherError)?.code)
        }
    }

    private func delete(_ a: TeacherAssignment) async {
        guard let token = auth.accessToken else { return }
        busyId = a.id
        banner = nil
        defer { busyId = nil }
        do {
            try await APIClient.shared.teacherDeleteAssignment(classId: classId, id: a.id, bearerToken: token)
            assignments?.removeAll { $0.id == a.id }
        } catch {
            banner = .some((error as? APIClient.TeacherError)?.code)
        }
    }
}

// MARK: - New / edit assignment

struct TeacherAssignmentForm: View {
    let classId: String
    let existing: TeacherAssignment?
    let onSaved: (TeacherAssignment, _ wasNew: Bool) -> Void

    @Environment(AuthStore.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var prompt = ""
    @State private var hasDue = false
    @State private var due = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
    @State private var allowLate = true
    @State private var saving = false
    @State private var error: LocalizedStringResource?
    @State private var didInit = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(text: $title) { Text(TeacherCopy.formTitle) }
                        .onChange(of: title) { _, v in if v.count > TeacherStickers.titleMax { title = String(v.prefix(TeacherStickers.titleMax)) } }
                } header: { Text(TeacherCopy.formTitle) }

                Section {
                    TextField(text: $prompt, axis: .vertical) { Text(TeacherCopy.formPrompt) }
                        .lineLimit(4...10)
                        .onChange(of: prompt) { _, v in if v.count > TeacherStickers.promptMax { prompt = String(v.prefix(TeacherStickers.promptMax)) } }
                } header: {
                    Text(TeacherCopy.formPrompt)
                } footer: {
                    Text(verbatim: "\(prompt.count)/\(TeacherStickers.promptMax)")
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }

                Section {
                    Toggle(isOn: $hasDue) { Text(TeacherCopy.formHasDue) }
                    if hasDue {
                        DatePicker(selection: $due) { Text(TeacherCopy.formDue) }
                    }
                    Toggle(isOn: $allowLate) { Text(TeacherCopy.formAllowLate) }
                }

                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }

                Section {
                    if existing != nil {
                        Button { Task { await save(status: nil) } } label: {
                            Text(saving ? TeacherCopy.formSaving : TeacherCopy.formSave).bold()
                        }
                    } else {
                        Button { Task { await save(status: "draft") } } label: {
                            Text(saving ? TeacherCopy.formSaving : TeacherCopy.formSaveDraft)
                        }
                        Button { Task { await save(status: "published") } } label: {
                            Text(TeacherCopy.formPublishNow).bold()
                        }
                    }
                }
                .disabled(saving)
            }
            .navigationTitle(Text(existing == nil ? TeacherCopy.formNew : TeacherCopy.formEdit))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text(TeacherCopy.cancel) }
                }
            }
            .onAppear {
                guard !didInit else { return }
                didInit = true
                if let existing {
                    title = existing.title
                    prompt = existing.prompt ?? ""
                    if let d = TeacherDates.parse(existing.due_at) { hasDue = true; due = d }
                    allowLate = existing.allow_late ?? true
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    /// Editing only ever changes title/prompt/due/late; status moves are the
    /// one-tap row actions, so this never re-implements the transition rules.
    private func save(status: String?) async {
        let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let p = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { error = TeacherCopy.titleRequired; return }
        guard !p.isEmpty else { error = TeacherCopy.promptRequired; return }
        guard let token = auth.accessToken else { return }
        saving = true
        error = nil
        defer { saving = false }
        let dueIso: String? = hasDue ? TeacherDates.iso(due) : nil
        var body = APIClient.AssignmentWrite(classId: classId)
        body.id = existing?.id
        body.title = t
        body.prompt = p
        body.dueAt = .some(dueIso)
        body.allowLate = allowLate
        if existing == nil { body.status = status }
        do {
            let saved = try await APIClient.shared.teacherSaveAssignment(body, bearerToken: token)
            onSaved(saved, existing == nil)
        } catch {
            self.error = TeacherCopy.error(error)
        }
    }
}

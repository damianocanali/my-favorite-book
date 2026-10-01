// "My Writing Year" on a class account's home (spec 2026-10-01 §3): the
// pieces chosen so far (the teacher's order, read-only), suggestions waiting
// for the teacher, "Suggest this for my Writing Year" on their own books and
// hand-ins, the "About me" page, and their book to look at and listen to.
// Web: MyWritingYear.jsx. API: api/school/writing-year.js (student route).
import SwiftUI

struct MyWritingYearCard: View {
    @Environment(AuthStore.self) private var auth
    @State private var data: WYStudentView?
    @State private var about = WYStudentView.About(about_favorite: "", about_best_sentence: "", about_learned: "")
    @State private var error: LocalizedStringResource?
    @State private var busy = false
    @State private var savedFlash = false
    @State private var book: WYBook?

    private var approved: [WYItem] { (data?.items ?? []).filter(\.approved).sorted { $0.position < $1.position } }
    private var waiting: [WYItem] { (data?.items ?? []).filter { !$0.approved } }

    var body: some View {
        VStack(spacing: 0) {
            if auth.isStudent, let data {
                VStack(alignment: .leading, spacing: 14) {
                    Label { Text(WritingYearCopy.cardHeading) } icon: { Image(systemName: "book.closed.fill").foregroundStyle(.cyan) }
                        .font(.system(.title2, design: .rounded).bold())
                        .foregroundStyle(.white)
                        .accessibilityAddTraits(.isHeader)
                    Text(WritingYearCopy.cardSub).font(.subheadline).foregroundStyle(.white.opacity(0.8))
                    if let error { Text(error).font(.footnote).foregroundStyle(.red) }

                    chosenSection
                    if !waiting.isEmpty { waitingSection }
                    suggestSection(data)
                    aboutSection
                    if let book { WritingYearBookView(book: book) }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 20))
                .padding(.bottom, 12)
            }
        }
        .task { await load() }
    }

    private var chosenSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(WritingYearCopy.chosen).font(.headline).foregroundStyle(.white)
            if approved.isEmpty {
                Text(WritingYearCopy.nothingYet).foregroundStyle(.white.opacity(0.8))
            } else {
                ForEach(Array(approved.enumerated()), id: \.element.id) { idx, i in
                    Text(verbatim: "\(idx + 1). \(i.title ?? "—")").foregroundStyle(.white)
                }
                Button { Task { await toggleBook() } } label: {
                    Label { Text(WritingYearCopy.viewBook) } icon: { Image(systemName: "book") }
                }
                .buttonStyle(.bordered).tint(.cyan)
            }
        }
    }

    private var waitingSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(WritingYearCopy.waiting).font(.headline).foregroundStyle(.yellow)
            ForEach(waiting) { i in
                HStack {
                    Text(verbatim: i.title ?? "—").foregroundStyle(.white)
                    Spacer()
                    Button { Task { await withdraw(i) } } label: { Text(WritingYearCopy.takeBack) }
                        .buttonStyle(.bordered).tint(.white).disabled(busy)
                }
            }
        }
    }

    private func suggestSection(_ data: WYStudentView) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(WritingYearCopy.suggestHeading).font(.headline).foregroundStyle(.white)
            if data.suggestable.isEmpty {
                Text(WritingYearCopy.nothingToSuggest).foregroundStyle(.white.opacity(0.8))
            }
            ForEach(data.suggestable.prefix(12)) { s in
                ViewThatFits(in: .horizontal) {
                    HStack {
                        Text(verbatim: s.title ?? "—").foregroundStyle(.white).lineLimit(1)
                        Spacer()
                        suggestButton(s)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text(verbatim: s.title ?? "—").foregroundStyle(.white)
                        suggestButton(s)
                    }
                }
            }
        }
    }

    private func suggestButton(_ s: WYStudentView.Suggestable) -> some View {
        Button { Task { await suggest(s) } } label: {
            Label { Text(WritingYearCopy.suggest) } icon: { Image(systemName: "paperplane.fill") }
                .font(.subheadline.weight(.semibold))
        }
        .buttonStyle(.borderedProminent).tint(.purple)
        .disabled(busy)
    }

    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(WritingYearCopy.aboutHeading).font(.headline).foregroundStyle(.white)
            aboutField("about_favorite", $about.about_favorite)
            aboutField("about_best_sentence", $about.about_best_sentence)
            aboutField("about_learned", $about.about_learned)
            HStack(spacing: 10) {
                Button { Task { await saveAbout() } } label: { Text(WritingYearCopy.studentSave) }
                    .buttonStyle(.borderedProminent).tint(.purple).disabled(busy)
                if savedFlash {
                    Label { Text(WritingYearCopy.studentSaved) } icon: { Image(systemName: "checkmark.circle.fill") }
                        .font(.footnote.weight(.semibold)).foregroundStyle(.green)
                }
            }
        }
    }

    private func aboutField(_ field: String, _ text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(WritingYearCopy.aboutPrompt(field)).font(.subheadline).foregroundStyle(.white.opacity(0.9))
            TextField(text: text, axis: .vertical) { Text(WritingYearCopy.aboutPrompt(field)) }
                .lineLimit(2...4)
                .textFieldStyle(.roundedBorder)
                .onChange(of: text.wrappedValue) { _, v in
                    if v.count > WritingYearRules.aboutMax { text.wrappedValue = String(v.prefix(WritingYearRules.aboutMax)) }
                    savedFlash = false
                }
        }
    }

    // MARK: Calls (class accounts only)

    private func token() async -> String? {
        auth.isStudent ? await auth.validAccessToken() : nil
    }

    private func load() async {
        guard let token = await token() else { return }
        do {
            let d = try await APIClient.shared.myWritingYear(bearerToken: token)
            if data == nil { about = d.about }
            data = d
            error = nil
        } catch {
            // Quiet like the assignments list: a failed read never blocks the shelf.
            if data != nil { self.error = WritingYearCopy.error(error) }
        }
    }

    private func run(_ work: (String) async throws -> Void) async {
        guard let token = await token() else { return }
        busy = true
        error = nil
        defer { busy = false }
        do { try await work(token) } catch { self.error = WritingYearCopy.error(error) }
    }

    private func suggest(_ s: WYStudentView.Suggestable) async {
        await run { token in
            try await APIClient.shared.suggestForWritingYear(submissionId: s.submission_id, bookId: s.book_id, bearerToken: token)
        }
        await load()
    }

    private func withdraw(_ i: WYItem) async {
        await run { token in try await APIClient.shared.withdrawWritingYearSuggestion(itemId: i.id, bearerToken: token) }
        await load()
    }

    private func saveAbout() async {
        await run { token in
            about = try await APIClient.shared.saveAboutMe(about, bearerToken: token)
            savedFlash = true
        }
    }

    private func toggleBook() async {
        if book != nil { book = nil; return }
        await run { token in book = try await APIClient.shared.myWritingYearBook(bearerToken: token) }
    }
}

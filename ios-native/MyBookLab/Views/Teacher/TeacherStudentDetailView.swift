// One student, from the dashboard roster: their books (a list, then the
// app's own book reader, read-only) and the last 30 days of check-ins as a
// plain dated list — no totals, no ranking. Counterpart of the web's
// StudentDetailDrawer + BooksPanelContent + CheckInsPanelContent.
//
// Read-only end to end: api/school/student-books and student-checkins are
// GET-only and scope every query to a student of the teacher's own class.
import SwiftUI

struct TeacherStudentDetailView: View {
    let classId: String
    let student: TeacherDashboardStudent

    @Environment(AuthStore.self) private var auth

    enum Tab: Hashable { case books, checkins }
    @State private var tab: Tab = .books

    @State private var books: [TeacherStudentBook]?
    @State private var booksError: String??
    @State private var checkins: [TeacherCheckin]?
    @State private var checkinsError: String??

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(spacing: 16) {
                    HStack(spacing: 12) {
                        TeacherStudentAvatar(emoji: student.avatar_emoji, url: student.avatar_url, size: 56)
                        Text(verbatim: student.display_name)
                            .font(.system(.title2, design: .rounded).bold())
                            .foregroundStyle(.white)
                        Spacer()
                    }
                    Picker(selection: $tab) {
                        Text(TeacherCopy.tabBooks).tag(Tab.books)
                        Text(TeacherCopy.tabCheckins).tag(Tab.checkins)
                    } label: {
                        Text(TeacherCopy.studentDetails(student.display_name))
                    }
                    .pickerStyle(.segmented)

                    // Both stay loaded, so switching back never re-fetches.
                    switch tab {
                    case .books: booksPanel
                    case .checkins: checkinsPanel
                    }
                }
                .padding()
                .contentColumn(maxWidth: ContentWidth.reading)
            }
            .scrollContentBackground(.hidden)
            .refreshable { await loadBooks(); await loadCheckins() }
        }
        .navigationTitle(Text(TeacherCopy.studentDetails(student.display_name)))
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .task {
            async let b: Void = loadBooks()
            async let c: Void = loadCheckins()
            _ = await (b, c)
        }
    }

    @ViewBuilder
    private var booksPanel: some View {
        if let booksError {
            TeacherErrorBlock(message: TeacherCopy.error(booksError)) { Task { await loadBooks() } }
        } else if let books {
            if books.isEmpty {
                Text(TeacherCopy.booksEmpty).foregroundStyle(.white.opacity(0.7)).padding(.vertical, 24)
            } else {
                VStack(spacing: 10) {
                    ForEach(books) { book in
                        NavigationLink {
                            TeacherStudentBookView(classId: classId, studentId: student.id, summary: book)
                        } label: {
                            bookRow(book)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        } else {
            TeacherLoading()
        }
    }

    private func bookRow(_ b: TeacherStudentBook) -> some View {
        TeacherCard {
            HStack(spacing: 12) {
                Group {
                    if let cover = b.cover, let url = URL(string: cover) {
                        AsyncImage(url: url) { phase in
                            if let img = phase.image { img.resizable().scaledToFill() } else { Color.cyan.opacity(0.15) }
                        }
                    } else {
                        ZStack {
                            Color.cyan.opacity(0.15)
                            Image(systemName: "book.closed.fill").foregroundStyle(.cyan)
                        }
                    }
                }
                .frame(width: 44, height: 60)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: b.title ?? "—").font(.headline).foregroundStyle(.white).lineLimit(2)
                    if let when = TeacherDates.relative(b.updated_at) {
                        Text(TeacherCopy.updated(when)).font(.caption).foregroundStyle(.white.opacity(0.65))
                    }
                }
                Spacer()
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.white.opacity(0.5))
            }
        }
    }

    @ViewBuilder
    private var checkinsPanel: some View {
        if let checkinsError {
            TeacherErrorBlock(message: TeacherCopy.error(checkinsError)) { Task { await loadCheckins() } }
        } else if let checkins {
            if checkins.isEmpty {
                Text(TeacherCopy.checkinsEmpty).foregroundStyle(.white.opacity(0.7)).padding(.vertical, 24)
            } else {
                VStack(spacing: 8) {
                    ForEach(Array(checkins.enumerated()), id: \.offset) { _, c in
                        TeacherCard {
                            HStack(spacing: 12) {
                                TeacherFeelingIcon(id: c.feeling, size: 28)
                                if let need = c.need { TeacherFeelingIcon(id: need, size: 20) }
                                Text(verbatim: c.spokenLabel)
                                    .font(.subheadline)
                                    .foregroundStyle(.white)
                                Spacer()
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
            }
        } else {
            TeacherLoading()
        }
    }

    private func loadBooks() async {
        guard let token = auth.accessToken else { return }
        do {
            books = try await APIClient.shared.teacherStudentBooks(classId: classId, studentId: student.id, bearerToken: token)
            booksError = nil
        } catch {
            booksError = .some((error as? APIClient.TeacherError)?.code)
        }
    }

    private func loadCheckins() async {
        guard let token = auth.accessToken else { return }
        do {
            checkins = try await APIClient.shared.teacherStudentCheckins(classId: classId, studentId: student.id, bearerToken: token)
            checkinsError = nil
        } catch {
            checkinsError = .some((error as? APIClient.TeacherError)?.code)
        }
    }
}

/// Fetches one of a student's books, then shows it in the app's own reader
/// with editing and printing switched off.
struct TeacherStudentBookView: View {
    let classId: String
    let studentId: String
    let summary: TeacherStudentBook

    @Environment(AuthStore.self) private var auth
    @State private var book: Book?
    @State private var error: String??

    var body: some View {
        Group {
            if let book {
                BookDetailView(book: book, readOnly: true)
            } else {
                ZStack {
                    CosmicBackground()
                    if let error {
                        TeacherErrorBlock(message: TeacherCopy.error(error)) { Task { await load() } }
                            .contentColumn()
                    } else {
                        TeacherLoading()
                    }
                }
                .navigationTitle(Text(verbatim: summary.title ?? ""))
                .navigationBarTitleDisplayMode(.inline)
            }
        }
        .task { if book == nil { await load() } }
    }

    private func load() async {
        guard let token = auth.accessToken else { return }
        error = nil
        do {
            if let b = try await APIClient.shared.teacherStudentBook(
                classId: classId, studentId: studentId, bookId: summary.book_id, bearerToken: token
            ) {
                book = b
            } else {
                error = .some("book_not_found")
            }
        } catch {
            self.error = .some((error as? APIClient.TeacherError)?.code)
        }
    }
}

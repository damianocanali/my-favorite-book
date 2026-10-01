// Review one assignment: every student's hand-in status and level, then —
// for a handed-in book — the book itself (the app's reader, read-only), the
// grade (level, tips, send back to revise; TeacherGradeViews.swift), the
// feedback already sent (Seen / Not seen yet), and new feedback: sticker
// toggles plus a comment of at most 500 characters. Prev/Next walks the
// handed-in books only. Counterpart of the web's AssignmentReview.jsx.
import SwiftUI

struct TeacherReviewView: View {
    let classId: String
    let assignmentId: String

    @Environment(AuthStore.self) private var auth

    @State private var title: String?
    @State private var assignment: TeacherReviewList.Assignment?
    @State private var rows: [TeacherSubmissionRow]?
    @State private var listError: String??
    /// Index into `handedIn`, nil on the list.
    @State private var openIndex: Int?
    @State private var detail: TeacherSubmissionDetail?
    @State private var detailError: String??

    private var handedIn: [TeacherSubmissionRow] { (rows ?? []).filter(\.isHandedIn) }
    private var current: TeacherSubmissionRow? {
        guard let openIndex, handedIn.indices.contains(openIndex) else { return nil }
        return handedIn[openIndex]
    }

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Color.clear.frame(height: 0).id("top")
                        if current != nil { detailPane } else { listPane }
                    }
                    .padding()
                    .contentColumn(maxWidth: ContentWidth.reading)
                }
                .scrollContentBackground(.hidden)
                // Each student starts at the top, never scrolled past the header.
                .onChange(of: openIndex) { _, _ in proxy.scrollTo("top", anchor: .top) }
                .refreshable { await loadList() }
            }
        }
        .navigationTitle(navTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            if let openIndex {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { open(openIndex - 1) } label: { Image(systemName: "chevron.left") }
                        .disabled(openIndex == 0)
                        .accessibilityLabel(Text(TeacherCopy.previous))
                    Button { open(openIndex + 1) } label: { Image(systemName: "chevron.right") }
                        .disabled(openIndex >= handedIn.count - 1)
                        .accessibilityLabel(Text(TeacherCopy.next))
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button { backToList() } label: {
                        Label { Text(TeacherCopy.reviewHeading(title ?? "")) } icon: { Image(systemName: "list.bullet") }
                            .labelStyle(.iconOnly)
                    }
                }
            }
        }
        .navigationBarBackButtonHidden(openIndex != nil)
        .task { await loadList() }
    }

    private var navTitle: Text {
        if let current { return Text(verbatim: current.display_name ?? "") }
        return Text(TeacherCopy.reviewHeading(title ?? ""))
    }

    // MARK: List

    @ViewBuilder
    private var listPane: some View {
        if let listError {
            TeacherErrorBlock(message: TeacherCopy.error(listError)) { Task { await loadList() } }
        } else if let rows {
            if rows.isEmpty {
                Text(TeacherCopy.reviewEmpty).foregroundStyle(.white.opacity(0.7))
                    .frame(maxWidth: .infinity).padding(.vertical, 24)
            }
            ForEach(rows) { row in
                if row.isHandedIn {
                    Button { openRow(row) } label: { studentRow(row) }
                        .buttonStyle(.plain)
                } else {
                    studentRow(row).opacity(0.7)
                }
            }
        } else {
            TeacherLoading()
        }
    }

    private func studentRow(_ row: TeacherSubmissionRow) -> some View {
        TeacherCard {
            HStack(spacing: 12) {
                TeacherStudentAvatar(emoji: row.avatar_emoji, size: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: row.display_name ?? String(appLocalized: TeacherCopy.unknownStudent))
                        .font(.headline).foregroundStyle(.white).lineLimit(1)
                    if let when = TeacherDates.relative(row.submitted_at) {
                        HStack(spacing: 4) {
                            Text(TeacherCopy.handedInAt(when))
                            if let v = row.version, v > 1 {
                                Text(verbatim: "·")
                                Text(TeacherCopy.version(v))
                            }
                        }
                        .font(.caption).foregroundStyle(.white.opacity(0.65))
                    }
                }
                Spacer(minLength: 6)
                if let n = row.feedback_count, n > 0 {
                    Text(TeacherCopy.feedbackCount(n)).font(.caption).foregroundStyle(.white.opacity(0.65))
                }
                // Grading at a glance: the newest level, "Sent back" while
                // waiting on the child (only while the assignment is still
                // open for hand-ins), "New version" once they handed in again.
                if row.returned == true {
                    if assignment?.isOpen() == true { TeacherChip(text: GradingCopy.sentBack, tone: .warn) }
                } else if row.hasUngradedVersion {
                    TeacherChip(text: GradingCopy.newVersion, tone: .good)
                }
                if let level = row.level { GradeLevelChip(level: level) }
                HandInChip(state: HandInState(row: row))
                if row.isHandedIn {
                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(.white.opacity(0.5))
                }
            }
        }
    }

    // MARK: One hand-in

    @ViewBuilder
    private var detailPane: some View {
        if let detailError {
            TeacherErrorBlock(message: TeacherCopy.error(detailError)) {
                if let current { Task { await loadDetail(current) } }
            }
        } else if let detail {
            if let book = detail.submission.book_snapshot {
                NavigationLink {
                    BookDetailView(book: book, readOnly: true)
                } label: {
                    TeacherCard(tint: .purple) {
                        HStack(spacing: 12) {
                            Image(systemName: "book.fill").font(.title2).foregroundStyle(.yellow)
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(verbatim: detail.submission.book_title ?? book.title)
                                    .font(.headline).foregroundStyle(.white)
                                Text(TeacherCopy.openBook).font(.caption).foregroundStyle(.cyan)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.white.opacity(0.5))
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            TeacherGradePanel(
                classId: classId,
                submissionId: detail.submission.id,
                version: detail.submission.version ?? 1,
                grades: detail.grades ?? []
            ) { saved in gradeSaved(saved, submissionId: detail.submission.id) }
            // Same reason as the feedback panel below: nothing carries over.
            .id("grade-\(detail.submission.id)-\(detail.submission.version ?? 1)")
            TeacherFeedbackPanel(
                classId: classId,
                submissionId: detail.submission.id,
                feedback: detail.feedback
            ) { sent in
                self.detail?.feedback.append(sent)
                if let i = rows?.firstIndex(where: { $0.submissionId == detail.submission.id }) {
                    rows?[i].feedback_count = (rows?[i].feedback_count ?? 0) + 1
                }
            }
            // A new identity per hand-in: one student's half-written comment
            // must never carry over to the next (web: key={submission.id}).
            .id(detail.submission.id)
        } else {
            TeacherLoading()
        }
    }

    /// A saved grade replaces that version's in the history, and the list
    /// row shows it at once (no reload).
    private func gradeSaved(_ g: SubmissionGrade, submissionId: String) {
        var grades = detail?.grades ?? []
        grades.removeAll { $0.version == g.version }
        grades.append(g)
        detail?.grades = grades.sorted { $0.version > $1.version }
        if let i = rows?.firstIndex(where: { $0.submissionId == submissionId }) {
            rows?[i].level = g.level
            rows?[i].graded_version = g.version
            rows?[i].returned = g.returned == true
        }
    }

    // MARK: Loading and navigation

    private func loadList() async {
        guard let token = await auth.validAccessToken() else { return }
        do {
            let res = try await APIClient.shared.teacherReviewList(
                classId: classId, assignmentId: assignmentId, bearerToken: token)
            title = res.assignment.title
            assignment = res.assignment
            rows = res.submissions ?? []
            listError = nil
        } catch {
            if rows == nil { listError = .some((error as? APIClient.TeacherError)?.code) }
        }
    }

    private func openRow(_ row: TeacherSubmissionRow) {
        if let i = handedIn.firstIndex(where: { $0.id == row.id }) { open(i) }
    }

    private func open(_ index: Int) {
        guard handedIn.indices.contains(index) else { return }
        openIndex = index
        detail = nil
        detailError = nil
        let row = handedIn[index]
        Task { await loadDetail(row) }
    }

    private func backToList() {
        openIndex = nil
        detail = nil
        detailError = nil
    }

    private func loadDetail(_ row: TeacherSubmissionRow) async {
        guard let token = await auth.validAccessToken(), let id = row.submissionId else { return }
        detailError = nil
        do {
            let res = try await APIClient.shared.teacherSubmission(classId: classId, id: id, bearerToken: token)
            // A late answer for a student the teacher already moved past is dropped.
            guard current?.submissionId == id else { return }
            detail = res
        } catch {
            guard current?.submissionId == id else { return }
            detailError = .some((error as? APIClient.TeacherError)?.code)
        }
    }
}

/// Sticker toggles (tap the chosen one again for "no sticker"), a comment,
/// Send, and the thread already sent.
struct TeacherFeedbackPanel: View {
    let classId: String
    let submissionId: String
    let feedback: [TeacherFeedback]
    let onSent: (TeacherFeedback) -> Void

    @Environment(AuthStore.self) private var auth
    @State private var sticker: String?
    @State private var comment = ""
    @State private var sending = false
    @State private var error: LocalizedStringResource?

    var body: some View {
        TeacherCard {
            VStack(alignment: .leading, spacing: 12) {
                Text(TeacherCopy.feedbackHeading).font(.headline).foregroundStyle(.white)

                // Full-size stickers where they fit; smaller on a 375 pt phone.
                ViewThatFits(in: .horizontal) {
                    stickerRow(size: 46, spacing: 8)
                    stickerRow(size: 38, spacing: 6)
                    stickerRow(size: 34, spacing: 4)
                }

                TextField(text: $comment, axis: .vertical) { Text(TeacherCopy.feedbackPlaceholder) }
                    .lineLimit(2...6)
                    .padding(10)
                    .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.white)
                    .onChange(of: comment) { _, v in
                        let cut = TeacherStickers.truncated(v, max: TeacherStickers.commentMax)
                        if cut != v { comment = cut }
                    }
                Text(verbatim: "\(comment.utf16.count)/\(TeacherStickers.commentMax)")
                    .font(.caption2).foregroundStyle(.white.opacity(0.5))
                    .frame(maxWidth: .infinity, alignment: .trailing)

                if let error { Text(error).font(.footnote).foregroundStyle(.red) }

                Button { Task { await send() } } label: {
                    Text(sending ? TeacherCopy.feedbackSending : TeacherCopy.feedbackSend)
                        .font(.callout.bold())
                        .padding(.horizontal, 18).padding(.vertical, 9)
                        .background(.purple.opacity(0.7), in: Capsule())
                        .foregroundStyle(.white)
                }
                .buttonStyle(.plain)
                .disabled(sending)

                if !feedback.isEmpty {
                    Divider().overlay(.white.opacity(0.2))
                    ForEach(feedback) { f in
                        HStack(alignment: .top, spacing: 8) {
                            if let s = f.sticker {
                                Text(verbatim: TeacherStickers.emoji(s)).font(.title3)
                                    .accessibilityLabel(Text(AssignmentCopy.sticker(s) ?? AssignmentCopy.stickerFallback))
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                if let c = f.comment { Text(verbatim: c).foregroundStyle(.white) }
                                HStack(spacing: 4) {
                                    if let when = TeacherDates.relative(f.created_at) {
                                        Text(verbatim: when)
                                        Text(verbatim: "·")
                                    }
                                    Text(f.seen_at != nil ? TeacherCopy.feedbackSeen : TeacherCopy.feedbackNotSeen)
                                }
                                .font(.caption).foregroundStyle(.white.opacity(0.6))
                            }
                        }
                        .font(.subheadline)
                    }
                }
            }
        }
    }

    private func stickerRow(size: CGFloat, spacing: CGFloat) -> some View {
        HStack(spacing: spacing) {
            ForEach(TeacherStickers.all, id: \.self) { id in
                Button {
                    sticker = sticker == id ? nil : id
                } label: {
                    Text(verbatim: TeacherStickers.emoji(id))
                        .font(.system(size: size * 0.5))
                        .frame(width: size, height: size)
                        .background(sticker == id ? Color.cyan.opacity(0.3) : .clear,
                                    in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(sticker == id ? Color.cyan : .white.opacity(0.2)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text(AssignmentCopy.sticker(id) ?? AssignmentCopy.stickerFallback))
                .accessibilityAddTraits(sticker == id ? .isSelected : [])
            }
        }
        .fixedSize()
    }

    private func send() async {
        let trimmed = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty || sticker != nil else { error = TeacherCopy.feedbackNeedContent; return }
        sending = true
        error = nil
        defer { sending = false }
        guard let token = await auth.validAccessToken() else { return }
        do {
            let sent = try await APIClient.shared.teacherSendFeedback(
                classId: classId, submissionId: submissionId,
                comment: trimmed.isEmpty ? nil : trimmed, sticker: sticker, bearerToken: token)
            onSent(sent)
            comment = ""
            sticker = nil
        } catch {
            self.error = TeacherCopy.error(error)
        }
    }
}

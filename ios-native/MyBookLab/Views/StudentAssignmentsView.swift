// A class account's assignments on the bookshelf, the teacher-feedback
// sheet, and the prompt hint shown while writing an assignment book.
// SwiftUI counterparts of src/components/school/{MyAssignments,
// AssignmentCard,StudentFeedbackModal}.jsx and StoryEditor's
// AssignmentPromptHint, with the web's exact EN/IT copy
// (src/i18n/locales/*/school.json, student.*).
//
// Every entry point is gated on AuthStore.isStudent by its caller, so a
// family account never renders (or fetches) any of it.
import SwiftUI

// MARK: - Copy

enum AssignmentCopy {
    static let heading = LocalizedStringResource("school.student.assignments.heading", defaultValue: "My assignments")
    static let listen = LocalizedStringResource("school.student.assignments.prompt_listen_aria", defaultValue: "Read the assignment out loud")
    static let startWriting = LocalizedStringResource("school.student.assignments.start_writing", defaultValue: "Start writing")
    static let continueWriting = LocalizedStringResource("school.student.assignments.continue_writing", defaultValue: "Continue writing")
    static let openHandedIn = LocalizedStringResource("school.student.assignments.open_handed_in", defaultValue: "Open my book")
    static let handInAgain = LocalizedStringResource("school.student.assignments.hand_in_again", defaultValue: "Hand in again")
    static let newFeedback = LocalizedStringResource("school.student.assignments.new_feedback", defaultValue: "New feedback!")
    static let seeFeedback = LocalizedStringResource("school.student.assignments.see_feedback", defaultValue: "See feedback")
    static let hintHeading = LocalizedStringResource("school.student.assignments.prompt_hint.heading", defaultValue: "Your assignment")
    static let hintDismiss = LocalizedStringResource("school.student.assignments.prompt_hint.dismiss_aria", defaultValue: "Hide the assignment prompt")
    static let feedbackHeading = LocalizedStringResource("school.student.feedback.heading", defaultValue: "Feedback from your teacher")
    static let feedbackEmpty = LocalizedStringResource("school.student.feedback.empty", defaultValue: "No feedback yet.")
    static let feedbackClose = LocalizedStringResource("school.student.feedback.close_aria", defaultValue: "Close feedback")
    static let readAloud = LocalizedStringResource("school.actions.listen", defaultValue: "Read this out loud")

    static func status(_ s: StudentAssignment.CardStatus) -> LocalizedStringResource {
        switch s {
        case .notStarted: LocalizedStringResource("school.student.assignments.status.not_started", defaultValue: "Not started")
        case .handedIn: LocalizedStringResource("school.student.assignments.status.handed_in", defaultValue: "Handed in ✓")
        case .closed: LocalizedStringResource("school.student.assignments.status.closed", defaultValue: "Closed")
        }
    }

    static func due(_ d: StudentAssignment.Due) -> LocalizedStringResource {
        let locale = Locale(identifier: AppLanguage.uiLanguage)
        switch d {
        case .none: return LocalizedStringResource("school.student.assignments.due.none", defaultValue: "No due date")
        case .today: return LocalizedStringResource("school.student.assignments.due.today", defaultValue: "Due today")
        case .tomorrow: return LocalizedStringResource("school.student.assignments.due.tomorrow", defaultValue: "Due tomorrow")
        case .weekday(let date):
            let weekday = date.formatted(.dateTime.weekday(.wide).locale(locale))
            return LocalizedStringResource("school.student.assignments.due.weekday", defaultValue: "Due \(weekday)")
        case .date(let date):
            let day = date.formatted(.dateTime.month(.abbreviated).day().locale(locale))
            return LocalizedStringResource("school.student.assignments.due.date", defaultValue: "Due \(day)")
        case .lateOK: return LocalizedStringResource("school.student.assignments.due.late_ok", defaultValue: "Late is OK")
        case .pastDue: return LocalizedStringResource("school.student.assignments.due.past_due", defaultValue: "Past due")
        }
    }
}

// MARK: - Bookshelf section

/// "My assignments" above the shelf. Renders nothing while loading, on a
/// failure, or when the class has no assignments — a broken schools API
/// must never block or flash above a child's own books.
struct MyAssignmentsSection: View {
    @Environment(AuthStore.self) private var auth
    @Environment(BookshelfStore.self) private var bookshelf
    @Environment(AppRouter.self) private var router
    @State private var assignments: [StudentAssignment]?
    @State private var feedbackFor: StudentAssignment?

    var body: some View {
        Group {
            if auth.isStudent, let assignments, !assignments.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    Label {
                        Text(AssignmentCopy.heading)
                    } icon: {
                        Image(systemName: "list.clipboard")
                            .foregroundStyle(.cyan)
                    }
                    .font(.system(.title3, design: .rounded).bold())
                    .foregroundStyle(.white)

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 16)], spacing: 16) {
                        ForEach(assignments) { assignment in
                            AssignmentCard(
                                assignment: assignment,
                                book: taggedBook(for: assignment),
                                onWrite: { startOrContinue(assignment) },
                                onSeeFeedback: { feedbackFor = assignment }
                            )
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 12)
            }
        }
        .task(id: auth.isStudent) {
            guard auth.isStudent else { return }
            if let fresh = await SchoolAssignments.list() { assignments = fresh }
        }
        .sheet(item: $feedbackFor) { assignment in
            if let submissionId = assignment.my_submission?.id {
                StudentFeedbackSheet(submissionId: submissionId) { markSeen(assignment.id) }
            }
        }
    }

    /// A book already tagged for this assignment: "Start writing" resumes it
    /// instead of starting a second one, and a handed-in card opens it.
    private func taggedBook(for assignment: StudentAssignment) -> Book? {
        bookshelf.books.first { $0.assignmentId == assignment.id }
    }

    /// A new book made the app's normal way (the Create wizard), tagged with
    /// the assignment and titled after it — or the tagged book reopened in
    /// the editor, same as the Edit button on a book.
    private func startOrContinue(_ assignment: StudentAssignment) {
        let draft = BookDraftStore.shared
        if let existing = taggedBook(for: assignment) {
            draft.edit(existing)
        } else {
            draft.begin()
            draft.book?.title = assignment.title
            draft.book?.assignmentId = assignment.id
            draft.book?.assignmentPrompt = assignment.prompt
        }
        router.selectedTab = .create
    }

    private func markSeen(_ assignmentId: String) {
        guard let i = assignments?.firstIndex(where: { $0.id == assignmentId }),
              let sub = assignments?[i].my_submission else { return }
        assignments?[i].my_submission = .init(
            id: sub.id, version: sub.version, submitted_at: sub.submitted_at,
            late: sub.late, feedback_unseen: 0
        )
    }
}

// MARK: - One card

private struct AssignmentCard: View {
    let assignment: StudentAssignment
    let book: Book?
    let onWrite: () -> Void
    let onSeeFeedback: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var speaker = SpeechSpeaker()
    @State private var pulsing = false

    private var status: StudentAssignment.CardStatus { assignment.cardStatus }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 8) {
                Text(assignment.title)
                    .font(.system(.headline, design: .rounded))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(AssignmentCopy.status(status))
                    .font(.caption.bold())
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .foregroundStyle(status == .handedIn ? Color.green : .white.opacity(0.7))
                    .background(
                        (status == .handedIn ? Color.green : .white).opacity(0.14),
                        in: Capsule()
                    )
            }

            if let prompt = assignment.prompt, !prompt.isEmpty {
                HStack(alignment: .top, spacing: 8) {
                    Text(prompt)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.8))
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button {
                        speaker.speak(prompt)
                    } label: {
                        Image(systemName: "speaker.wave.2.fill")
                            .font(.body)
                            .frame(width: 44, height: 44)
                            .background(.cyan.opacity(0.18), in: Circle())
                            .foregroundStyle(.cyan)
                    }
                    .accessibilityLabel(Text(AssignmentCopy.listen))
                }
            }

            Text(AssignmentCopy.due(assignment.due()))
                .font(.caption.weight(dueIsUrgent ? .bold : .regular))
                .foregroundStyle(dueColor)

            if assignment.hasUnseenFeedback {
                Button(action: onSeeFeedback) {
                    Label { Text(AssignmentCopy.newFeedback) } icon: { Image(systemName: "sparkles") }
                        .font(.subheadline.bold())
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .foregroundStyle(.yellow)
                        .background(
                            LinearGradient(colors: [.yellow.opacity(0.22), .pink.opacity(0.22)],
                                           startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 12)
                        )
                }
                .scaleEffect(pulsing ? 1.03 : 1)
                .loopingAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) {
                    pulsing = true
                }
            }

            actions
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
        .onDisappear { speaker.stop() }
    }

    @ViewBuilder
    private var actions: some View {
        HStack(spacing: 10) {
            switch status {
            case .notStarted:
                SparkleButton(action: onWrite, size: .small) {
                    Text(book == nil ? AssignmentCopy.startWriting : AssignmentCopy.continueWriting)
                }
                .fixedSize()
            case .handedIn:
                let label = assignment.canHandInAgain ? AssignmentCopy.handInAgain : AssignmentCopy.openHandedIn
                if let book {
                    NavigationLink {
                        BookDetailView(book: book)
                    } label: {
                        secondaryLabel(label)
                    }
                    .buttonStyle(.plain)
                } else {
                    Button(action: onWrite) { secondaryLabel(label) }
                        .buttonStyle(.plain)
                }
            case .closed:
                EmptyView()
            }

            if assignment.my_submission != nil, !assignment.hasUnseenFeedback {
                Button(action: onSeeFeedback) {
                    Text(AssignmentCopy.seeFeedback)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.75))
                        .padding(.vertical, 10)
                        .padding(.horizontal, 6)
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }
    }

    private func secondaryLabel(_ text: LocalizedStringResource) -> some View {
        Text(text)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.vertical, 10)
            .padding(.horizontal, 16)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(.white.opacity(0.3)))
            .contentShape(Rectangle())
    }

    private var dueIsUrgent: Bool {
        switch assignment.due() {
        case .today, .lateOK: true
        default: false
        }
    }

    private var dueColor: Color {
        switch assignment.due() {
        case .today, .tomorrow: .cyan
        case .lateOK: .orange
        case .pastDue: .red
        default: .white.opacity(0.6)
        }
    }
}

// MARK: - Feedback sheet

/// One hand-in's feedback thread. Opening it marks every unseen item seen
/// and tells the caller, so the card's "New feedback!" badge clears without
/// waiting for a re-fetch.
struct StudentFeedbackSheet: View {
    let submissionId: String
    var onSeen: () -> Void = {}

    @Environment(\.dismiss) private var dismiss
    @State private var items: [StudentSubmission.Feedback]?
    @State private var failed = false
    @State private var speaker = SpeechSpeaker()

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                Text(AssignmentCopy.feedbackHeading)
                    .font(.system(.title3, design: .rounded).bold())
                    .foregroundStyle(.white)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.body.bold())
                        .frame(width: 44, height: 44)
                        .foregroundStyle(.white.opacity(0.7))
                }
                .accessibilityLabel(Text(AssignmentCopy.feedbackClose))
            }

            if failed {
                Text(HandInCopy.error("generic"))
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else if let items {
                if items.isEmpty {
                    Text(AssignmentCopy.feedbackEmpty)
                        .foregroundStyle(.white.opacity(0.7))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                } else {
                    ScrollView {
                        VStack(spacing: 12) {
                            ForEach(items) { item in
                                FeedbackRow(item: item, speaker: speaker)
                            }
                        }
                    }
                }
            } else {
                ProgressView()
                    .tint(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
            }
            Spacer(minLength: 0)
        }
        .padding(20)
        .contentColumn(maxWidth: ContentWidth.form)
        // Opaque: the sheet opens over the assignment cards or the book,
        // which bled through a translucent panel on the web.
        .presentationBackground(Color("LaunchBackground"))
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .task {
            if let res = await SchoolAssignments.feedback(submissionId: submissionId) {
                items = res.items
                if res.markedSeen { onSeen() }
            } else {
                failed = true
            }
        }
        .onDisappear { speaker.stop() }
    }
}

private struct FeedbackRow: View {
    let item: StudentSubmission.Feedback
    let speaker: SpeechSpeaker

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var popped = false

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if let emoji = item.stickerEmoji {
                // The sticker is the reward: big, and it pops in once. Under
                // Reduce Motion it is simply there.
                Text(verbatim: emoji)
                    .font(.system(size: 64))
                    .scaleEffect(popped ? 1 : 0.2)
                    .rotationEffect(.degrees(popped ? 0 : -20))
                    .accessibilityHidden(true)
                    .onAppear {
                        guard !popped else { return }
                        if reduceMotion {
                            popped = true
                        } else {
                            withAnimation(.spring(response: 0.45, dampingFraction: 0.45)) { popped = true }
                        }
                    }
            }
            VStack(alignment: .leading, spacing: 4) {
                if let comment = item.comment, !comment.isEmpty {
                    Text(comment)
                        .font(.body)
                        .foregroundStyle(.white)
                }
                if let date = StudentAssignment.parseDate(item.created_at) {
                    Text(date, format: .relative(presentation: .named))
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.55))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let comment = item.comment, !comment.isEmpty {
                Button {
                    speaker.speak(comment)
                } label: {
                    Image(systemName: "speaker.wave.2.fill")
                        .frame(width: 44, height: 44)
                        .foregroundStyle(.cyan)
                }
                .accessibilityLabel(Text(AssignmentCopy.readAloud))
            }
        }
        .padding(14)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Prompt hint while writing

/// The assignment's prompt above the Create wizard, for a book started from
/// "Start writing". Dismissing only hides it for this writing session.
struct AssignmentPromptHint: View {
    let prompt: String
    let onDismiss: () -> Void
    @State private var speaker = SpeechSpeaker()

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "list.clipboard")
                .foregroundStyle(.cyan)
                .padding(.top, 2)
            VStack(alignment: .leading, spacing: 4) {
                Text(AssignmentCopy.hintHeading)
                    .font(.caption.bold())
                    .foregroundStyle(.cyan)
                Text(prompt)
                    .font(.subheadline)
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button { speaker.speak(prompt) } label: {
                Image(systemName: "speaker.wave.2.fill")
                    .frame(width: 44, height: 44)
                    .foregroundStyle(.cyan)
            }
            .accessibilityLabel(Text(AssignmentCopy.listen))
            Button {
                speaker.stop()
                onDismiss()
            } label: {
                Image(systemName: "xmark")
                    .frame(width: 44, height: 44)
                    .foregroundStyle(.white.opacity(0.7))
            }
            .accessibilityLabel(Text(AssignmentCopy.hintDismiss))
        }
        .padding(12)
        .background(Color("LaunchBackground").opacity(0.92), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(.cyan.opacity(0.35)))
        .padding(.horizontal)
        .padding(.top, 4)
        .contentColumn(maxWidth: ContentWidth.form)
        .onDisappear { speaker.stop() }
    }
}

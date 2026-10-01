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
    static var heading: LocalizedStringResource { AppText("school.student.assignments.heading", defaultValue: "My assignments") }
    static var fromTeacher: LocalizedStringResource { AppText("school.student.assignments.from_teacher", defaultValue: "From your teacher") }
    static var listen: LocalizedStringResource { AppText("school.student.assignments.prompt_listen_aria", defaultValue: "Read the assignment out loud") }
    static var startWriting: LocalizedStringResource { AppText("school.student.assignments.start_writing", defaultValue: "Start writing") }
    static var continueWriting: LocalizedStringResource { AppText("school.student.assignments.continue_writing", defaultValue: "Continue writing") }
    static var openHandedIn: LocalizedStringResource { AppText("school.student.assignments.open_handed_in", defaultValue: "Open my book") }
    static var handInAgain: LocalizedStringResource { AppText("school.student.assignments.hand_in_again", defaultValue: "Hand in again") }
    static var newFeedback: LocalizedStringResource { AppText("school.student.assignments.new_feedback", defaultValue: "New feedback!") }
    static var seeFeedback: LocalizedStringResource { AppText("school.student.assignments.see_feedback", defaultValue: "See feedback") }
    static var hintHeading: LocalizedStringResource { AppText("school.student.assignments.prompt_hint.heading", defaultValue: "Your assignment") }
    static var hintDismiss: LocalizedStringResource { AppText("school.student.assignments.prompt_hint.dismiss_aria", defaultValue: "Hide the assignment prompt") }
    static var feedbackHeading: LocalizedStringResource { AppText("school.student.feedback.heading", defaultValue: "Feedback from your teacher") }
    static var feedbackEmpty: LocalizedStringResource { AppText("school.student.feedback.empty", defaultValue: "No feedback yet.") }
    static var feedbackClose: LocalizedStringResource { AppText("school.student.feedback.close_aria", defaultValue: "Close feedback") }
    static var readAloud: LocalizedStringResource { AppText("school.actions.listen", defaultValue: "Read this out loud") }
    static var stopReading: LocalizedStringResource { AppText("school.actions.stop_listening", defaultValue: "Stop reading") }
    static var replaceDraftTitle: LocalizedStringResource { AppText("school.student.assignments.replace_draft", defaultValue: "Start a new book? Your unsaved book will be lost.") }
    static var replaceDraftConfirm: LocalizedStringResource { AppText("school.student.assignments.start_writing", defaultValue: "Start writing") }

    static var stickerFallback: LocalizedStringResource { AppText("school.teacher.assignments.feedback.sticker_label", defaultValue: "Sticker") }

    static func sticker(_ id: String) -> LocalizedStringResource? {
        switch id {
        case "star": AppText("school.teacher.assignments.feedback.sticker.star", defaultValue: "Star")
        case "rocket": AppText("school.teacher.assignments.feedback.sticker.rocket", defaultValue: "Rocket")
        case "heart": AppText("school.teacher.assignments.feedback.sticker.heart", defaultValue: "Heart")
        case "wow": AppText("school.teacher.assignments.feedback.sticker.wow", defaultValue: "Wow")
        case "keep_going": AppText("school.teacher.assignments.feedback.sticker.keep_going", defaultValue: "Keep going")
        case "rainbow": AppText("school.teacher.assignments.feedback.sticker.rainbow", defaultValue: "Rainbow")
        default: nil
        }
    }

    static func status(_ s: StudentAssignment.CardStatus) -> LocalizedStringResource {
        switch s {
        case .notStarted: AppText("school.student.assignments.status.not_started", defaultValue: "Not started")
        case .handedIn: AppText("school.student.assignments.status.handed_in", defaultValue: "Handed in ✓")
        case .closed: AppText("school.student.assignments.status.closed", defaultValue: "Closed")
        }
    }

    static func homeStatus(_ s: StudentAssignment.HomeStatus) -> LocalizedStringResource {
        switch s {
        case .new: AppText("school.student.assignments.status.new", defaultValue: "New")
        case .notStarted: status(.notStarted)
        case .inProgress: AppText("school.student.assignments.status.in_progress", defaultValue: "In progress")
        case .handedIn: status(.handedIn)
        case .feedback: AppText("school.student.assignments.status.feedback", defaultValue: "Feedback")
        case .closed: status(.closed)
        }
    }

    static func due(_ d: StudentAssignment.Due) -> LocalizedStringResource {
        let locale = AppLanguage.locale
        switch d {
        case .none: return AppText("school.student.assignments.due.none", defaultValue: "No due date")
        case .today: return AppText("school.student.assignments.due.today", defaultValue: "Due today")
        case .tomorrow: return AppText("school.student.assignments.due.tomorrow", defaultValue: "Due tomorrow")
        case .weekday(let date):
            let weekday = date.formatted(.dateTime.weekday(.wide).locale(locale))
            return AppText("school.student.assignments.due.weekday", defaultValue: "Due \(weekday)")
        case .date(let date):
            let day = date.formatted(.dateTime.month(.abbreviated).day().locale(locale))
            return AppText("school.student.assignments.due.date", defaultValue: "Due \(day)")
        case .lateOK: return AppText("school.student.assignments.due.late_ok", defaultValue: "Late is OK")
        case .pastDue: return AppText("school.student.assignments.due.past_due", defaultValue: "Past due")
        }
    }
}

// MARK: - Bookshelf section

/// "From your teacher" at the top of a class account's home (the Books tab).
/// Renders nothing while loading, on a failure, or when there is nothing to
/// do — a broken schools API must never block or flash above a child's own
/// books.
///
/// Students are on shared iPads and get no push: a just-published
/// assignment arrives by re-reading the list whenever the app becomes
/// active and every minute while this is on screen.
struct MyAssignmentsSection: View {
    @Environment(AuthStore.self) private var auth
    @Environment(BookshelfStore.self) private var bookshelf
    @Environment(AppRouter.self) private var router
    @Environment(\.scenePhase) private var scenePhase
    @State private var assignments: [StudentAssignment]?
    /// Assignment ids this child has opened (AssignmentSeen); drives "New".
    @State private var seen: Set<String> = []
    @State private var feedbackFor: StudentAssignment?
    /// What is waiting on "replace your unsaved book?": the assignment, and
    /// the nudge that led there (marked seen only if the child goes ahead).
    /// The dialog carries it via `presenting:`, so the Replace action acts
    /// on exactly the value it was shown with.
    @State private var pendingStart: PendingStart?

    private struct PendingStart {
        let assignment: StudentAssignment
        var nudge: StudentNudge?
    }
    /// The teacher's unread nudge (api/school/nudges.js), shown first.
    @State private var nudge: StudentNudge?
    /// Dismissed with "Got it" on this device: a poll racing the PATCH
    /// must not bring the card straight back.
    @State private var dismissedNudges: Set<String> = []

    var body: some View {
        // A real container, not a Group: modifiers on a Group that starts
        // empty land on no view, so .task would never run and nothing
        // would ever load.
        VStack(spacing: 0) {
            if auth.isStudent, !visible.isEmpty || nudge != nil {
                VStack(alignment: .leading, spacing: 14) {
                    Label {
                        Text(AssignmentCopy.fromTeacher)
                    } icon: {
                        Image(systemName: "list.clipboard")
                            .foregroundStyle(.cyan)
                    }
                    .font(.system(.title2, design: .rounded).bold())
                    .foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)

                    if let nudge {
                        StudentNudgeCard(
                            nudge: nudge,
                            actionLabel: nudgeActionLabel(nudge),
                            // Acting on it counts as reading it — once the
                            // action really goes ahead (see nudgeAction).
                            onAction: { nudgeAction(nudge) },
                            onGotIt: { dismissNudge(nudge) }
                        )
                    }

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 16)], spacing: 16) {
                        ForEach(visible) { assignment in
                            let book = taggedBook(for: assignment)
                            AssignmentCard(
                                assignment: assignment,
                                book: book,
                                started: isStarted(assignment),
                                homeStatus: assignment.homeStatus(
                                    hasBook: isStarted(assignment), seen: seen.contains(assignment.id)),
                                onOpen: { markOpened(assignment) },
                                onWrite: {
                                    markOpened(assignment)
                                    startOrContinue(assignment)
                                },
                                onSeeFeedback: {
                                    markOpened(assignment)
                                    feedbackFor = assignment
                                }
                            )
                        }
                    }
                }
                .padding(16)
                .background(
                    LinearGradient(colors: [.cyan.opacity(0.14), .purple.opacity(0.10)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: 22)
                )
                .overlay(RoundedRectangle(cornerRadius: 22).stroke(.cyan.opacity(0.3)))
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 12)
            }
        }
        // Re-read on becoming active (a new scenePhase restarts the task),
        // then every minute while the home is on screen; the task ends when
        // it leaves the screen or the app goes to the background.
        .task(id: PollKey(student: auth.isStudent, userId: auth.user?.id, active: scenePhase == .active)) {
            guard auth.isStudent else {
                assignments = nil
                nudge = nil
                return
            }
            seen = AssignmentSeen.ids(userId: auth.user?.id.uuidString)
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                if let fresh = await SchoolAssignments.list() {
                    assignments = fresh
                    seen = AssignmentSeen.prune(keeping: fresh.map(\.id), userId: auth.user?.id.uuidString)
                }
                // A failed read keeps what is on screen.
                if let fresh = await SchoolAssignments.nudge() {
                    nudge = fresh.flatMap { dismissedNudges.contains($0.id) ? nil : $0 }
                }
                try? await Task.sleep(for: SchoolAssignments.pollInterval)
            }
        }
        .sheet(item: $feedbackFor) { assignment in
            if let submissionId = assignment.my_submission?.id {
                StudentFeedbackSheet(
                    submissionId: submissionId,
                    onSeen: { markSeen(assignment.id) },
                    // "Try again" opens their book to revise and hand in again.
                    onTryAgain: assignment.canHandInAgain ? {
                        feedbackFor = nil
                        startOrContinue(assignment)
                    } : nil
                )
            }
        }
        .confirmationDialog(
            Text(AssignmentCopy.replaceDraftTitle),
            // Any dismissal (a button, a tap outside, the system) clears the
            // pending start. Replace still acts on the `presenting:` value
            // SwiftUI captured, so clearing here can't lose the nudge.
            isPresented: Binding(
                get: { pendingStart != nil },
                set: { if !$0 { pendingStart = nil } }
            ),
            titleVisibility: .visible,
            presenting: pendingStart
        ) { pending in
            Button(role: .destructive) {
                pendingStart = nil
                if let n = pending.nudge { dismissNudge(n) }
                startNew(pending.assignment)
            } label: {
                Text(AssignmentCopy.replaceDraftConfirm)
            }
            Button("Cancel", role: .cancel) { pendingStart = nil }
        }
    }

    private struct PollKey: Equatable {
        let student: Bool
        let userId: UUID?
        let active: Bool
    }

    /// What the child has to act on first: new, then in progress, then
    /// fresh feedback, then the rest; each group in the server's order.
    private var visible: [StudentAssignment] {
        let open = (assignments ?? []).filter(\.showsOnHome)
        func rank(_ a: StudentAssignment) -> Int {
            switch a.homeStatus(hasBook: isStarted(a), seen: seen.contains(a.id)) {
            case .new: 0
            case .feedback: 1
            case .inProgress: 2
            case .notStarted: 3
            case .handedIn: 4
            case .closed: 5
            }
        }
        return open.enumerated()
            .sorted { (rank($0.element), $0.offset) < (rank($1.element), $1.offset) }
            .map(\.element)
    }

    /// Started = a saved book is tagged for it, or the draft open in the
    /// editor is this assignment's (not saved to the shelf yet).
    private func isStarted(_ assignment: StudentAssignment) -> Bool {
        taggedBook(for: assignment) != nil || BookDraftStore.shared.book?.assignmentId == assignment.id
    }

    private func markOpened(_ assignment: StudentAssignment) {
        guard !seen.contains(assignment.id) else { return }
        seen.insert(assignment.id)
        AssignmentSeen.mark(assignment.id, userId: auth.user?.id.uuidString)
    }

    /// A book already tagged for this assignment: "Start writing" resumes it
    /// instead of starting a second one, and a handed-in card opens it.
    private func taggedBook(for assignment: StudentAssignment) -> Book? {
        bookshelf.books.first { $0.assignmentId == assignment.id }
    }

    /// A new book made the app's normal way (the Create wizard), tagged with
    /// the assignment and titled after it — or the tagged book reopened in
    /// the editor, same as the Edit button on a book.
    ///
    /// Never silently wipes work: a draft already open for this assignment
    /// is just returned to, and any other draft with something in it is
    /// only replaced after the child says so.
    /// Returns false when it is waiting on the "replace?" confirmation.
    @discardableResult
    private func startOrContinue(_ assignment: StudentAssignment, nudge: StudentNudge? = nil) -> Bool {
        let draft = BookDraftStore.shared
        if draft.book?.assignmentId == assignment.id {
            router.selectedTab = .create
            return true
        }
        if let open = draft.book, Self.hasWork(open) {
            pendingStart = PendingStart(assignment: assignment, nudge: nudge)
            return false
        }
        startNew(assignment)
        return true
    }

    private func startNew(_ assignment: StudentAssignment) {
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

    /// Whether an open draft holds anything a child would miss.
    private static func hasWork(_ b: Book) -> Bool {
        !b.title.trimmingCharacters(in: .whitespaces).isEmpty
            || !b.authorName.trimmingCharacters(in: .whitespaces).isEmpty
            || !b.characters.isEmpty
            || b.setting != nil
            || b.pages.contains { !$0.text.trimmingCharacters(in: .whitespaces).isEmpty || $0.illustrationData != nil }
            || b.coverImage != nil
    }

    // MARK: Nudge

    /// The linked assignment, if it is still one the child can write for.
    private func nudgeAssignment(_ n: StudentNudge) -> StudentAssignment? {
        guard let id = n.assignment?.id,
              let a = assignments?.first(where: { $0.id == id }),
              a.cardStatus == .notStarted,
              // Closed by its due date (no late work): nothing to write for.
              !(a.past_due == true && a.allow_late == false) else { return nil }
        return a
    }

    /// Most recently edited book on the shelf (ISO-8601 strings sort by time).
    private var mostRecentBook: Book? {
        bookshelf.books.max { $0.updatedAt < $1.updatedAt }
    }

    private func nudgeActionLabel(_ n: StudentNudge) -> LocalizedStringResource {
        if let a = nudgeAssignment(n) {
            return isStarted(a) ? AssignmentCopy.continueWriting : AssignmentCopy.startWriting
        }
        if let open = BookDraftStore.shared.book, Self.hasWork(open) { return NudgeCopy.keepWriting }
        return mostRecentBook != nil ? NudgeCopy.keepWriting : NudgeCopy.createBook
    }

    /// The linked assignment's Start/Continue writing (same path as its
    /// card); otherwise the book in progress, the most recent book, or a
    /// new one. Never wipes an open draft that has work in it.
    private func nudgeAction(_ n: StudentNudge) {
        if let a = nudgeAssignment(n) {
            markOpened(a)
            // Waiting on "replace?": the dialog carries the nudge and marks
            // it seen only on Replace.
            if startOrContinue(a, nudge: n) { dismissNudge(n) }
            return
        }
        dismissNudge(n)
        let draft = BookDraftStore.shared
        if let open = draft.book, Self.hasWork(open) {
            router.selectedTab = .create
            return
        }
        if let book = mostRecentBook {
            draft.edit(book)
        } else {
            draft.begin()
        }
        router.selectedTab = .create
    }

    private func dismissNudge(_ n: StudentNudge) {
        dismissedNudges.insert(n.id)
        nudge = nil
        Task { await SchoolAssignments.markNudgeSeen(id: n.id) }
    }

    private func markSeen(_ assignmentId: String) {
        guard let i = assignments?.firstIndex(where: { $0.id == assignmentId }),
              assignments?[i].my_submission != nil else { return }
        assignments?[i].my_submission?.feedback_unseen = 0
        assignments?[i].my_submission?.grade_unseen = false
    }
}

// MARK: - One card

private struct AssignmentCard: View {
    let assignment: StudentAssignment
    let book: Book?
    /// A saved book or the open draft belongs to it: "Continue writing".
    let started: Bool
    let homeStatus: StudentAssignment.HomeStatus
    /// Any touch on the card counts as opening it (clears "New").
    let onOpen: () -> Void
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
                statusPill
            }

            if let prompt = assignment.prompt, !prompt.isEmpty {
                HStack(alignment: .top, spacing: 8) {
                    Text(prompt)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.8))
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button {
                        onOpen()
                        speaker.toggle(prompt)
                    } label: {
                        Image(systemName: speaker.isSpeaking(prompt) ? "stop.fill" : "speaker.wave.2.fill")
                            .font(.body)
                            .frame(width: 44, height: 44)
                            .background(.cyan.opacity(0.18), in: Circle())
                            .foregroundStyle(.cyan)
                    }
                    .accessibilityLabel(Text(speaker.isSpeaking(prompt) ? AssignmentCopy.stopReading : AssignmentCopy.listen))
                }
            }

            Text(AssignmentCopy.due(assignment.due()))
                .font(.caption.weight(dueIsUrgent ? .bold : .regular))
                .foregroundStyle(dueColor)

            if let level = assignment.my_submission?.level, !assignment.isSentBack {
                StudentLevelBadge(level: level, compact: true)
            }

            if assignment.isSentBack {
                SentBackBanner(onTryAgain: onWrite)
            }

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
        .overlay {
            if homeStatus == .new {
                RoundedRectangle(cornerRadius: 16).stroke(.yellow.opacity(0.7), lineWidth: 2)
            }
        }
        // Buttons inside keep their own taps; a tap anywhere else on the
        // card opens it too.
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .onTapGesture(perform: onOpen)
        .onDisappear { speaker.stop() }
    }

    private var statusPill: some View {
        let tint: Color = switch homeStatus {
        case .new: .yellow
        case .inProgress: .cyan
        case .handedIn: .green
        case .feedback: .pink
        case .notStarted, .closed: .white
        }
        return HStack(spacing: 4) {
            if homeStatus == .new {
                Image(systemName: "sparkles").accessibilityHidden(true)
            }
            Text(AssignmentCopy.homeStatus(homeStatus))
        }
        .font(.caption.bold())
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .foregroundStyle(homeStatus == .notStarted || homeStatus == .closed ? tint.opacity(0.7) : tint)
        .background(tint.opacity(homeStatus == .new ? 0.22 : 0.14), in: Capsule())
    }

    /// One row when it fits; stacked at large Dynamic Type or with longer
    /// (Italian) labels.
    private var actions: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 10) {
                actionButtons
                Spacer(minLength: 0)
            }
            VStack(alignment: .leading, spacing: 8) {
                actionButtons
            }
        }
    }

    @ViewBuilder
    private var actionButtons: some View {
            switch status {
            case .notStarted:
                // The one big thing to do on a card.
                SparkleButton(action: onWrite, size: .regular) {
                    Label {
                        Text(started ? AssignmentCopy.continueWriting : AssignmentCopy.startWriting)
                    } icon: {
                        Image(systemName: "pencil.and.scribble")
                    }
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

/// One hand-in's feedback thread, with the child's level and tips on top
/// (StudentGradeViews.swift). Opening it marks every unseen item seen and
/// tells the caller, so the card's "New feedback!" badge clears without
/// waiting for a re-fetch. `onTryAgain`: offered when the teacher sent it
/// back and the child can still hand in again.
struct StudentFeedbackSheet: View {
    let submissionId: String
    var onSeen: () -> Void = {}
    var onTryAgain: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var items: [StudentSubmission.Feedback]?
    @State private var grade: SubmissionGrade?
    @State private var returned = false
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
                if items.isEmpty && grade == nil {
                    Text(AssignmentCopy.feedbackEmpty)
                        .foregroundStyle(.white.opacity(0.7))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                } else {
                    ScrollView {
                        VStack(spacing: 12) {
                            if returned, let onTryAgain {
                                SentBackBanner(onTryAgain: onTryAgain)
                            }
                            if let grade {
                                StudentGradeCard(grade: grade, speaker: speaker)
                            }
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
                grade = res.grade
                returned = res.returned
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
                    .accessibilityLabel(Text(AssignmentCopy.sticker(item.sticker ?? "") ?? AssignmentCopy.stickerFallback))
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
                    speaker.toggle(comment)
                } label: {
                    Image(systemName: speaker.isSpeaking(comment) ? "stop.fill" : "speaker.wave.2.fill")
                        .frame(width: 44, height: 44)
                        .foregroundStyle(.cyan)
                }
                .accessibilityLabel(Text(speaker.isSpeaking(comment) ? AssignmentCopy.stopReading : AssignmentCopy.readAloud))
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
            Button { speaker.toggle(prompt) } label: {
                Image(systemName: speaker.isSpeaking(prompt) ? "stop.fill" : "speaker.wave.2.fill")
                    .frame(width: 44, height: 44)
                    .foregroundStyle(.cyan)
            }
            .accessibilityLabel(Text(speaker.isSpeaking(prompt) ? AssignmentCopy.stopReading : AssignmentCopy.listen))
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

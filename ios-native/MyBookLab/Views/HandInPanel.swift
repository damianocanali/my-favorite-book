// The Hand-in button on a class account's own book — SwiftUI counterpart of
// src/components/school/HandInPanel.jsx. A book started from an assignment
// hands straight in to it; any other book gets a "Hand in to…" picker of
// the assignments still open. BookDetailView only mounts this for a
// student's own book, so a family account never sees or fetches it.
import SwiftUI

enum HandInCopy {
    static var pickerTitle: LocalizedStringResource { AppText("school.student.hand_in.picker_title", defaultValue: "Hand in to…") }
    static var pickerHint: LocalizedStringResource { AppText("school.student.hand_in.picker_hint", defaultValue: "Which assignment is this book for?") }
    static var pickerEmpty: LocalizedStringResource { AppText("school.student.hand_in.picker_empty", defaultValue: "No open assignments right now.") }
    static var button: LocalizedStringResource { AppText("school.student.hand_in.button", defaultValue: "Hand in") }
    static var buttonPick: LocalizedStringResource { AppText("school.student.hand_in.button_pick", defaultValue: "Hand in to…") }
    static var saving: LocalizedStringResource { AppText("school.student.hand_in.saving", defaultValue: "Saving your book…") }
    static var sending: LocalizedStringResource { AppText("school.student.hand_in.sending", defaultValue: "Handing in…") }
    static var successTitle: LocalizedStringResource { AppText("school.student.hand_in.success_title", defaultValue: "Handed in!") }
    static var successBody: LocalizedStringResource { AppText("school.student.hand_in.success_body", defaultValue: "Your teacher will read it.") }

    static func error(_ code: String) -> LocalizedStringResource {
        switch code {
        case "sync_failed":
            AppText("school.student.hand_in.errors.sync_failed", defaultValue: "We couldn't save your book. Check the internet and try again.")
        case "assignment_closed":
            AppText("school.student.hand_in.errors.assignment_closed", defaultValue: "This assignment is closed. Ask your teacher.")
        case "past_due":
            AppText("school.student.hand_in.errors.past_due", defaultValue: "It's past the due date. Ask your teacher.")
        case "book_too_large":
            AppText("school.student.hand_in.errors.book_too_large", defaultValue: "This book is too big to hand in. Ask your teacher.")
        case "assignment_not_found":
            AppText("school.student.hand_in.errors.assignment_not_found", defaultValue: "We can't find that assignment. Ask your teacher.")
        case "book_not_found":
            AppText("school.student.hand_in.errors.book_not_found", defaultValue: "We can't find that book. Try again.")
        // Worksheet hand-ins (migration 023).
        case "empty_worksheet":
            AppText("school.student.hand_in.errors.empty_worksheet", defaultValue: "Write something in at least one box.")
        case "unkind":
            AppText("school.student.hand_in.errors.unkind", defaultValue: "Let’s keep it kind — try different words.")
        case "answer_too_long":
            AppText("school.student.hand_in.errors.answer_too_long", defaultValue: "One of your answers is too long.")
        case "wrong_kind":
            AppText("school.student.hand_in.errors.wrong_kind", defaultValue: "This assignment changed. Ask your teacher.")
        case APIClient.sessionExpiredCode:
            APIError.sessionExpiredText
        default:
            AppText("school.student.hand_in.errors.generic", defaultValue: "Something went wrong. Ask your teacher.")
        }
    }
}

struct HandInPanel: View {
    let book: Book
    /// Fired once per successful hand-in, so the host can burst its
    /// full-screen confetti (which already respects Reduce Motion).
    var onHandedIn: () -> Void = {}

    @Environment(AuthStore.self) private var auth
    @Environment(BookshelfStore.self) private var bookshelf
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var assignments: [StudentAssignment]?
    @State private var phase: SchoolAssignments.HandInPhase = .idle
    @State private var errorCode: String?
    @State private var success = false
    @State private var showPicker = false
    @State private var showFeedback = false
    /// The assignment this book is tagged for. Starts from the book and is
    /// updated after a hand-in through the picker, since `book` is a let.
    @State private var taggedId: String?
    @State private var didInit = false

    private var tagged: StudentAssignment? {
        guard let taggedId else { return nil }
        return assignments?.first { $0.id == taggedId }
    }

    private var busy: Bool { phase != .idle }

    var body: some View {
        // A real container, not a Group: modifiers on a Group that starts
        // empty land on no view, so .task would never run and the panel
        // would never load.
        VStack(spacing: 0) {
            // Quiet while loading, same as the web.
            if let assignments {
                content(assignments)
            }
        }
        .contentColumn(maxWidth: 480)
        .padding(.horizontal, 24)
        .task {
            if !didInit {
                didInit = true
                taggedId = book.assignmentId
            }
            await refresh()
        }
        .sheet(isPresented: $showPicker) {
            AssignmentPickerSheet(
                // A book can't go to a worksheet assignment (migration 023).
                assignments: (assignments ?? []).filter { $0.canSubmit && !$0.isWorksheet },
                onPick: { id in
                    showPicker = false
                    Task { await submit(to: id) }
                }
            )
        }
        .sheet(isPresented: $showFeedback) {
            if let submissionId = tagged?.my_submission?.id {
                StudentFeedbackSheet(submissionId: submissionId) {
                    Task { await refresh() }
                }
            }
        }
    }

    @ViewBuilder
    private func content(_ assignments: [StudentAssignment]) -> some View {
        VStack(spacing: 10) {
            if success {
                VStack(spacing: 6) {
                    Mascot(mood: .cheer, size: 64)
                    Text(HandInCopy.successTitle)
                        .font(.system(.headline, design: .rounded).bold())
                        .foregroundStyle(.green)
                    Text(HandInCopy.successBody)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.75))
                }
                .padding(16)
                .frame(maxWidth: .infinity)
                .background(Color("LaunchBackground"), in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(.green.opacity(0.4)))
                .transition(reduceMotion ? .opacity : .scale(scale: 0.9).combined(with: .opacity))
            } else {
                Button {
                    if let tagged { Task { await submit(to: tagged.id) } } else { showPicker = true }
                } label: {
                    HStack(spacing: 8) {
                        if busy {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "paperplane.fill")
                        }
                        Text(buttonLabel)
                    }
                    .font(.system(.headline, design: .rounded))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        LinearGradient(colors: [.purple, .pink], startPoint: .leading, endPoint: .trailing),
                        in: Capsule()
                    )
                }
                .buttonStyle(.plain)
                .disabled(busy || (tagged.map { !$0.canSubmit } ?? false))
                .opacity(busy || (tagged.map { !$0.canSubmit } ?? false) ? 0.5 : 1)
            }

            if let errorCode {
                Text(HandInCopy.error(errorCode))
                    .font(.subheadline)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            if !success, tagged?.my_submission != nil {
                Button { showFeedback = true } label: {
                    Text(AssignmentCopy.seeFeedback)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.7))
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var buttonLabel: LocalizedStringResource {
        switch phase {
        case .syncing: return HandInCopy.saving
        case .sending: return HandInCopy.sending
        case .idle:
            guard let tagged else { return HandInCopy.buttonPick }
            return tagged.my_submission == nil ? HandInCopy.button : AssignmentCopy.handInAgain
        }
    }

    private func refresh() async {
        if let fresh = await SchoolAssignments.list() { assignments = fresh }
    }

    private func submit(to assignmentId: String) async {
        // No double submit: a second tap while working is ignored even if
        // it slipped past the disabled button.
        guard !busy else { return }
        errorCode = nil
        success = false
        // The freshest copy on the shelf (the page may have been opened
        // before an edit was saved).
        let latest = bookshelf.books.first { $0.id == book.id } ?? book
        let code = await SchoolAssignments.handIn(book: latest, assignmentId: assignmentId) { phase = $0 }
        phase = .idle
        guard code == nil else {
            errorCode = code
            return
        }
        withAnimation(reduceMotion ? nil : .spring(response: 0.45, dampingFraction: 0.7)) {
            success = true
        }
        onHandedIn()
        // A book handed in through the picker is tagged now too, so it reads
        // consistently next time (card state, "Hand in again", the prompt
        // hint). Best effort: the hand-in itself already succeeded.
        if latest.assignmentId != assignmentId, let userId = auth.user?.id.uuidString {
            var retagged = latest
            retagged.assignmentId = assignmentId
            retagged.assignmentPrompt = assignments?.first { $0.id == assignmentId }?.prompt
            try? await bookshelf.save(retagged, userId: userId)
        }
        taggedId = assignmentId
        await refresh()
    }
}

// MARK: - "Hand in to…" picker

private struct AssignmentPickerSheet: View {
    let assignments: [StudentAssignment]
    let onPick: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(HandInCopy.pickerTitle)
                .font(.system(.title3, design: .rounded).bold())
                .foregroundStyle(.white)
            Text(HandInCopy.pickerHint)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.7))

            if assignments.isEmpty {
                Text(HandInCopy.pickerEmpty)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.7))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else {
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(assignments) { a in
                            Button { onPick(a.id) } label: {
                                Text(a.title)
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(.white)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(16)
                                    .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            Button("Cancel") { dismiss() }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white.opacity(0.7))
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        .padding(20)
        .contentColumn(maxWidth: ContentWidth.form)
        .presentationBackground(Color("LaunchBackground"))
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

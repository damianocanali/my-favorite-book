// A class account's assignments, hand-ins and teacher feedback — the JSON
// shapes of api/school/assignments.js (studentList), submit.js and
// submissions.js (studentOne), plus the pure rules the bookshelf card and
// the Hand-in button share. Mirrors src/components/school/assignmentStudentUi.js
// so the iPad and the web never disagree about what a card says.
import Foundation

struct StudentAssignment: Decodable, Identifiable, Hashable, Sendable {
    struct MySubmission: Decodable, Hashable, Sendable {
        let id: String
        let version: Int?
        let submitted_at: String?
        let late: Bool?
        let feedback_unseen: Int?
    }

    let id: String
    let title: String
    let prompt: String?
    let due_at: String?
    /// "published" or "closed" — a student never sees a draft.
    let status: String
    let allow_late: Bool?
    let created_at: String?
    /// Server-computed against the database clock (the same clock the
    /// hand-in re-checks against), so it is never recomputed here.
    let past_due: Bool?
    var my_submission: MySubmission?

    enum CardStatus { case notStarted, handedIn, closed }

    /// Closed wins over everything: once a teacher closes it, it reads
    /// Closed even for a child who already handed something in.
    var cardStatus: CardStatus {
        if status == "closed" { return .closed }
        return my_submission == nil ? .notStarted : .handedIn
    }

    /// Whether a hand-in can be attempted at all. past_due is deliberately
    /// not checked: trying just surfaces the server's own past_due message
    /// instead of leaving a child with no visible way to try.
    var canSubmit: Bool { status == "published" }

    var canHandInAgain: Bool { canSubmit && my_submission != nil }

    var hasUnseenFeedback: Bool { (my_submission?.feedback_unseen ?? 0) > 0 }

    var dueDate: Date? { StudentAssignment.parseDate(due_at) }

    /// The friendly due wording ("Due Friday", "Due today", "Late is OK"),
    /// same rules as the web's dueWording.
    enum Due: Equatable {
        case none, today, tomorrow, weekday(Date), date(Date), lateOK, pastDue
    }

    func due(now: Date = Date(), calendar: Calendar = .current) -> Due {
        guard let due = dueDate else { return .none }
        if past_due == true { return allow_late == true ? .lateOK : .pastDue }
        let days = calendar.dateComponents(
            [.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: due)
        ).day ?? 0
        if days <= 0 { return .today }
        if days == 1 { return .tomorrow }
        if days <= 6 { return .weekday(due) }
        return .date(due)
    }

    /// Postgres timestamps come back with or without fractional seconds.
    static func parseDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFraction.date(from: raw) { return d }
        return ISO8601DateFormatter().date(from: raw)
    }
}

/// POST /api/school/submit's success body.
struct SubmitResult: Decodable, Sendable {
    let id: String
    let version: Int?
    let submitted_at: String?
    let late: Bool?
}

/// GET /api/school/submissions?id= for a student: their own hand-in's
/// feedback thread (the snapshot is not needed on the device).
struct StudentSubmission: Decodable, Sendable {
    struct Feedback: Decodable, Identifiable, Hashable, Sendable {
        let id: String
        let comment: String?
        /// star | rocket | heart | wow | keep_going | rainbow
        let sticker: String?
        let created_at: String?
        let seen_at: String?

        /// Same emoji as the web's STICKER_EMOJI.
        var stickerEmoji: String? {
            guard let sticker else { return nil }
            return [
                "star": "⭐", "rocket": "🚀", "heart": "❤️",
                "wow": "😮", "keep_going": "💪", "rainbow": "🌈",
            ][sticker]
        }
    }
    let feedback: [Feedback]?
}

// A class account's assignments: the list, the hand-in sequence, and the
// feedback thread. Mirrors src/components/school/{MyAssignments,HandInPanel,
// StudentFeedbackModal}.jsx. Like SchoolShare, every call is gated on
// AuthStore.isStudent (app_metadata, server-set), so a family account never
// makes any of these requests.
import Foundation
import os

@MainActor
enum SchoolAssignments {
    private static let log = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "MyBookLab", category: "SchoolAssignments"
    )

    /// A usable (refreshed if expired) token, for a class account only.
    private static func bearer() async -> String? {
        AuthStore.shared.isStudent ? await AuthStore.shared.validAccessToken() : nil
    }

    /// nil on any failure: the bookshelf stays quiet rather than blocking a
    /// child's own books, same as the web.
    static func list() async -> [StudentAssignment]? {
        guard let token = await bearer() else { return nil }
        do {
            return try await APIClient.shared.studentAssignments(bearerToken: token)
        } catch {
            log.warning("assignments list failed: \(String(describing: error), privacy: .public)")
            return nil
        }
    }

    /// The teacher's current unread nudge. `.some(nil)` = none; nil = the
    /// read failed, and the caller keeps whatever it already shows.
    static func nudge() async -> StudentNudge?? {
        guard let token = await bearer() else { return nil }
        do {
            return .some(try await APIClient.shared.studentNudge(bearerToken: token))
        } catch {
            log.warning("nudge read failed: \(String(describing: error), privacy: .public)")
            return nil
        }
    }

    /// "Got it". Best-effort: the card is already gone; a failure only
    /// means it may come back on the next poll.
    static func markNudgeSeen(id: String) async {
        guard let token = await bearer() else { return }
        do {
            try await APIClient.shared.markNudgeSeen(id: id, bearerToken: token)
        } catch {
            log.warning("nudge seen failed: \(String(describing: error), privacy: .public)")
        }
    }

    /// How often the home re-reads the list while it is on screen and the
    /// app is active, so a just-published assignment shows up by itself.
    static let pollInterval: Duration = .seconds(60)

    enum HandInPhase { case idle, syncing, sending }

    /// The hand-in: sync the book to the cloud first, and only if that worked
    /// ask the server to hand it in. school/submit reads the book straight
    /// out of user_books, so handing in after a failed sync would show
    /// "Handed in!" over a copy the teacher can't see (or an old one).
    ///
    /// Returns nil on success, or the error code to show
    /// ("sync_failed", "assignment_closed", "past_due", "book_too_large", ...,
    /// "generic").
    static func handIn(
        book: Book, assignmentId: String,
        phase: (HandInPhase) -> Void
    ) async -> String? {
        guard let token = await bearer(), let userId = AuthStore.shared.user?.id.uuidString else { return "generic" }
        phase(.syncing)
        do {
            try await BookshelfStore.shared.save(book, userId: userId)
        } catch {
            log.warning("hand-in sync failed: \(String(describing: error), privacy: .public)")
            return "sync_failed"
        }
        phase(.sending)
        do {
            _ = try await APIClient.shared.submitAssignment(
                assignmentId: assignmentId, bookId: book.id, bearerToken: token
            )
            return nil
        } catch let e as APIClient.SchoolError {
            return e.code ?? "generic"
        } catch {
            return "generic"
        }
    }

    /// A worksheet hand-in (migration 023): the answers go straight to the
    /// server (there is no book to sync). nil on success, else the error
    /// code to show ("empty_worksheet", "unkind", "assignment_closed", ...).
    static func handInWorksheet(assignmentId: String, answers: [String: String]) async -> String? {
        guard let token = await bearer() else { return "generic" }
        do {
            _ = try await APIClient.shared.submitWorksheet(assignmentId: assignmentId, answers: answers, bearerToken: token)
            return nil
        } catch let e as APIClient.SchoolError {
            return e.code ?? "generic"
        } catch {
            return "generic"
        }
    }

    /// The child's own hand-in answers (to start "Try again" from on an
    /// iPad that has no draft), or nil on failure.
    static func handedInAnswers(submissionId: String) async -> [String: String]? {
        guard let token = await bearer() else { return nil }
        return try? await APIClient.shared.studentSubmission(id: submissionId, bearerToken: token).answers ?? [:]
    }

    struct FeedbackLoad {
        let items: [StudentSubmission.Feedback]
        let grade: SubmissionGrade?
        let returned: Bool
        let markedSeen: Bool
    }

    /// The feedback thread and grade of one hand-in, or nil on failure.
    /// Every not-yet-seen item (and a new grade) is marked seen on the way
    /// (the server keeps the FIRST time it was seen, so repeating this is
    /// harmless); `markedSeen` is true when anything was newly marked.
    static func feedback(submissionId: String) async -> FeedbackLoad? {
        guard let token = await bearer() else { return nil }
        do {
            let res = try await APIClient.shared.studentSubmission(id: submissionId, bearerToken: token)
            let items = res.feedback ?? []
            let unseen = items.filter { $0.seen_at == nil }
            let gradeUnseen = res.grade.flatMap { $0.seen_at == nil ? $0.id : nil }
            await withTaskGroup(of: Void.self) { group in
                for item in unseen {
                    group.addTask {
                        try? await APIClient.shared.markFeedbackSeen(id: item.id, bearerToken: token)
                    }
                }
                if let gradeUnseen {
                    group.addTask {
                        try? await APIClient.shared.markGradeSeen(id: gradeUnseen, bearerToken: token)
                    }
                }
            }
            return FeedbackLoad(items: items, grade: res.grade, returned: res.returned == true,
                                markedSeen: !unseen.isEmpty || gradeUnseen != nil)
        } catch {
            log.warning("feedback load failed: \(String(describing: error), privacy: .public)")
            return nil
        }
    }
}

/// Which assignments this child has opened, so a new one wears a "New" badge
/// until they do. On the device only, per student user id (class iPads are
/// shared, and ids never cross between children). Deliberately KEPT across
/// sign-out: a child signing back in must not see everything as New again.
/// It stays small because every load prunes it to the assignments still
/// listed.
@MainActor
enum AssignmentSeen {
    private static let prefix = "assignmentsSeen."

    static func ids(userId: String?) -> Set<String> {
        guard let userId else { return [] }
        return Set(UserDefaults.standard.stringArray(forKey: prefix + userId) ?? [])
    }

    static func mark(_ assignmentId: String, userId: String?) {
        guard let userId else { return }
        var seen = ids(userId: userId)
        guard seen.insert(assignmentId).inserted else { return }
        UserDefaults.standard.set(Array(seen), forKey: prefix + userId)
    }

    /// Drops ids of assignments no longer in the list; returns what is left.
    @discardableResult
    static func prune(keeping liveIds: [String], userId: String?) -> Set<String> {
        let seen = ids(userId: userId)
        guard let userId else { return seen }
        // A sent-back marker ("<id>#back:…") lives as long as its assignment.
        let live = Set(liveIds)
        let kept = seen.filter { live.contains(String($0.split(separator: "#").first ?? "")) }
        if kept.count != seen.count {
            UserDefaults.standard.set(Array(kept), forKey: prefix + userId)
        }
        return kept
    }
}

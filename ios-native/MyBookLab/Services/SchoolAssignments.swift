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

    private static var token: String? {
        AuthStore.shared.isStudent ? AuthStore.shared.accessToken : nil
    }

    /// nil on any failure: the bookshelf stays quiet rather than blocking a
    /// child's own books, same as the web.
    static func list() async -> [StudentAssignment]? {
        guard let token else { return nil }
        do {
            return try await APIClient.shared.studentAssignments(bearerToken: token)
        } catch {
            log.warning("assignments list failed: \(String(describing: error), privacy: .public)")
            return nil
        }
    }

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
        guard let token, let userId = AuthStore.shared.user?.id.uuidString else { return "generic" }
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

    /// The feedback thread of one hand-in, or nil on failure. Every
    /// not-yet-seen item is marked seen on the way (the server keeps the
    /// FIRST time it was seen, so repeating this is harmless);
    /// `markedSeen` is true when at least one item was newly marked.
    static func feedback(submissionId: String) async -> (items: [StudentSubmission.Feedback], markedSeen: Bool)? {
        guard let token else { return nil }
        do {
            let res = try await APIClient.shared.studentSubmission(id: submissionId, bearerToken: token)
            let items = res.feedback ?? []
            let unseen = items.filter { $0.seen_at == nil }
            await withTaskGroup(of: Void.self) { group in
                for item in unseen {
                    group.addTask {
                        try? await APIClient.shared.markFeedbackSeen(id: item.id, bearerToken: token)
                    }
                }
            }
            return (items, !unseen.isEmpty)
        } catch {
            log.warning("feedback load failed: \(String(describing: error), privacy: .public)")
            return nil
        }
    }
}

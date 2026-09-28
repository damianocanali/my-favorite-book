// Sends a copy of a class (student) account's check-in to their teacher, and
// carries a class account's help asks. Mirrors src/lib/schoolShare.js.
//
// Owner decision D7: teachers see class accounts' check-ins, and the child is
// always told ("Your teacher can see this" on the sheet). A family account's
// check-ins must NEVER leave the device — CheckInStore stays network-free, and
// this file takes finished feeling/need values rather than the store, so the
// exception lives here and only here. CheckInHost is the only caller.
//
// Every function is gated on AuthStore.isStudent, which reads app_metadata
// only (server-set, not user-writable): trusting user_metadata would let a
// family account talk its way into sending a child's feelings somewhere.

import Foundation
import os

@MainActor
enum SchoolShare {
    private static let log = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "MyBookLab", category: "SchoolShare"
    )

    /// The one gate. A no-op for everyone else, including signed-out.
    static var shouldShare: Bool { AuthStore.shared.isStudent }

    /// Fire-and-forget copy of a finished check-in. Failures are logged and
    /// never shown: a child should not see an error for telling us how they
    /// feel. `need` is nil when they closed the sheet after the feeling.
    static func shareCheckIn(feeling: Feeling, need: Need?) {
        guard shouldShare, let token = AuthStore.shared.accessToken else { return }
        Task {
            do {
                try await APIClient.shared.schoolCheckIn(
                    feeling: feeling.rawValue, need: need?.rawValue, bearerToken: token
                )
            } catch {
                log.warning("teacher copy of check-in failed: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    enum HelpKind: String {
        case book, grownup
    }

    /// What a help ask came back with. Never an error: every failure is
    /// `ok: false`, so "I need a grown-up" can always show a real end state.
    struct HelpResult: Equatable, Sendable {
        let ok: Bool
        var id: String? = nil
        var inHours = false
    }

    static func askForHelp(_ kind: HelpKind) async -> HelpResult {
        guard shouldShare, let token = AuthStore.shared.accessToken else {
            return HelpResult(ok: false)
        }
        do {
            let res = try await APIClient.shared.schoolHelp(kind: kind.rawValue, bearerToken: token)
            return HelpResult(ok: true, id: res.id, inHours: res.in_hours)
        } catch {
            log.warning("help ask (\(kind.rawValue, privacy: .public)) failed: \(error.localizedDescription, privacy: .public)")
            return HelpResult(ok: false)
        }
    }

    /// Whether the teacher has seen an open help ask. Any failure reads as
    /// "not yet", so polling simply tries again next time.
    static func helpSeen(id: String) async -> (seen: Bool, teacherName: String?) {
        guard shouldShare, let token = AuthStore.shared.accessToken else { return (false, nil) }
        do {
            let res = try await APIClient.shared.schoolHelpStatus(id: id, bearerToken: token)
            let name = res.teacher_name?.trimmingCharacters(in: .whitespacesAndNewlines)
            return (res.seen, (name?.isEmpty ?? true) ? nil : name)
        } catch {
            return (false, nil)
        }
    }
}

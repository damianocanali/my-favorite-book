// The teacher area's JSON shapes and the pure rules behind it. Mirrors
// api/school/{dashboard,classes,student-books,student-checkins,assignments,
// submissions,feedback,notifications,notification-settings}.js and the web's
// pure helpers (src/lib/{dashboardHelp,dashboardClass,teacherNotifications}.js,
// src/components/school/{assignmentUi,rosterText}.js, lib/school/license.js),
// so the iPad and the web never disagree about what a screen says.
//
// Every field the server might leave out is optional: a teacher screen must
// degrade, never fail to decode, when the API grows a field or drops one.
import Foundation

// MARK: - Dashboard

struct TeacherClassRef: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String?
}

/// One unseen help ask ("I need a grown-up" / "Help with my book").
struct TeacherHelpItem: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let student_id: String?
    let display_name: String?
    /// "grownup" | "book"
    let kind: String
    let asks: Int?
    let in_hours: Bool?
    let created_at: String?
    let classroom_id: String?
    let class_name: String?

    var isGrownup: Bool { kind == "grownup" }
    var createdDate: Date? { TeacherDates.parse(created_at) }
}

/// GET /api/school/dashboard (no classId): every class plus unseen help.
struct TeacherOverview: Decodable, Sendable {
    let classes: [TeacherClassRef]?
    let help: [TeacherHelpItem]?
}

struct TeacherLicense: Decodable, Hashable, Sendable {
    let status: String?
    let expires_at: String?
    let image_allowance: Int?
    let images_used: Int?
    // Stage 4: seats and plan state for the iPad's plan card. Never a price
    // (App Store 3.1.3); nil from an older server.
    var seats: Int? = nil
    var pending_seats: Int? = nil
    var cancel_at_period_end: Bool? = nil
    var school_plan_id: String? = nil
}

struct TeacherCheckin: Decodable, Hashable, Sendable {
    let feeling: String
    let need: String?
    let created_at: String?
}

struct TeacherDashboardStudent: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let display_name: String
    let avatar_emoji: String?
    let avatar_url: String?
    let locked: Bool?
    let last_sign_in_at: String?
    let books_count: Int?
    let last_book_edited_at: String?
    let images_today: Int?
    let checkins_7d: [TeacherCheckin]?
    let inactive_7d: Bool?
    /// assignment id -> "handed_in" | "late" | "not_started" | "revising"
    let assignments: [String: String]?
}

struct TeacherDashboardAssignment: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let status: String
    let due_at: String?
    /// nil on an older server: treated as allowing late work.
    var allow_late: Bool? = nil
}

/// GET /api/school/dashboard?classId=
struct TeacherClassDashboard: Decodable, Sendable {
    struct ClassInfo: Decodable, Sendable {
        let id: String
        let name: String?
        let license: TeacherLicense?
        let student_count: Int?
    }
    struct Summary: Decodable, Sendable {
        let active_this_week: Int?
        let total_students: Int?
        let books_total: Int?
        let books_edited_this_week: Int?
        let images_used: Int?
        let image_allowance: Int?
    }
    let `class`: ClassInfo
    let summary: Summary
    let students: [TeacherDashboardStudent]
    let help: [TeacherHelpItem]?
    let assignments: [TeacherDashboardAssignment]?

    /// The column the roster tracks: the newest still-open assignment, not
    /// assignments[0] (which may be a closed one), same as the web.
    var latestOpenAssignment: TeacherDashboardAssignment? {
        assignments?.first { $0.status == "published" }
    }
}

// MARK: - Classes

/// One row of GET /api/school/classes (and the `class` of POST/PATCH).
struct TeacherClass: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String?
    let code: String?
    let license: TeacherLicense?
    let student_count: Int?
    /// "en" | "it"
    let locale: String?
    let sign_in_open: Bool?
    /// The class's check-ins switch (review §7.28); nil from an older server = on.
    let checkins_enabled: Bool?
    /// IANA zone the school hours are read in.
    let timezone: String?
    /// ISO weekday ("1" = Monday … "7" = Sunday) -> ["HH:MM", "HH:MM"].
    let school_hours: [String: [String]]?
}

struct TeacherClassesResponse: Decodable, Sendable {
    struct Verification: Decodable, Sendable {
        let verified: Bool?
    }
    let classes: [TeacherClass]?
    /// Stage 4: an unverified teacher can look around but can't create
    /// classes or add students. nil from an older server = verified.
    let verification: Verification?
}

struct TeacherClassResponse: Decodable, Sendable {
    let `class`: TeacherClass?
    /// POST only: the class was made, but this teacher's free trials are
    /// used up, so it has no license.
    let trial_used_up: Bool?
}

// MARK: - Roster (api/school/students.js)

/// GET /api/school/students — never a secret, only these public fields.
struct TeacherRosterStudent: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    var display_name: String
    let avatar_emoji: String?
    let avatar_url: String?
    /// "active" | "removed"
    let status: String?
    let hard_locked: Bool?
    let locked: Bool?
    let last_sign_in_at: String?

    var isActive: Bool { (status ?? "active") == "active" }
    var needsUnlock: Bool { locked == true || hard_locked == true }
}

struct TeacherRosterResponse: Decodable, Sendable {
    let students: [TeacherRosterStudent]?
}

/// A child whose picture password was just made (added, or reset). The only
/// moment the three picture ids exist outside the server's hash: shown and
/// printed now, then dropped — they can't be fetched again.
struct TeacherNewPictures: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let display_name: String
    let avatar_emoji: String?
    let pictures: [String]
}

struct TeacherAddStudentsResponse: Decodable, Sendable {
    struct Skipped: Decodable, Hashable, Sendable {
        let name: String
        let code: String?
    }
    let created: [TeacherNewPictures]?
    let skipped: [Skipped]?
}

/// A permanent delete (student or class) went through.
struct TeacherDeletedResponse: Decodable, Sendable {
    let deleted: Bool?
    let id: String?
    /// 202: the deletion is under way and finishes on its own.
    let pending: Bool?
}

struct TeacherStudentActionResponse: Decodable, Sendable {
    let student: TeacherRosterStudent?
    /// reset_secret only.
    let pictures: [String]?
}

/// The web's rosterText / cleanName rules, so the iPad sends what the server
/// would keep anyway: split on newlines and commas, trim, collapse spaces,
/// cut to 24 UTF-16 units (JS `.length`), drop blanks and case-insensitive
/// repeats (first spelling wins).
enum TeacherRosterRules {
    /// The typed-name check for a permanent delete — same rule as the
    /// server's lib/school/confirmName.js (case, spacing and Unicode
    /// composition ignored; empty never matches). The server re-checks.
    static func namesMatch(_ typed: String, _ expected: String) -> Bool {
        func norm(_ s: String) -> String {
            s.precomposedStringWithCanonicalMapping
                .split(whereSeparator: \.isWhitespace).joined(separator: " ")
                .lowercased()
        }
        let e = norm(expected)
        return !e.isEmpty && norm(typed) == e
    }

    static let studentNameMax = 24
    static let classNameMax = 60
    static let maxStudents = 35

    static func cleanName(_ raw: String, max: Int = studentNameMax) -> String {
        let collapsed = raw.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
        return TeacherStickers.truncated(collapsed, max: max).trimmingCharacters(in: .whitespaces)
    }

    static func parse(_ text: String) -> [String] {
        var seen = Set<String>()
        var out: [String] = []
        for raw in text.split(whereSeparator: { $0.isNewline || $0 == "," }) {
            let name = cleanName(String(raw))
            guard !name.isEmpty else { continue }
            let key = name.lowercased()
            if seen.insert(key).inserted { out.append(name) }
        }
        return out
    }
}

// MARK: - School hours

/// One weekday's span in the editor. ISO weekday: 1 = Monday … 7 = Sunday.
struct SchoolDayHours: Identifiable, Hashable, Sendable {
    let weekday: Int
    var enabled: Bool
    var start: String
    var end: String
    var id: Int { weekday }

    static let defaultSpan = ("08:00", "15:30")

    /// Server shape -> seven editor rows (a missing day is off, pre-filled
    /// with the default span so turning it on starts somewhere sensible).
    static func rows(from hours: [String: [String]]?) -> [SchoolDayHours] {
        (1...7).map { d in
            if let span = hours?[String(d)], span.count == 2 {
                return SchoolDayHours(weekday: d, enabled: true, start: span[0], end: span[1])
            }
            return SchoolDayHours(weekday: d, enabled: false, start: defaultSpan.0, end: defaultSpan.1)
        }
    }

    /// Editor rows -> server shape; nil when a span is invalid (the same
    /// check as lib/school/hours.js validateSchoolHours: HH:MM, start < end).
    static func payload(_ rows: [SchoolDayHours]) -> [String: [String]]? {
        var out: [String: [String]] = [:]
        for r in rows where r.enabled {
            guard isHHMM(r.start), isHHMM(r.end), r.start < r.end else { return nil }
            out[String(r.weekday)] = [r.start, r.end]
        }
        return out
    }

    static func isHHMM(_ s: String) -> Bool {
        s.range(of: #"^([01]\d|2[0-3]):[0-5]\d$"#, options: .regularExpression) != nil
    }

    /// "08:00" <-> a Date today, for the time pickers.
    static func date(_ hhmm: String) -> Date {
        let parts = hhmm.split(separator: ":").compactMap { Int($0) }
        return Calendar.current.date(bySettingHour: parts.first ?? 8, minute: parts.count > 1 ? parts[1] : 0, second: 0, of: Date()) ?? Date()
    }

    static func hhmm(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}

// MARK: - A student's books and check-ins

struct TeacherStudentBook: Decodable, Identifiable, Hashable, Sendable {
    let book_id: String
    let title: String?
    let updated_at: String?
    let cover: String?
    var id: String { book_id }
}

struct TeacherStudentBooksResponse: Decodable, Sendable {
    let books: [TeacherStudentBook]?
}

struct TeacherStudentBookResponse: Decodable, Sendable {
    let book: Book?
}

struct TeacherStudentCheckinsResponse: Decodable, Sendable {
    let checkins: [TeacherCheckin]?
}

// MARK: - Assignments, hand-ins, feedback

struct TeacherAssignment: Decodable, Identifiable, Hashable, Sendable {
    struct Counts: Decodable, Hashable, Sendable {
        let handed_in: Int?
        let total_students: Int?
    }
    let id: String
    var title: String
    var prompt: String?
    var due_at: String?
    /// "draft" | "published" | "closed"
    var status: String
    var allow_late: Bool?
    let created_at: String?
    var counts: Counts?
    /// "book" | "worksheet" (migration 023); nil reads as a book.
    var kind: String? = nil
    var worksheet: WorksheetDefinition? = nil

    var isWorksheet: Bool { kind == "worksheet" && worksheet != nil }

    /// Delete is offered only while nobody has handed in — mirrors the
    /// server's has_submissions 409, so the button is absent rather than
    /// present-but-always-rejected.
    var canDelete: Bool { (counts?.handed_in ?? 0) == 0 }

    /// draft -> published -> closed; closed -> published (reopen).
    var nextStatuses: [String] {
        switch status {
        case "draft": return ["published"]
        case "published": return ["closed"]
        case "closed": return ["published"]
        default: return []
        }
    }
}

struct TeacherAssignmentsResponse: Decodable, Sendable {
    let assignments: [TeacherAssignment]?
}

struct TeacherAssignmentResponse: Decodable, Sendable {
    let assignment: TeacherAssignment
}

/// One row of the review list: a hand-in, or an active student who hasn't.
struct TeacherSubmissionRow: Decodable, Identifiable, Hashable, Sendable {
    /// nil for a not_started row.
    let submissionId: String?
    let student_id: String
    let display_name: String?
    let avatar_emoji: String?
    /// "handed_in" | "not_started"
    let status: String
    let version: Int?
    let submitted_at: String?
    let late: Bool?
    let book_title: String?
    var feedback_count: Int?
    /// The newest grade's level and the version it was for (migration 022);
    /// `returned`: sent back and not handed in again yet.
    var level: String?
    var graded_version: Int?
    var returned: Bool?

    var id: String { submissionId ?? "student-\(student_id)" }
    var isHandedIn: Bool { status == "handed_in" && submissionId != nil }
    /// Handed in again since the last grade: the teacher hasn't looked yet.
    var hasUngradedVersion: Bool {
        guard let graded_version, let version else { return false }
        return version > graded_version
    }

    enum CodingKeys: String, CodingKey {
        case submissionId = "id"
        case student_id, display_name, avatar_emoji, status, version, submitted_at, late, book_title, feedback_count
        case level, graded_version, returned
    }
}

struct TeacherReviewList: Decodable, Sendable {
    struct Assignment: Decodable, Sendable {
        let id: String
        let title: String
        let status: String?
        let due_at: String?
        let allow_late: Bool?
        var kind: String? = nil
        var worksheet: WorksheetDefinition? = nil

        /// Still open for hand-ins: published, and not past a due date that
        /// refuses late work (same rule as NudgeRules.isOpen and the web).
        func isOpen(now: Date = Date()) -> Bool {
            guard status == "published" else { return false }
            if allow_late == false, let due = TeacherDates.parse(due_at), due < now { return false }
            return true
        }
    }
    let assignment: Assignment
    let submissions: [TeacherSubmissionRow]?
}

struct TeacherFeedback: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let comment: String?
    let sticker: String?
    let created_at: String?
    let seen_at: String?
}

struct TeacherSubmissionDetail: Decodable, Sendable {
    struct Submission: Decodable, Sendable {
        let id: String
        let assignment_id: String?
        let student_id: String?
        let display_name: String?
        let version: Int?
        let submitted_at: String?
        let late: Bool?
        let book_title: String?
        let book_snapshot: Book?
        let returned: Bool?
        /// A worksheet hand-in (migration 023): its answers and the prompts
        /// the child answered.
        var kind: String? = nil
        var answers: [String: String]? = nil
        var worksheet: WorksheetSnapshot? = nil
    }
    let submission: Submission
    var feedback: [TeacherFeedback]
    /// Every graded version, newest first.
    var grades: [SubmissionGrade]?
}

struct TeacherFeedbackResponse: Decodable, Sendable {
    let feedback: TeacherFeedback
}

enum TeacherStickers {
    static let all = ["star", "rocket", "heart", "wow", "keep_going", "rainbow"]
    static let commentMax = 500
    static let titleMax = 80
    static let promptMax = 1000

    /// Cut to at most `max` UTF-16 code units — what the server's JS
    /// `.length` counts — without splitting a character (an emoji is 2+).
    static func truncated(_ s: String, max: Int) -> String {
        guard s.utf16.count > max else { return s }
        var out = ""
        var used = 0
        for ch in s {
            let n = String(ch).utf16.count
            if used + n > max { break }
            out.append(ch)
            used += n
        }
        return out
    }

    static func emoji(_ id: String) -> String {
        [
            "star": "⭐", "rocket": "🚀", "heart": "❤️",
            "wow": "😮", "keep_going": "💪", "rainbow": "🌈",
        ][id] ?? "⭐"
    }
}

/// The hand-in chip a row shows. The dashboard's per-student map is
/// already the flattened string; a review row is {status, late}. Both land
/// here so the two surfaces never disagree (web: assignmentUi.handInChipKey).
enum HandInState: String, Sendable {
    /// revising: sent back to revise (migration 022), not handed in again
    /// yet — dashboard only, and only while the assignment is still open
    /// (api/school/dashboard.js decides); still "not handed in" for nudges.
    case handedIn = "handed_in", late, notStarted = "not_started", revising

    init(dashboardValue: String?) {
        self = HandInState(rawValue: dashboardValue ?? "") ?? .notStarted
    }

    init(row: TeacherSubmissionRow) {
        if !row.isHandedIn { self = .notStarted } else { self = row.late == true ? .late : .handedIn }
    }
}

// MARK: - Notifications (the bell) and settings

struct TeacherNotification: Decodable, Identifiable, Hashable, Sendable {
    struct Payload: Decodable, Hashable, Sendable {
        let student_id: String?
        let student_name: String?
        let class_name: String?
        let assignment_id: String?
        let assignment_title: String?
        /// Help asks only: whether it arrived inside the class's school
        /// hours. false = only the bell got it (no push was sent); nil =
        /// unknown or not a help ask.
        let in_hours: Bool?
    }
    let id: String
    let classroom_id: String?
    /// hand_in | hand_in_late | resubmit | all_handed_in | help_book | help_grownup
    let kind: String
    let payload: Payload?
    let created_at: String?
    var read_at: String?

    static let reviewKinds: Set<String> = ["hand_in", "hand_in_late", "resubmit", "all_handed_in"]

    /// Help asks go to the dashboard; hand-ins to that assignment's review.
    /// Same rule (and the same id check) as the web's notificationHref.
    var route: TeacherRoute {
        if Self.reviewKinds.contains(kind),
           let cid = classroom_id, TeacherRoute.isSafeId(cid),
           let aid = payload?.assignment_id, TeacherRoute.isSafeId(aid) {
            return .review(classId: cid, assignmentId: aid)
        }
        return .dashboard
    }
}

struct TeacherNotificationsResponse: Decodable, Sendable {
    let notifications: [TeacherNotification]?
    let unread: Int?
}

struct TeacherNotificationSettings: Codable, Equatable, Sendable {
    /// "daily" | "weekly" | "off"
    var summary: String
    var push_urgent: Bool
    var email_urgent: Bool
}

// MARK: - Routing

/// Where a bell row or a push tap lands inside the teacher area.
enum TeacherRoute: Equatable, Sendable {
    case dashboard
    case classDetail(classId: String)
    case review(classId: String, assignmentId: String)

    static func isSafeId(_ s: String) -> Bool {
        !s.isEmpty && s.count <= 64
            && s.unicodeScalars.allSatisfy { CharacterSet.alphanumerics.contains($0) || $0 == "-" }
            && s.allSatisfy(\.isASCII)
    }

    /// A push payload's `url` is a same-origin web path: /teacher?help=… or
    /// /teacher/class/<id>?review=<assignmentId>. Anything else — another
    /// host, another path, an unsafe id — is ignored (nil), never followed.
    static func from(pushURL raw: String) -> TeacherRoute? {
        guard let comps = URLComponents(string: raw) else { return nil }
        // Same-origin only: a relative path, or an absolute URL on our own host.
        if comps.scheme != nil || comps.host != nil {
            guard comps.scheme == "https",
                  comps.host == AppConfig.shared.apiBase.host || comps.host == "mybooklab.app"
            else { return nil }
        }
        let parts = comps.path.split(separator: "/").map(String.init)
        if parts == ["teacher"] { return .dashboard }
        if parts.count == 3, parts[0] == "teacher", parts[1] == "class", isSafeId(parts[2]),
           let review = comps.queryItems?.first(where: { $0.name == "review" })?.value,
           isSafeId(review) {
            return .review(classId: parts[2], assignmentId: review)
        }
        return nil
    }
}

// MARK: - License badge (no prices, ever)

enum LicenseBadgeState: Equatable {
    case trialDays(Int), trialEnded, active, comped, expired, none

    var isWarning: Bool { self == .trialEnded || self == .expired }
    var isGood: Bool {
        switch self {
        case .trialDays, .active, .comped: return true
        default: return false
        }
    }

    /// LicenseBadge.jsx + rosterText.trialDaysLeft + license.isLicenseUsable.
    init(_ license: TeacherLicense?, now: Date = Date()) {
        guard let license else { self = .none; return }
        let expires = TeacherDates.parse(license.expires_at)
        switch license.status {
        case "trial":
            let ms = (expires ?? now).timeIntervalSince(now)
            let days = max(0, Int((ms / 86_400).rounded(.up)))
            self = days > 0 ? .trialDays(days) : .trialEnded
        case "comped":
            self = .comped
        case "grace":
            self = .active
        case "pending_payment":
            // An invoice-billed school plan whose invoice is open: usable
            // until its due date (lib/school/license.js). Shown as active —
            // the iPad never talks about payment.
            self = (expires.map { $0 > now } ?? false) ? .active : .expired
        case "active":
            self = (expires.map { $0 > now } ?? false) ? .active : .expired
        default:
            self = .expired
        }
    }
}

// MARK: - Help ordering

enum TeacherHelpRules {
    /// Grown-up asks first, then newest first — api/school/dashboard.js's
    /// sortHelp, used to put a failed "Seen" back where it belongs.
    static func sort(_ rows: [TeacherHelpItem]) -> [TeacherHelpItem] {
        rows.sorted { a, b in
            if a.kind != b.kind { return a.isGrownup }
            return (a.createdDate ?? .distantPast) > (b.createdDate ?? .distantPast)
        }
    }

    /// How long a just-Seen id stays out of poll results (web: SEEN_SUPPRESS_MS),
    /// so a poll that was already in flight can't resurrect it.
    static let seenSuppress: TimeInterval = 60

    /// The remembered class if it is still one of this teacher's, else the
    /// first (web: dashboardClass.pickClassId).
    static func pickClassId(_ classes: [TeacherClassRef], remembered: String?) -> String? {
        guard let first = classes.first else { return nil }
        if let remembered, classes.contains(where: { $0.id == remembered }) { return remembered }
        return first.id
    }
}

// MARK: - Dates

enum TeacherDates {
    /// Postgres timestamps come back with or without fractional seconds.
    static func parse(_ raw: String?) -> Date? {
        StudentAssignment.parseDate(raw)
    }

    static func iso(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: date)
    }

    /// "3 hours ago" / "yesterday", in the app's UI language.
    static func relative(_ raw: String?, now: Date = Date()) -> String? {
        guard let date = parse(raw) else { return nil }
        let f = RelativeDateTimeFormatter()
        f.locale = AppLanguage.locale
        f.dateTimeStyle = .named
        f.unitsStyle = .full
        return f.localizedString(for: date, relativeTo: now)
    }

    /// Medium date + short time, e.g. a due date.
    static func dueString(_ raw: String?) -> String? {
        guard let date = parse(raw) else { return nil }
        return date.formatted(
            .dateTime.day().month(.abbreviated).year().hour().minute()
                .locale(AppLanguage.locale)
        )
    }
}

// MARK: - Nudges (api/school/nudges.js, migration 021)

/// The latest nudge a teacher sent one student (GET ?classId=).
struct TeacherNudge: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let student_id: String
    let created_at: String?
    let seen_at: String?
    let preset: String?
    let message: String?
}

/// POST result: who got it, and who was skipped (daily_cap, not_found, ...).
struct TeacherNudgeSendResult: Decodable, Sendable {
    struct Sent: Decodable, Sendable { let student_id: String; let id: String? }
    struct Skipped: Decodable, Sendable { let student_id: String; let code: String }
    let sent: [Sent]
    let skipped: [Skipped]
}

/// A class account's current unread nudge (GET with no classId).
struct StudentNudge: Decodable, Identifiable, Hashable, Sendable {
    struct LinkedAssignment: Decodable, Hashable, Sendable { let id: String; let title: String }
    let id: String
    let teacher_name: String?
    let preset: String?
    let message: String?
    let created_at: String?
    let assignment: LinkedAssignment?
}

/// Shared limits and the "who might need a nudge" suggestion, mirrored from
/// lib/school/nudges.js and src/components/school/nudgeUi.js.
enum NudgeRules {
    static let presets = ["story_waiting", "one_more_page", "cant_wait", "hand_in"]
    /// UTF-16 units, like the server's JS `.length`.
    static let messageMax = 140
    static let maxStudents = 35
    /// "No book edited in the last 3 days."
    static let quietDays: TimeInterval = 3 * 24 * 60 * 60

    enum Reason: Hashable, Sendable { case quiet, notHandedIn }

    /// Why a student is pre-ticked, if at all: (a) no book edited in the
    /// last 3 days (never edited counts), (b) a published assignment still
    /// open for them and not handed in.
    static func reasons(for s: TeacherDashboardStudent, assignments: [TeacherDashboardAssignment],
                        now: Date = Date()) -> [Reason] {
        var out: [Reason] = []
        if let last = TeacherDates.parse(s.last_book_edited_at) {
            if now.timeIntervalSince(last) >= quietDays { out.append(.quiet) }
        } else {
            out.append(.quiet)
        }
        if !openNotHandedIn(s, assignments: assignments, now: now).isEmpty {
            out.append(.notHandedIn)
        }
        return out
    }

    /// Open = published and not closed by a due date that refuses late
    /// work. Same rule as the API, the RPC and the web (nudgeUi.isOpenAssignment).
    static func isOpen(_ a: TeacherDashboardAssignment, now: Date = Date()) -> Bool {
        guard a.status == "published" else { return false }
        if a.allow_late == false, let due = TeacherDates.parse(a.due_at), due < now { return false }
        return true
    }

    static func open(_ assignments: [TeacherDashboardAssignment], now: Date = Date()) -> [TeacherDashboardAssignment] {
        assignments.filter { isOpen($0, now: now) }
    }

    /// The open assignments a student has not handed in yet.
    static func openNotHandedIn(_ s: TeacherDashboardStudent, assignments: [TeacherDashboardAssignment],
                                now: Date = Date()) -> [TeacherDashboardAssignment] {
        // "revising" (sent back to revise) is not done either.
        open(assignments, now: now).filter {
            let v = s.assignments?[$0.id] ?? "not_started"
            return v == "not_started" || v == "revising"
        }
    }
}

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
    /// assignment id -> "handed_in" | "late" | "not_started"
    let assignments: [String: String]?
}

struct TeacherDashboardAssignment: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let title: String
    let status: String
    let due_at: String?
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

/// One row of GET /api/school/classes.
struct TeacherClass: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String?
    let code: String?
    let license: TeacherLicense?
    let student_count: Int?
}

struct TeacherClassesResponse: Decodable, Sendable {
    let classes: [TeacherClass]?
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

    var id: String { submissionId ?? "student-\(student_id)" }
    var isHandedIn: Bool { status == "handed_in" && submissionId != nil }

    enum CodingKeys: String, CodingKey {
        case submissionId = "id"
        case student_id, display_name, avatar_emoji, status, version, submitted_at, late, book_title, feedback_count
    }
}

struct TeacherReviewList: Decodable, Sendable {
    struct Assignment: Decodable, Sendable {
        let id: String
        let title: String
        let status: String?
        let due_at: String?
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
    }
    let submission: Submission
    var feedback: [TeacherFeedback]
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
    case handedIn = "handed_in", late, notStarted = "not_started"

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
        f.locale = Locale(identifier: AppLanguage.uiLanguage)
        f.dateTimeStyle = .named
        f.unitsStyle = .full
        return f.localizedString(for: date, relativeTo: now)
    }

    /// Medium date + short time, e.g. a due date.
    static func dueString(_ raw: String?) -> String? {
        guard let date = parse(raw) else { return nil }
        return date.formatted(
            .dateTime.day().month(.abbreviated).year().hour().minute()
                .locale(Locale(identifier: AppLanguage.uiLanguage))
        )
    }
}

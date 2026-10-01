// Grading with tips (migration 022, api/school/grades.js): a child-facing
// level, 0–3 tips, and "send back to revise". Swift copy of
// lib/school/grading.js — the same four levels and the same tip keys in the
// same order. tests/grading-tips.test.js fails if the key lists drift.
import Foundation

enum GradingRules {
    static let levels = ["getting_started", "growing", "got_it", "wow"]

    /// The tip library by skill, in the order the teacher's picker shows it.
    static let skills: [(id: String, tips: [String])] = [
        ("ideas", ["more_detail", "feelings", "senses", "what_next", "problem", "why", "own_idea"]),
        ("order", ["beginning", "middle", "ending", "time_words", "one_idea_per_page", "check_order", "new_line"]),
        ("words", ["strong_verbs", "describing", "repeated", "dialogue", "new_word", "said", "sound_words"]),
        ("spelling", ["capitals", "end_marks", "names", "read_aloud", "commas", "quotation_marks", "spaces"]),
    ]

    /// "ideas.more_detail", ... — what is stored and sent.
    static var tipKeys: [String] { skills.flatMap { s in s.tips.map { "\(s.id).\($0)" } } }

    static let tipsMax = 3
    /// UTF-16 units, like the server's JS `.length`.
    static let tipTextMax = 140

    /// A growing plant, then a star: friendly, never a score.
    static func emoji(_ level: String?) -> String {
        switch level {
        case "getting_started": "🌱"
        case "growing": "🌿"
        case "got_it": "🌳"
        case "wow": "🌟"
        default: "🌱"
        }
    }
}

/// One tip: a library key or the teacher's own words. Encodes as exactly
/// {"key": ...} or {"text": ...} (nil fields are omitted).
struct GradeTip: Codable, Hashable, Sendable {
    let key: String?
    let text: String?

    static func library(_ key: String) -> GradeTip { GradeTip(key: key, text: nil) }
    static func custom(_ text: String) -> GradeTip { GradeTip(key: nil, text: text) }
}

/// One graded version of a hand-in.
struct SubmissionGrade: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let version: Int
    let level: String
    let tips: [GradeTip]?
    let returned: Bool?
    let created_at: String?
    let updated_at: String?
    let seen_at: String?
}

/// POST /api/school/grades (teacher).
struct TeacherGradeResult: Decodable, Sendable {
    let grade: SubmissionGrade
    let feedback: TeacherFeedback?
}

/// GET /api/school/grades?classId&studentId: one child's levels over time.
struct TeacherStudentGrade: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let version: Int
    let level: String
    let returned: Bool?
    let updated_at: String?
    let submission_id: String?
    let assignment_id: String?
    let assignment_title: String?
    let current_version: Int?
}

struct TeacherStudentGradesResponse: Decodable, Sendable {
    let grades: [TeacherStudentGrade]?
}

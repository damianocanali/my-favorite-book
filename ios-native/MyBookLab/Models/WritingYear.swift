// "My Writing Year" (spec 2026-10-01 §3): the shapes api/school/writing-year.js
// returns, for the teacher's Writing Year screen and a class account's card.
// Property names follow the JSON (snake_case), like TeacherModels.swift.
import Foundation

enum WritingYearRules {
    static let aboutMax = 200
    static let noteMax = 600
    static let coverTitleMax = 60
    static let aboutFields = ["about_favorite", "about_best_sentence", "about_learned"]
    /// The happy path of a class print request, in order.
    static let statusSteps = ["requested", "approved", "submitted", "in_production", "shipped"]
    /// The address fields, in form order; state and line 2 are optional.
    static let addressFields = ["school_name", "contact_name", "contact_email", "contact_phone",
                                "address_line1", "address_line2", "city", "state_code",
                                "postal_code", "country_code"]
    static let optionalAddressFields: Set<String> = ["address_line2", "state_code"]

    /// "2026-27" → "2026–27".
    static func yearLabel(_ year: String?) -> String { (year ?? "").replacingOccurrences(of: "-", with: "–") }

    /// The request that still counts for this school year, if any.
    static func liveRequest(_ requests: [WYPrintRequest], year: String) -> WYPrintRequest? {
        requests.first { $0.school_year == year && $0.status != "canceled" }
    }

    /// `list` with the element at `from` moved to `to`.
    static func move<T>(_ list: [T], from: Int, to: Int) -> [T] {
        guard from != to, list.indices.contains(from), list.indices.contains(to) else { return list }
        var next = list
        let x = next.remove(at: from)
        next.insert(x, at: to)
        return next
    }
}

struct WYChildSummary: Decodable, Identifiable, Hashable {
    let student_id: String
    let display_name: String
    let avatar_emoji: String?
    let item_count: Int
    let pending_count: Int
    let about_me_done: Bool
    let has_note: Bool
    var id: String { student_id }
}

struct WYTracking: Decodable, Hashable {
    let url: String?
    let number: String?
    let carrier: String?
}

struct WYPrintRequest: Decodable, Identifiable, Hashable {
    let id: String
    let status: String
    let school_year: String
    let children_count: Int?
    let excluded_count: Int?
    let tracking: WYTracking?
}

struct WYOverview: Decodable {
    let school_year: String
    let can_print: Bool
    let children: [WYChildSummary]
    let requests: [WYPrintRequest]
}

struct WYItem: Decodable, Identifiable, Hashable {
    let id: String
    let kind: String
    let title: String?
    let position: Int
    let approved: Bool
    let added_by: String?
    let submission_id: String?
    let book_id: String?
}

struct WYMeta: Decodable {
    let about_favorite: String?
    let about_best_sentence: String?
    let about_learned: String?
    let teacher_note: String?
    let cover_title: String?
}

struct WYChildDetail: Decodable {
    let items: [WYItem]
    let meta: WYMeta
}

/// A built book, as it will print (lib/school/writingYear.js buildChildBook).
struct WYBook: Decodable {
    struct Page: Decodable, Hashable { let text: String; let image: String? }
    struct Box: Decodable, Hashable { let prompt: String; let answer: String }
    struct Piece: Decodable, Hashable {
        let kind: String
        let title: String?
        let pages: [Page]?
        let boxes: [Box]?
    }
    struct About: Decodable {
        let about_favorite: String?
        let about_best_sentence: String?
        let about_learned: String?
    }
    let name: String
    let avatar_emoji: String?
    let class_name: String?
    let lang: String?
    let year: String?
    let cover_title: String?
    let pieces: [Piece]
    let about: About?
    let teacher_note: String?
}

struct WYPrintSummary: Decodable {
    struct Child: Decodable, Hashable { let student_id: String; let display_name: String }
    let can_print: Bool
    let school_year: String
    let included: [Child]
    let excluded: [Child]
}

struct WYStudentView: Decodable {
    struct Suggestable: Decodable, Identifiable, Hashable {
        let kind: String
        let submission_id: String?
        let book_id: String?
        let title: String?
        var id: String { submission_id ?? book_id ?? UUID().uuidString }
    }
    struct About: Codable, Equatable {
        var about_favorite: String
        var about_best_sentence: String
        var about_learned: String
    }
    let school_year: String
    let items: [WYItem]
    let about: About
    let suggestable: [Suggestable]
}

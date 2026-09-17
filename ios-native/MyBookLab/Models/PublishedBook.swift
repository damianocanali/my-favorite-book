// A book that's been published to the public Gallery (the
// `published_books` table). The list endpoint returns a lightweight
// view (cover info + counts); the detail endpoint returns the full
// book payload that we then render in BookDetailView via the same
// Book model.
import Foundation

struct PublishedBookSummary: Codable, Identifiable, Hashable, Sendable {
    var slug: String
    var title: String
    var authorName: String
    var authorAge: Int?
    var coverEmoji: String?
    var coverColor: String?
    var publishedAt: String?
    var featured: Bool?
    var reactionCounts: [String: Int]?
    /// Author's user id — returned by the recent listing, absent from
    /// the featured one. Needed to block an author.
    var userId: String?

    var id: String { slug }

    enum CodingKeys: String, CodingKey {
        case slug, title, featured
        case authorName = "author_name"
        case authorAge = "author_age"
        case coverEmoji = "cover_emoji"
        case coverColor = "cover_color"
        case publishedAt = "published_at"
        case reactionCounts = "reaction_counts"
        case userId = "user_id"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.slug = (try? c.decode(String.self, forKey: .slug)) ?? UUID().uuidString
        self.title = (try? c.decode(String.self, forKey: .title)) ?? "Untitled"
        self.authorName = (try? c.decode(String.self, forKey: .authorName)) ?? ""
        self.authorAge = try? c.decode(Int.self, forKey: .authorAge)
        self.coverEmoji = try? c.decode(String.self, forKey: .coverEmoji)
        self.coverColor = try? c.decode(String.self, forKey: .coverColor)
        self.publishedAt = try? c.decode(String.self, forKey: .publishedAt)
        self.featured = try? c.decode(Bool.self, forKey: .featured)
        self.reactionCounts = try? c.decode([String: Int].self, forKey: .reactionCounts)
        self.userId = try? c.decode(String.self, forKey: .userId)
    }
}

// MARK: - Reporting (App Store Guideline 1.2)

struct ReportBookRequest: Codable, Sendable {
    var slug: String
    var reason: String
    var details: String?
}

struct BlockAuthorRequest: Codable, Sendable {
    var action: String
    var userId: String
}

struct ReportBookResponse: Codable, Sendable {
    var success: Bool?
    /// True when this report pushed the book over the auto-hide threshold.
    var hidden: Bool?
    var blocked: Bool?
}

/// The reasons offered in the report sheet. Values must match the
/// REASONS set in api/report-book.js.
enum ReportReason: String, CaseIterable, Identifiable, Sendable {
    case inappropriate
    case scary
    case mean
    case personalInfo = "personal-info"
    case copyright
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .inappropriate: return "Not okay for kids"
        case .scary: return "Too scary"
        case .mean: return "Mean or bullying"
        case .personalInfo: return "Shares private information"
        case .copyright: return "Copies someone else's work"
        case .other: return "Something else"
        }
    }
}

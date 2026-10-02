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
    /// An opaque, server-sealed handle for the author (never their account
    /// id — api/publish-book.js, lib/authorRef.js). Sent back to block them.
    /// Older servers put the raw id in `user_id`; either decodes here.
    var authorRef: String?
    /// The server's answer to "is this the signed-in reader's own book?".
    var isOwner: Bool?

    var id: String { slug }

    enum CodingKeys: String, CodingKey {
        case slug, title, featured
        case authorName = "author_name"
        case authorAge = "author_age"
        case coverEmoji = "cover_emoji"
        case coverColor = "cover_color"
        case publishedAt = "published_at"
        case reactionCounts = "reaction_counts"
        case authorRef = "author_ref"
        case legacyUserId = "user_id"
        case isOwner = "is_owner"
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
        self.authorRef = (try? c.decode(String.self, forKey: .authorRef)) ?? (try? c.decode(String.self, forKey: .legacyUserId))
        self.isOwner = try? c.decode(Bool.self, forKey: .isOwner)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(slug, forKey: .slug)
        try c.encode(title, forKey: .title)
        try c.encode(authorName, forKey: .authorName)
        try c.encodeIfPresent(authorAge, forKey: .authorAge)
        try c.encodeIfPresent(coverEmoji, forKey: .coverEmoji)
        try c.encodeIfPresent(coverColor, forKey: .coverColor)
        try c.encodeIfPresent(publishedAt, forKey: .publishedAt)
        try c.encodeIfPresent(featured, forKey: .featured)
        try c.encodeIfPresent(reactionCounts, forKey: .reactionCounts)
        try c.encodeIfPresent(authorRef, forKey: .authorRef)
        try c.encodeIfPresent(isOwner, forKey: .isOwner)
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
    var authorRef: String
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

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

    var id: String { slug }

    enum CodingKeys: String, CodingKey {
        case slug, title, featured
        case authorName = "author_name"
        case authorAge = "author_age"
        case coverEmoji = "cover_emoji"
        case coverColor = "cover_color"
        case publishedAt = "published_at"
        case reactionCounts = "reaction_counts"
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
    }
}

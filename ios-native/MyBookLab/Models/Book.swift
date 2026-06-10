// Models mirror the JSON shape stored in Supabase user_books.book_data
// — the canonical schema the web app produces. Because that schema has
// evolved over time (some old books are missing `setting`, some have
// integer ids that snuck through, some have null `text` on a page),
// we hand-write decoders that tolerate every field being optional or
// missing, and fall back to safe defaults. One malformed book on the
// shelf should never block the rest from loading.
import Foundation

struct Book: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var title: String
    var authorName: String
    var authorAge: Int?
    var authorAvatar: String?
    var createdAt: String
    var updatedAt: String
    var colors: BookColors?
    var coverImage: String?
    var characters: [BookCharacter]
    var setting: BookSetting?
    var pages: [BookPage]

    init(
        id: String,
        title: String,
        authorName: String,
        authorAge: Int? = nil,
        authorAvatar: String? = nil,
        createdAt: String,
        updatedAt: String,
        colors: BookColors? = nil,
        coverImage: String? = nil,
        characters: [BookCharacter] = [],
        setting: BookSetting? = nil,
        pages: [BookPage] = []
    ) {
        self.id = id
        self.title = title
        self.authorName = authorName
        self.authorAge = authorAge
        self.authorAvatar = authorAvatar
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.colors = colors
        self.coverImage = coverImage
        self.characters = characters
        self.setting = setting
        self.pages = pages
    }

    enum CodingKeys: String, CodingKey {
        case id, title, authorName, authorAge, authorAvatar
        case createdAt, updatedAt, colors, coverImage, characters, setting, pages
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // id may have been written as a string OR an int by old code.
        if let s = try? c.decode(String.self, forKey: .id) {
            self.id = s
        } else if let i = try? c.decode(Int.self, forKey: .id) {
            self.id = String(i)
        } else {
            self.id = UUID().uuidString
        }
        self.title = (try? c.decode(String.self, forKey: .title)) ?? "Untitled"
        self.authorName = (try? c.decode(String.self, forKey: .authorName)) ?? ""
        self.authorAge = try? c.decode(Int.self, forKey: .authorAge)
        self.authorAvatar = try? c.decode(String.self, forKey: .authorAvatar)
        self.createdAt = (try? c.decode(String.self, forKey: .createdAt)) ?? ISO8601DateFormatter().string(from: Date())
        self.updatedAt = (try? c.decode(String.self, forKey: .updatedAt)) ?? self.createdAt
        self.colors = try? c.decode(BookColors.self, forKey: .colors)
        self.coverImage = try? c.decode(String.self, forKey: .coverImage)
        self.characters = (try? c.decode([BookCharacter].self, forKey: .characters)) ?? []
        self.setting = try? c.decode(BookSetting.self, forKey: .setting)
        self.pages = (try? c.decode([BookPage].self, forKey: .pages)) ?? []
    }
}

struct BookColors: Codable, Hashable, Sendable {
    var cover: String?
    var accent: String?
    var text: String?
}

struct BookCharacter: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var name: String
    var emoji: String?
    var description: String?
    /// Optional AI-generated hero portrait (data: URL or remote URL).
    /// Set when the kid creates their hero from a photo or AI style.
    var imageData: String?

    init(id: String, name: String, emoji: String? = nil, description: String? = nil, imageData: String? = nil) {
        self.id = id; self.name = name; self.emoji = emoji
        self.description = description; self.imageData = imageData
    }

    enum CodingKeys: String, CodingKey { case id, name, emoji, description, imageData }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let s = try? c.decode(String.self, forKey: .id) { self.id = s }
        else if let i = try? c.decode(Int.self, forKey: .id) { self.id = String(i) }
        else { self.id = UUID().uuidString }
        self.name = (try? c.decode(String.self, forKey: .name)) ?? "A hero"
        self.emoji = try? c.decode(String.self, forKey: .emoji)
        self.description = try? c.decode(String.self, forKey: .description)
        self.imageData = try? c.decode(String.self, forKey: .imageData)
    }
}

extension BookCharacter {
    /// Description for image-generation prompts that pins the character's
    /// species from their chosen emoji — so a dragon named "Neo" is drawn
    /// as a dragon, not a boy named Neo. Without this the model guesses
    /// from the name and the kid keeps regenerating (wasting credits).
    var imagePromptDescription: String {
        let species = BookCharacter.species(for: emoji)
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let base: String
        switch (species, trimmedName.isEmpty) {
        case let (s?, false): base = "\(s) named \(trimmedName)"
        case let (s?, true):  base = s
        case (nil, false):    base = trimmedName
        case (nil, true):     base = "a friendly character"
        }
        if let d = description?.trimmingCharacters(in: .whitespaces), !d.isEmpty {
            return "\(base), \(d)"
        }
        return base
    }

    static func species(for emoji: String?) -> String? {
        guard let emoji, !emoji.isEmpty else { return nil }
        return emojiSpecies[emoji]
    }

    /// Maps the character-picker emoji set to a plain-language species the
    /// image model understands.
    static let emojiSpecies: [String: String] = [
        // Animals & creatures
        "🦊": "a fox", "🐻": "a bear", "🐰": "a rabbit", "🦄": "a unicorn",
        "🐉": "a dragon", "🦁": "a lion", "🐱": "a cat", "🐶": "a puppy",
        "🐢": "a turtle", "🦉": "an owl", "🐸": "a frog", "🐼": "a panda",
        "🐨": "a koala", "🐯": "a tiger", "🦒": "a giraffe", "🐘": "an elephant",
        "🦓": "a zebra", "🦝": "a raccoon", "🐺": "a wolf", "🦔": "a hedgehog",
        "🐝": "a bee", "🦋": "a butterfly", "🐙": "an octopus", "🦕": "a dinosaur",
        "🐧": "a penguin", "🦜": "a parrot", "🦢": "a swan", "🦩": "a flamingo",
        "🐬": "a dolphin", "🐳": "a whale", "🦈": "a shark", "🐠": "a fish",
        // People & heroes
        "👦": "a young boy", "👧": "a young girl", "🧒": "a child", "👶": "a baby",
        "🧑‍🚀": "an astronaut", "🦸": "a superhero", "🦸‍♀️": "a superhero",
        "🧚": "a fairy", "🧚‍♂️": "a fairy", "🧜‍♀️": "a mermaid", "🧞": "a genie",
        "🧙": "a wizard", "🧙‍♀️": "a witch", "👸": "a princess", "🤴": "a prince",
        "🥷": "a ninja", "🤖": "a robot", "👽": "an alien", "🎅": "Santa Claus",
        "🧝": "an elf",
        // Fun & magical
        "🌟": "a friendly star", "⭐️": "a friendly star", "⭐": "a friendly star",
        "🌈": "a rainbow", "🔮": "a magic crystal ball", "🎈": "a balloon",
        "🚀": "a rocket", "🏰": "a castle", "👑": "a crown", "🍪": "a cookie",
        "🦷": "a tooth", "❄️": "a snowflake", "❄": "a snowflake", "🔥": "a flame",
    ]
}

struct BookSetting: Codable, Hashable, Sendable {
    var id: String?
    var name: String?
    var label: String?
    var emoji: String?
    var description: String?
}

struct BookPage: Codable, Identifiable, Hashable, Sendable {
    var id: Int
    var pageNumber: Int
    var text: String
    var illustrationData: String?

    init(id: Int, pageNumber: Int, text: String, illustrationData: String? = nil) {
        self.id = id; self.pageNumber = pageNumber; self.text = text; self.illustrationData = illustrationData
    }

    enum CodingKeys: String, CodingKey { case id, pageNumber, text, illustrationData }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let i = try? c.decode(Int.self, forKey: .id) { self.id = i }
        else if let s = try? c.decode(String.self, forKey: .id), let parsed = Int(s) { self.id = parsed }
        else { self.id = 0 }
        if let i = try? c.decode(Int.self, forKey: .pageNumber) { self.pageNumber = i }
        else { self.pageNumber = self.id }
        self.text = (try? c.decode(String.self, forKey: .text)) ?? ""
        self.illustrationData = try? c.decode(String.self, forKey: .illustrationData)
    }
}

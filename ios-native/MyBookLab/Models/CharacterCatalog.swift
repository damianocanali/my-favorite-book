// The story wizard's ready-made characters (web: src/data/characters.js —
// same ids, same frozen English prompt text, same EN/IT display copy from
// src/i18n/locales/*/content.json). Keep the two lists in step.
//
// A picked character is saved with its English `promptName` as its name and
// `promptDescription` as its description (exactly what the web stores), so
// the image prompt is always English. What the child SEES comes from the
// catalog by id (`BookCharacter.displayName`), in the app's language —
// never the stored English.
import Foundation

struct CatalogCharacter: Identifiable {
    let id: String
    let emoji: String
    /// FROZEN ENGLISH — image prompt only, never shown.
    let promptName: String
    /// FROZEN ENGLISH — image prompt only, never shown.
    let promptDescription: String
    let name: LocalizedStringResource
    let blurb: LocalizedStringResource

    var bookCharacter: BookCharacter {
        BookCharacter(
            id: id, name: promptName, emoji: emoji, description: promptDescription,
            promptEn: .init(name: promptName, description: promptDescription)
        )
    }
}

enum CharacterCatalog {
    /// A story stars at most this many (web: MAX_CHARACTERS).
    static let maxCharacters = 4
    /// "Create your own" limits (web: CUSTOM_NAME_MAX / CUSTOM_DESCRIPTION_MAX).
    static let customNameMax = 24
    static let customDescriptionMax = 80

    static func entry(id: String) -> CatalogCharacter? { all.first { $0.id == id } }

    // People first (owner feedback: stories kept starring an animal), then
    // heroes and creatures.
    static var all: [CatalogCharacter] { [
        .init(id: "girl", emoji: "👧",
              promptName: "Mia the Brave Girl",
              promptDescription: "A curious young girl who loves big adventures",
              name: AppText("content.characters.girl.name", defaultValue: "Mia the Brave Girl"),
              blurb: AppText("content.characters.girl.description", defaultValue: "A curious girl who loves big adventures")),
        .init(id: "boy", emoji: "👦",
              promptName: "Leo the Helpful Boy",
              promptDescription: "A cheerful young boy who is always ready to help",
              name: AppText("content.characters.boy.name", defaultValue: "Leo the Helpful Boy"),
              blurb: AppText("content.characters.boy.description", defaultValue: "A cheerful boy who is always ready to help")),
        .init(id: "aunt", emoji: "👩",
              promptName: "Aunt Sofia",
              promptDescription: "A kind grown-up aunt who is great at solving problems",
              name: AppText("content.characters.aunt.name", defaultValue: "Aunt Sofia"),
              blurb: AppText("content.characters.aunt.description", defaultValue: "A kind aunt who is great at solving problems")),
        .init(id: "uncle", emoji: "👨",
              promptName: "Uncle Marco",
              promptDescription: "A friendly grown-up uncle who tells the best jokes",
              name: AppText("content.characters.uncle.name", defaultValue: "Uncle Marco"),
              blurb: AppText("content.characters.uncle.description", defaultValue: "A friendly uncle who tells the best jokes")),
        .init(id: "grandma", emoji: "👵",
              promptName: "Grandma Rosa",
              promptDescription: "A cheerful grandmother who knows a story for everything",
              name: AppText("content.characters.grandma.name", defaultValue: "Grandma Rosa"),
              blurb: AppText("content.characters.grandma.description", defaultValue: "A cheerful grandma who knows a story for everything")),
        .init(id: "grandpa", emoji: "👴",
              promptName: "Grandpa Joe",
              promptDescription: "A playful grandfather who builds amazing inventions",
              name: AppText("content.characters.grandpa.name", defaultValue: "Grandpa Joe"),
              blurb: AppText("content.characters.grandpa.description", defaultValue: "A playful grandpa who builds amazing inventions")),
        .init(id: "teacher", emoji: "🧑‍🏫",
              promptName: "Teacher Sam",
              promptDescription: "A friendly teacher who makes every lesson an adventure",
              name: AppText("content.characters.teacher.name", defaultValue: "Teacher Sam"),
              blurb: AppText("content.characters.teacher.description", defaultValue: "A friendly teacher who makes every lesson an adventure")),
        .init(id: "firefighter", emoji: "🧑‍🚒",
              promptName: "Firefighter Alex",
              promptDescription: "A brave firefighter who helps anyone in trouble",
              name: AppText("content.characters.firefighter.name", defaultValue: "Firefighter Alex"),
              blurb: AppText("content.characters.firefighter.description", defaultValue: "A brave firefighter who helps anyone in trouble")),
        .init(id: "doctor", emoji: "🧑‍⚕️",
              promptName: "Dr. Kim",
              promptDescription: "A caring doctor who helps people and animals feel better",
              name: AppText("content.characters.doctor.name", defaultValue: "Dr. Kim"),
              blurb: AppText("content.characters.doctor.description", defaultValue: "A caring doctor who helps people and animals feel better")),
        .init(id: "chef", emoji: "🧑‍🍳",
              promptName: "Chef Nico",
              promptDescription: "A joyful chef who cooks surprising, delicious food",
              name: AppText("content.characters.chef.name", defaultValue: "Chef Nico"),
              blurb: AppText("content.characters.chef.description", defaultValue: "A joyful chef who cooks surprising, delicious food")),
        .init(id: "king", emoji: "🤴",
              promptName: "King Theo",
              promptDescription: "A kind young king who listens to everyone in his kingdom",
              name: AppText("content.characters.king.name", defaultValue: "King Theo"),
              blurb: AppText("content.characters.king.description", defaultValue: "A kind king who listens to everyone in his kingdom")),
        .init(id: "queen", emoji: "🫅",
              promptName: "Queen Amara",
              promptDescription: "A wise queen who is brave, fair and kind",
              name: AppText("content.characters.queen.name", defaultValue: "Queen Amara"),
              blurb: AppText("content.characters.queen.description", defaultValue: "A wise queen who is brave, fair and kind")),
        .init(id: "astronaut", emoji: "👨‍🚀",
              promptName: "Astro the Explorer",
              promptDescription: "A brave space explorer who discovers new planets",
              name: AppText("content.characters.astronaut.name", defaultValue: "Astro the Explorer"),
              blurb: AppText("content.characters.astronaut.description", defaultValue: "A brave space explorer who discovers new planets")),
        .init(id: "princess", emoji: "👸",
              promptName: "Princess Luna",
              promptDescription: "A magical princess who rules the moonlight kingdom",
              name: AppText("content.characters.princess.name", defaultValue: "Princess Luna"),
              blurb: AppText("content.characters.princess.description", defaultValue: "A magical princess who rules the moonlight kingdom")),
        .init(id: "dragon", emoji: "🐉",
              promptName: "Spark the Dragon",
              promptDescription: "A friendly dragon who breathes colorful fire",
              name: AppText("content.characters.dragon.name", defaultValue: "Spark the Dragon"),
              blurb: AppText("content.characters.dragon.description", defaultValue: "A friendly dragon who breathes colorful fire")),
        .init(id: "robot", emoji: "🤖",
              promptName: "Beeper Bot",
              promptDescription: "A clever robot who loves solving puzzles",
              name: AppText("content.characters.robot.name", defaultValue: "Beeper Bot"),
              blurb: AppText("content.characters.robot.description", defaultValue: "A clever robot who loves solving puzzles")),
        .init(id: "pirate", emoji: "🏴‍☠️",
              promptName: "Captain Waves",
              promptDescription: "A fearless pirate sailing the seven seas",
              name: AppText("content.characters.pirate.name", defaultValue: "Captain Waves"),
              blurb: AppText("content.characters.pirate.description", defaultValue: "A fearless pirate sailing the seven seas")),
        .init(id: "unicorn", emoji: "🦄",
              promptName: "Shimmer",
              promptDescription: "A magical unicorn with a rainbow mane",
              name: AppText("content.characters.unicorn.name", defaultValue: "Shimmer"),
              blurb: AppText("content.characters.unicorn.description", defaultValue: "A magical unicorn with a rainbow mane")),
        .init(id: "wizard", emoji: "🧙",
              promptName: "Merlo the Wise",
              promptDescription: "An ancient wizard with powerful spells",
              name: AppText("content.characters.wizard.name", defaultValue: "Merlo the Wise"),
              blurb: AppText("content.characters.wizard.description", defaultValue: "An ancient wizard with powerful spells")),
        .init(id: "fairy", emoji: "🧚",
              promptName: "Twinkle",
              promptDescription: "A tiny fairy who grants wishes",
              name: AppText("content.characters.fairy.name", defaultValue: "Twinkle"),
              blurb: AppText("content.characters.fairy.description", defaultValue: "A tiny fairy who grants wishes")),
        .init(id: "ninja", emoji: "🥷",
              promptName: "Shadow",
              promptDescription: "A stealthy ninja with incredible speed",
              name: AppText("content.characters.ninja.name", defaultValue: "Shadow"),
              blurb: AppText("content.characters.ninja.description", defaultValue: "A stealthy ninja with incredible speed")),
        .init(id: "mermaid", emoji: "🧜‍♀️",
              promptName: "Coral",
              promptDescription: "A mermaid who sings to the ocean creatures",
              name: AppText("content.characters.mermaid.name", defaultValue: "Coral"),
              blurb: AppText("content.characters.mermaid.description", defaultValue: "A mermaid who sings to the ocean creatures")),
        .init(id: "superhero", emoji: "🦸",
              promptName: "Captain Blaze",
              promptDescription: "A superhero with the power of the sun",
              name: AppText("content.characters.superhero.name", defaultValue: "Captain Blaze"),
              blurb: AppText("content.characters.superhero.description", defaultValue: "A superhero with the power of the sun")),
        .init(id: "alien", emoji: "👽",
              promptName: "Zorp",
              promptDescription: "A friendly alien from the Andromeda galaxy",
              name: AppText("content.characters.alien.name", defaultValue: "Zorp"),
              blurb: AppText("content.characters.alien.description", defaultValue: "A friendly alien from the Andromeda galaxy")),
    ] }
}

extension BookCharacter {
    /// What to SHOW: the catalog's name in the app language for a
    /// ready-made character, the child's own words for anything else.
    var displayName: String {
        if custom != true, let entry = CharacterCatalog.entry(id: id) {
            return String(appLocalized: entry.name)
        }
        return name
    }

    /// Same rule as `displayName`, for the longer description.
    var displayDescription: String? {
        if custom != true, let entry = CharacterCatalog.entry(id: id) {
            return String(appLocalized: entry.blurb)
        }
        return description
    }
}

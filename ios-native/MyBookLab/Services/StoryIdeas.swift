// Local story-starter prompts for the shake-for-an-idea feature.
// Kept on-device so ideas are instant, free, and work offline — the
// Story Buddy API ("starters" intent) remains the richer, contextual
// option inside the wizard.
import Foundation

enum StoryIdeas {
    /// The prompt pool, keyed.
    ///
    /// These were a plain `[String]`, which meant thirty sentences of
    /// child-facing copy that no extractor could see and no translator
    /// could reach. Each one is now a keyed `LocalizedStringResource`:
    /// the key is the entry's stable identity, the English text is the
    /// default value the build lifts into the String Catalog.
    static let all: [LocalizedStringResource] = [
        LocalizedStringResource("story.idea.01", defaultValue: "A dragon who is afraid of the dark finds a glowing friend.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.02", defaultValue: "Your sneakers can suddenly jump over houses. Where do you go first?", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.03", defaultValue: "A tiny mouse opens the world's smallest bakery.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.04", defaultValue: "The moon gets lost and knocks on your window for directions.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.05", defaultValue: "A robot learns how to giggle.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.06", defaultValue: "Your pet goldfish becomes the captain of a pirate ship.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.07", defaultValue: "A rainbow falls asleep across your street.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.08", defaultValue: "The letters of the alphabet throw a birthday party.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.09", defaultValue: "A snowman wishes for a warm hug that won't melt him.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.10", defaultValue: "Your crayons sneak out at night to draw on the sky.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.11", defaultValue: "A baby dinosaur hatches in your backyard.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.12", defaultValue: "The school bus grows wings on the way to school.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.13", defaultValue: "A cloud rains lemonade on the town fair.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.14", defaultValue: "Your shadow wants to swap places with you for a day.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.15", defaultValue: "A unicorn loses its sparkle and goes looking for it.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.16", defaultValue: "The library books start whispering their stories at midnight.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.17", defaultValue: "A penguin moves to the jungle and opens an ice-cream stand.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.18", defaultValue: "Your grandma's old key opens a door in a tree.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.19", defaultValue: "A star falls into your soup. Now your spoon can fly.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.20", defaultValue: "The vegetables in the garden form a band.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.21", defaultValue: "A friendly monster is hiding under the bed — and it's scared of YOU.", comment: "Shake-for-an-idea story starter; the shouted YOU is the joke, keep the emphasis"),
        LocalizedStringResource("story.idea.22", defaultValue: "Your bicycle can talk, but only on Tuesdays.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.23", defaultValue: "A whale dreams of seeing the mountains.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.24", defaultValue: "The playground slide is secretly a portal to the clouds.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.25", defaultValue: "A firefly teaches the lighthouse how to blink hello.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.26", defaultValue: "Your mittens are magic: everything you touch turns fuzzy.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.27", defaultValue: "A little ghost just wants to be invited to the sleepover.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.28", defaultValue: "The last cookie in the jar makes a daring escape.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.29", defaultValue: "A turtle enters the city's fastest race.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
        LocalizedStringResource("story.idea.30", defaultValue: "Your treehouse lifts off like a rocket at bedtime.", comment: "Shake-for-an-idea story starter shown to children aged 4-8"),
    ]

    /// A random idea, resolved for display, avoiding an immediate repeat
    /// when reshuffling.
    ///
    /// The pool is keyed but this still hands back a `String`, because
    /// the value lives in `MainTabView`'s `@State` and travels through
    /// `StoryIdeaCard`'s binding — both outside this change's blast
    /// radius. What matters is that the string handed out is already
    /// *resolved through the catalog*, so the card renders Italian on an
    /// Italian device even though it holds a plain `String`.
    ///
    /// Exclusion is the part that would have rotted quietly: the old
    /// `all.filter { $0 != current }` compared display prose, which stops
    /// meaning anything once the prose is translated. It now resolves the
    /// pool once and drops the matching *entry* by index, so the identity
    /// being compared is a position in the keyed pool, not the sentence.
    static func random(excluding current: String? = nil) -> String {
        let resolved = all.map { String(localized: $0) }
        guard let first = resolved.first else { return "" }
        let excluded = current.flatMap { resolved.firstIndex(of: $0) }
        let pool = resolved.indices.filter { $0 != excluded }
        guard let pick = pool.randomElement() else { return first }
        return resolved[pick]
    }
}

// Local story-starter prompts for the shake-for-an-idea feature.
// Kept on-device so ideas are instant, free, and work offline — the
// Story Buddy API ("starters" intent) remains the richer, contextual
// option inside the wizard.
import Foundation

enum StoryIdeas {
    static let all: [String] = [
        "A dragon who is afraid of the dark finds a glowing friend.",
        "Your sneakers can suddenly jump over houses. Where do you go first?",
        "A tiny mouse opens the world's smallest bakery.",
        "The moon gets lost and knocks on your window for directions.",
        "A robot learns how to giggle.",
        "Your pet goldfish becomes the captain of a pirate ship.",
        "A rainbow falls asleep across your street.",
        "The letters of the alphabet throw a birthday party.",
        "A snowman wishes for a warm hug that won't melt him.",
        "Your crayons sneak out at night to draw on the sky.",
        "A baby dinosaur hatches in your backyard.",
        "The school bus grows wings on the way to school.",
        "A cloud rains lemonade on the town fair.",
        "Your shadow wants to swap places with you for a day.",
        "A unicorn loses its sparkle and goes looking for it.",
        "The library books start whispering their stories at midnight.",
        "A penguin moves to the jungle and opens an ice-cream stand.",
        "Your grandma's old key opens a door in a tree.",
        "A star falls into your soup. Now your spoon can fly.",
        "The vegetables in the garden form a band.",
        "A friendly monster is hiding under the bed — and it's scared of YOU.",
        "Your bicycle can talk, but only on Tuesdays.",
        "A whale dreams of seeing the mountains.",
        "The playground slide is secretly a portal to the clouds.",
        "A firefly teaches the lighthouse how to blink hello.",
        "Your mittens are magic: everything you touch turns fuzzy.",
        "A little ghost just wants to be invited to the sleepover.",
        "The last cookie in the jar makes a daring escape.",
        "A turtle enters the city's fastest race.",
        "Your treehouse lifts off like a rocket at bedtime.",
    ]

    /// A random idea, avoiding an immediate repeat when reshuffling.
    static func random(excluding current: String? = nil) -> String {
        let pool = all.filter { $0 != current }
        return pool.randomElement() ?? all[0]
    }
}

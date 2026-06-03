// "Theo and the Star Bear" — the same sample book the web app
// surfaces on /example. Used as the always-available demo on the
// iOS app so signed-out visitors and new accounts can flip through a
// finished story before committing.
//
// Illustration URLs point at the live web app's /sample-book/*.png
// assets so we don't have to bundle ~2 MB of images in the native
// binary just for the demo.
import Foundation

enum SampleBook {
    static let book: Book = Book(
        id: "sample-theo-and-the-star-bear",
        title: "Theo and the Star Bear",
        authorName: "Theo",
        authorAge: 7,
        authorAvatar: "https://mybooklab.app/sample-book/author.png",
        createdAt: "2026-05-07T00:00:00Z",
        updatedAt: "2026-05-07T00:00:00Z",
        colors: BookColors(cover: "#5B3FA8", accent: "#F4B860", text: "#FFF8E7"),
        coverImage: "https://mybooklab.app/sample-book/cover.png",
        characters: [
            BookCharacter(id: "c1", name: "Theo", emoji: "👦🏼",
                          description: "A curious 7-year-old who loves stargazing."),
            BookCharacter(id: "c2", name: "Twinkle", emoji: "🌟",
                          description: "A fluffy bear made entirely of starlight."),
        ],
        setting: BookSetting(
            id: "s1", name: "The Glowing Forest", label: "The Glowing Forest",
            emoji: "🌲",
            description: "A magical forest where stars come down at night and mushrooms shine like lamps."
        ),
        pages: [
            BookPage(id: 1, pageNumber: 1,
                text: "Theo loved to look at the stars before bed. Every night, they sparkled like diamonds in the sky.",
                illustrationData: "https://mybooklab.app/sample-book/page-01.png"),
            BookPage(id: 2, pageNumber: 2,
                text: "But one night, something different happened. A tiny star floated down through his window!",
                illustrationData: "https://mybooklab.app/sample-book/page-02.png"),
            BookPage(id: 3, pageNumber: 3,
                text: "The star wiggled and grew, until it became a fluffy bear made of starlight. \"Hello, Theo!\" it said. \"I'm Twinkle.\"",
                illustrationData: "https://mybooklab.app/sample-book/page-03.png"),
            BookPage(id: 4, pageNumber: 4,
                text: "\"Come with me,\" Twinkle whispered. \"The Glowing Forest needs your help.\"",
                illustrationData: "https://mybooklab.app/sample-book/page-04.png"),
            BookPage(id: 5, pageNumber: 5,
                text: "They flew on a moonbeam to a place Theo had never seen. The trees were silver, and the mushrooms shone like lamps.",
                illustrationData: "https://mybooklab.app/sample-book/page-05.png"),
            BookPage(id: 6, pageNumber: 6,
                text: "\"A storm cloud put out our stars,\" said Twinkle. \"We need to wake them up again.\"",
                illustrationData: "https://mybooklab.app/sample-book/page-06.png"),
            BookPage(id: 7, pageNumber: 7,
                text: "Theo cupped his hands and gathered some shimmer-dust from the path. \"Maybe this will help!\"",
                illustrationData: "https://mybooklab.app/sample-book/page-07.png"),
            BookPage(id: 8, pageNumber: 8,
                text: "He blew the shimmer-dust toward the dim stars. They began to glow brighter and brighter.",
                illustrationData: "https://mybooklab.app/sample-book/page-08.png"),
            BookPage(id: 9, pageNumber: 9,
                text: "Soon the forest twinkled like never before. The fireflies danced and the leaves sang.",
                illustrationData: "https://mybooklab.app/sample-book/page-09.png"),
            BookPage(id: 10, pageNumber: 10,
                text: "\"You did it!\" cheered Twinkle. \"You saved the Glowing Forest!\"",
                illustrationData: "https://mybooklab.app/sample-book/page-10.png"),
            BookPage(id: 11, pageNumber: 11,
                text: "Twinkle gave Theo a tiny star to keep. \"Whenever you look at it, you'll remember our adventure.\"",
                illustrationData: "https://mybooklab.app/sample-book/page-11.png"),
            BookPage(id: 12, pageNumber: 12,
                text: "Theo woke up in his bed. The little star sat glowing on his pillow. He smiled, knowing the magic was real.",
                illustrationData: "https://mybooklab.app/sample-book/page-12.png"),
        ]
    )
}

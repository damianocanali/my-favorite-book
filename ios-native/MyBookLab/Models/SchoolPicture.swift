// The picture alphabet for children's class sign-in. Swift copy of
// lib/school/pictures.js — same 16 ids, same emoji, same order. The ids are
// what the server checks (a child's secret is three ids), so they must match
// exactly; they are never shown. Only the emoji is, which is why the pad
// works for a 6-year-old who can't read yet, in English or Italian.
//
// The names are for VoiceOver only.
import Foundation

struct SchoolPicture: Identifiable, Hashable {
    let id: String
    let emoji: String
    let name: LocalizedStringResource

    static func == (a: SchoolPicture, b: SchoolPicture) -> Bool { a.id == b.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    static var all: [SchoolPicture] { [
        .init(id: "cat", emoji: "🐱", name: AppText("school.picture.cat", defaultValue: "cat")),
        .init(id: "dog", emoji: "🐶", name: AppText("school.picture.dog", defaultValue: "dog")),
        .init(id: "fish", emoji: "🐟", name: AppText("school.picture.fish", defaultValue: "fish")),
        .init(id: "frog", emoji: "🐸", name: AppText("school.picture.frog", defaultValue: "frog")),
        .init(id: "lion", emoji: "🦁", name: AppText("school.picture.lion", defaultValue: "lion")),
        .init(id: "owl", emoji: "🦉", name: AppText("school.picture.owl", defaultValue: "owl")),
        .init(id: "turtle", emoji: "🐢", name: AppText("school.picture.turtle", defaultValue: "turtle")),
        .init(id: "bee", emoji: "🐝", name: AppText("school.picture.bee", defaultValue: "bee")),
        .init(id: "sun", emoji: "☀️", name: AppText("school.picture.sun", defaultValue: "sun")),
        .init(id: "moon", emoji: "🌙", name: AppText("school.picture.moon", defaultValue: "moon")),
        .init(id: "star", emoji: "⭐", name: AppText("school.picture.star", defaultValue: "star")),
        .init(id: "tree", emoji: "🌳", name: AppText("school.picture.tree", defaultValue: "tree")),
        .init(id: "apple", emoji: "🍎", name: AppText("school.picture.apple", defaultValue: "apple")),
        .init(id: "boat", emoji: "⛵", name: AppText("school.picture.boat", defaultValue: "boat")),
        .init(id: "rocket", emoji: "🚀", name: AppText("school.picture.rocket", defaultValue: "rocket")),
        .init(id: "ball", emoji: "⚽", name: AppText("school.picture.ball", defaultValue: "ball")),
    ] }

    static func byId(_ id: String) -> SchoolPicture? { all.first { $0.id == id } }
}

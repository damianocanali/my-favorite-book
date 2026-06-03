// Holds the in-progress book during the Create wizard. Once the user
// finishes the wizard, BookshelfStore.save() persists it to Supabase
// and clears the draft. Reset on sign-out (mirrors the web fix).
import Foundation
import Observation

@Observable
@MainActor
final class BookDraftStore {
    static let shared = BookDraftStore()

    var step: Int = 0
    var book: Book?

    /// Open a fresh draft at the author-intro step (0). The author
    /// name + age are collected on that first step.
    func begin() {
        book = Book(
            id: UUID().uuidString,
            title: "",
            authorName: "",
            authorAge: nil,
            authorAvatar: nil,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            colors: BookColors(cover: "#5B3FA8", accent: "#F4B860", text: "#FFF8E7"),
            coverImage: nil,
            characters: [],
            setting: nil,
            pages: []
        )
        step = 0
    }

    /// Set the author on the current draft and advance to the
    /// character step.
    func setAuthor(name: String, age: Int?) {
        guard var b = book else { return }
        b.authorName = name
        b.authorAge = age
        book = b
        step = 1
    }

    /// Open an existing book for editing — jumps straight to the page
    /// editor (step 4) with the full book loaded. Saving upserts by
    /// the same book id, so edits overwrite the original.
    func edit(_ existing: Book) {
        book = existing
        step = 4
    }

    func clear() {
        book = nil
        step = 0
    }
}

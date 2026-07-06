// Loads the user's books directly from Supabase user_books via the
// Swift SDK. The SDK builds the request URL and attaches the signed-in
// user's access token automatically, so RLS sees auth.uid() — no
// manual URL construction (which is what caused the "bad URL" bug when
// this briefly went through hand-rolled HTTP calls).
import Foundation
import Observation
import Supabase

@Observable
@MainActor
final class BookshelfStore {
    static let shared = BookshelfStore()

    private(set) var books: [Book] = []
    private(set) var loading: Bool = false
    private(set) var error: String?

    private var supabase: SupabaseClient { AuthStore.shared.supabase }

    private struct UserBookRow: Decodable {
        let book_data: Book?
    }

    func load(userId: String) async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let rows: [UserBookRow] = try await supabase
                .from("user_books")
                .select("book_id, book_data, updated_at")
                .eq("user_id", value: userId)
                .order("updated_at", ascending: false)
                .execute()
                .value
            books = rows.compactMap(\.book_data)
            shelfDidChange()
        } catch is CancellationError {
            // View went away mid-fetch — keep existing books.
        } catch let urlError as URLError where urlError.code == .cancelled {
            // Same — don't wipe the shelf.
        } catch {
            self.error = "Couldn't load your books: \(error.localizedDescription)"
        }
    }

    private struct BookRow: Encodable {
        let user_id: String
        let book_id: String
        let book_data: Book
        let title: String
        let updated_at: String
    }

    /// Upsert a book. Strips illustration data to a marker so the cloud
    /// row stays small (full images live on-device); same convention as
    /// the web sync.
    func save(_ book: Book, userId: String) async throws {
        let stripped = strippedForCloud(book)
        try await supabase
            .from("user_books")
            .upsert(
                BookRow(
                    user_id: userId,
                    book_id: book.id,
                    book_data: stripped,
                    title: book.title,
                    updated_at: ISO8601DateFormatter().string(from: Date())
                ),
                onConflict: "user_id,book_id"
            )
            .execute()
        if let idx = books.firstIndex(where: { $0.id == book.id }) {
            books[idx] = book
        } else {
            books.insert(book, at: 0)
        }
        shelfDidChange()
    }

    func delete(_ bookId: String, userId: String) async throws {
        try await supabase
            .from("user_books")
            .delete()
            .eq("user_id", value: userId)
            .eq("book_id", value: bookId)
            .execute()
        books.removeAll { $0.id == bookId }
        shelfDidChange()
    }

    /// Reset on sign-out — mirrors the web fix to drop per-user state.
    func clear() {
        books = []
        error = nil
        loading = false
        shelfDidChange()
    }

    /// Keep the home-screen widget and Spotlight in sync with the shelf.
    private func shelfDidChange() {
        SharedData.updateBooks(books)
        SpotlightIndexer.reindex(books)
    }

    private func strippedForCloud(_ b: Book) -> Book {
        var copy = b
        copy.pages = b.pages.map { p in
            var pp = p
            if pp.illustrationData != nil { pp.illustrationData = "[saved-locally]" }
            return pp
        }
        return copy
    }
}

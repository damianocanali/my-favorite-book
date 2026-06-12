// Thin typed wrapper over Vercel /api/* endpoints.
//
// The web app and this native app share the same backend — every endpoint
// here corresponds to a file under /api/ in the parent repo. When you add
// a new endpoint server-side, add the matching method here.
//
// Auth: pass the current Supabase access token via `bearerToken` for any
// endpoint that requires it. AuthStore owns the token and supplies it.
import Foundation

enum APIError: Error, LocalizedError {
    case http(status: Int, body: String)
    case decoding(Error)
    case noData
    case transport(url: String, underlying: Error)

    var errorDescription: String? {
        switch self {
        case .http(let status, let body):
            return "HTTP \(status): \(body)"
        case .decoding(let e):
            return "Decoding failed: \(e.localizedDescription)"
        case .noData:
            return "Empty response"
        case .transport(let url, let underlying):
            return "Request to \(url) failed: \(underlying.localizedDescription)"
        }
    }
}

actor APIClient {
    static let shared = APIClient()
    private let session: URLSession
    private let baseURL: URL
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    init(baseURL: URL = AppConfig.shared.apiBase, session: URLSession = .shared) {
        self.session = session
        self.baseURL = baseURL
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    // MARK: - Generic request

    private func request<Body: Encodable, Response: Decodable>(
        method: String,
        path: String,
        body: Body? = Optional<EmptyBody>.none,
        bearerToken: String? = nil
    ) async throws -> Response {
        // Build via URLComponents — appendingPathComponent percent-encodes
        // the slashes in "/api/..." and produces a broken URL.
        let url = makeURL(path: path, query: [:])
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = bearerToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            req.httpBody = try encoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.transport(url: url.absoluteString, underlying: error)
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.noData }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.http(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
        do { return try decoder.decode(Response.self, from: data) }
        catch { throw APIError.decoding(error) }
    }

    private struct EmptyBody: Encodable {}

    // MARK: - Print orders

    func createPrintOrder(_ body: CreatePrintOrderRequest, bearerToken: String) async throws -> CreatePrintOrderResponse {
        try await request(method: "POST", path: "/api/print-orders/create",
                          body: body, bearerToken: bearerToken)
    }

    func getPrintOrder(id: String, bearerToken: String) async throws -> PrintOrder {
        let url = makeURL(path: "/api/print-orders/get", query: ["id": id])
        return try await rawGet(url: url, bearerToken: bearerToken)
    }

    /// Lists the user's print orders via the server endpoint (service
    /// key + JWT filter), bypassing any RLS uncertainty.
    func listPrintOrders(bearerToken: String) async throws -> [PrintOrder] {
        let url = makeURL(path: "/api/print-orders/list", query: [:])
        return try await rawGet(url: url, bearerToken: bearerToken)
    }

    // MARK: - Bookshelf

    /// One row of /api/sync-books GET — { book_id, book_data, updated_at }.
    private struct SyncBookRow: Decodable {
        let book_data: Book?
    }

    /// Fetches the user's books from /api/sync-books GET (server uses
    /// the service-role key, so this works regardless of user_books
    /// RLS — same path the web app reads through).
    func fetchBooks(bearerToken: String) async throws -> [Book] {
        let url = makeURL(path: "/api/sync-books", query: [:])
        let rows: [SyncBookRow] = try await rawGet(url: url, bearerToken: bearerToken)
        return rows.compactMap(\.book_data)
    }

    private struct SaveBookBody: Encodable { let book: Book }
    private struct DeleteBookBody: Encodable { let action = "delete"; let bookId: String }
    private struct SyncOK: Decodable { let saved: Bool? ; let deleted: Bool? }

    /// Upsert a book via /api/sync-books POST. The server strips
    /// illustrations and persists with the service-role key.
    func saveBook(_ book: Book, bearerToken: String) async throws {
        let _: SyncOK = try await request(
            method: "POST", path: "/api/sync-books",
            body: SaveBookBody(book: book), bearerToken: bearerToken
        )
    }

    func deleteBook(bookId: String, bearerToken: String) async throws {
        let _: SyncOK = try await request(
            method: "POST", path: "/api/sync-books",
            body: DeleteBookBody(bookId: bookId), bearerToken: bearerToken
        )
    }

    // MARK: - Image generation

    struct GenerateImageRequest: Encodable {
        let prompt: String
        let style: String?
    }
    struct GenerateImageResponse: Decodable {
        let image: String // data URL or remote URL
    }
    func generateImage(_ body: GenerateImageRequest, bearerToken: String) async throws -> GenerateImageResponse {
        try await request(method: "POST", path: "/api/generate-image",
                          body: body, bearerToken: bearerToken)
    }

    // MARK: - Avatar (photo cartoonify)

    struct GenerateAvatarRequest: Encodable {
        let features: AvatarFeatures?
        let artStyle: String
        let sourceImage: String? // base64 data URL for photo mode

        struct AvatarFeatures: Encodable {
            var skinTone: String?
            var hairStyle: String?
            var hairColor: String?
            var clothing: String?
            var hat: String?
            var accessory: String?
            var expression: String?
        }
    }
    struct GenerateAvatarResponse: Decodable {
        let image: String
    }
    func generateAvatar(_ body: GenerateAvatarRequest, bearerToken: String) async throws -> GenerateAvatarResponse {
        try await request(method: "POST", path: "/api/generate-avatar",
                          body: body, bearerToken: bearerToken)
    }

    // MARK: - Gallery (public — no auth required)

    /// Fetches the recent + featured Gallery books from /api/publish-book?recent=true.
    func fetchGallery() async throws -> [PublishedBookSummary] {
        let url = makeURL(path: "/api/publish-book", query: ["recent": "true"])
        return try await rawGet(url: url)
    }

    /// Fetches a single published book's full payload as raw bytes;
    /// caller decodes the parts they need.
    func fetchPublishedBook(slug: String) async throws -> Data {
        let url = makeURL(path: "/api/publish-book", query: ["slug": slug])
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode) else {
            throw APIError.http(
                status: (response as? HTTPURLResponse)?.statusCode ?? 0,
                body: String(data: data, encoding: .utf8) ?? ""
            )
        }
        return data
    }

    /// Builds a URL with the path AND query string properly encoded.
    /// `URL.appendingPathComponent` percent-encodes "?" which breaks
    /// query strings — use URLComponents instead.
    private func makeURL(path: String, query: [String: String]) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.path = (components.path.isEmpty ? "" : components.path) + path
        components.queryItems = query.isEmpty
            ? nil
            : query.map { URLQueryItem(name: $0.key, value: $0.value) }
        return components.url!
    }

    /// GET + JSON-decode in one shot. Optional bearer token for the
    /// authed endpoints (orders, books); omit it for public ones
    /// (gallery).
    private func rawGet<Response: Decodable>(url: URL, bearerToken: String? = nil) async throws -> Response {
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let bearerToken { req.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization") }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.transport(url: url.absoluteString, underlying: error)
        }
        guard let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode) else {
            throw APIError.http(
                status: (response as? HTTPURLResponse)?.statusCode ?? 0,
                body: String(data: data, encoding: .utf8) ?? ""
            )
        }
        do { return try decoder.decode(Response.self, from: data) }
        catch { throw APIError.decoding(error) }
    }

    // MARK: - Story Buddy

    struct StoryBuddyRequest: Encodable {
        let message: String
        let context: String?
    }
    struct StoryBuddyResponse: Decodable {
        let reply: String
    }
    func askStoryBuddy(_ body: StoryBuddyRequest, bearerToken: String) async throws -> StoryBuddyResponse {
        try await request(method: "POST", path: "/api/story-buddy",
                          body: body, bearerToken: bearerToken)
    }

    // MARK: - Rewards (badges + streak)

    struct ClaimBadgeResponse: Decodable {
        let alreadyClaimed: Bool
        let coinsEarned: Int?
        let balance: Int?
    }
    private struct ClaimBadgeBody: Encodable { let badgeId: String }

    /// Claims a badge's coin reward. Idempotent server-side — the
    /// response says whether this call actually credited.
    func claimBadge(badgeId: String, bearerToken: String) async throws -> ClaimBadgeResponse {
        try await request(method: "POST", path: "/api/claim-badge",
                          body: ClaimBadgeBody(badgeId: badgeId), bearerToken: bearerToken)
    }

    struct StreakStatus: Decodable {
        let currentStreak: Int
        let longestStreak: Int
        let lastActiveDate: String?
    }
    private struct TouchStreakBody: Encodable { let day: String }

    func getStreak(bearerToken: String) async throws -> StreakStatus {
        try await request(method: "GET", path: "/api/streak", bearerToken: bearerToken)
    }

    /// Marks a local calendar day (YYYY-MM-DD) as a writing day.
    func touchStreak(day: String, bearerToken: String) async throws -> StreakStatus {
        try await request(method: "POST", path: "/api/streak",
                          body: TouchStreakBody(day: day), bearerToken: bearerToken)
    }

    // MARK: - Account deletion (recoverable)

    struct DeletionStatus: Decodable {
        let pending: Bool
        let scheduled_for: String?
    }
    private struct DeletionScheduled: Decodable { let scheduled_for: String? }
    private struct CancelResult: Decodable { let cancelled: Bool? }

    /// Schedules account deletion (7-day grace). Returns the ISO date it's
    /// scheduled for, if the server provided one.
    @discardableResult
    func requestAccountDeletion(bearerToken: String) async throws -> String? {
        let res: DeletionScheduled = try await request(
            method: "POST", path: "/api/delete-account", bearerToken: bearerToken)
        return res.scheduled_for
    }

    /// Cancels a pending account deletion.
    func cancelAccountDeletion(bearerToken: String) async throws {
        let _: CancelResult = try await request(
            method: "POST", path: "/api/cancel-deletion", bearerToken: bearerToken)
    }

    /// Returns whether the account is scheduled for deletion (and when).
    func deletionStatus(bearerToken: String) async throws -> DeletionStatus {
        try await request(method: "GET", path: "/api/delete-account", bearerToken: bearerToken)
    }

    // Intent-based "ideas" helpers (Sentence Starters / Help Me Think).
    // Reuses the same /api/story-buddy endpoint as the web app, which for
    // an intent returns the raw Anthropic message; we parse it to a list.
    private struct StoryBuddyIntentRequest: Encodable {
        let intent: String
        let book: SlimBook
        let page: SlimPage

        struct SlimBook: Encodable {
            let title: String
            let authorName: String
            let authorAge: Int?
            let characters: [SlimCharacter]
            let setting: SlimSetting?
            let pages: [SlimPage]
        }
        struct SlimCharacter: Encodable { let name: String }
        struct SlimSetting: Encodable { let name: String? }
        struct SlimPage: Encodable { let pageNumber: Int; let text: String }
    }
    private struct AnthropicTextResponse: Decodable {
        struct Block: Decodable { let text: String? }
        let content: [Block]
    }

    /// Returns a parsed list of ideas for `intent` ("starters" or
    /// "questions"). Sends only the text fields the prompt needs (no
    /// illustration data) to keep the request small.
    func storyBuddyIdeas(intent: String, book: Book, page: BookPage, bearerToken: String) async throws -> [String] {
        let body = StoryBuddyIntentRequest(
            intent: intent,
            book: .init(
                title: book.title,
                authorName: book.authorName,
                authorAge: book.authorAge,
                characters: book.characters.map { .init(name: $0.name) },
                setting: book.setting.map { .init(name: $0.name) },
                pages: book.pages.map { .init(pageNumber: $0.pageNumber, text: $0.text) }
            ),
            page: .init(pageNumber: page.pageNumber, text: page.text)
        )
        let res: AnthropicTextResponse = try await request(
            method: "POST", path: "/api/story-buddy",
            body: body, bearerToken: bearerToken
        )
        return Self.parseIdeaList(res.content.first?.text ?? "")
    }

    /// Splits Claude's numbered list into clean lines (mirrors the web app).
    static func parseIdeaList(_ text: String) -> [String] {
        text.split(separator: "\n", omittingEmptySubsequences: true).map { line in
            line.trimmingCharacters(in: .whitespaces)
                .replacingOccurrences(of: "^\\d+[\\.\\)]\\s*", with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespaces)
        }.filter { !$0.isEmpty }
    }
}

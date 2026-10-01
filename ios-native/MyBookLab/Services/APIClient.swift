// Thin typed wrapper over Vercel /api/* endpoints.
//
// The web app and this native app share the same backend — every endpoint
// here corresponds to a file under /api/ in the parent repo. When you add
// a new endpoint server-side, add the matching method here.
//
// Auth: pass the current Supabase access token via `bearerToken` for any
// endpoint that requires it — from `await AuthStore.validAccessToken()`,
// never the cached `accessToken`, which may have expired. Every bearer
// request that still gets a 401 is retried ONCE with a refreshed token
// (withAuthRetry); a second 401 becomes APIError.sessionExpired.
//
// Failures are logged (os.Logger, category "api": method, path, status —
// never the token or a body) so they can be diagnosed from the console.
import Foundation
import os

enum APIError: Error, LocalizedError {
    case http(status: Int, body: String)
    case decoding(Error)
    case noData
    case transport(url: String, underlying: Error)
    /// Still 401 after refreshing the token once: the session is over and
    /// only signing in again helps.
    case sessionExpired

    /// Shown wherever a call ends in `sessionExpired` (teacher screens, the
    /// hand-in, anything showing localizedDescription).
    static var sessionExpiredText: LocalizedStringResource {
        AppText("errors.session_expired", defaultValue: "Your session ended — please sign in again.")
    }

    var errorDescription: String? {
        switch self {
        case .sessionExpired:
            return String(appLocalized: Self.sessionExpiredText)
        case .http(let status, let body):
            // Never the server's raw (English) body: map its `code` to copy
            // in the app language (web: src/lib/aiErrors.js). The raw body
            // still goes to the log where the request fails.
            return String(appLocalized: Self.friendly(status: status, code: Self.code(in: body),
                                                      message: Self.message(in: body)))
        case .decoding, .noData:
            return String(appLocalized: Self.genericText)
        case .transport(_, let underlying):
            // Already localized by iOS ("The Internet connection appears to be offline").
            return underlying.localizedDescription
        }
    }

    /// The server's machine `code`, if its error body is JSON with one.
    static func code(in body: String) -> String? { field("code", in: body) }
    /// The server's English sentence — only consulted for older servers
    /// that send no code.
    static func message(in body: String) -> String? { field("error", in: body) }

    private static func field(_ key: String, in body: String) -> String? {
        guard let data = body.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return obj[key] as? String
    }

    /// The student-facing class picture limit (not the teacher's wording).
    static var classImageLimitText: LocalizedStringResource {
        AppText("errors.ai.class_image_limit", defaultValue: "That's all the pictures for today — ask your teacher.")
    }

    static var genericText: LocalizedStringResource {
        AppText("errors.ai.generic", defaultValue: "Something went wrong. Please try again.")
    }

    static func friendly(status: Int, code: String?, message: String? = nil) -> LocalizedStringResource {
        // No code (an older server): the daily cap's sentence still reads as
        // the daily cap, not as a plain rate limit.
        let code = code ?? {
            let m = (message ?? "").lowercased()
            if m.contains("creation limit") { return "daily_limit" }
            if m.contains("all the pictures for today") { return "class_image_limit" }
            if m.contains("kind and friendly") { return "unkind" }
            return nil
        }()
        switch code {
        case "class_image_limit":
            return classImageLimitText
        case "daily_limit":
            return AppText("errors.ai.daily_limit", defaultValue: "You've reached today's creation limit — come back tomorrow!")
        case "rate_limited":
            return AppText("errors.ai.rate_limited", defaultValue: "Too many tries just now. Please try again a bit later.")
        case "scene_unavailable":
            return AppText("errors.ai.try_again", defaultValue: "We couldn't do that just now. Please try again in a moment.")
        case "timeout":
            return AppText("errors.ai.timeout", defaultValue: "That took too long. Please try again.")
        case "unkind":
            return AppText("errors.ai.unkind", defaultValue: "Let's keep our story kind and friendly — try different words!")
        default:
            if status == 429 {
                return AppText("errors.ai.rate_limited", defaultValue: "Too many tries just now. Please try again a bit later.")
            }
            if status == 504 {
                return AppText("errors.ai.timeout", defaultValue: "That took too long. Please try again.")
            }
            return genericText
        }
    }
}

actor APIClient {
    static let shared = APIClient()
    static let log = Logger(subsystem: Bundle.main.bundleIdentifier ?? "MyBookLab", category: "api")
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
        let bodyData = try body.map { try encoder.encode($0) }
        return try await withAuthRetry(bearerToken, method: method, path: path) { token in
            var req = URLRequest(url: url)
            req.httpMethod = method
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            if let token {
                req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            req.httpBody = bodyData
            return try await perform(req, url: url)
        }
    }

    /// Like `request`, but for the paid AI endpoints: attaches an App
    /// Attest assertion over the exact body bytes (when available) so
    /// the server grants the attested-tier limits. Requests still go
    /// out unattested on simulators or before registration completes.
    private func attestedRequest<Body: Encodable, Response: Decodable>(
        method: String,
        path: String,
        body: Body,
        bearerToken: String
    ) async throws -> Response {
        let url = makeURL(path: path, query: [:])
        let data = try encoder.encode(body)
        // The retry builds a NEW assertion for the new token: an assertion is
        // single-use, so re-sending the first one would be refused.
        return try await withAuthRetry(bearerToken, method: method, path: path) { token in
            let token = token ?? bearerToken
            var req = URLRequest(url: url)
            req.httpMethod = method
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.setValue("ios", forHTTPHeaderField: "x-client-platform")
            req.httpBody = data
            if let attestHeaders = await AppAttestService.shared.assertionHeaders(
                for: data, bearerToken: token
            ) {
                for (key, value) in attestHeaders {
                    req.setValue(value, forHTTPHeaderField: key)
                }
            }
            return try await perform(req, url: url)
        }
    }

    /// Sends a bearer request; if the server answers 401 — the token expired
    /// in flight, or the app sent one it had cached across a sleep — asks
    /// AuthStore for a fresh token and sends it ONE more time. The retry is
    /// not wrapped again, so it can never loop. Still 401, or no fresh token
    /// to be had → APIError.sessionExpired. Requests without a token (public
    /// endpoints, the class sign-in itself) are never retried.
    private func withAuthRetry<Response>(
        _ bearerToken: String?, method: String, path: String,
        _ send: (String?) async throws -> Response
    ) async throws -> Response {
        do {
            return try await send(bearerToken)
        } catch APIError.http(let status, let body) where status == 401 && bearerToken != nil {
            // App Attest refused the device proof: the token was fine, so a
            // refresh would change nothing and a retry would burn another
            // assertion. Surfaces as the plain 401 it is.
            if Self.isAttestFailure(body) {
                Self.log.error("\(method, privacy: .public) \(path, privacy: .public): 401 attest_failed — not retried")
                throw APIError.http(status: status, body: body)
            }
            guard let rejected = bearerToken else { throw APIError.http(status: status, body: body) }
            let fresh: String
            switch await AuthStore.shared.tokenAfterUnauthorized(rejected: rejected) {
            case .fresh(let token):
                fresh = token
            case .gone:
                Self.log.error("\(method, privacy: .public) \(path, privacy: .public): 401 and the session is gone — session ended")
                throw APIError.sessionExpired
            case .transient(let refreshError):
                // Couldn't reach the auth server: a network failure, not a
                // signed-out user.
                let ns = refreshError as NSError
                Self.log.error("\(method, privacy: .public) \(path, privacy: .public): 401, refresh failed transiently (\(ns.domain, privacy: .public) \(ns.code, privacy: .public))")
                throw APIError.transport(url: path, underlying: refreshError)
            }
            Self.log.info("\(method, privacy: .public) \(path, privacy: .public): 401, retrying once with a refreshed token")
            do {
                return try await send(fresh)
            } catch APIError.http(let status, let body) where status == 401 && !Self.isAttestFailure(body) {
                // A token minted a moment ago was refused too.
                Self.log.error("\(method, privacy: .public) \(path, privacy: .public): 401 again after refresh — session ended")
                throw APIError.sessionExpired
            }
        }
    }

    private struct ErrorCodeBody: Decodable { let code: String? }

    /// api/_appAttest.js's enforce-mode rejection.
    private static func isAttestFailure(_ body: String) -> Bool {
        (try? JSONDecoder().decode(ErrorCodeBody.self, from: Data(body.utf8)))?.code == "attest_failed"
    }

    private func perform<Response: Decodable>(_ req: URLRequest, url: URL,
                                              using urlSession: URLSession? = nil) async throws -> Response {
        let data: Data
        let response: URLResponse
        let method = req.httpMethod ?? "GET"
        do {
            (data, response) = try await (urlSession ?? session).data(for: req)
        } catch {
            Self.logTransport(method: method, url: url, error: error)
            throw APIError.transport(url: url.absoluteString, underlying: error)
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.noData }
        guard (200..<300).contains(http.statusCode) else {
            Self.log.error("\(method, privacy: .public) \(url.path, privacy: .public) → HTTP \(http.statusCode, privacy: .public)")
            throw APIError.http(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
        do { return try decoder.decode(Response.self, from: data) }
        catch {
            Self.log.error("\(method, privacy: .public) \(url.path, privacy: .public) → HTTP \(http.statusCode, privacy: .public), response didn't decode as \(String(describing: Response.self), privacy: .public)")
            throw APIError.decoding(error)
        }
    }

    /// A cancelled request (a view went away mid-poll) is routine, not a failure.
    private static func logTransport(method: String, url: URL, error: Error) {
        if error is CancellationError || (error as? URLError)?.code == .cancelled { return }
        let ns = error as NSError
        log.error("\(method, privacy: .public) \(url.path, privacy: .public) → transport error \(ns.domain, privacy: .public) \(ns.code, privacy: .public)")
    }

    private struct EmptyBody: Encodable {}

    // MARK: - App Attest registration

    struct AttestChallenge: Decodable {
        let challengeId: String
        let challenge: String
    }
    private struct RegisterAttestationBody: Encodable {
        let challengeId: String
        let keyId: String
        let attestation: String
    }
    private struct RegisterAttestationResponse: Decodable { let registered: Bool }

    func attestChallenge(bearerToken: String) async throws -> AttestChallenge {
        try await request(method: "POST", path: "/api/attest/challenge", bearerToken: bearerToken)
    }

    func registerAttestation(challengeId: String, keyId: String, attestation: String,
                             bearerToken: String) async throws {
        let _: RegisterAttestationResponse = try await request(
            method: "POST", path: "/api/attest/register",
            body: RegisterAttestationBody(challengeId: challengeId, keyId: keyId, attestation: attestation),
            bearerToken: bearerToken
        )
    }

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

    /// Structured picture request. The app no longer builds FLUX prompts:
    /// the server writes an English scene from these fields (see
    /// lib/imageScene.js), so the child's prose is never pasted into the
    /// image prompt — that drew their words as letters, passed real people's
    /// names through, and forced the hero into every page.
    ///
    /// Everything except `pageText`, `title` and `instruction` is English
    /// on purpose (prompt terms, never display labels).
    struct GenerateImageRequest: Encodable {
        struct Character: Encodable {
            let name: String
            let promptEn: String
            let description: String?
            /// The emoji's species ("a fox"): the only part the server's
            /// offline fallback may draw, since name/description are typed
            /// by the child.
            let species: String?
            /// A child-made ("create your own") character: the server's
            /// offline fallback never draws from its name or description.
            let custom: Bool
        }
        struct Setting: Encodable {
            let promptEn: String
            let description: String?
            /// A child-made place: never looked up as a catalogue setting.
            let custom: Bool
        }

        let kind: String            // "page" | "cover" | "portrait" | "edit"
        var pageText: String?
        var title: String?
        var characters: [Character]
        var setting: Setting?
        var locale: String = AppLanguage.apiLocale

        static func page(text: String, book: Book) -> Self {
            .init(kind: "page", pageText: String(text.prefix(4000)), title: nil,
                  characters: characters(of: book), setting: setting(of: book))
        }

        static func cover(book: Book) -> Self {
            .init(kind: "cover", pageText: nil, title: String(book.title.prefix(200)),
                  characters: characters(of: book), setting: setting(of: book))
        }

        private static func characters(of book: Book) -> [Character] {
            // Server accepts at most 6 (lib/imageScene.js LIMITS.characters).
            book.characters.prefix(6).map { c in
                let d = c.description?.trimmingCharacters(in: .whitespaces)
                // Same caps the server keeps (lib/imageScene.js LIMITS); it
                // truncates too, this just avoids sending what it drops.
                let isCustom = c.custom == true
                // A catalogue character goes by its frozen English catalogue
                // name, which the server recognises (lib/imageCatalog.js).
                let subject = (!isCustom ? c.promptEn?.name : nil) ?? c.imagePromptSubject
                return Character(name: String(c.name.prefix(120)),
                                 promptEn: String(subject.prefix(200)),
                                 description: (d?.isEmpty ?? true) ? nil : d.map { String($0.prefix(200)) },
                                 species: BookCharacter.species(for: c.emoji),
                                 custom: isCustom)
            }
        }

        private static func setting(of book: Book) -> Setting? {
            // Preset worlds store their English name + blurb (the display
            // title is a separate localized resource), so this is English.
            guard let s = book.setting,
                  let name = (s.name ?? s.label)?.trimmingCharacters(in: .whitespaces),
                  !name.isEmpty else { return nil }
            let d = s.description?.trimmingCharacters(in: .whitespaces)
            return Setting(promptEn: String(name.prefix(200)),
                           description: (d?.isEmpty ?? true) ? nil : d.map { String($0.prefix(200)) },
                           custom: s.custom == true)
        }
    }
    struct GenerateImageResponse: Decodable {
        let image: String // data URL or remote URL
    }
    func generateImage(_ body: GenerateImageRequest, bearerToken: String) async throws -> GenerateImageResponse {
        try await attestedRequest(method: "POST", path: "/api/generate-image",
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
        try await attestedRequest(method: "POST", path: "/api/generate-avatar",
                                  body: body, bearerToken: bearerToken)
    }

    // MARK: - Gallery (public — no auth required)

    /// Fetches the recent + featured Gallery books from /api/publish-book?recent=true.
    func fetchGallery() async throws -> [PublishedBookSummary] {
        let url = makeURL(path: "/api/publish-book", query: ["recent": "true"])
        return try await rawGet(url: url)
    }

    /// Reports a published book so it can be reviewed and, once enough
    /// people flag it, auto-hidden. Required by App Store Guideline 1.2
    /// for an app that shows other users' content.
    @discardableResult
    func reportBook(slug: String, reason: String, details: String? = nil,
                    bearerToken: String) async throws -> ReportBookResponse {
        try await request(
            method: "POST", path: "/api/report-book",
            body: ReportBookRequest(slug: slug, reason: reason, details: details),
            bearerToken: bearerToken
        )
    }

    /// Hides everything by a given author for this user.
    @discardableResult
    func blockAuthor(userId: String, bearerToken: String) async throws -> ReportBookResponse {
        try await request(
            method: "POST", path: "/api/report-book",
            body: BlockAuthorRequest(action: "block", userId: userId),
            bearerToken: bearerToken
        )
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
        // URLComponents leaves "+" as is, and servers (URLSearchParams
        // included) read a bare "+" in a query as a space — which broke the
        // "+00:00" of a timestamp. No caller means a space by "+".
        components.percentEncodedQuery = components.percentEncodedQuery?
            .replacingOccurrences(of: "+", with: "%2B")
        return components.url!
    }

    /// GET + JSON-decode in one shot. Optional bearer token for the
    /// authed endpoints (orders, books); omit it for public ones
    /// (gallery).
    private func rawGet<Response: Decodable>(url: URL, bearerToken: String? = nil) async throws -> Response {
        try await withAuthRetry(bearerToken, method: "GET", path: url.path) { token in
            var req = URLRequest(url: url)
            req.httpMethod = "GET"
            req.setValue("application/json", forHTTPHeaderField: "Accept")
            if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
            return try await perform(req, url: url)
        }
    }

    // MARK: - Story Buddy

    struct StoryBuddyRequest: Encodable {
        let message: String
        let context: String?
        /// The language Story Buddy should reply in. Defaulted so every
        /// existing call site sends it — without this an Italian child gets
        /// English writing help inside an Italian app, which is the most
        /// visible way a half-finished localization shows up.
        var locale: String = AppLanguage.apiLocale
    }
    struct StoryBuddyResponse: Decodable {
        let reply: String
    }
    func askStoryBuddy(_ body: StoryBuddyRequest, bearerToken: String) async throws -> StoryBuddyResponse {
        try await attestedRequest(method: "POST", path: "/api/story-buddy",
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

    // MARK: - Schools (children's class sign-in)
    //
    // Both endpoints are unauthenticated: a child has no session yet. Errors
    // come back as { error, code } and the code is what the UI maps to a
    // child-friendly sentence, so these throw SchoolError rather than
    // APIError — the raw HTTP body must never reach a child's screen.

    struct SchoolRoster: Decodable {
        struct Classroom: Decodable {
            let id: String
            let name: String?
            let locale: String?
        }
        struct Student: Decodable, Identifiable, Hashable {
            let id: String
            let display_name: String
            let avatar_emoji: String?
        }
        let classroom: Classroom
        let students: [Student]
    }

    struct SchoolSession: Decodable {
        let access_token: String
        let refresh_token: String
    }

    /// `code` is the server's error code, or nil for a network failure or a
    /// body that wasn't the documented shape.
    struct SchoolError: Error {
        let code: String?
    }

    private struct SchoolSignInBody: Encodable {
        let code: String
        let studentId: String
        let pictures: [String]
    }

    func schoolRoster(code: String) async throws -> SchoolRoster {
        var req = URLRequest(url: makeURL(path: "/api/school/roster", query: ["code": code]))
        req.httpMethod = "GET"
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await schoolPerform(req)
    }

    func schoolSignIn(code: String, studentId: String, pictures: [String]) async throws -> SchoolSession {
        var req = URLRequest(url: makeURL(path: "/api/school/sign-in", query: [:]))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try encoder.encode(
            SchoolSignInBody(code: code, studentId: studentId, pictures: pictures)
        )
        return try await schoolPerform(req)
    }

    private struct SchoolErrorBody: Decodable { let code: String? }

    private func schoolPerform<Response: Decodable>(_ req: URLRequest) async throws -> Response {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw SchoolError(code: nil)
        }
        guard let http = response as? HTTPURLResponse else { throw SchoolError(code: nil) }
        guard (200..<300).contains(http.statusCode) else {
            throw SchoolError(code: (try? decoder.decode(SchoolErrorBody.self, from: data))?.code)
        }
        do { return try decoder.decode(Response.self, from: data) }
        catch { throw SchoolError(code: nil) }
    }

    // MARK: - Schools (a signed-in class account's check-ins and help asks)
    //
    // Student-session endpoints; SchoolShare is the only caller and decides
    // whether to call at all. Each request gives up after 8 s, like the web's
    // AbortSignal.timeout(8000): a check-in copy must never hang, and "I need
    // a grown-up" must always reach a real end state on slow wifi.

    private static let schoolTimeout: TimeInterval = 8

    /// A session whose resource timeout caps the WHOLE request at 8 s — a
    /// request's own timeoutInterval is only an idle timeout, which a slow
    /// trickle of bytes can keep resetting.
    private static let schoolSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = schoolTimeout
        config.timeoutIntervalForResource = schoolTimeout
        return URLSession(configuration: config)
    }()

    private struct SchoolCheckInBody: Encodable {
        let feeling: String
        /// Omitted (not null) when the child closed the sheet after step 1.
        let need: String?
    }
    private struct SchoolHelpBody: Encodable { let kind: String }

    struct SchoolHelpAsk: Decodable {
        let id: String
        let in_hours: Bool
    }
    struct SchoolHelpStatus: Decodable {
        let seen: Bool
        let teacher_name: String?
    }
    private struct Ignored: Decodable {}

    func schoolCheckIn(feeling: String, need: String?, bearerToken: String) async throws {
        let _: Ignored = try await schoolAuthed(
            method: "POST", path: "/api/school/checkin", query: [:],
            body: SchoolCheckInBody(feeling: feeling, need: need), bearerToken: bearerToken
        )
    }

    /// `kind` is "book" or "grownup".
    func schoolHelp(kind: String, bearerToken: String) async throws -> SchoolHelpAsk {
        try await schoolAuthed(
            method: "POST", path: "/api/school/help", query: [:],
            body: SchoolHelpBody(kind: kind), bearerToken: bearerToken
        )
    }

    func schoolHelpStatus(id: String, bearerToken: String) async throws -> SchoolHelpStatus {
        try await schoolAuthed(
            method: "GET", path: "/api/school/help", query: ["id": id],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken
        )
    }

    // MARK: - Schools (a class account's assignments, hand-ins and feedback)
    //
    // Same student bearer token and 8 s session as the check-in calls above.
    // Failures come back as SchoolError carrying the server's `code`
    // (assignment_closed, past_due, book_too_large, ...), nil for a network
    // failure or timeout, so the UI can pick the child-friendly sentence and
    // a raw HTTP body never reaches a child's screen. Shapes mirror
    // api/school/{assignments,submit,submissions,feedback}.js.

    private struct SchoolSubmitBody: Encodable {
        let assignmentId: String
        let bookId: String
    }
    private struct SchoolFeedbackSeenBody: Encodable { let id: String }
    private struct StudentAssignmentsResponse: Decodable { let assignments: [StudentAssignment]? }

    func studentAssignments(bearerToken: String) async throws -> [StudentAssignment] {
        let res: StudentAssignmentsResponse = try await schoolStudent(
            method: "GET", path: "/api/school/assignments", query: [:],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken
        )
        return res.assignments ?? []
    }

    func submitAssignment(assignmentId: String, bookId: String, bearerToken: String) async throws -> SubmitResult {
        try await schoolStudent(
            method: "POST", path: "/api/school/submit", query: [:],
            body: SchoolSubmitBody(assignmentId: assignmentId, bookId: bookId), bearerToken: bearerToken
        )
    }

    func studentSubmission(id: String, bearerToken: String) async throws -> StudentSubmission {
        try await schoolStudent(
            method: "GET", path: "/api/school/submissions", query: ["id": id],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken
        )
    }

    func markFeedbackSeen(id: String, bearerToken: String) async throws {
        let _: Ignored = try await schoolStudent(
            method: "POST", path: "/api/school/feedback", query: [:],
            body: SchoolFeedbackSeenBody(id: id), bearerToken: bearerToken
        )
    }

    /// The child's own grade, opened: seen (the server keeps the first time).
    func markGradeSeen(id: String, bearerToken: String) async throws {
        let _: Ignored = try await schoolStudent(
            method: "POST", path: "/api/school/grades", query: [:],
            body: SchoolFeedbackSeenBody(id: id), bearerToken: bearerToken
        )
    }

    // MARK: - Schools (a class account's teacher nudge)
    //
    // api/school/nudges.js: GET with no classId is the caller's own unread
    // nudge (or null); PATCH {id} is "Got it".
    private struct StudentNudgeResponse: Decodable { let nudge: StudentNudge? }

    func studentNudge(bearerToken: String) async throws -> StudentNudge? {
        let res: StudentNudgeResponse = try await schoolStudent(
            method: "GET", path: "/api/school/nudges", query: [:],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken
        )
        return res.nudge
    }

    func markNudgeSeen(id: String, bearerToken: String) async throws {
        let _: Ignored = try await schoolStudent(
            method: "PATCH", path: "/api/school/nudges", query: [:],
            body: SchoolFeedbackSeenBody(id: id), bearerToken: bearerToken
        )
    }

    /// schoolAuthed, with every failure turned into a SchoolError carrying
    /// the server's error code.
    private func schoolStudent<Body: Encodable, Response: Decodable>(
        method: String, path: String, query: [String: String],
        body: Body?, bearerToken: String
    ) async throws -> Response {
        do {
            return try await schoolAuthed(
                method: method, path: path, query: query, body: body, bearerToken: bearerToken
            )
        } catch APIError.sessionExpired {
            throw SchoolError(code: Self.sessionExpiredCode)
        } catch APIError.http(let status, let body) {
            let code = (try? decoder.decode(SchoolErrorBody.self, from: Data(body.utf8)))?.code
            if code == nil {
                Self.log.error("student \(method, privacy: .public) \(path, privacy: .public): HTTP \(status, privacy: .public) without an error code")
            }
            throw SchoolError(code: code)
        } catch {
            Self.logUnmapped("student", method: method, path: path, error: error)
            throw SchoolError(code: nil)
        }
    }

    private func schoolAuthed<Body: Encodable, Response: Decodable>(
        method: String, path: String, query: [String: String],
        body: Body?, bearerToken: String
    ) async throws -> Response {
        let url = makeURL(path: path, query: query)
        let bodyData = try body.map { try encoder.encode($0) }
        return try await withAuthRetry(bearerToken, method: method, path: path) { token in
            var req = URLRequest(url: url, timeoutInterval: Self.schoolTimeout)
            req.httpMethod = method
            req.setValue("application/json", forHTTPHeaderField: "Accept")
            req.setValue("Bearer \(token ?? bearerToken)", forHTTPHeaderField: "Authorization")
            if let bodyData {
                req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                req.httpBody = bodyData
            }
            return try await perform(req, url: url, using: Self.schoolSession)
        }
    }

    // MARK: - Schools (the teacher area)
    //
    // The teacher's own bearer token. Every classroom endpoint re-checks class
    // ownership server-side; nothing here is trusted for access. Failures come
    // back as TeacherError carrying the server's `code` (nil for a network
    // failure or an unexpected body), which the UI maps to the web's
    // teacher.errors.* copy — a raw HTTP body never reaches the screen.
    // Shapes: Models/TeacherModels.swift.

    struct TeacherError: Error, Sendable {
        let code: String?
    }

    /// The `code` a TeacherError / SchoolError carries when the session is
    /// over (still 401 after one refresh). Not a server code: the app's own,
    /// mapped to "Your session ended — please sign in again."
    static let sessionExpiredCode = "session_expired"

    /// A failure that reaches the UI as a code-less (generic) error. Logged
    /// with what was asked and why it failed, never the token or a body.
    private static func logUnmapped(_ area: String, method: String, path: String, error: Error) {
        if error is CancellationError || (error as? URLError)?.code == .cancelled { return }
        if case APIError.transport(_, let underlying) = error,
           (underlying as? URLError)?.code == .cancelled { return }
        log.error("\(area, privacy: .public) \(method, privacy: .public) \(path, privacy: .public) failed: \(String(describing: error), privacy: .public)")
    }

    func teacherOverview(bearerToken: String) async throws -> TeacherOverview {
        try await teacherCall(method: "GET", path: "/api/school/dashboard", query: [:],
                              body: Optional<EmptyBody>.none, bearerToken: bearerToken)
    }

    func teacherClassDashboard(classId: String, bearerToken: String) async throws -> TeacherClassDashboard {
        try await teacherCall(method: "GET", path: "/api/school/dashboard", query: ["classId": classId],
                              body: Optional<EmptyBody>.none, bearerToken: bearerToken)
    }

    private struct IdBody: Encodable { let id: String }

    func teacherMarkHelpSeen(id: String, bearerToken: String) async throws {
        let _: Ignored = try await teacherCall(method: "POST", path: "/api/school/help-seen", query: [:],
                                               body: IdBody(id: id), bearerToken: bearerToken)
    }

    // MARK: Nudges (api/school/nudges.js)

    private struct TeacherNudgesResponse: Decodable { let nudges: [TeacherNudge]? }

    /// The latest nudge per student of one class ("Sent" / "Seen ✓").
    func teacherNudges(classId: String, bearerToken: String) async throws -> [TeacherNudge] {
        let res: TeacherNudgesResponse = try await teacherCall(
            method: "GET", path: "/api/school/nudges", query: ["classId": classId],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken)
        return res.nudges ?? []
    }

    /// Exactly one of `preset` / `message`; nil fields are left out of the body.
    struct NudgeSend: Encodable, Sendable {
        let classId: String
        let studentIds: [String]
        var preset: String?
        var message: String?
        var assignmentId: String?
    }

    func teacherSendNudge(_ body: NudgeSend, bearerToken: String) async throws -> TeacherNudgeSendResult {
        try await teacherCall(method: "POST", path: "/api/school/nudges", query: [:],
                              body: body, bearerToken: bearerToken)
    }

    func teacherClasses(bearerToken: String) async throws -> [TeacherClass] {
        let res: TeacherClassesResponse = try await teacherCall(
            method: "GET", path: "/api/school/classes", query: [:],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken)
        return res.classes ?? []
    }

    private struct CreateClassBody: Encodable {
        let name: String
        let timezone: String
        let locale: String
    }

    /// POST /api/school/classes. The server gives a new class its free trial
    /// (or says `trial_used_up`); nothing here ever involves a price.
    func teacherCreateClass(name: String, timezone: String, locale: String,
                            bearerToken: String) async throws -> TeacherClassResponse {
        try await teacherCall(method: "POST", path: "/api/school/classes", query: [:],
                              body: CreateClassBody(name: name, timezone: timezone, locale: locale),
                              bearerToken: bearerToken)
    }

    /// PATCH /api/school/classes: only the fields that are set are sent.
    struct ClassPatch: Encodable, Sendable {
        let id: String
        var name: String?
        var sign_in_open: Bool?
        var timezone: String?
        var school_hours: [String: [String]]?
        var locale: String?
    }

    func teacherUpdateClass(_ patch: ClassPatch, bearerToken: String) async throws -> TeacherClass? {
        let res: TeacherClassResponse = try await teacherCall(
            method: "PATCH", path: "/api/school/classes", query: [:], body: patch, bearerToken: bearerToken)
        return res.class
    }

    func teacherRoster(classId: String, bearerToken: String) async throws -> [TeacherRosterStudent] {
        let res: TeacherRosterResponse = try await teacherCall(
            method: "GET", path: "/api/school/students", query: ["classId": classId],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken)
        return res.students ?? []
    }

    private struct AddStudentsBody: Encodable {
        struct Name: Encodable { let name: String }
        let classId: String
        let students: [Name]
    }

    func teacherAddStudents(classId: String, names: [String], bearerToken: String) async throws -> TeacherAddStudentsResponse {
        try await teacherCall(method: "POST", path: "/api/school/students", query: [:],
                              body: AddStudentsBody(classId: classId, students: names.map { .init(name: $0) }),
                              bearerToken: bearerToken)
    }

    private struct StudentActionBody: Encodable {
        let classId: String
        let id: String
        let action: String
        let name: String?
    }

    /// PATCH /api/school/students: reset_secret | unlock | rename | sign_out
    /// | remove | restore. reset_secret answers with the new `pictures`.
    func teacherStudentAction(classId: String, studentId: String, action: String, name: String? = nil,
                              bearerToken: String) async throws -> TeacherStudentActionResponse {
        try await teacherCall(method: "PATCH", path: "/api/school/students", query: [:],
                              body: StudentActionBody(classId: classId, id: studentId, action: action, name: name),
                              bearerToken: bearerToken)
    }

    func teacherStudentBooks(classId: String, studentId: String, bearerToken: String) async throws -> [TeacherStudentBook] {
        let res: TeacherStudentBooksResponse = try await teacherCall(
            method: "GET", path: "/api/school/student-books",
            query: ["classId": classId, "studentId": studentId],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken)
        return res.books ?? []
    }

    func teacherStudentBook(classId: String, studentId: String, bookId: String, bearerToken: String) async throws -> Book? {
        let res: TeacherStudentBookResponse = try await teacherCall(
            method: "GET", path: "/api/school/student-books",
            query: ["classId": classId, "studentId": studentId, "bookId": bookId],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken)
        return res.book
    }

    func teacherStudentCheckins(classId: String, studentId: String, bearerToken: String) async throws -> [TeacherCheckin] {
        let res: TeacherStudentCheckinsResponse = try await teacherCall(
            method: "GET", path: "/api/school/student-checkins",
            query: ["classId": classId, "studentId": studentId],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken)
        return res.checkins ?? []
    }

    func teacherAssignments(classId: String, bearerToken: String) async throws -> [TeacherAssignment] {
        let res: TeacherAssignmentsResponse = try await teacherCall(
            method: "GET", path: "/api/school/assignments", query: ["classId": classId],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken)
        return res.assignments ?? []
    }

    /// Create (POST, `status` "draft" or "published") or edit (PATCH, with
    /// `id`) — the same bodies the web's AssignmentForm and status buttons
    /// send. `dueAt` .some(nil) clears the due date (JSON null); nil leaves
    /// it out of the body entirely.
    struct AssignmentWrite: Encodable, Sendable {
        let classId: String
        var id: String?
        var title: String?
        var prompt: String?
        var dueAt: String??
        var allowLate: Bool?
        var status: String?

        enum CodingKeys: String, CodingKey {
            case classId, id, title, prompt, due_at, allow_late, status
        }

        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(classId, forKey: .classId)
            try c.encodeIfPresent(id, forKey: .id)
            try c.encodeIfPresent(title, forKey: .title)
            try c.encodeIfPresent(prompt, forKey: .prompt)
            if let dueAt {
                if let value = dueAt { try c.encode(value, forKey: .due_at) } else { try c.encodeNil(forKey: .due_at) }
            }
            try c.encodeIfPresent(allowLate, forKey: .allow_late)
            try c.encodeIfPresent(status, forKey: .status)
        }
    }

    func teacherSaveAssignment(_ body: AssignmentWrite, bearerToken: String) async throws -> TeacherAssignment {
        let res: TeacherAssignmentResponse = try await teacherCall(
            method: body.id == nil ? "POST" : "PATCH", path: "/api/school/assignments", query: [:],
            body: body, bearerToken: bearerToken)
        return res.assignment
    }

    func teacherDeleteAssignment(classId: String, id: String, bearerToken: String) async throws {
        let _: Ignored = try await teacherCall(
            method: "DELETE", path: "/api/school/assignments", query: ["classId": classId, "id": id],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken)
    }

    func teacherReviewList(classId: String, assignmentId: String, bearerToken: String) async throws -> TeacherReviewList {
        try await teacherCall(method: "GET", path: "/api/school/submissions",
                              query: ["classId": classId, "assignmentId": assignmentId],
                              body: Optional<EmptyBody>.none, bearerToken: bearerToken)
    }

    func teacherSubmission(classId: String, id: String, bearerToken: String) async throws -> TeacherSubmissionDetail {
        try await teacherCall(method: "GET", path: "/api/school/submissions",
                              query: ["classId": classId, "id": id],
                              body: Optional<EmptyBody>.none, bearerToken: bearerToken)
    }

    private struct FeedbackBody: Encodable {
        let classId: String
        let submissionId: String
        let comment: String?
        let sticker: String?
    }

    func teacherSendFeedback(classId: String, submissionId: String, comment: String?, sticker: String?,
                             bearerToken: String) async throws -> TeacherFeedback {
        let res: TeacherFeedbackResponse = try await teacherCall(
            method: "POST", path: "/api/school/feedback", query: [:],
            body: FeedbackBody(classId: classId, submissionId: submissionId, comment: comment, sticker: sticker),
            bearerToken: bearerToken)
        return res.feedback
    }

    private struct GradeBody: Encodable {
        let classId: String
        let submissionId: String
        let version: Int
        let level: String
        let tips: [GradeTip]
        let returned: Bool
    }

    /// Grades the version the teacher is looking at (api/school/grades.js);
    /// a newer hand-in since then is a version_changed error.
    func teacherGrade(classId: String, submissionId: String, version: Int, level: String,
                      tips: [GradeTip], returned: Bool, bearerToken: String) async throws -> TeacherGradeResult {
        try await teacherCall(
            method: "POST", path: "/api/school/grades", query: [:],
            body: GradeBody(classId: classId, submissionId: submissionId, version: version,
                            level: level, tips: tips, returned: returned),
            bearerToken: bearerToken)
    }

    func teacherStudentGrades(classId: String, studentId: String, bearerToken: String) async throws -> [TeacherStudentGrade] {
        let res: TeacherStudentGradesResponse = try await teacherCall(
            method: "GET", path: "/api/school/grades", query: ["classId": classId, "studentId": studentId],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken)
        return res.grades ?? []
    }

    func teacherNotifications(bearerToken: String) async throws -> TeacherNotificationsResponse {
        try await teacherCall(method: "GET", path: "/api/school/notifications", query: [:],
                              body: Optional<EmptyBody>.none, bearerToken: bearerToken)
    }

    private struct MarkReadBody: Encodable {
        var action = "read"
        let ids: [String]?
    }

    /// `ids` nil marks everything read.
    func teacherMarkNotificationsRead(ids: [String]?, bearerToken: String) async throws {
        let _: Ignored = try await teacherCall(
            method: "POST", path: "/api/school/notifications", query: [:],
            body: MarkReadBody(ids: ids), bearerToken: bearerToken)
    }

    /// DELETE one notification by id. The server only ever deletes the
    /// caller's own rows.
    func teacherDeleteNotification(id: String, bearerToken: String) async throws {
        let _: Ignored = try await teacherCall(
            method: "DELETE", path: "/api/school/notifications", query: ["id": id],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken)
    }

    /// "Clear all": the caller's rows created at or before `before` — the
    /// newest row the teacher had loaded, sent back exactly as the server
    /// gave it, so one arriving meanwhile isn't wiped unseen.
    func teacherClearNotifications(before: String, bearerToken: String) async throws {
        let _: Ignored = try await teacherCall(
            method: "DELETE", path: "/api/school/notifications", query: ["before": before],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken)
    }

    func teacherNotificationSettings(bearerToken: String) async throws -> TeacherNotificationSettings {
        try await teacherCall(method: "GET", path: "/api/school/notification-settings", query: [:],
                              body: Optional<EmptyBody>.none, bearerToken: bearerToken)
    }

    struct NotificationSettingsPatch: Encodable, Sendable {
        var summary: String?
        var push_urgent: Bool?
        var email_urgent: Bool?
    }

    func teacherSaveNotificationSettings(_ patch: NotificationSettingsPatch,
                                         bearerToken: String) async throws -> TeacherNotificationSettings {
        try await teacherCall(method: "PUT", path: "/api/school/notification-settings", query: [:],
                              body: patch, bearerToken: bearerToken)
    }

    private struct TestAlertBody: Encodable { let locale: String }
    private struct TestAlertResponse: Decodable { let sent: Int? }

    /// One push to the caller's own devices, ignoring school hours. Returns
    /// how many devices it reached.
    func teacherSendTestAlert(bearerToken: String) async throws -> Int {
        let res: TestAlertResponse = try await teacherCall(
            method: "POST", path: "/api/school/test-alert", query: [:],
            body: TestAlertBody(locale: AppLanguage.apiLocale), bearerToken: bearerToken)
        return res.sent ?? 0
    }

    // MARK: - Push (a grown-up's APNs device token)

    private struct DeviceTokenBody: Encodable {
        let token: String
        let env: String?
    }

    /// `env` is "sandbox" for development-signed builds, else "production".
    func registerDeviceToken(_ token: String, env: String, bearerToken: String) async throws {
        let _: Ignored = try await teacherCall(
            method: "POST", path: "/api/device-token", query: [:],
            body: DeviceTokenBody(token: token, env: env), bearerToken: bearerToken)
    }

    func forgetDeviceToken(_ token: String, bearerToken: String) async throws {
        let _: Ignored = try await teacherCall(
            method: "DELETE", path: "/api/device-token", query: [:],
            body: DeviceTokenBody(token: token, env: nil), bearerToken: bearerToken)
    }

    private func teacherCall<Body: Encodable, Response: Decodable>(
        method: String, path: String, query: [String: String],
        body: Body?, bearerToken: String
    ) async throws -> Response {
        let url = makeURL(path: path, query: query)
        do {
            let bodyData = try body.map { try encoder.encode($0) }
            return try await withAuthRetry(bearerToken, method: method, path: path) { token in
                var req = URLRequest(url: url, timeoutInterval: 20)
                req.httpMethod = method
                req.setValue("application/json", forHTTPHeaderField: "Accept")
                req.setValue("Bearer \(token ?? bearerToken)", forHTTPHeaderField: "Authorization")
                if let bodyData {
                    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    req.httpBody = bodyData
                }
                return try await perform(req, url: url)
            }
        } catch APIError.sessionExpired {
            throw TeacherError(code: Self.sessionExpiredCode)
        } catch APIError.http(let status, let body) {
            let code = (try? decoder.decode(SchoolErrorBody.self, from: Data(body.utf8)))?.code
            if code == nil {
                Self.log.error("teacher \(method, privacy: .public) \(path, privacy: .public): HTTP \(status, privacy: .public) without an error code")
            }
            throw TeacherError(code: code)
        } catch {
            Self.logUnmapped("teacher", method: method, path: path, error: error)
            throw TeacherError(code: nil)
        }
    }

    // Intent-based "ideas" helpers (Sentence Starters / Help Me Think).
    // Reuses the same /api/story-buddy endpoint as the web app, which for
    // an intent returns the raw Anthropic message; we parse it to a list.
    private struct StoryBuddyIntentRequest: Encodable {
        let intent: String
        let book: SlimBook
        let page: SlimPage
        /// See StoryBuddyRequest.locale.
        var locale: String = AppLanguage.apiLocale

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
                // The names the child sees, in their language — never the
                // stored English catalogue names.
                characters: book.characters.map { .init(name: $0.displayName) },
                setting: book.setting.map { .init(name: $0.displayName) },
                pages: book.pages.map { .init(pageNumber: $0.pageNumber, text: $0.text) }
            ),
            page: .init(pageNumber: page.pageNumber, text: page.text)
        )
        let res: AnthropicTextResponse = try await attestedRequest(
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

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
        return try await perform(req, url: url)
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
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        req.setValue("ios", forHTTPHeaderField: "x-client-platform")
        let data = try encoder.encode(body)
        req.httpBody = data
        if let attestHeaders = await AppAttestService.shared.assertionHeaders(
            for: data, bearerToken: bearerToken
        ) {
            for (key, value) in attestHeaders {
                req.setValue(value, forHTTPHeaderField: key)
            }
        }
        return try await perform(req, url: url)
    }

    private func perform<Response: Decodable>(_ req: URLRequest, url: URL,
                                              using urlSession: URLSession? = nil) async throws -> Response {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await (urlSession ?? session).data(for: req)
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

    struct GenerateImageRequest: Encodable {
        let prompt: String
        let style: String?
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
        } catch APIError.http(_, let body) {
            throw SchoolError(code: (try? decoder.decode(SchoolErrorBody.self, from: Data(body.utf8)))?.code)
        } catch {
            throw SchoolError(code: nil)
        }
    }

    private func schoolAuthed<Body: Encodable, Response: Decodable>(
        method: String, path: String, query: [String: String],
        body: Body?, bearerToken: String
    ) async throws -> Response {
        let url = makeURL(path: path, query: query)
        var req = URLRequest(url: url, timeoutInterval: Self.schoolTimeout)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try encoder.encode(body)
        }
        return try await perform(req, url: url, using: Self.schoolSession)
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

    func teacherClasses(bearerToken: String) async throws -> [TeacherClass] {
        let res: TeacherClassesResponse = try await teacherCall(
            method: "GET", path: "/api/school/classes", query: [:],
            body: Optional<EmptyBody>.none, bearerToken: bearerToken)
        return res.classes ?? []
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
        var req = URLRequest(url: url, timeoutInterval: 20)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try encoder.encode(body)
        }
        do {
            return try await perform(req, url: url)
        } catch APIError.http(_, let body) {
            throw TeacherError(code: (try? decoder.decode(SchoolErrorBody.self, from: Data(body.utf8)))?.code)
        } catch {
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
                characters: book.characters.map { .init(name: $0.name) },
                setting: book.setting.map { .init(name: $0.name) },
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

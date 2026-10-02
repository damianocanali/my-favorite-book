// Worksheet assignments (spec 2026-10-01 §2, migration 023) on the iPad:
// the template structure, the boxes a child fills in, the on-device draft,
// and "Turn into book pages". A mirror of lib/school/worksheets.js (the
// structure and the page mapping) and src/components/school/worksheetUi.js
// (layout, drafts); tests/worksheets-ios.test.js fails if the template
// list drifts from lib. The wording is in WorksheetCopy.swift.
import Foundation

struct WorksheetTemplate: Hashable, Sendable {
    enum Size: String, Sendable { case small, medium, large }
    enum Join: Sendable { case lines, paragraph }

    struct Box: Hashable, Sendable {
        let id: String
        let size: Size
        /// The acrostic's letters: one box per letter of the word.
        let perLetter: Bool
        init(_ id: String, _ size: Size, perLetter: Bool = false) {
            self.id = id; self.size = size; self.perLetter = perLetter
        }
    }

    let id: String
    let boxes: [Box]
    /// Which boxes become which book page in "Turn into book pages".
    let pages: [[String]]
    let join: Join

    var boxIds: [String] { boxes.map(\.id) }
}

enum WorksheetTemplates {
    static let promptMax = 300
    static let answerMax = 2000
    static let acrosticWordMax = 12
    /// The web editor's longest page and most pages (lib PAGE_TEXT_MAX,
    /// BOOK_PAGES_MAX).
    static let pageTextMax = 500
    static let bookPagesMax = 24

    // Same order and contents as WORKSHEET_TEMPLATES in lib/school/worksheets.js.
    static let all: [WorksheetTemplate] = [
        WorksheetTemplate(id: "story_map", boxes: [.init("characters", .medium), .init("setting", .medium), .init("problem", .medium), .init("events", .large), .init("ending", .medium)],
                          pages: [["characters", "setting"], ["problem", "events"], ["ending"]], join: .lines),
        WorksheetTemplate(id: "character_profile", boxes: [.init("name", .small), .init("looks_like", .medium), .init("likes", .medium), .init("wants", .medium), .init("afraid_of", .medium)],
                          pages: [["name", "looks_like"], ["likes", "wants"], ["afraid_of"]], join: .lines),
        WorksheetTemplate(id: "beginning_middle_end", boxes: [.init("beginning", .large), .init("middle", .large), .init("end", .large)],
                          pages: [["beginning"], ["middle"], ["end"]], join: .lines),
        WorksheetTemplate(id: "five_senses", boxes: [.init("place", .small), .init("see", .medium), .init("hear", .medium), .init("smell", .medium), .init("touch", .medium), .init("taste", .medium)],
                          pages: [["place", "see", "hear"], ["smell", "touch", "taste"]], join: .lines),
        WorksheetTemplate(id: "letter", boxes: [.init("greeting", .small), .init("opening", .medium), .init("body", .large), .init("closing", .medium), .init("signature", .small)],
                          pages: [["greeting", "opening", "body", "closing", "signature"]], join: .lines),
        WorksheetTemplate(id: "opinion", boxes: [.init("opinion", .medium), .init("reason", .medium), .init("example", .medium), .init("conclusion", .medium)],
                          pages: [["opinion", "reason", "example", "conclusion"]], join: .paragraph),
        WorksheetTemplate(id: "acrostic", boxes: [.init("word", .small), .init("lines", .large, perLetter: true)],
                          pages: [["lines"]], join: .lines),
        WorksheetTemplate(id: "sequence", boxes: [.init("first", .medium), .init("next", .medium), .init("then", .medium), .init("last", .medium)],
                          pages: [["first"], ["next"], ["then"], ["last"]], join: .lines),
        WorksheetTemplate(id: "my_week", boxes: [.init("best", .medium), .init("learned", .medium), .init("tricky", .medium), .init("felt_good", .medium), .init("next_week", .medium)],
                          pages: [["best", "learned", "tricky", "felt_good", "next_week"]], join: .lines),
    ]

    static func find(_ id: String?) -> WorksheetTemplate? {
        guard let id else { return nil }
        return all.first { $0.id == id }
    }

    /// The acrostic word, upper-cased, or nil if it isn't 2-12 letters
    /// (checked after upper-casing, like lib's cleanAcrosticWord).
    static func cleanAcrosticWord(_ value: String?) -> String? {
        guard let value else { return nil }
        let w = value.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let letters = Array(w)
        guard (2...acrosticWordMax).contains(letters.count), letters.allSatisfy(\.isLetter) else { return nil }
        return w
    }
}

/// assignments.worksheet: the template and the teacher's prompts.
struct WorksheetDefinition: Codable, Hashable, Sendable {
    var templateId: String
    var prompts: [String: String]
    /// The acrostic's word when the teacher chose it.
    var word: String?

    var template: WorksheetTemplate? { WorksheetTemplates.find(templateId) }
    var isAcrostic: Bool { templateId == "acrostic" }
}

/// A hand-in's frozen worksheet (api/school/submissions.js `worksheet`):
/// the prompts as the child saw them.
struct WorksheetSnapshot: Decodable, Hashable, Sendable {
    struct Box: Decodable, Hashable, Sendable {
        let id: String
        let prompt: String?
    }
    let templateId: String
    let boxes: [Box]?
    let word: String?

    var definition: WorksheetDefinition {
        WorksheetDefinition(
            templateId: templateId,
            prompts: Dictionary((boxes ?? []).map { ($0.id, $0.prompt ?? "") }, uniquingKeysWith: { a, _ in a }),
            word: word)
    }
}

/// One thing on the fill-in screen, in order (web: fillLayout).
enum WorksheetItem: Identifiable, Hashable {
    case box(id: String, prompt: String, size: WorksheetTemplate.Size)
    /// The acrostic's word: the teacher's (fixed) or the child's own.
    case word(prompt: String, fixed: Bool)
    case letters(prompt: String, letters: [Letter])

    struct Letter: Hashable, Identifiable {
        let id: String
        let letter: String
    }

    var id: String {
        switch self {
        case .box(let id, _, _): id
        case .word: "word"
        case .letters: "lines"
        }
    }
}

enum WorksheetLayout {
    static func items(_ def: WorksheetDefinition, childWord: String? = nil) -> [WorksheetItem] {
        guard let template = def.template else { return [] }
        let effective = def.word ?? WorksheetTemplates.cleanAcrosticWord(childWord)
        return template.boxes.map { b in
            let prompt = def.prompts[b.id] ?? ""
            if def.isAcrostic && b.id == "word" { return .word(prompt: prompt, fixed: def.word != nil) }
            if b.perLetter {
                let letters = Array(effective ?? "").enumerated().map { i, c in
                    WorksheetItem.Letter(id: "line_\(i + 1)", letter: String(c))
                }
                return .letters(prompt: prompt, letters: letters)
            }
            return .box(id: b.id, prompt: prompt, size: b.size)
        }
    }

    /// What POST /api/school/submit takes (web: answersForSubmit): every
    /// box written in, the child's own acrostic word when the teacher left
    /// it open, never a line past the word's last letter.
    static func answersForSubmit(_ def: WorksheetDefinition, _ answers: [String: String]) -> [String: String] {
        var out: [String: String] = [:]
        let word = def.isAcrostic ? (def.word ?? WorksheetTemplates.cleanAcrosticWord(answers["word"])) : nil
        let n = Array(word ?? "").count
        for (k, v) in answers where !v.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            if def.isAcrostic {
                if k == "word" {
                    if def.word == nil { out[k] = v.trimmingCharacters(in: .whitespacesAndNewlines) }
                    continue
                }
                guard k.hasPrefix("line_"), let i = Int(k.dropFirst(5)), i >= 1, i <= n else { continue }
            }
            out[k] = v
        }
        return out
    }

    static func hasAnswers(_ answers: [String: String]) -> Bool {
        answers.contains { $0.key != "word" && !$0.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }
}

// MARK: - Turn into book pages (lib: worksheetPages; deterministic, no AI)

enum WorksheetPages {
    /// Chunks of at most `max`, cut at a sentence end or a space in the
    /// second half of the chunk when there is one, else hard (lib:
    /// splitPageText).
    static func split(_ text: String, max: Int = WorksheetTemplates.pageTextMax) -> [String] {
        var out: [String] = []
        var rest = Array(text.trimmingCharacters(in: .whitespacesAndNewlines))
        while rest.count > max {
            let head = Array(rest.prefix(max + 1))
            var cut = -1
            // A sentence end followed by whitespace, then any whitespace.
            for i in stride(from: min(max, head.count - 1), through: max / 2, by: -1) where i >= 1 {
                if head[i].isWhitespace, ".!?…".contains(head[i - 1]) { cut = i; break }
            }
            if cut == -1 {
                for i in stride(from: min(max, head.count - 1), through: max / 2, by: -1) where head[i].isWhitespace {
                    cut = i; break
                }
            }
            if cut == -1 { cut = max }
            out.append(String(rest[..<cut]).trimmingCharacters(in: .whitespacesAndNewlines))
            rest = Array(String(rest[cut...]).trimmingCharacters(in: .whitespacesAndNewlines))
        }
        if !rest.isEmpty { out.append(String(rest)) }
        return out
    }

    static func pages(_ def: WorksheetDefinition, answers: [String: String]) -> [String] {
        guard let template = def.template else { return [] }
        let sep = template.join == .paragraph ? " " : "\n"
        let trimmed = answers.mapValues { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        var result: [String] = []
        for group in template.pages {
            var parts: [String] = []
            var hasWriting = false
            for id in group {
                if id == "lines" {
                    let word = def.word ?? trimmed["word"]
                    for (i, c) in Array(word ?? "").enumerated() {
                        let a = trimmed["line_\(i + 1)"] ?? ""
                        parts.append(a.isEmpty ? String(c) : a)
                    }
                    hasWriting = hasWriting || trimmed.contains { $0.key.hasPrefix("line_") && !$0.value.isEmpty }
                } else if let a = trimmed[id], !a.isEmpty {
                    parts.append(a)
                    hasWriting = true
                }
            }
            let text = parts.joined(separator: sep).trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty && hasWriting { result.append(contentsOf: split(text)) }
        }
        return result
    }

    /// The book pages are added to: the one open in the editor when it is
    /// the one picked (its unsaved edits must never be lost), else the
    /// shelf copy (web: pagesBase).
    static func base(open: Book?, picked: Book) -> Book {
        if let open, open.id == picked.id { return open }
        return picked
    }

    /// `book` with `texts` added as new pages, numbered on, never past the
    /// page limit.
    static func append(_ texts: [String], to book: Book) -> Book {
        var b = book
        let room = max(0, WorksheetTemplates.bookPagesMax - b.pages.count)
        for text in texts.prefix(room) {
            let n = (b.pages.last?.pageNumber ?? 0) + 1
            b.pages.append(BookPage(id: n, pageNumber: n, text: text, illustrationData: nil))
        }
        b.updatedAt = ISO8601DateFormatter().string(from: Date())
        return b
    }
}

// MARK: - On-device draft (no server drafts in v1)

/// A child's answers, autosaved on this iPad per child and assignment (a
/// shared class iPad never shows one child's answers to the next). Kept
/// across sign-out (a child picks up where they left off), but never past
/// their assignment: deleted after a successful hand-in, and pruned on
/// every assignments load for assignments no longer listed or closed.
/// Same rules as the web's localStorage drafts; the two never meet.
enum WorksheetDrafts {
    struct Draft: Codable, Equatable {
        var answers: [String: String]
        var updatedAt: Date
    }

    private static func prefix(_ userId: String) -> String { "mbl.worksheetDraft.\(userId)." }
    private static func key(_ userId: String, _ assignmentId: String) -> String {
        "mbl.worksheetDraft.\(userId).\(assignmentId)"
    }

    static func read(userId: String?, assignmentId: String, defaults: UserDefaults = .standard) -> Draft? {
        guard let userId, let data = defaults.data(forKey: key(userId, assignmentId)) else { return nil }
        return try? JSONDecoder().decode(Draft.self, from: data)
    }

    static func write(_ answers: [String: String], userId: String?, assignmentId: String, defaults: UserDefaults = .standard) {
        guard let userId, let data = try? JSONEncoder().encode(Draft(answers: answers, updatedAt: Date())) else { return }
        defaults.set(data, forKey: key(userId, assignmentId))
    }

    static func remove(userId: String?, assignmentId: String, defaults: UserDefaults = .standard) {
        guard let userId else { return }
        defaults.removeObject(forKey: key(userId, assignmentId))
    }

    /// Deletes this child's drafts for every assignment that isn't listed
    /// and open (published) any more.
    static func prune(userId: String?, keeping assignments: [StudentAssignment], defaults: UserDefaults = .standard) {
        guard let userId else { return }
        let keep = Set(assignments.filter { $0.status == "published" }.map(\.id))
        let p = prefix(userId)
        for k in defaults.dictionaryRepresentation().keys where k.hasPrefix(p) {
            if !keep.contains(String(k.dropFirst(p.count))) { defaults.removeObject(forKey: k) }
        }
    }

    /// Every draft this child has on this device — called on a class
    /// account's sign-out (shared iPads: the next child must not find a
    /// classmate's answers at rest on the device). Unsent answers are lost
    /// by design; the hand-in itself lives on the server.
    static func removeAll(userId: String?, defaults: UserDefaults = .standard) {
        guard let userId else { return }
        let p = prefix(userId)
        for k in defaults.dictionaryRepresentation().keys where k.hasPrefix(p) { defaults.removeObject(forKey: k) }
    }

    static func hasDraft(userId: String?, assignmentId: String) -> Bool {
        WorksheetLayout.hasAnswers(read(userId: userId, assignmentId: assignmentId)?.answers ?? [:])
    }

    enum Start: Equatable { case draft, handedIn, empty }

    /// This iPad's draft, unless the hand-in is newer (handed in again on
    /// another device since): then the hand-in (web: startingPoint).
    static func startingPoint(draft: Draft?, submission: StudentAssignment.MySubmission?) -> Start {
        if let draft, let submitted = StudentAssignment.parseDate(submission?.submitted_at), submitted > draft.updatedAt {
            return .handedIn
        }
        if draft != nil { return .draft }
        return submission != nil ? .handedIn : .empty
    }
}

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
    /// The library's shelves, in display order (lib WORKSHEET_CATEGORIES).
    enum Category: String, CaseIterable, Sendable {
        case plan, characters, words, poems, opinions, reading, facts, me
    }
    /// Grades K-2, grades 3-5, or any grade (lib GRADE_BANDS).
    enum GradeBand: String, CaseIterable, Sendable { case k2, g35, all }

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
    let category: Category
    let grade: GradeBand
    let boxes: [Box]
    /// Which boxes become which book page in "Turn into book pages".
    let pages: [[String]]
    let join: Join

    var boxIds: [String] { boxes.map(\.id) }

    /// Shown under a grade filter: an any-grade sheet is under both
    /// (lib matchesGrade). nil = every grade.
    func matches(grade filter: GradeBand?) -> Bool {
        guard let filter, filter != .all else { return true }
        return grade == .all || grade == filter
    }
}

enum WorksheetTemplates {
    static let promptMax = 300
    static let answerMax = 2000
    static let acrosticWordMax = 12
    /// The web editor's longest page and most pages (lib PAGE_TEXT_MAX,
    /// BOOK_PAGES_MAX).
    static let pageTextMax = 500
    static let bookPagesMax = 24

    // Same order and contents as WORKSHEET_TEMPLATES in lib/school/worksheets.js
    // (33 sheets in eight categories). The first nine of lib's history
    // (story_map … my_week) are live data: their ids and box ids never change.
    static let all: [WorksheetTemplate] = [
        WorksheetTemplate(id: "story_map", category: .plan, grade: .all,
                          boxes: [.init("characters", .medium), .init("setting", .medium), .init("problem", .medium), .init("events", .large), .init("ending", .medium)],
                          pages: [["characters", "setting"], ["problem", "events"], ["ending"]], join: .lines),
        WorksheetTemplate(id: "beginning_middle_end", category: .plan, grade: .k2,
                          boxes: [.init("beginning", .large), .init("middle", .large), .init("end", .large)],
                          pages: [["beginning"], ["middle"], ["end"]], join: .lines),
        WorksheetTemplate(id: "sequence", category: .plan, grade: .k2,
                          boxes: [.init("first", .medium), .init("next", .medium), .init("then", .medium), .init("last", .medium)],
                          pages: [["first"], ["next"], ["then"], ["last"]], join: .lines),
        WorksheetTemplate(id: "storyboard", category: .plan, grade: .all,
                          boxes: [.init("panel_one", .medium), .init("panel_two", .medium), .init("panel_three", .medium), .init("panel_four", .medium), .init("panel_five", .medium), .init("panel_six", .medium)],
                          pages: [["panel_one", "panel_two"], ["panel_three", "panel_four"], ["panel_five", "panel_six"]], join: .lines),
        WorksheetTemplate(id: "problem_solution", category: .plan, grade: .k2,
                          boxes: [.init("problem", .medium), .init("tries", .large), .init("solution", .medium)],
                          pages: [["problem"], ["tries"], ["solution"]], join: .lines),
        WorksheetTemplate(id: "story_mountain", category: .plan, grade: .g35,
                          boxes: [.init("beginning", .medium), .init("build_up", .medium), .init("big_moment", .medium), .init("wind_down", .medium), .init("ending", .medium)],
                          pages: [["beginning", "build_up"], ["big_moment"], ["wind_down", "ending"]], join: .lines),
        WorksheetTemplate(id: "character_profile", category: .characters, grade: .k2,
                          boxes: [.init("name", .small), .init("looks_like", .medium), .init("likes", .medium), .init("wants", .medium), .init("afraid_of", .medium)],
                          pages: [["name", "looks_like"], ["likes", "wants"], ["afraid_of"]], join: .lines),
        WorksheetTemplate(id: "setting_sketch", category: .characters, grade: .k2,
                          boxes: [.init("place", .small), .init("when", .small), .init("looks_like", .medium), .init("sounds_smells", .medium)],
                          pages: [["place", "when", "looks_like", "sounds_smells"]], join: .lines),
        WorksheetTemplate(id: "five_senses", category: .characters, grade: .all,
                          boxes: [.init("place", .small), .init("see", .medium), .init("hear", .medium), .init("smell", .medium), .init("touch", .medium), .init("taste", .medium)],
                          pages: [["place", "see", "hear"], ["smell", "touch", "taste"]], join: .lines),
        WorksheetTemplate(id: "character_change", category: .characters, grade: .g35,
                          boxes: [.init("character", .small), .init("at_start", .medium), .init("what_happened", .medium), .init("at_end", .medium)],
                          pages: [["character", "at_start"], ["what_happened"], ["at_end"]], join: .lines),
        WorksheetTemplate(id: "sentence_starters", category: .words, grade: .k2,
                          boxes: [.init("sentence_one", .medium), .init("sentence_two", .medium), .init("sentence_three", .medium), .init("sentence_four", .medium)],
                          pages: [["sentence_one", "sentence_two", "sentence_three", "sentence_four"]], join: .paragraph),
        WorksheetTemplate(id: "describing_words", category: .words, grade: .k2,
                          boxes: [.init("thing", .small), .init("word_one", .small), .init("word_two", .small), .init("word_three", .small), .init("word_four", .small), .init("word_five", .small)],
                          pages: [["thing", "word_one", "word_two", "word_three", "word_four", "word_five"]], join: .lines),
        WorksheetTemplate(id: "word_web", category: .words, grade: .all,
                          boxes: [.init("center", .small), .init("idea_one", .small), .init("idea_two", .small), .init("idea_three", .small), .init("idea_four", .small), .init("idea_five", .small), .init("idea_six", .small)],
                          pages: [["center", "idea_one", "idea_two", "idea_three", "idea_four", "idea_five", "idea_six"]], join: .lines),
        WorksheetTemplate(id: "stretch_sentence", category: .words, grade: .k2,
                          boxes: [.init("who", .small), .init("did_what", .small), .init("where", .small), .init("when", .small), .init("why", .small), .init("my_sentence", .large)],
                          pages: [["my_sentence"]], join: .lines),
        WorksheetTemplate(id: "dialogue", category: .words, grade: .g35,
                          boxes: [.init("character_a", .small), .init("character_b", .small), .init("conversation", .large)],
                          pages: [["conversation"]], join: .lines),
        WorksheetTemplate(id: "acrostic", category: .poems, grade: .all,
                          boxes: [.init("word", .small), .init("lines", .large, perLetter: true)],
                          pages: [["lines"]], join: .lines),
        WorksheetTemplate(id: "haiku", category: .poems, grade: .g35,
                          boxes: [.init("line_one", .small), .init("line_two", .small), .init("line_three", .small)],
                          pages: [["line_one", "line_two", "line_three"]], join: .lines),
        WorksheetTemplate(id: "i_am_poem", category: .poems, grade: .all,
                          boxes: [.init("i_am", .small), .init("i_wonder", .small), .init("i_hear", .small), .init("i_see", .small), .init("i_want", .small), .init("i_am_again", .small)],
                          pages: [["i_am", "i_wonder", "i_hear", "i_see", "i_want", "i_am_again"]], join: .lines),
        WorksheetTemplate(id: "cinquain", category: .poems, grade: .g35,
                          boxes: [.init("noun", .small), .init("two_describing", .small), .init("three_doing", .small), .init("feeling_phrase", .small), .init("another_name", .small)],
                          pages: [["noun", "two_describing", "three_doing", "feeling_phrase", "another_name"]], join: .lines),
        WorksheetTemplate(id: "opinion", category: .opinions, grade: .g35,
                          boxes: [.init("opinion", .medium), .init("reason", .medium), .init("example", .medium), .init("conclusion", .medium)],
                          pages: [["opinion", "reason", "example", "conclusion"]], join: .paragraph),
        WorksheetTemplate(id: "letter", category: .opinions, grade: .all,
                          boxes: [.init("greeting", .small), .init("opening", .medium), .init("body", .large), .init("closing", .medium), .init("signature", .small)],
                          pages: [["greeting", "opening", "body", "closing", "signature"]], join: .lines),
        WorksheetTemplate(id: "thank_you", category: .opinions, grade: .k2,
                          boxes: [.init("to", .small), .init("thank_you_for", .medium), .init("because", .medium), .init("from", .small)],
                          pages: [["to", "thank_you_for", "because", "from"]], join: .lines),
        WorksheetTemplate(id: "persuade", category: .opinions, grade: .g35,
                          boxes: [.init("should", .medium), .init("reason_one", .medium), .init("reason_two", .medium), .init("reason_three", .medium), .init("so", .medium)],
                          pages: [["should", "reason_one", "reason_two", "reason_three", "so"]], join: .paragraph),
        WorksheetTemplate(id: "book_report", category: .reading, grade: .all,
                          boxes: [.init("title", .small), .init("author", .small), .init("about", .medium), .init("favorite", .medium), .init("would_recommend", .medium)],
                          pages: [["title", "author", "about"], ["favorite", "would_recommend"]], join: .lines),
        WorksheetTemplate(id: "favorite_part", category: .reading, grade: .k2,
                          boxes: [.init("title", .small), .init("part", .medium), .init("why", .medium)],
                          pages: [["title", "part", "why"]], join: .lines),
        WorksheetTemplate(id: "predict", category: .reading, grade: .all,
                          boxes: [.init("title", .small), .init("clues", .medium), .init("prediction", .medium), .init("what_happened", .medium)],
                          pages: [["clues", "prediction"], ["what_happened"]], join: .lines),
        WorksheetTemplate(id: "compare_books", category: .reading, grade: .g35,
                          boxes: [.init("book_one", .small), .init("book_two", .small), .init("same", .medium), .init("different", .medium)],
                          pages: [["book_one", "book_two", "same"], ["different"]], join: .lines),
        WorksheetTemplate(id: "all_about", category: .facts, grade: .all,
                          boxes: [.init("topic", .small), .init("fact_one", .medium), .init("fact_two", .medium), .init("fact_three", .medium), .init("wow_fact", .medium)],
                          pages: [["topic", "fact_one"], ["fact_two", "fact_three"], ["wow_fact"]], join: .lines),
        WorksheetTemplate(id: "how_to", category: .facts, grade: .all,
                          boxes: [.init("what", .small), .init("need", .medium), .init("step_one", .medium), .init("step_two", .medium), .init("step_three", .medium), .init("step_four", .medium)],
                          pages: [["what", "need"], ["step_one", "step_two"], ["step_three", "step_four"]], join: .lines),
        WorksheetTemplate(id: "about_author", category: .me, grade: .k2,
                          boxes: [.init("my_name", .small), .init("i_like", .medium), .init("i_write_about", .medium), .init("fun_fact", .medium)],
                          pages: [["my_name", "i_like", "i_write_about", "fun_fact"]], join: .lines),
        WorksheetTemplate(id: "feelings_checkin", category: .me, grade: .k2,
                          boxes: [.init("feeling", .small), .init("why", .medium), .init("what_helps", .medium)],
                          pages: [["feeling", "why", "what_helps"]], join: .lines),
        WorksheetTemplate(id: "my_week", category: .me, grade: .all,
                          boxes: [.init("best", .medium), .init("learned", .medium), .init("tricky", .medium), .init("felt_good", .medium), .init("next_week", .medium)],
                          pages: [["best", "learned", "tricky", "felt_good", "next_week"]], join: .lines),
        WorksheetTemplate(id: "all_about_me", category: .me, grade: .k2,
                          boxes: [.init("favorites", .medium), .init("good_at", .medium), .init("learning", .medium), .init("dream", .medium)],
                          pages: [["favorites", "good_at"], ["learning", "dream"]], join: .lines),
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
        // A template this build doesn't know (added after it shipped): a
        // plain box per prompt the assignment carries, so the child can still
        // answer — the server knows the template and checks the box ids.
        guard let template = def.template else {
            return def.prompts.keys.sorted().map { .box(id: $0, prompt: def.prompts[$0] ?? "", size: .medium) }
        }
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

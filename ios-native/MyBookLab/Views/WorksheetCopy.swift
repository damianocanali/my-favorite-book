// The worksheet copy on the iPad (spec 2026-10-01 §2): each template's
// title, description and default box prompts, and the worksheet screens'
// own strings. Same keys and wording as the web (school.json worksheet.*);
// tests/worksheets-ios.test.js checks every key here is in
// Localizable.xcstrings with the web's EN and IT. Generated from
// school.json — edit there, then regenerate, never one side alone.
import Foundation

enum WorksheetCopy {
    static func title(_ templateId: String) -> LocalizedStringResource {
        switch templateId {
        case "story_map": AppText("school.worksheet.templates.story_map.title", defaultValue: "Story map")
        case "character_profile": AppText("school.worksheet.templates.character_profile.title", defaultValue: "Character profile")
        case "beginning_middle_end": AppText("school.worksheet.templates.beginning_middle_end.title", defaultValue: "Beginning, middle, end")
        case "five_senses": AppText("school.worksheet.templates.five_senses.title", defaultValue: "Five senses")
        case "letter": AppText("school.worksheet.templates.letter.title", defaultValue: "Letter to a character")
        case "opinion": AppText("school.worksheet.templates.opinion.title", defaultValue: "Opinion paragraph (OREO)")
        case "acrostic": AppText("school.worksheet.templates.acrostic.title", defaultValue: "Acrostic poem")
        case "sequence": AppText("school.worksheet.templates.sequence.title", defaultValue: "Sequence of events")
        case "my_week": AppText("school.worksheet.templates.my_week.title", defaultValue: "My week")
        default: AppText("school.worksheet.teacher.chip", defaultValue: "Worksheet")
        }
    }

    static func description(_ templateId: String) -> LocalizedStringResource {
        switch templateId {
        case "story_map": AppText("school.worksheet.templates.story_map.description", defaultValue: "Plan a story: who, where, the problem, what happens and the ending.")
        case "character_profile": AppText("school.worksheet.templates.character_profile.description", defaultValue: "Get to know a character before writing about them.")
        case "beginning_middle_end": AppText("school.worksheet.templates.beginning_middle_end.description", defaultValue: "Three big boxes for the three parts of a story.")
        case "five_senses": AppText("school.worksheet.templates.five_senses.description", defaultValue: "Describe a place with sight, sound, smell, touch and taste.")
        case "letter": AppText("school.worksheet.templates.letter.description", defaultValue: "Write a letter to someone from a story.")
        case "opinion": AppText("school.worksheet.templates.opinion.description", defaultValue: "Opinion, reason, example, opinion again.")
        case "acrostic": AppText("school.worksheet.templates.acrostic.description", defaultValue: "One line for each letter of a word.")
        case "sequence": AppText("school.worksheet.templates.sequence.description", defaultValue: "First, next, then, last.")
        case "my_week": AppText("school.worksheet.templates.my_week.description", defaultValue: "A journal page about the week.")
        default: AppText("school.worksheet.teacher.chip", defaultValue: "Worksheet")
        }
    }

    /// The template's own prompt for a box, in the app's language: what a
    /// teacher starts editing from.
    static func defaultPrompt(_ templateId: String, _ boxId: String) -> LocalizedStringResource? {
        switch (templateId, boxId) {
        case ("story_map", "characters"): AppText("school.worksheet.templates.story_map.boxes.characters", defaultValue: "Who is in your story?")
        case ("story_map", "setting"): AppText("school.worksheet.templates.story_map.boxes.setting", defaultValue: "Where and when does it happen?")
        case ("story_map", "problem"): AppText("school.worksheet.templates.story_map.boxes.problem", defaultValue: "What is the problem?")
        case ("story_map", "events"): AppText("school.worksheet.templates.story_map.boxes.events", defaultValue: "What happens? Write the big moments.")
        case ("story_map", "ending"): AppText("school.worksheet.templates.story_map.boxes.ending", defaultValue: "How does it end?")
        case ("character_profile", "name"): AppText("school.worksheet.templates.character_profile.boxes.name", defaultValue: "What is your character’s name?")
        case ("character_profile", "looks_like"): AppText("school.worksheet.templates.character_profile.boxes.looks_like", defaultValue: "What do they look like?")
        case ("character_profile", "likes"): AppText("school.worksheet.templates.character_profile.boxes.likes", defaultValue: "What do they like to do?")
        case ("character_profile", "wants"): AppText("school.worksheet.templates.character_profile.boxes.wants", defaultValue: "What do they want most?")
        case ("character_profile", "afraid_of"): AppText("school.worksheet.templates.character_profile.boxes.afraid_of", defaultValue: "What are they afraid of?")
        case ("beginning_middle_end", "beginning"): AppText("school.worksheet.templates.beginning_middle_end.boxes.beginning", defaultValue: "Beginning: how does your story start?")
        case ("beginning_middle_end", "middle"): AppText("school.worksheet.templates.beginning_middle_end.boxes.middle", defaultValue: "Middle: what happens next?")
        case ("beginning_middle_end", "end"): AppText("school.worksheet.templates.beginning_middle_end.boxes.end", defaultValue: "End: how does it finish?")
        case ("five_senses", "place"): AppText("school.worksheet.templates.five_senses.boxes.place", defaultValue: "Which place are you describing?")
        case ("five_senses", "see"): AppText("school.worksheet.templates.five_senses.boxes.see", defaultValue: "What can you see?")
        case ("five_senses", "hear"): AppText("school.worksheet.templates.five_senses.boxes.hear", defaultValue: "What can you hear?")
        case ("five_senses", "smell"): AppText("school.worksheet.templates.five_senses.boxes.smell", defaultValue: "What can you smell?")
        case ("five_senses", "touch"): AppText("school.worksheet.templates.five_senses.boxes.touch", defaultValue: "What can you touch?")
        case ("five_senses", "taste"): AppText("school.worksheet.templates.five_senses.boxes.taste", defaultValue: "What can you taste?")
        case ("letter", "greeting"): AppText("school.worksheet.templates.letter.boxes.greeting", defaultValue: "Who are you writing to?")
        case ("letter", "opening"): AppText("school.worksheet.templates.letter.boxes.opening", defaultValue: "Say hello and why you are writing.")
        case ("letter", "body"): AppText("school.worksheet.templates.letter.boxes.body", defaultValue: "What do you want to tell or ask?")
        case ("letter", "closing"): AppText("school.worksheet.templates.letter.boxes.closing", defaultValue: "How do you end your letter?")
        case ("letter", "signature"): AppText("school.worksheet.templates.letter.boxes.signature", defaultValue: "Sign your name.")
        case ("opinion", "opinion"): AppText("school.worksheet.templates.opinion.boxes.opinion", defaultValue: "O — Opinion: what do you think?")
        case ("opinion", "reason"): AppText("school.worksheet.templates.opinion.boxes.reason", defaultValue: "R — Reason: why do you think so?")
        case ("opinion", "example"): AppText("school.worksheet.templates.opinion.boxes.example", defaultValue: "E — Example: give an example.")
        case ("opinion", "conclusion"): AppText("school.worksheet.templates.opinion.boxes.conclusion", defaultValue: "O — Opinion again: say it one more time.")
        case ("acrostic", "word"): AppText("school.worksheet.templates.acrostic.boxes.word", defaultValue: "Choose a word. Each letter starts a line.")
        case ("acrostic", "lines"): AppText("school.worksheet.templates.acrostic.boxes.lines", defaultValue: "Write a word or a line for each letter.")
        case ("sequence", "first"): AppText("school.worksheet.templates.sequence.boxes.first", defaultValue: "First…")
        case ("sequence", "next"): AppText("school.worksheet.templates.sequence.boxes.next", defaultValue: "Next…")
        case ("sequence", "then"): AppText("school.worksheet.templates.sequence.boxes.then", defaultValue: "Then…")
        case ("sequence", "last"): AppText("school.worksheet.templates.sequence.boxes.last", defaultValue: "Last…")
        case ("my_week", "best"): AppText("school.worksheet.templates.my_week.boxes.best", defaultValue: "The best part of my week was…")
        case ("my_week", "learned"): AppText("school.worksheet.templates.my_week.boxes.learned", defaultValue: "Something new I learned…")
        case ("my_week", "tricky"): AppText("school.worksheet.templates.my_week.boxes.tricky", defaultValue: "Something tricky was…")
        case ("my_week", "felt_good"): AppText("school.worksheet.templates.my_week.boxes.felt_good", defaultValue: "Something that made me feel good…")
        case ("my_week", "next_week"): AppText("school.worksheet.templates.my_week.boxes.next_week", defaultValue: "Next week I want to…")
        default: nil
        }
    }

    // MARK: teacher

    static var teacherKindLabel: LocalizedStringResource { AppText("school.worksheet.teacher.kind_label", defaultValue: "What are you assigning?") }
    static var teacherKindBook: LocalizedStringResource { AppText("school.worksheet.teacher.kind_book", defaultValue: "A book") }
    static var teacherKindBookHint: LocalizedStringResource { AppText("school.worksheet.teacher.kind_book_hint", defaultValue: "Each child writes a book of their own.") }
    static var teacherKindWorksheet: LocalizedStringResource { AppText("school.worksheet.teacher.kind_worksheet", defaultValue: "A worksheet") }
    static var teacherKindWorksheetHint: LocalizedStringResource { AppText("school.worksheet.teacher.kind_worksheet_hint", defaultValue: "Boxes to fill in, from a template.") }
    static var teacherChooseTemplate: LocalizedStringResource { AppText("school.worksheet.teacher.choose_template", defaultValue: "Choose a worksheet") }
    static var teacherChangeTemplate: LocalizedStringResource { AppText("school.worksheet.teacher.change_template", defaultValue: "Change worksheet") }
    static var teacherInstructionsLabel: LocalizedStringResource { AppText("school.worksheet.teacher.instructions_label", defaultValue: "Instructions for the class") }
    static var teacherPromptsHeading: LocalizedStringResource { AppText("school.worksheet.teacher.prompts_heading", defaultValue: "The prompt in each box") }
    static var teacherPromptsHint: LocalizedStringResource { AppText("school.worksheet.teacher.prompts_hint", defaultValue: "Edit any prompt to fit your class.") }
    static var teacherResetPrompts: LocalizedStringResource { AppText("school.worksheet.teacher.reset_prompts", defaultValue: "Reset prompts") }
    static func teacherBoxLabel(_ number: Int) -> LocalizedStringResource { AppText("school.worksheet.teacher.box_label", defaultValue: "Box \(number)") }
    static var teacherAcrosticWordLabel: LocalizedStringResource { AppText("school.worksheet.teacher.acrostic_word_label", defaultValue: "Word for the acrostic (optional)") }
    static var teacherAcrosticWordHint: LocalizedStringResource { AppText("school.worksheet.teacher.acrostic_word_hint", defaultValue: "Leave it empty and each child chooses a word.") }
    static var teacherAcrosticWordInvalid: LocalizedStringResource { AppText("school.worksheet.teacher.acrostic_word_invalid", defaultValue: "Use 2–12 letters, no spaces.") }
    static var teacherPromptRequired: LocalizedStringResource { AppText("school.worksheet.teacher.prompt_required", defaultValue: "Every box needs a prompt.") }
    static var teacherTemplateRequired: LocalizedStringResource { AppText("school.worksheet.teacher.template_required", defaultValue: "Choose a worksheet.") }
    static var teacherChip: LocalizedStringResource { AppText("school.worksheet.teacher.chip", defaultValue: "Worksheet") }
    static var teacherPrintBlank: LocalizedStringResource { AppText("school.worksheet.teacher.print_blank", defaultValue: "Print blank") }
    static var teacherPrintFilled: LocalizedStringResource { AppText("school.worksheet.teacher.print_filled", defaultValue: "Print") }
    static var teacherAnswersHeading: LocalizedStringResource { AppText("school.worksheet.teacher.answers_heading", defaultValue: "Answers") }
    static var teacherNoAnswer: LocalizedStringResource { AppText("school.worksheet.teacher.no_answer", defaultValue: "(empty)") }
    static var teacherAcrosticWordLocked: LocalizedStringResource { AppText("school.worksheet.teacher.acrostic_word_locked", defaultValue: "Locked after publishing: children may already be writing to this word.") }
    // MARK: student

    static var studentStart: LocalizedStringResource { AppText("school.worksheet.student.start", defaultValue: "Start worksheet") }
    static var studentContinue: LocalizedStringResource { AppText("school.worksheet.student.continue", defaultValue: "Continue worksheet") }
    static var studentOpen: LocalizedStringResource { AppText("school.worksheet.student.open", defaultValue: "Open my worksheet") }
    static var studentHandIn: LocalizedStringResource { AppText("school.worksheet.student.hand_in", defaultValue: "Hand in") }
    static var studentHandingIn: LocalizedStringResource { AppText("school.worksheet.student.handing_in", defaultValue: "Handing in…") }
    static var studentSavedHere: LocalizedStringResource { AppText("school.worksheet.student.saved_here", defaultValue: "Saved on this device") }
    static var studentListen: LocalizedStringResource { AppText("school.worksheet.student.listen", defaultValue: "Read the question out loud") }
    static var studentDictate: LocalizedStringResource { AppText("school.worksheet.student.dictate", defaultValue: "Say it instead of typing") }
    static var studentStopDictate: LocalizedStringResource { AppText("school.worksheet.student.stop_dictate", defaultValue: "Stop listening") }
    static var studentWordLabel: LocalizedStringResource { AppText("school.worksheet.student.word_label", defaultValue: "My word") }
    static var studentWordPlaceholder: LocalizedStringResource { AppText("school.worksheet.student.word_placeholder", defaultValue: "Type your word") }
    static func studentLineFor(_ letter: String) -> LocalizedStringResource { AppText("school.worksheet.student.line_for", defaultValue: "Line for \(letter)") }
    static var studentClose: LocalizedStringResource { AppText("school.worksheet.student.close", defaultValue: "Close worksheet") }
    static var studentMakePages: LocalizedStringResource { AppText("school.worksheet.student.make_pages", defaultValue: "Turn into book pages") }
    static var studentMakePagesHeading: LocalizedStringResource { AppText("school.worksheet.student.make_pages_heading", defaultValue: "Make book pages") }
    static var studentMakePagesHint: LocalizedStringResource { AppText("school.worksheet.student.make_pages_hint", defaultValue: "Your answers become pages you can keep writing.") }
    static var studentMakePagesNew: LocalizedStringResource { AppText("school.worksheet.student.make_pages_new", defaultValue: "Start a new book") }
    static var studentMakePagesAppend: LocalizedStringResource { AppText("school.worksheet.student.make_pages_append", defaultValue: "Add to one of my books") }
    static var studentMakePagesFull: LocalizedStringResource { AppText("school.worksheet.student.make_pages_full", defaultValue: "This book is full.") }
    static var studentBoxFull: LocalizedStringResource { AppText("school.worksheet.student.box_full", defaultValue: "This box is full.") }
}

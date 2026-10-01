// Grading copy: the four levels, the tip library and the grading UI, EN
// in code and IT in Localizable.xcstrings (catalog keys = the web's
// school.json keys, "school.grading.*"). Generated from one EN/IT source
// alongside src/i18n/locales/{en,it}/school.json; tests/grading-tips.test.js
// checks that every library key has its copy here, on the web and in the
// catalog (with an Italian value).
import Foundation

enum GradingCopy {
    static func level(_ id: String?) -> LocalizedStringResource {
        switch id {
        case "growing": AppText("school.grading.levels.growing", defaultValue: "Growing")
        case "got_it": AppText("school.grading.levels.got_it", defaultValue: "Got it!")
        case "wow": AppText("school.grading.levels.wow", defaultValue: "Wow!")
        default: AppText("school.grading.levels.getting_started", defaultValue: "Getting started")
        }
    }

    static func skill(_ id: String) -> LocalizedStringResource {
        switch id {
        case "ideas": AppText("school.grading.skills.ideas", defaultValue: "Ideas")
        case "order": AppText("school.grading.skills.order", defaultValue: "Order")
        case "words": AppText("school.grading.skills.words", defaultValue: "Word choice")
        default: AppText("school.grading.skills.spelling", defaultValue: "Spelling & punctuation")
        }
    }

    /// A library tip in the app language; nil for a key this build
    /// doesn't know (a newer server), which the caller simply skips.
    static func tip(_ key: String) -> LocalizedStringResource? {
        switch key {
        case "ideas.more_detail": AppText("school.grading.tips.ideas.more_detail", defaultValue: "Add a detail that helps me picture it.")
        case "ideas.feelings": AppText("school.grading.tips.ideas.feelings", defaultValue: "Tell me how your character feels.")
        case "ideas.senses": AppText("school.grading.tips.ideas.senses", defaultValue: "Use your senses: what can you see, hear or smell?")
        case "ideas.what_next": AppText("school.grading.tips.ideas.what_next", defaultValue: "What happens next? Add one more part.")
        case "ideas.problem": AppText("school.grading.tips.ideas.problem", defaultValue: "Give your character a problem to solve.")
        case "ideas.why": AppText("school.grading.tips.ideas.why", defaultValue: "Tell me why it happens.")
        case "ideas.own_idea": AppText("school.grading.tips.ideas.own_idea", defaultValue: "Add an idea that only you could think of.")
        case "order.beginning": AppText("school.grading.tips.order.beginning", defaultValue: "Give your story a clear beginning.")
        case "order.middle": AppText("school.grading.tips.order.middle", defaultValue: "Tell me more about the middle.")
        case "order.ending": AppText("school.grading.tips.order.ending", defaultValue: "Finish with an ending that wraps it up.")
        case "order.time_words": AppText("school.grading.tips.order.time_words", defaultValue: "Use words like first, then, next and at last.")
        case "order.one_idea_per_page": AppText("school.grading.tips.order.one_idea_per_page", defaultValue: "Put one main idea on each page.")
        case "order.check_order": AppText("school.grading.tips.order.check_order", defaultValue: "Read it again: are the parts in the right order?")
        case "order.new_line": AppText("school.grading.tips.order.new_line", defaultValue: "Start a new line when a new idea begins.")
        case "words.strong_verbs": AppText("school.grading.tips.words.strong_verbs", defaultValue: "Try a stronger action word, like dashed instead of went.")
        case "words.describing": AppText("school.grading.tips.words.describing", defaultValue: "Add a describing word to paint a picture.")
        case "words.repeated": AppText("school.grading.tips.words.repeated", defaultValue: "Find a word you used a lot and swap it for a new one.")
        case "words.dialogue": AppText("school.grading.tips.words.dialogue", defaultValue: "Let your characters talk to each other.")
        case "words.new_word": AppText("school.grading.tips.words.new_word", defaultValue: "Try a new word you learned this week.")
        case "words.said": AppText("school.grading.tips.words.said", defaultValue: "Try another word for said, like whispered or shouted.")
        case "words.sound_words": AppText("school.grading.tips.words.sound_words", defaultValue: "Add a sound word, like crash or whoosh!")
        case "spelling.capitals": AppText("school.grading.tips.spelling.capitals", defaultValue: "Start each sentence with a capital letter.")
        case "spelling.end_marks": AppText("school.grading.tips.spelling.end_marks", defaultValue: "End each sentence with a period, ? or !")
        case "spelling.names": AppText("school.grading.tips.spelling.names", defaultValue: "Names start with a capital letter.")
        case "spelling.read_aloud": AppText("school.grading.tips.spelling.read_aloud", defaultValue: "Read it aloud and fix any words that look wrong.")
        case "spelling.commas": AppText("school.grading.tips.spelling.commas", defaultValue: "Use commas between things in a list.")
        case "spelling.quotation_marks": AppText("school.grading.tips.spelling.quotation_marks", defaultValue: "Put quotation marks around what characters say.")
        case "spelling.spaces": AppText("school.grading.tips.spelling.spaces", defaultValue: "Leave a space between words.")
        default: nil
        }
    }

    // MARK: Teacher
    static var heading: LocalizedStringResource { AppText("school.grading.teacher.heading", defaultValue: "Grade") }
    static var levelLabel: LocalizedStringResource { AppText("school.grading.teacher.level_label", defaultValue: "Level") }
    static var tipsLabel: LocalizedStringResource { AppText("school.grading.teacher.tips_label", defaultValue: "Tips (up to 3)") }
    static var tipsFull: LocalizedStringResource { AppText("school.grading.teacher.tips_full", defaultValue: "That's 3 tips: plenty!") }
    static var customPlaceholder: LocalizedStringResource { AppText("school.grading.teacher.custom_placeholder", defaultValue: "Write your own short tip…") }
    static var customAdd: LocalizedStringResource { AppText("school.grading.teacher.custom_add", defaultValue: "Add tip") }
    static var removeTip: LocalizedStringResource { AppText("school.grading.teacher.remove_tip", defaultValue: "Remove tip") }
    static var returnLabel: LocalizedStringResource { AppText("school.grading.teacher.return_label", defaultValue: "Send back to revise") }
    static var returnHint: LocalizedStringResource { AppText("school.grading.teacher.return_hint", defaultValue: "They'll see your tips and can hand it in again.") }
    static var save: LocalizedStringResource { AppText("school.grading.teacher.save", defaultValue: "Save grade") }
    static var saveReturn: LocalizedStringResource { AppText("school.grading.teacher.save_return", defaultValue: "Send back with tips") }
    static var saving: LocalizedStringResource { AppText("school.grading.teacher.saving", defaultValue: "Saving…") }
    static var saved: LocalizedStringResource { AppText("school.grading.teacher.saved", defaultValue: "Saved") }
    static var needLevel: LocalizedStringResource { AppText("school.grading.teacher.need_level", defaultValue: "Pick a level.") }
    static var needTip: LocalizedStringResource { AppText("school.grading.teacher.need_tip", defaultValue: "Add a tip so they know what to change.") }
    static var history: LocalizedStringResource { AppText("school.grading.teacher.history", defaultValue: "Earlier grades") }
    static var sentBack: LocalizedStringResource { AppText("school.grading.teacher.sent_back", defaultValue: "Sent back") }
    static var notGraded: LocalizedStringResource { AppText("school.grading.teacher.not_graded", defaultValue: "Not graded") }
    static var newVersion: LocalizedStringResource { AppText("school.grading.teacher.new_version", defaultValue: "New version") }
    static var levelsOverTime: LocalizedStringResource { AppText("school.grading.teacher.levels_over_time", defaultValue: "Levels over time") }
    static var noGrades: LocalizedStringResource { AppText("school.grading.teacher.no_grades", defaultValue: "No grades yet.") }

    // MARK: Child
    static var studentLevelHeading: LocalizedStringResource { AppText("school.grading.student.level_heading", defaultValue: "Your level") }
    static var studentTipsHeading: LocalizedStringResource { AppText("school.grading.student.tips_heading", defaultValue: "Tips to try") }
    static var studentSentBack: LocalizedStringResource { AppText("school.grading.student.sent_back", defaultValue: "Your teacher sent this back with tips. Try again!") }
    static var studentTryAgain: LocalizedStringResource { AppText("school.grading.student.try_again", defaultValue: "Try again") }
    static var studentListenTip: LocalizedStringResource { AppText("school.grading.student.listen_tip", defaultValue: "Read the tip out loud") }
    static var studentStatusSentBack: LocalizedStringResource { AppText("school.grading.student.status_sent_back", defaultValue: "Try again") }
}

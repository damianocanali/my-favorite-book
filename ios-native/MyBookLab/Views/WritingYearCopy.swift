// Every "My Writing Year" string on the iPad, keyed after the web's
// src/i18n/locales/{en,it}/school.json (writing_year.*) with the same EN/IT
// wording. Italian lives in Localizable.xcstrings under the same keys.
//
// No prices and no buying anywhere (App Store 3.1.3): when a class can't
// print, the iPad says only that printing isn't available yet.
import Foundation

enum WritingYearCopy {
    // MARK: Teacher
    static var toggleLabel: LocalizedStringResource { AppText("school.writing_year.teacher.toggle_label", defaultValue: "Add to Writing Year") }
    static var toggleHint: LocalizedStringResource { AppText("school.writing_year.teacher.toggle_hint", defaultValue: "It goes into their year-end book, “My Writing Year”.") }
    static var toggleNeedsGrade: LocalizedStringResource { AppText("school.writing_year.teacher.toggle_needs_grade", defaultValue: "Grade it first, then you can add it to their Writing Year.") }
    static var toggleWaiting: LocalizedStringResource { AppText("school.writing_year.teacher.toggle_waiting", defaultValue: "They suggested this one. Add it to approve.") }
    static var sectionHeading: LocalizedStringResource { AppText("school.writing_year.teacher.section_heading", defaultValue: "My Writing Year") }
    static var sectionSub: LocalizedStringResource { AppText("school.writing_year.teacher.section_sub", defaultValue: "Each child's year-end book: the pieces you choose, their About me page and your note.") }
    static func piecesCount(_ count: Int) -> LocalizedStringResource {
        AppText("school.writing_year.teacher.pieces_count", defaultValue: "\(count) pieces")
    }
    static func waitingCount(_ count: Int) -> LocalizedStringResource {
        AppText("school.writing_year.teacher.waiting_count", defaultValue: "\(count) suggestions")
    }
    static var aboutDone: LocalizedStringResource { AppText("school.writing_year.teacher.about_done", defaultValue: "About me done") }
    static var aboutMissing: LocalizedStringResource { AppText("school.writing_year.teacher.about_missing", defaultValue: "No About me yet") }
    static var noChildren: LocalizedStringResource { AppText("school.writing_year.teacher.no_children", defaultValue: "Add children to the class to start their Writing Year books.") }
    static func childHeading(_ name: String) -> LocalizedStringResource {
        AppText("school.writing_year.teacher.child_heading", defaultValue: "\(name)'s Writing Year")
    }
    static var emptyChild: LocalizedStringResource { AppText("school.writing_year.teacher.empty_child", defaultValue: "No pieces yet. Use “Add to Writing Year” when you grade a hand-in.") }
    static var suggested: LocalizedStringResource { AppText("school.writing_year.teacher.suggested", defaultValue: "Suggested") }
    static var approve: LocalizedStringResource { AppText("school.writing_year.teacher.approve", defaultValue: "Add it") }
    static var decline: LocalizedStringResource { AppText("school.writing_year.teacher.decline", defaultValue: "Not this one") }
    static var remove: LocalizedStringResource { AppText("school.writing_year.teacher.remove", defaultValue: "Remove") }
    static var removeConfirm: LocalizedStringResource { AppText("school.writing_year.teacher.remove_confirm", defaultValue: "Remove this piece from their Writing Year?") }
    static var moveUp: LocalizedStringResource { AppText("school.writing_year.teacher.move_up", defaultValue: "Move up") }
    static var moveDown: LocalizedStringResource { AppText("school.writing_year.teacher.move_down", defaultValue: "Move down") }
    static var kindBook: LocalizedStringResource { AppText("school.writing_year.teacher.kind_book", defaultValue: "Book") }
    static var kindSubmission: LocalizedStringResource { AppText("school.writing_year.teacher.kind_submission", defaultValue: "Hand-in") }
    static var noteLabel: LocalizedStringResource { AppText("school.writing_year.teacher.note_label", defaultValue: "Your note (printed on the last page)") }
    static var coverTitleLabel: LocalizedStringResource { AppText("school.writing_year.teacher.cover_title_label", defaultValue: "Cover title (optional)") }
    static var save: LocalizedStringResource { AppText("school.writing_year.teacher.save", defaultValue: "Save") }
    static var saving: LocalizedStringResource { AppText("school.writing_year.teacher.saving", defaultValue: "Saving…") }
    static var saved: LocalizedStringResource { AppText("school.writing_year.teacher.saved", defaultValue: "Saved") }
    static var preview: LocalizedStringResource { AppText("school.writing_year.teacher.preview", defaultValue: "Preview") }
    static var downloadPdf: LocalizedStringResource { AppText("school.writing_year.teacher.download_pdf", defaultValue: "Download PDF") }
    static var downloading: LocalizedStringResource { AppText("school.writing_year.teacher.downloading", defaultValue: "Preparing the PDF…") }
    static var printHeading: LocalizedStringResource { AppText("school.writing_year.teacher.print_heading", defaultValue: "Print the class books") }
    static var printIntro: LocalizedStringResource { AppText("school.writing_year.teacher.print_intro", defaultValue: "One softcover per child, sent to your school in one box.") }
    /// R1 on the iPad: neutral, no pricing words (the web says why).
    static var printNotAvailable: LocalizedStringResource { AppText("school.writing_year.errors.print_not_available", defaultValue: "Printing isn't available for this class yet.") }
    static var addressHeading: LocalizedStringResource { AppText("school.writing_year.teacher.address_heading", defaultValue: "Where should we send the books?") }
    static func field(_ name: String) -> LocalizedStringResource {
        switch name {
        case "school_name": AppText("school.writing_year.teacher.field.school_name", defaultValue: "School name")
        case "contact_name": AppText("school.writing_year.teacher.field.contact_name", defaultValue: "Contact name")
        case "contact_email": AppText("school.writing_year.teacher.field.contact_email", defaultValue: "Contact email")
        case "contact_phone": AppText("school.writing_year.teacher.field.contact_phone", defaultValue: "Phone")
        case "address_line1": AppText("school.writing_year.teacher.field.address_line1", defaultValue: "Street address")
        case "address_line2": AppText("school.writing_year.teacher.field.address_line2", defaultValue: "Address line 2 (optional)")
        case "city": AppText("school.writing_year.teacher.field.city", defaultValue: "City")
        case "state_code": AppText("school.writing_year.teacher.field.state_code", defaultValue: "State / province")
        case "postal_code": AppText("school.writing_year.teacher.field.postal_code", defaultValue: "ZIP / postal code")
        default: AppText("school.writing_year.teacher.field.country_code", defaultValue: "Country (two letters, e.g. US)")
        }
    }
    static var next: LocalizedStringResource { AppText("school.writing_year.teacher.next", defaultValue: "Next") }
    static var back: LocalizedStringResource { AppText("school.writing_year.teacher.back", defaultValue: "Back") }
    static var cancel: LocalizedStringResource { AppText("school.writing_year.teacher.cancel", defaultValue: "Cancel") }
    static var summaryHeading: LocalizedStringResource { AppText("school.writing_year.teacher.summary_heading", defaultValue: "Ready to send") }
    static func summaryIncluded(_ count: Int) -> LocalizedStringResource {
        AppText("school.writing_year.teacher.summary_included", defaultValue: "\(count) children's books will be printed.")
    }
    static func summaryExcluded(_ names: String) -> LocalizedStringResource {
        AppText("school.writing_year.teacher.summary_excluded", defaultValue: "Not included yet (no pieces): \(names)")
    }
    static var summaryReview: LocalizedStringResource { AppText("school.writing_year.teacher.summary_review", defaultValue: "We review every request before it goes to the printer.") }
    static var printSubmit: LocalizedStringResource { AppText("school.writing_year.teacher.print_submit", defaultValue: "Send the request") }
    static var sending: LocalizedStringResource { AppText("school.writing_year.teacher.sending", defaultValue: "Sending…") }
    static var printSent: LocalizedStringResource { AppText("school.writing_year.teacher.print_sent", defaultValue: "Request sent. We'll review it and keep you posted here.") }
    static func requestsHeading(_ year: String) -> LocalizedStringResource {
        AppText("school.writing_year.teacher.requests_heading", defaultValue: "Class books for \(year)")
    }
    static var cancelRequest: LocalizedStringResource { AppText("school.writing_year.teacher.cancel_request", defaultValue: "Cancel request") }
    static var cancelConfirm: LocalizedStringResource { AppText("school.writing_year.teacher.cancel_confirm", defaultValue: "Cancel this print request?") }
    static var track: LocalizedStringResource { AppText("school.writing_year.teacher.track", defaultValue: "Track the box") }
    static var booksMissing: LocalizedStringResource { AppText("school.writing_year.teacher.books_missing", defaultValue: "We couldn't prepare the books for this request. Cancel it and try again.") }
    static var failedHint: LocalizedStringResource { AppText("school.writing_year.teacher.failed_hint", defaultValue: "Something went wrong with the printer. We'll be in touch.") }
    static func status(_ s: String) -> LocalizedStringResource {
        switch s {
        case "requested": AppText("school.writing_year.teacher.status.requested", defaultValue: "Requested")
        case "approved": AppText("school.writing_year.teacher.status.approved", defaultValue: "Approved")
        case "submitted": AppText("school.writing_year.teacher.status.submitted", defaultValue: "At the printer")
        case "in_production": AppText("school.writing_year.teacher.status.in_production", defaultValue: "Being printed")
        case "shipped": AppText("school.writing_year.teacher.status.shipped", defaultValue: "Shipped")
        case "canceled": AppText("school.writing_year.teacher.status.canceled", defaultValue: "Canceled")
        default: AppText("school.writing_year.teacher.status.failed", defaultValue: "Needs attention")
        }
    }

    // MARK: Preview
    static var previewAbout: LocalizedStringResource { AppText("school.writing_year.preview.about", defaultValue: "About me") }
    static var previewTeacherNote: LocalizedStringResource { AppText("school.writing_year.preview.teacher_note", defaultValue: "A note from my teacher") }
    static var previewEmpty: LocalizedStringResource { AppText("school.writing_year.preview.empty", defaultValue: "No pieces in this book yet.") }

    // MARK: Student
    static var cardHeading: LocalizedStringResource { AppText("school.writing_year.student.card_heading", defaultValue: "My Writing Year") }
    static var cardSub: LocalizedStringResource { AppText("school.writing_year.student.card_sub", defaultValue: "The pieces going into your book this year.") }
    static var chosen: LocalizedStringResource { AppText("school.writing_year.student.chosen", defaultValue: "In my book") }
    static var waiting: LocalizedStringResource { AppText("school.writing_year.student.waiting", defaultValue: "Waiting for your teacher") }
    static var nothingYet: LocalizedStringResource { AppText("school.writing_year.student.nothing_yet", defaultValue: "Nothing yet. You can suggest a piece!") }
    static var suggestHeading: LocalizedStringResource { AppText("school.writing_year.student.suggest_heading", defaultValue: "Suggest a piece") }
    static var suggest: LocalizedStringResource { AppText("school.writing_year.student.suggest", defaultValue: "Suggest this for my Writing Year") }
    static var takeBack: LocalizedStringResource { AppText("school.writing_year.student.take_back", defaultValue: "Take it back") }
    static var nothingToSuggest: LocalizedStringResource { AppText("school.writing_year.student.nothing_to_suggest", defaultValue: "Finish a book or hand in some work to suggest it.") }
    static var aboutHeading: LocalizedStringResource { AppText("school.writing_year.student.about_heading", defaultValue: "About me") }
    static func aboutPrompt(_ field: String) -> LocalizedStringResource {
        switch field {
        case "about_favorite": AppText("school.writing_year.student.about_favorite", defaultValue: "My favorite thing to write about")
        case "about_best_sentence": AppText("school.writing_year.student.about_best_sentence", defaultValue: "My best sentence")
        default: AppText("school.writing_year.student.about_learned", defaultValue: "What I learned this year")
        }
    }
    static var studentSave: LocalizedStringResource { AppText("school.writing_year.student.save", defaultValue: "Save") }
    static var studentSaved: LocalizedStringResource { AppText("school.writing_year.student.saved", defaultValue: "Saved") }
    static var viewBook: LocalizedStringResource { AppText("school.writing_year.student.view_book", defaultValue: "Look at my book") }
    static var listen: LocalizedStringResource { AppText("school.writing_year.student.listen", defaultValue: "Listen") }
    static var stop: LocalizedStringResource { AppText("school.writing_year.student.stop", defaultValue: "Stop") }

    // MARK: Errors
    static func error(_ code: String?) -> LocalizedStringResource {
        switch code {
        case "already_requested": AppText("school.writing_year.errors.already_requested", defaultValue: "The class books for this year have already been asked for.")
        case "print_not_available": printNotAvailable
        case "no_children": AppText("school.writing_year.errors.no_children", defaultValue: "No child has a piece in their Writing Year yet.")
        case "not_graded": AppText("school.writing_year.errors.not_graded", defaultValue: "Grade it first, then add it to their Writing Year.")
        case "too_many_items": AppText("school.writing_year.errors.too_many_items", defaultValue: "A Writing Year holds up to 30 pieces.")
        case "too_many_pending": AppText("school.writing_year.errors.too_many_pending", defaultValue: "Your teacher has a few of your ideas to look at first.")
        case "order_mismatch": AppText("school.writing_year.errors.order_mismatch", defaultValue: "The pieces changed. Refresh and try again.")
        case "children_changed": AppText("school.writing_year.errors.children_changed", defaultValue: "The class changed. Refresh and try again.")
        case "bad_address": AppText("school.writing_year.errors.bad_address", defaultValue: "Check the address.")
        case "cannot_cancel": AppText("school.writing_year.errors.cannot_cancel", defaultValue: "This request is already on its way. Contact us to change it.")
        case "print_book_too_big": AppText("school.writing_year.errors.print_book_too_big_generic", defaultValue: "A child's book is too big to print. Remove a piece and try again.")
        case "page_overflow": AppText("school.writing_year.errors.page_overflow_generic", defaultValue: "Some text doesn't fit on a page. Shorten that piece and try again.")
        case "book_too_big": AppText("school.writing_year.errors.book_too_big", defaultValue: "That book is too big to add.")
        case nil, "upstream", "generic": AppText("school.writing_year.errors.generic", defaultValue: "Something went wrong. Try again.")
        default: TeacherCopy.error(code)
        }
    }

    static func error(_ error: Error) -> LocalizedStringResource {
        if let t = error as? APIClient.TeacherError { return self.error(t.code) }
        if let s = error as? APIClient.SchoolError { return self.error(s.code) }
        return self.error(nil as String?)
    }
}

// Every string the teacher area shows, keyed after the web's
// src/i18n/locales/{en,it}/school.json (teacher.*, notifications.*) and
// nav.json, with the same EN/IT wording so a teacher who moves between the
// iPad and a browser reads the same words. Italian lives in
// Localizable.xcstrings under the same keys.
//
// No prices anywhere in here, by design (App Store 3.1.3): purchasing stays
// on the web, and the app never links to it. Everything else a teacher
// needs — classes, roster, sign-in cards, school hours — is native.
import Foundation

enum TeacherCopy {
    // MARK: Navigation and view mode
    static var tabDashboard: LocalizedStringResource { AppText("school.teacher.tabs.dashboard", defaultValue: "Dashboard") }
    static var tabClasses: LocalizedStringResource { AppText("school.teacher.tabs.classes", defaultValue: "Classes") }
    static var tabAccount: LocalizedStringResource { AppText("school.teacher.tabs.account", defaultValue: "Account") }
    static var switchToFamily: LocalizedStringResource { AppText("school.teacher.view.switch_to_family", defaultValue: "Switch to family view") }
    static var switchToTeacher: LocalizedStringResource { AppText("school.teacher.view.switch_to_teacher", defaultValue: "Switch to teacher view") }
    static var retry: LocalizedStringResource { AppText("school.teacher.retry", defaultValue: "Try again") }
    static var done: LocalizedStringResource { AppText("school.teacher.done", defaultValue: "Done") }
    static var cancel: LocalizedStringResource { AppText("school.teacher.cancel", defaultValue: "Cancel") }

    // MARK: Dashboard
    static var dashboardTitle: LocalizedStringResource { AppText("school.teacher.dashboard.title", defaultValue: "Dashboard") }
    static var classSwitcher: LocalizedStringResource { AppText("school.teacher.dashboard.class_switcher", defaultValue: "Choose a class") }
    static var emptyHeading: LocalizedStringResource { AppText("school.teacher.dashboard.empty.heading", defaultValue: "No classes yet") }
    static var emptyBody: LocalizedStringResource { AppText("school.teacher.dashboard.empty.body", defaultValue: "Create your first class to see who's active, their books, and any messages that need you.") }
    static var emptyCta: LocalizedStringResource { AppText("school.teacher.dashboard.empty.cta", defaultValue: "Create your first class") }

    static var needsHeading: LocalizedStringResource { AppText("school.teacher.dashboard.needs_you_now.heading", defaultValue: "Needs you now") }
    static var needsDisclaimer: LocalizedStringResource { AppText("school.teacher.dashboard.needs_you_now.disclaimer", defaultValue: "My Book Lab passes these messages on. They are not monitored and are not an emergency service.") }
    static var needsEmpty: LocalizedStringResource { AppText("school.teacher.dashboard.needs_you_now.empty", defaultValue: "Nothing needs you right now.") }
    static var needsGrownup: LocalizedStringResource { AppText("school.teacher.dashboard.needs_you_now.grownup_heading", defaultValue: "I need a grown-up") }
    static var needsBook: LocalizedStringResource { AppText("school.teacher.dashboard.needs_you_now.book_heading", defaultValue: "Help with my book") }
    static var unknownStudent: LocalizedStringResource { AppText("school.teacher.dashboard.needs_you_now.unknown_student", defaultValue: "A student") }
    static var seen: LocalizedStringResource { AppText("school.teacher.dashboard.needs_you_now.seen", defaultValue: "Seen") }
    static func asks(_ count: Int) -> LocalizedStringResource {
        AppText("school.teacher.dashboard.needs_you_now.asks", defaultValue: "asked \(count) times")
    }
    static func seenAria(_ name: String) -> LocalizedStringResource {
        AppText("school.teacher.dashboard.needs_you_now.seen_aria", defaultValue: "Mark \(name)'s message as seen")
    }

    static var glanceHeading: LocalizedStringResource { AppText("school.teacher.dashboard.glance.heading", defaultValue: "Class at a glance") }
    static var glanceActive: LocalizedStringResource { AppText("school.teacher.dashboard.glance.active_label", defaultValue: "Active this week") }
    static var glanceBooks: LocalizedStringResource { AppText("school.teacher.dashboard.glance.books_label", defaultValue: "Books") }
    static var glancePictures: LocalizedStringResource { AppText("school.teacher.dashboard.glance.pictures_label", defaultValue: "Pictures used") }
    static var glanceLicense: LocalizedStringResource { AppText("school.teacher.dashboard.glance.license_label", defaultValue: "License") }
    static func fraction(_ a: Int, _ b: Int) -> LocalizedStringResource {
        AppText("school.teacher.dashboard.glance.fraction", defaultValue: "\(a) of \(b)")
    }
    static func booksEdited(_ count: Int) -> LocalizedStringResource {
        AppText("school.teacher.dashboard.glance.books_edited_sub", defaultValue: "\(count) edited this week")
    }

    static var studentsHeading: LocalizedStringResource { AppText("school.teacher.dashboard.students.heading", defaultValue: "Students") }
    static var studentsEmpty: LocalizedStringResource { AppText("school.teacher.dashboard.students.empty", defaultValue: "No students yet.") }
    static var inactiveChip: LocalizedStringResource { AppText("school.teacher.dashboard.students.inactive_chip", defaultValue: "Not seen in 7 days") }
    static var noCheckins: LocalizedStringResource { AppText("school.teacher.dashboard.students.no_checkins", defaultValue: "No check-ins") }
    static var neverSignedIn: LocalizedStringResource { AppText("school.teacher.roster.last_sign_in_never", defaultValue: "Never signed in") }
    static var assignmentHint: LocalizedStringResource { AppText("school.teacher.dashboard.students.assignment_hint", defaultValue: "Create an assignment") }
    static func booksCount(_ count: Int) -> LocalizedStringResource {
        AppText("school.teacher.dashboard.students.books_count", defaultValue: "\(count) books")
    }
    static func picturesToday(_ count: Int) -> LocalizedStringResource {
        AppText("school.teacher.dashboard.students.pictures_today", defaultValue: "\(count) pictures today")
    }
    static func lastEdited(_ when: String) -> LocalizedStringResource {
        AppText("school.teacher.dashboard.students.last_edited", defaultValue: "Last edited \(when)")
    }
    static func lastSignedIn(_ when: String) -> LocalizedStringResource {
        AppText("school.teacher.dashboard.students.last_signed_in", defaultValue: "Last signed in \(when)")
    }
    static func openStudentAria(_ name: String) -> LocalizedStringResource {
        AppText("school.teacher.dashboard.students.open_aria", defaultValue: "See \(name)'s details")
    }

    static var tabBooks: LocalizedStringResource { AppText("school.teacher.dashboard.drawer.tab_books", defaultValue: "Books") }
    static var tabCheckins: LocalizedStringResource { AppText("school.teacher.dashboard.drawer.tab_checkins", defaultValue: "Check-ins") }
    static var checkinsEmpty: LocalizedStringResource { AppText("school.teacher.dashboard.drawer.checkins_empty", defaultValue: "No check-ins in the last 30 days.") }
    static var booksEmpty: LocalizedStringResource { AppText("school.teacher.student_books.empty", defaultValue: "No books yet.") }
    static var today: LocalizedStringResource { AppText("school.teacher.day.today", defaultValue: "Today") }
    static var yesterday: LocalizedStringResource { AppText("school.teacher.day.yesterday", defaultValue: "Yesterday") }
    static func checkinSpoken(feeling: String, time: String) -> LocalizedStringResource {
        AppText("school.teacher.checkins.spoken", defaultValue: "\(feeling), at \(time)")
    }
    static func checkinSpoken(feeling: String, need: String, time: String) -> LocalizedStringResource {
        AppText("school.teacher.checkins.spoken_with_need", defaultValue: "\(feeling), \(need), at \(time)")
    }
    /// What the child asked for, in a grown-up's words (the child's own
    /// button says "I need a grown-up"; the teacher reads "Needs a grown-up").
    static func needChip(_ need: Need) -> LocalizedStringResource {
        switch need {
        case .grownup: AppText("school.teacher.checkins.need.grownup", defaultValue: "Needs a grown-up")
        case .helpBook: AppText("school.teacher.checkins.need.help_book", defaultValue: "Wants help with their book")
        case .help: AppText("school.teacher.checkins.need.help", defaultValue: "Wants help")
        case .takeBreak: AppText("school.teacher.checkins.need.break", defaultValue: "Wants a break")
        case .quiet: AppText("school.teacher.checkins.need.quiet", defaultValue: "Wants some quiet")
        case .keepGoing: AppText("school.teacher.checkins.need.keep_going", defaultValue: "Wants to keep going")
        }
    }
    static func studentDetails(_ name: String) -> LocalizedStringResource {
        AppText("school.teacher.dashboard.drawer.heading", defaultValue: "\(name)'s details")
    }
    static func updated(_ when: String) -> LocalizedStringResource {
        AppText("school.teacher.student_books.updated", defaultValue: "Updated \(when)")
    }

    // MARK: Alerts on this device
    static var pushHint: LocalizedStringResource { AppText("school.teacher.push.hint", defaultValue: "Get an alert when a student asks for a grown-up during school hours.") }
    static var pushBlocked: LocalizedStringResource { AppText("school.teacher.push.blocked", defaultValue: "Alerts are turned off for My Book Lab in Settings.") }
    static var pushOpenSettings: LocalizedStringResource { AppText("school.teacher.push.open_settings", defaultValue: "Open Settings") }
    static var pushError: LocalizedStringResource { AppText("school.teacher.push.error", defaultValue: "Couldn't turn on alerts. Try again.") }
    static var pushTurnOnPad: LocalizedStringResource { AppText("school.teacher.push.turn_on_ipad", defaultValue: "Turn on alerts on this iPad") }
    static var pushTurnOnPhone: LocalizedStringResource { AppText("school.teacher.push.turn_on_iphone", defaultValue: "Turn on alerts on this iPhone") }
    static var pushOnPad: LocalizedStringResource { AppText("school.teacher.push.on_ipad", defaultValue: "Alerts are on for this iPad") }
    static var pushOnPhone: LocalizedStringResource { AppText("school.teacher.push.on_iphone", defaultValue: "Alerts are on for this iPhone") }

    // MARK: Classes
    static var classesTitle: LocalizedStringResource { AppText("school.teacher.classes.title", defaultValue: "Your classes") }
    static var classesEmpty: LocalizedStringResource { AppText("school.teacher.classes.empty", defaultValue: "No classes yet. Create your first one to get started.") }
    static var studentsCardTitle: LocalizedStringResource { AppText("school.teacher.classes.students_card", defaultValue: "Students and sign-in") }
    static var studentsCardHint: LocalizedStringResource { AppText("school.teacher.classes.students_card_hint", defaultValue: "Add children, rename or remove them, and make new picture passwords.") }
    static var settingsCardTitle: LocalizedStringResource { AppText("school.teacher.classes.settings_card", defaultValue: "Class settings") }
    static var settingsCardHint: LocalizedStringResource { AppText("school.teacher.classes.settings_card_hint", defaultValue: "Name, sign-in, school hours and time zone.") }

    // MARK: Create a class
    static var createClass: LocalizedStringResource { AppText("school.teacher.create.heading", defaultValue: "Create a class") }
    static var createName: LocalizedStringResource { AppText("school.teacher.create.name_label", defaultValue: "Class name") }
    static var createNamePlaceholder: LocalizedStringResource { AppText("school.teacher.create.name_placeholder", defaultValue: "e.g. Mrs. Rivera's 3rd Grade") }
    static var createTimezone: LocalizedStringResource { AppText("school.teacher.create.timezone_label", defaultValue: "Time zone") }
    static var createLanguage: LocalizedStringResource { AppText("school.teacher.create.language_label", defaultValue: "Class language") }
    static var createLanguageHint: LocalizedStringResource { AppText("school.teacher.create.language_hint", defaultValue: "The language the children's sign-in and your alerts use.") }
    static var createTrialNote: LocalizedStringResource { AppText("school.teacher.create.trial_note", defaultValue: "A new class starts with a free trial.") }
    static var createSubmit: LocalizedStringResource { AppText("school.teacher.create.submit", defaultValue: "Create class") }
    static var createSubmitting: LocalizedStringResource { AppText("school.teacher.create.submitting", defaultValue: "Creating…") }
    /// Neutral on purpose (App Store 3.1.3): no price, no link, no "buy".
    /// The server made the class but couldn't give it a license (trial cap,
    /// or the license write failed). Neutral on purpose: no link, no price.
    static var classReadyNoLicense: LocalizedStringResource { AppText("school.teacher.create.ready_no_license", defaultValue: "Your class is ready, but it can't add students yet — contact My Book Lab.") }
    static var alreadyInactiveClass: LocalizedStringResource { AppText("school.teacher.create.already_inactive", defaultValue: "You already have a class that isn't active yet. Contact My Book Lab before creating another.") }
    /// A class that never had a license.
    static var classNotActive: LocalizedStringResource { AppText("school.teacher.license.not_active_note", defaultValue: "This class isn't active yet — contact My Book Lab.") }
    /// A class whose license really lapsed.
    static var licenseEnded: LocalizedStringResource { AppText("school.teacher.license.ended_note", defaultValue: "This class's license has ended.") }

    // MARK: Class settings
    static var settingsNameSection: LocalizedStringResource { AppText("school.teacher.class_settings.name", defaultValue: "Class name") }
    static var settingsSignIn: LocalizedStringResource { AppText("school.teacher.class_settings.sign_in_open", defaultValue: "Children can sign in") }
    static var settingsSignInHint: LocalizedStringResource { AppText("school.teacher.class_settings.sign_in_hint", defaultValue: "Turn this off to pause picture sign-in for the whole class.") }
    static var hoursHeading: LocalizedStringResource { AppText("school.teacher.hours.heading", defaultValue: "School hours") }
    static var hoursHint: LocalizedStringResource { AppText("school.teacher.hours.hint_alerts", defaultValue: "Urgent “I need a grown-up” alerts reach you only during these hours; outside them they wait in the bell.") }
    static var hoursStart: LocalizedStringResource { AppText("school.teacher.hours.start_label", defaultValue: "Start") }
    static var hoursEnd: LocalizedStringResource { AppText("school.teacher.hours.end_label", defaultValue: "End") }
    static var hoursSave: LocalizedStringResource { AppText("school.teacher.hours.save_with_zone", defaultValue: "Save hours and time zone") }
    static var unsavedTitle: LocalizedStringResource { AppText("school.teacher.class_settings.unsaved", defaultValue: "You have unsaved changes.") }
    static var unsavedSave: LocalizedStringResource { AppText("school.teacher.class_settings.unsaved_save", defaultValue: "Save changes") }
    static var unsavedDiscard: LocalizedStringResource { AppText("school.teacher.class_settings.unsaved_discard", defaultValue: "Discard changes") }
    static var back: LocalizedStringResource { AppText("school.teacher.back", defaultValue: "Back") }

    // MARK: Roster
    static var rosterTitle: LocalizedStringResource { AppText("school.teacher.roster.title", defaultValue: "Students") }
    static var rosterEmpty: LocalizedStringResource { AppText("school.teacher.roster.empty_native", defaultValue: "No students yet. Tap + to add your class.") }
    static var rosterAdd: LocalizedStringResource { AppText("school.teacher.roster.add", defaultValue: "Add students") }
    static var addOne: LocalizedStringResource { AppText("school.teacher.add_students.one", defaultValue: "Add a child") }
    static var addMany: LocalizedStringResource { AppText("school.teacher.add_students.many", defaultValue: "Add several at once") }
    static var addName: LocalizedStringResource { AppText("school.teacher.add_students.name_label", defaultValue: "Child's name") }
    static var addManyHint: LocalizedStringResource { AppText("school.teacher.add_students.placeholder", defaultValue: "One name per line. First name and last initial is best.") }
    static var adding: LocalizedStringResource { AppText("school.teacher.add_students.submitting", defaultValue: "Adding…") }
    static var skippedHeading: LocalizedStringResource { AppText("school.teacher.add_students.skipped_heading", defaultValue: "Not added") }
    static func addCount(_ count: Int) -> LocalizedStringResource {
        AppText("school.teacher.add_students.preview_count", defaultValue: "Add \(count) students")
    }
    static func addedCount(_ count: Int) -> LocalizedStringResource {
        AppText("school.teacher.add_students.success", defaultValue: "Added \(count) students.")
    }
    static func skippedReason(_ code: String?) -> LocalizedStringResource {
        switch code {
        case "duplicate_name": AppText("school.teacher.errors.duplicate_name", defaultValue: "already in this class")
        default: AppText("school.teacher.errors.create_failed", defaultValue: "couldn't be created")
        }
    }
    static var studentNameRequired: LocalizedStringResource { AppText("school.teacher.roster.name_required", defaultValue: "Enter a name.") }
    static var rename: LocalizedStringResource { AppText("school.teacher.roster.menu.rename", defaultValue: "Rename") }
    static var renameTitle: LocalizedStringResource { AppText("school.teacher.roster.rename_dialog.heading", defaultValue: "Rename student") }
    static var newPictures: LocalizedStringResource { AppText("school.teacher.roster.menu.new_pictures", defaultValue: "New pictures") }
    static var unlock: LocalizedStringResource { AppText("school.teacher.roster.menu.unlock", defaultValue: "Unlock") }
    static var signOutEverywhere: LocalizedStringResource { AppText("school.teacher.roster.menu.sign_out", defaultValue: "Sign out everywhere") }
    static var remove: LocalizedStringResource { AppText("school.teacher.roster.menu.remove", defaultValue: "Remove") }
    static var restore: LocalizedStringResource { AppText("school.teacher.roster.menu.restore", defaultValue: "Restore") }
    static var removedHeading: LocalizedStringResource { AppText("school.teacher.roster.status.removed", defaultValue: "Removed") }
    static var lockedChip: LocalizedStringResource { AppText("school.teacher.roster.status.locked", defaultValue: "Locked") }
    static var save: LocalizedStringResource { AppText("school.teacher.roster.save", defaultValue: "Save") }
    static func optionsFor(_ name: String) -> LocalizedStringResource {
        AppText("school.teacher.roster.menu.open_aria", defaultValue: "Options for \(name)")
    }
    static func removeConfirm(_ name: String) -> LocalizedStringResource {
        AppText("school.teacher.roster.remove_confirm", defaultValue: "Remove \(name) from this class? They'll be signed out everywhere.")
    }
    static func newPicturesConfirm(_ name: String) -> LocalizedStringResource {
        AppText("school.teacher.roster.new_pictures_confirm", defaultValue: "Make new pictures for \(name)? Their old pictures stop working.")
    }
    static func signedOut(_ name: String) -> LocalizedStringResource {
        AppText("school.teacher.roster.signed_out", defaultValue: "\(name) was signed out everywhere.")
    }

    // MARK: Sign-in cards
    static var cardsHeading: LocalizedStringResource { AppText("school.teacher.cards.heading", defaultValue: "Sign-in cards") }
    static var cardsSafety: LocalizedStringResource { AppText("school.teacher.cards.safety_note", defaultValue: "Print these now. For safety we can't show these pictures again; you can always make new ones.") }
    static var cardsPrint: LocalizedStringResource { AppText("school.teacher.cards.print_native", defaultValue: "Print sign-in cards") }
    static var cardsOrder: LocalizedStringResource { AppText("school.teacher.cards.order_hint", defaultValue: "Tap the pictures in this order") }
    static var cardsCloseTitle: LocalizedStringResource { AppText("school.teacher.cards.close_confirm", defaultValue: "Close without printing? These pictures can't be shown again.") }
    static var cardsClose: LocalizedStringResource { AppText("school.teacher.cards.close", defaultValue: "Close") }
    static var cardsSavePDF: LocalizedStringResource { AppText("school.teacher.cards.save_pdf", defaultValue: "Save as PDF") }
    static var cardsPending: LocalizedStringResource { AppText("school.teacher.cards.pending", defaultValue: "Sign-in cards not printed yet") }
    static var cardsShow: LocalizedStringResource { AppText("school.teacher.cards.show", defaultValue: "Show cards") }
    static var classLoadFailed: LocalizedStringResource { AppText("school.teacher.roster.class_load_failed", defaultValue: "Couldn't load this class's details, so adding children is paused.") }
    static func cardsPicturesAria(_ list: String) -> LocalizedStringResource {
        AppText("school.teacher.cards.pictures_aria", defaultValue: "Pictures, in order: \(list)")
    }
    static func studentCount(_ count: Int) -> LocalizedStringResource {
        AppText("school.teacher.classes.student_count", defaultValue: "\(count) students")
    }
    static func classCode(_ code: String) -> LocalizedStringResource {
        AppText("school.teacher.classes.code", defaultValue: "Code \(code)")
    }

    // MARK: License badge
    static func license(_ state: LicenseBadgeState) -> LocalizedStringResource {
        switch state {
        case .trialDays(let n): AppText("school.teacher.license.trial_days", defaultValue: "Free trial: \(n) days left")
        case .trialEnded: AppText("school.teacher.license.trial_ended", defaultValue: "Trial ended")
        case .active: AppText("school.teacher.license.active", defaultValue: "Active")
        case .comped: AppText("school.teacher.license.comped", defaultValue: "Comped")
        case .expired: AppText("school.teacher.license.expired", defaultValue: "License expired")
        case .none: AppText("school.teacher.license.none", defaultValue: "No license yet")
        }
    }

    // MARK: Assignments
    static var assignmentsHeading: LocalizedStringResource { AppText("school.teacher.assignments.heading", defaultValue: "Assignments") }
    static var newAssignment: LocalizedStringResource { AppText("school.teacher.assignments.new", defaultValue: "New assignment") }
    static var assignmentsEmpty: LocalizedStringResource { AppText("school.teacher.assignments.empty", defaultValue: "No assignments yet.") }
    static var noDueDate: LocalizedStringResource { AppText("school.teacher.assignments.no_due_date", defaultValue: "No due date") }
    static var publish: LocalizedStringResource { AppText("school.teacher.assignments.actions.publish", defaultValue: "Publish") }
    static var closeAction: LocalizedStringResource { AppText("school.teacher.assignments.actions.close", defaultValue: "Close") }
    static var reopen: LocalizedStringResource { AppText("school.teacher.assignments.actions.reopen", defaultValue: "Reopen") }
    static var edit: LocalizedStringResource { AppText("school.teacher.assignments.actions.edit", defaultValue: "Edit") }
    static var delete: LocalizedStringResource { AppText("school.teacher.assignments.actions.delete", defaultValue: "Delete") }
    static var review: LocalizedStringResource { AppText("school.teacher.assignments.actions.review", defaultValue: "Review") }
    static func due(_ when: String) -> LocalizedStringResource {
        AppText("school.teacher.assignments.due", defaultValue: "Due \(when)")
    }
    static func handedInCount(_ handedIn: Int, _ total: Int) -> LocalizedStringResource {
        AppText("school.teacher.assignments.handed_in_count", defaultValue: "\(handedIn) of \(total) handed in")
    }
    static func deleteConfirm(_ title: String) -> LocalizedStringResource {
        AppText("school.teacher.assignments.actions.delete_confirm", defaultValue: "Delete “\(title)”? This can't be undone.")
    }
    static func status(_ status: String) -> LocalizedStringResource {
        switch status {
        case "published": AppText("school.teacher.assignments.status.open", defaultValue: "Open")
        case "closed": AppText("school.teacher.assignments.status.closed", defaultValue: "Closed")
        default: AppText("school.teacher.assignments.status.draft", defaultValue: "Draft")
        }
    }

    static var formNew: LocalizedStringResource { AppText("school.teacher.assignments.form.new_heading", defaultValue: "New assignment") }
    static var formEdit: LocalizedStringResource { AppText("school.teacher.assignments.form.edit_heading", defaultValue: "Edit assignment") }
    static var formTitle: LocalizedStringResource { AppText("school.teacher.assignments.form.title_label", defaultValue: "Title") }
    static var formPrompt: LocalizedStringResource { AppText("school.teacher.assignments.form.prompt_label", defaultValue: "Writing prompt") }
    static var formHasDue: LocalizedStringResource { AppText("school.teacher.assignments.form.has_due", defaultValue: "Due date (optional)") }
    static var formDue: LocalizedStringResource { AppText("school.teacher.assignments.form.due_label", defaultValue: "Due") }
    static var formAllowLate: LocalizedStringResource { AppText("school.teacher.assignments.form.allow_late_label", defaultValue: "Allow late hand-in") }
    static var formSaveDraft: LocalizedStringResource { AppText("school.teacher.assignments.form.save_draft", defaultValue: "Save as draft") }
    static var formPublishNow: LocalizedStringResource { AppText("school.teacher.assignments.form.publish_now", defaultValue: "Publish now") }
    static var formSave: LocalizedStringResource { AppText("school.teacher.assignments.form.save", defaultValue: "Save") }
    static var formSaving: LocalizedStringResource { AppText("school.teacher.assignments.form.saving", defaultValue: "Saving…") }
    static var titleRequired: LocalizedStringResource { AppText("school.teacher.assignments.errors.title_required", defaultValue: "Enter a title.") }
    static var promptRequired: LocalizedStringResource { AppText("school.teacher.assignments.errors.prompt_required", defaultValue: "Enter a writing prompt.") }

    // MARK: Review and feedback
    static var reviewEmpty: LocalizedStringResource { AppText("school.teacher.assignments.review.empty", defaultValue: "No students yet.") }
    static var next: LocalizedStringResource { AppText("school.teacher.assignments.review.next", defaultValue: "Next student") }
    static var previous: LocalizedStringResource { AppText("school.teacher.assignments.review.previous", defaultValue: "Previous student") }
    static var openBook: LocalizedStringResource { AppText("school.teacher.assignments.review.open_book", defaultValue: "Open book") }
    static func reviewHeading(_ title: String) -> LocalizedStringResource {
        AppText("school.teacher.assignments.review.heading", defaultValue: "Review: \(title)")
    }
    static func handedInAt(_ when: String) -> LocalizedStringResource {
        AppText("school.teacher.assignments.review.handed_in_at", defaultValue: "Handed in \(when)")
    }
    static func version(_ count: Int) -> LocalizedStringResource {
        AppText("school.teacher.assignments.review.version", defaultValue: "Updated \(count)×")
    }
    static func feedbackCount(_ count: Int) -> LocalizedStringResource {
        AppText("school.teacher.assignments.review.feedback_count", defaultValue: "\(count) feedback")
    }
    static func handIn(_ state: HandInState) -> LocalizedStringResource {
        switch state {
        case .handedIn: AppText("school.teacher.assignments.review.status.handed_in", defaultValue: "Handed in")
        case .late: AppText("school.teacher.assignments.review.status.late", defaultValue: "Late")
        case .notStarted: AppText("school.teacher.assignments.review.status.not_started", defaultValue: "Not started")
        }
    }

    static var feedbackHeading: LocalizedStringResource { AppText("school.teacher.assignments.feedback.heading", defaultValue: "Feedback") }
    static var feedbackPlaceholder: LocalizedStringResource { AppText("school.teacher.assignments.feedback.comment_placeholder", defaultValue: "Write something encouraging…") }
    static var feedbackSend: LocalizedStringResource { AppText("school.teacher.assignments.feedback.send", defaultValue: "Send") }
    static var feedbackSending: LocalizedStringResource { AppText("school.teacher.assignments.feedback.sending", defaultValue: "Sending…") }
    static var feedbackSeen: LocalizedStringResource { AppText("school.teacher.assignments.feedback.seen", defaultValue: "Seen") }
    static var feedbackNotSeen: LocalizedStringResource { AppText("school.teacher.assignments.feedback.not_seen", defaultValue: "Not seen yet") }
    static var feedbackNeedContent: LocalizedStringResource { AppText("school.teacher.assignments.feedback.need_content", defaultValue: "Add a comment or pick a sticker.") }

    // MARK: Bell
    static var bellTitle: LocalizedStringResource { AppText("school.notifications.title", defaultValue: "Notifications") }
    static var bellMarkAll: LocalizedStringResource { AppText("school.notifications.mark_all_read", defaultValue: "Mark all as read") }
    static var bellClearAll: LocalizedStringResource { AppText("school.notifications.clear_all", defaultValue: "Clear all") }
    static var bellClearConfirm: LocalizedStringResource { AppText("school.notifications.clear_confirm", defaultValue: "Clear all notifications?") }
    static var bellClearAction: LocalizedStringResource { AppText("school.notifications.clear_confirm_action", defaultValue: "Clear") }
    static var bellRemove: LocalizedStringResource { AppText("school.notifications.remove", defaultValue: "Remove") }
    static var bellError: LocalizedStringResource { AppText("school.notifications.error", defaultValue: "Couldn't load notifications.") }
    static var bellUnknownStudent: LocalizedStringResource { AppText("school.notifications.unknown_student", defaultValue: "A student") }
    static func bellLabel(unread: Int) -> LocalizedStringResource {
        unread > 0
            ? AppText("school.notifications.bell_label_unread", defaultValue: "Notifications (\(unread) unread)")
            : AppText("school.notifications.bell_label", defaultValue: "Notifications")
    }

    static var bellToday: LocalizedStringResource { AppText("school.notifications.section.today", defaultValue: "Today") }
    static var bellEarlier: LocalizedStringResource { AppText("school.notifications.section.earlier", defaultValue: "Earlier") }
    static var bellEmptyTitle: LocalizedStringResource { AppText("school.notifications.empty_title", defaultValue: "You're all caught up") }
    static var bellEmptyBody: LocalizedStringResource { AppText("school.notifications.empty_body", defaultValue: "Hand-ins and requests for help will show up here.") }
    static var bellUnread: LocalizedStringResource { AppText("school.notifications.unread", defaultValue: "Unread") }
    static var bellOutsideHours: LocalizedStringResource { AppText("school.notifications.outside_hours", defaultValue: "Outside school hours — no alert sent") }

    /// The bold part of a bell row: the student, or the class for
    /// "everyone has handed in". Names are verbatim, never translated.
    static func notificationSubject(_ n: TeacherNotification) -> String {
        if n.kind == "all_handed_in", let c = n.payload?.class_name, !c.isEmpty { return c }
        return n.payload?.student_name.flatMap { $0.isEmpty ? nil : $0 }
            ?? String(appLocalized: bellUnknownStudent)
    }

    /// One short line of what happened, read after the subject. One explicit
    /// key per kind; the bell only ever says who, which class and which
    /// assignment (web: teacherNotifications.notificationText).
    static func notificationLine(_ n: TeacherNotification) -> LocalizedStringResource {
        let assignment = n.payload?.assignment_title ?? ""
        switch n.kind {
        case "hand_in":
            return AppText("school.notifications.short.hand_in", defaultValue: "handed in “\(assignment)”")
        case "hand_in_late":
            return AppText("school.notifications.short.hand_in_late", defaultValue: "handed in “\(assignment)” late")
        case "resubmit":
            return AppText("school.notifications.short.resubmit", defaultValue: "handed in a new version of “\(assignment)”")
        case "all_handed_in":
            return AppText("school.notifications.short.all_handed_in", defaultValue: "Everyone has handed in “\(assignment)”")
        case "help_book":
            return AppText("school.notifications.short.help_book", defaultValue: "would like help with their book")
        case "help_grownup":
            return AppText("school.notifications.short.help_grownup", defaultValue: "asked for a grown-up")
        default:
            return AppText("school.notifications.short.generic", defaultValue: "Something new")
        }
    }

    // MARK: Notification settings
    static var settingsTitle: LocalizedStringResource { AppText("school.notifications.settings.title", defaultValue: "Class notifications") }
    static var settingsSummary: LocalizedStringResource { AppText("school.notifications.settings.summary_label", defaultValue: "Summary email") }
    static var settingsDaily: LocalizedStringResource { AppText("school.notifications.settings.summary_daily", defaultValue: "Daily summary") }
    static var settingsWeekly: LocalizedStringResource { AppText("school.notifications.settings.summary_weekly", defaultValue: "Weekly (Fridays)") }
    static var settingsOff: LocalizedStringResource { AppText("school.notifications.settings.summary_off", defaultValue: "Off") }
    static var settingsUrgent: LocalizedStringResource { AppText("school.notifications.settings.urgent_label", defaultValue: "When a student asks for a grown-up during school hours") }
    static var settingsPush: LocalizedStringResource { AppText("school.notifications.settings.push_urgent", defaultValue: "Alert me with a notification") }
    static var settingsEmail: LocalizedStringResource { AppText("school.notifications.settings.email_urgent", defaultValue: "Alert me by email") }
    static var settingsSaved: LocalizedStringResource { AppText("school.notifications.settings.saved", defaultValue: "Saved") }
    static var settingsError: LocalizedStringResource { AppText("school.notifications.settings.error", defaultValue: "Couldn't save. Try again.") }
    static var settingsLoadError: LocalizedStringResource { AppText("school.notifications.settings.load_error", defaultValue: "Couldn't load your notification settings.") }

    static var settingsHoursNote: LocalizedStringResource { AppText("school.notifications.settings.hours_note", defaultValue: "Urgent alerts arrive during school hours. Outside them they wait in the bell.") }
    static var testButton: LocalizedStringResource { AppText("school.notifications.test.button", defaultValue: "Send a test alert") }
    static var testSending: LocalizedStringResource { AppText("school.notifications.test.sending", defaultValue: "Sending…") }
    static var testNone: LocalizedStringResource { AppText("school.notifications.test.none", defaultValue: "No device got it. Turn on alerts on this device from the Dashboard, then try again.") }
    static var testUnavailable: LocalizedStringResource { AppText("school.notifications.test.unavailable", defaultValue: "Test alerts aren't available right now.") }
    static func testSent(_ count: Int) -> LocalizedStringResource {
        AppText("school.notifications.test.sent", defaultValue: "Test alert sent to \(count) devices. It should arrive in a few seconds.")
    }

    // MARK: Errors (web: teacherErrors.teacherErrorText, standalone variants)
    static func error(_ code: String?) -> LocalizedStringResource {
        switch code {
        case "rate_limited": AppText("school.teacher.errors.rate_limited", defaultValue: "Too many requests — wait a moment and try again.")
        case "class_not_found": AppText("school.teacher.errors.class_not_found", defaultValue: "We can't find that class.")
        case "license_required": licenseEnded
        case "trial_used_up": classReadyNoLicense
        case "name_required": AppText("school.teacher.errors.name_required", defaultValue: "Enter a class name.")
        case "bad_timezone": AppText("school.teacher.errors.bad_timezone", defaultValue: "That time zone isn't recognized.")
        case "bad_hours": AppText("school.teacher.errors.bad_hours", defaultValue: "Check the school hours — each end time must be after its start time.")
        case "seats_full": AppText("school.teacher.errors.seats_full_native", defaultValue: "This class is full — a class can have up to 35 students.")
        case "duplicate_name": AppText("school.teacher.errors.duplicate_name_full", defaultValue: "Another student already has that name.")
        case "create_failed": AppText("school.teacher.errors.create_failed_full", defaultValue: "That student couldn't be created. Try again.")
        case "student_not_found": AppText("school.teacher.errors.student_not_found", defaultValue: "We can't find that student.")
        case "book_not_found": AppText("school.teacher.errors.book_not_found", defaultValue: "We can't find that book.")
        case "not_configured": AppText("school.teacher.errors.not_configured", defaultValue: "Schools aren't set up on this server yet.")
        case "upstream": AppText("school.teacher.errors.upstream", defaultValue: "Something went wrong. Try again.")
        case "student_forbidden": AppText("school.teacher.errors.student_forbidden", defaultValue: "Class accounts can't do that.")
        case "assignment_not_found": AppText("school.teacher.errors.assignment_not_found", defaultValue: "We can't find that assignment.")
        case "submission_not_found": AppText("school.teacher.errors.submission_not_found", defaultValue: "We can't find that hand-in.")
        case "has_submissions": AppText("school.teacher.errors.has_submissions", defaultValue: "Students have handed this in. Close it instead.")
        case "invalid_transition": AppText("school.teacher.errors.invalid_transition", defaultValue: "That status change isn't allowed.")
        case "assignment_closed": AppText("school.teacher.errors.assignment_closed", defaultValue: "This assignment is closed.")
        case "past_due": AppText("school.teacher.errors.past_due", defaultValue: "This assignment is past its due date.")
        case "class_archived": AppText("school.teacher.errors.class_archived", defaultValue: "This class is archived. Restore it to send nudges.")
        case "version_changed": AppText("school.teacher.errors.version_changed", defaultValue: "They handed in a new version. Have a look at it first.")
        case "cannot_return": AppText("school.teacher.errors.cannot_return", defaultValue: "This assignment is closed, so it can't be sent back.")
        case APIClient.sessionExpiredCode: APIError.sessionExpiredText
        default: AppText("school.teacher.errors.generic", defaultValue: "Something went wrong. Try again.")
        }
    }

    static func error(_ error: Error) -> LocalizedStringResource {
        self.error((error as? APIClient.TeacherError)?.code)
    }
}

extension Need {
    /// Same catalog keys the check-in sheet uses.
    var displayName: LocalizedStringResource {
        switch self {
        case .takeBreak: AppText("Take a break")
        case .quiet: AppText("Make it quiet")
        case .help: AppText("I need help")
        case .keepGoing: AppText("Keep going")
        case .helpBook: AppText("Help with my book")
        case .grownup: AppText("I need a grown-up")
        }
    }
}

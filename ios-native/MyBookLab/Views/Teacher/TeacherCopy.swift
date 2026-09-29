// Every string the teacher area shows, keyed after the web's
// src/i18n/locales/{en,it}/school.json (teacher.*, notifications.*) and
// nav.json, with the same EN/IT wording so a teacher who moves between the
// iPad and a browser reads the same words. Italian lives in
// Localizable.xcstrings under the same keys.
//
// No prices anywhere in here, by design (App Store 3.1.3): purchasing and
// roster management stay on the web.
import Foundation

enum TeacherCopy {
    // MARK: Navigation and view mode
    static let tabDashboard = LocalizedStringResource("school.teacher.tabs.dashboard", defaultValue: "Dashboard")
    static let tabClasses = LocalizedStringResource("school.teacher.tabs.classes", defaultValue: "Classes")
    static let tabAccount = LocalizedStringResource("school.teacher.tabs.account", defaultValue: "Account")
    static let previewLink = LocalizedStringResource("school.teacher.dashboard.preview_link", defaultValue: "Preview the kids' app")
    static let previewBanner = LocalizedStringResource("school.teacher.preview.banner", defaultValue: "You're previewing the kids' app")
    static let previewBack = LocalizedStringResource("school.teacher.preview.back_to_dashboard", defaultValue: "Back to dashboard")
    static let switchToFamily = LocalizedStringResource("school.teacher.view.switch_to_family", defaultValue: "Switch to family view")
    static let switchToTeacher = LocalizedStringResource("school.teacher.view.switch_to_teacher", defaultValue: "Switch to teacher view")
    static let retry = LocalizedStringResource("school.teacher.retry", defaultValue: "Try again")
    static let done = LocalizedStringResource("school.teacher.done", defaultValue: "Done")
    static let cancel = LocalizedStringResource("school.teacher.cancel", defaultValue: "Cancel")

    // MARK: Dashboard
    static let dashboardTitle = LocalizedStringResource("school.teacher.dashboard.title", defaultValue: "Dashboard")
    static let classSwitcher = LocalizedStringResource("school.teacher.dashboard.class_switcher", defaultValue: "Choose a class")
    static let emptyHeading = LocalizedStringResource("school.teacher.dashboard.empty.heading", defaultValue: "No classes yet")
    static let emptyBody = LocalizedStringResource("school.teacher.dashboard.empty.body", defaultValue: "Create your first class to see who's active, their books, and any messages that need you.")
    static let emptyCta = LocalizedStringResource("school.teacher.dashboard.empty.cta", defaultValue: "Create your first class")

    static let needsHeading = LocalizedStringResource("school.teacher.dashboard.needs_you_now.heading", defaultValue: "Needs you now")
    static let needsDisclaimer = LocalizedStringResource("school.teacher.dashboard.needs_you_now.disclaimer", defaultValue: "My Book Lab passes these messages on. They are not monitored and are not an emergency service.")
    static let needsEmpty = LocalizedStringResource("school.teacher.dashboard.needs_you_now.empty", defaultValue: "Nothing needs you right now.")
    static let needsGrownup = LocalizedStringResource("school.teacher.dashboard.needs_you_now.grownup_heading", defaultValue: "I need a grown-up")
    static let needsBook = LocalizedStringResource("school.teacher.dashboard.needs_you_now.book_heading", defaultValue: "Help with my book")
    static let unknownStudent = LocalizedStringResource("school.teacher.dashboard.needs_you_now.unknown_student", defaultValue: "A student")
    static let seen = LocalizedStringResource("school.teacher.dashboard.needs_you_now.seen", defaultValue: "Seen")
    static func asks(_ count: Int) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.dashboard.needs_you_now.asks", defaultValue: "asked \(count) times")
    }
    static func seenAria(_ name: String) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.dashboard.needs_you_now.seen_aria", defaultValue: "Mark \(name)'s message as seen")
    }

    static let glanceHeading = LocalizedStringResource("school.teacher.dashboard.glance.heading", defaultValue: "Class at a glance")
    static let glanceActive = LocalizedStringResource("school.teacher.dashboard.glance.active_label", defaultValue: "Active this week")
    static let glanceBooks = LocalizedStringResource("school.teacher.dashboard.glance.books_label", defaultValue: "Books")
    static let glancePictures = LocalizedStringResource("school.teacher.dashboard.glance.pictures_label", defaultValue: "Pictures used")
    static let glanceLicense = LocalizedStringResource("school.teacher.dashboard.glance.license_label", defaultValue: "License")
    static func fraction(_ a: Int, _ b: Int) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.dashboard.glance.fraction", defaultValue: "\(a) of \(b)")
    }
    static func booksEdited(_ count: Int) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.dashboard.glance.books_edited_sub", defaultValue: "\(count) edited this week")
    }

    static let studentsHeading = LocalizedStringResource("school.teacher.dashboard.students.heading", defaultValue: "Students")
    static let studentsEmpty = LocalizedStringResource("school.teacher.dashboard.students.empty", defaultValue: "No students yet.")
    static let inactiveChip = LocalizedStringResource("school.teacher.dashboard.students.inactive_chip", defaultValue: "Not seen in 7 days")
    static let noCheckins = LocalizedStringResource("school.teacher.dashboard.students.no_checkins", defaultValue: "No check-ins")
    static let neverSignedIn = LocalizedStringResource("school.teacher.roster.last_sign_in_never", defaultValue: "Never signed in")
    static let assignmentHint = LocalizedStringResource("school.teacher.dashboard.students.assignment_hint", defaultValue: "Create an assignment")
    static func booksCount(_ count: Int) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.dashboard.students.books_count", defaultValue: "\(count) books")
    }
    static func picturesToday(_ count: Int) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.dashboard.students.pictures_today", defaultValue: "\(count) pictures today")
    }
    static func lastEdited(_ when: String) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.dashboard.students.last_edited", defaultValue: "Last edited \(when)")
    }
    static func lastSignedIn(_ when: String) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.dashboard.students.last_signed_in", defaultValue: "Last signed in \(when)")
    }
    static func openStudentAria(_ name: String) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.dashboard.students.open_aria", defaultValue: "See \(name)'s details")
    }

    static let tabBooks = LocalizedStringResource("school.teacher.dashboard.drawer.tab_books", defaultValue: "Books")
    static let tabCheckins = LocalizedStringResource("school.teacher.dashboard.drawer.tab_checkins", defaultValue: "Check-ins")
    static let checkinsEmpty = LocalizedStringResource("school.teacher.dashboard.drawer.checkins_empty", defaultValue: "No check-ins in the last 30 days.")
    static let booksEmpty = LocalizedStringResource("school.teacher.student_books.empty", defaultValue: "No books yet.")
    static func studentDetails(_ name: String) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.dashboard.drawer.heading", defaultValue: "\(name)'s details")
    }
    static func updated(_ when: String) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.student_books.updated", defaultValue: "Updated \(when)")
    }

    // MARK: Alerts on this device
    static let pushHint = LocalizedStringResource("school.teacher.push.hint", defaultValue: "Get an alert when a student asks for a grown-up during school hours.")
    static let pushBlocked = LocalizedStringResource("school.teacher.push.blocked", defaultValue: "Alerts are turned off for My Book Lab in Settings.")
    static let pushOpenSettings = LocalizedStringResource("school.teacher.push.open_settings", defaultValue: "Open Settings")
    static let pushError = LocalizedStringResource("school.teacher.push.error", defaultValue: "Couldn't turn on alerts. Try again.")
    static let pushTurnOnPad = LocalizedStringResource("school.teacher.push.turn_on_ipad", defaultValue: "Turn on alerts on this iPad")
    static let pushTurnOnPhone = LocalizedStringResource("school.teacher.push.turn_on_iphone", defaultValue: "Turn on alerts on this iPhone")
    static let pushOnPad = LocalizedStringResource("school.teacher.push.on_ipad", defaultValue: "Alerts are on for this iPad")
    static let pushOnPhone = LocalizedStringResource("school.teacher.push.on_iphone", defaultValue: "Alerts are on for this iPhone")

    // MARK: Classes
    static let classesTitle = LocalizedStringResource("school.teacher.classes.title", defaultValue: "Your classes")
    static let classesEmpty = LocalizedStringResource("school.teacher.classes.empty", defaultValue: "No classes yet — create one on the web to get started.")
    static let createOnWeb = LocalizedStringResource("school.teacher.classes.create_on_web", defaultValue: "Create a class on the web")
    static let manageRoster = LocalizedStringResource("school.teacher.classes.manage_roster", defaultValue: "Manage roster on the web")
    static let manageRosterHint = LocalizedStringResource("school.teacher.classes.manage_roster_hint", defaultValue: "Add students, make new picture passwords and print sign-in cards on mybooklab.app.")
    static func studentCount(_ count: Int) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.classes.student_count", defaultValue: "\(count) students")
    }
    static func classCode(_ code: String) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.classes.code", defaultValue: "Code \(code)")
    }

    // MARK: License badge
    static func license(_ state: LicenseBadgeState) -> LocalizedStringResource {
        switch state {
        case .trialDays(let n): LocalizedStringResource("school.teacher.license.trial_days", defaultValue: "Free trial: \(n) days left")
        case .trialEnded: LocalizedStringResource("school.teacher.license.trial_ended", defaultValue: "Trial ended")
        case .active: LocalizedStringResource("school.teacher.license.active", defaultValue: "Active")
        case .comped: LocalizedStringResource("school.teacher.license.comped", defaultValue: "Comped")
        case .expired: LocalizedStringResource("school.teacher.license.expired", defaultValue: "License expired")
        case .none: LocalizedStringResource("school.teacher.license.none", defaultValue: "No license yet")
        }
    }

    // MARK: Assignments
    static let assignmentsHeading = LocalizedStringResource("school.teacher.assignments.heading", defaultValue: "Assignments")
    static let newAssignment = LocalizedStringResource("school.teacher.assignments.new", defaultValue: "New assignment")
    static let assignmentsEmpty = LocalizedStringResource("school.teacher.assignments.empty", defaultValue: "No assignments yet.")
    static let noDueDate = LocalizedStringResource("school.teacher.assignments.no_due_date", defaultValue: "No due date")
    static let publish = LocalizedStringResource("school.teacher.assignments.actions.publish", defaultValue: "Publish")
    static let closeAction = LocalizedStringResource("school.teacher.assignments.actions.close", defaultValue: "Close")
    static let reopen = LocalizedStringResource("school.teacher.assignments.actions.reopen", defaultValue: "Reopen")
    static let edit = LocalizedStringResource("school.teacher.assignments.actions.edit", defaultValue: "Edit")
    static let delete = LocalizedStringResource("school.teacher.assignments.actions.delete", defaultValue: "Delete")
    static let review = LocalizedStringResource("school.teacher.assignments.actions.review", defaultValue: "Review")
    static func due(_ when: String) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.assignments.due", defaultValue: "Due \(when)")
    }
    static func handedInCount(_ handedIn: Int, _ total: Int) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.assignments.handed_in_count", defaultValue: "\(handedIn) of \(total) handed in")
    }
    static func deleteConfirm(_ title: String) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.assignments.actions.delete_confirm", defaultValue: "Delete “\(title)”? This can't be undone.")
    }
    static func status(_ status: String) -> LocalizedStringResource {
        switch status {
        case "published": LocalizedStringResource("school.teacher.assignments.status.open", defaultValue: "Open")
        case "closed": LocalizedStringResource("school.teacher.assignments.status.closed", defaultValue: "Closed")
        default: LocalizedStringResource("school.teacher.assignments.status.draft", defaultValue: "Draft")
        }
    }

    static let formNew = LocalizedStringResource("school.teacher.assignments.form.new_heading", defaultValue: "New assignment")
    static let formEdit = LocalizedStringResource("school.teacher.assignments.form.edit_heading", defaultValue: "Edit assignment")
    static let formTitle = LocalizedStringResource("school.teacher.assignments.form.title_label", defaultValue: "Title")
    static let formPrompt = LocalizedStringResource("school.teacher.assignments.form.prompt_label", defaultValue: "Writing prompt")
    static let formHasDue = LocalizedStringResource("school.teacher.assignments.form.has_due", defaultValue: "Due date (optional)")
    static let formDue = LocalizedStringResource("school.teacher.assignments.form.due_label", defaultValue: "Due")
    static let formAllowLate = LocalizedStringResource("school.teacher.assignments.form.allow_late_label", defaultValue: "Allow late hand-in")
    static let formSaveDraft = LocalizedStringResource("school.teacher.assignments.form.save_draft", defaultValue: "Save as draft")
    static let formPublishNow = LocalizedStringResource("school.teacher.assignments.form.publish_now", defaultValue: "Publish now")
    static let formSave = LocalizedStringResource("school.teacher.assignments.form.save", defaultValue: "Save")
    static let formSaving = LocalizedStringResource("school.teacher.assignments.form.saving", defaultValue: "Saving…")
    static let titleRequired = LocalizedStringResource("school.teacher.assignments.errors.title_required", defaultValue: "Enter a title.")
    static let promptRequired = LocalizedStringResource("school.teacher.assignments.errors.prompt_required", defaultValue: "Enter a writing prompt.")

    // MARK: Review and feedback
    static let reviewEmpty = LocalizedStringResource("school.teacher.assignments.review.empty", defaultValue: "No students yet.")
    static let next = LocalizedStringResource("school.teacher.assignments.review.next", defaultValue: "Next student")
    static let previous = LocalizedStringResource("school.teacher.assignments.review.previous", defaultValue: "Previous student")
    static let openBook = LocalizedStringResource("school.teacher.assignments.review.open_book", defaultValue: "Open book")
    static func reviewHeading(_ title: String) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.assignments.review.heading", defaultValue: "Review: \(title)")
    }
    static func handedInAt(_ when: String) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.assignments.review.handed_in_at", defaultValue: "Handed in \(when)")
    }
    static func version(_ count: Int) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.assignments.review.version", defaultValue: "Updated \(count)×")
    }
    static func feedbackCount(_ count: Int) -> LocalizedStringResource {
        LocalizedStringResource("school.teacher.assignments.review.feedback_count", defaultValue: "\(count) feedback")
    }
    static func handIn(_ state: HandInState) -> LocalizedStringResource {
        switch state {
        case .handedIn: LocalizedStringResource("school.teacher.assignments.review.status.handed_in", defaultValue: "Handed in")
        case .late: LocalizedStringResource("school.teacher.assignments.review.status.late", defaultValue: "Late")
        case .notStarted: LocalizedStringResource("school.teacher.assignments.review.status.not_started", defaultValue: "Not started")
        }
    }

    static let feedbackHeading = LocalizedStringResource("school.teacher.assignments.feedback.heading", defaultValue: "Feedback")
    static let feedbackPlaceholder = LocalizedStringResource("school.teacher.assignments.feedback.comment_placeholder", defaultValue: "Write something encouraging…")
    static let feedbackSend = LocalizedStringResource("school.teacher.assignments.feedback.send", defaultValue: "Send")
    static let feedbackSending = LocalizedStringResource("school.teacher.assignments.feedback.sending", defaultValue: "Sending…")
    static let feedbackSeen = LocalizedStringResource("school.teacher.assignments.feedback.seen", defaultValue: "Seen")
    static let feedbackNotSeen = LocalizedStringResource("school.teacher.assignments.feedback.not_seen", defaultValue: "Not seen yet")
    static let feedbackNeedContent = LocalizedStringResource("school.teacher.assignments.feedback.need_content", defaultValue: "Add a comment or pick a sticker.")

    // MARK: Bell
    static let bellTitle = LocalizedStringResource("school.notifications.title", defaultValue: "Notifications")
    static let bellMarkAll = LocalizedStringResource("school.notifications.mark_all_read", defaultValue: "Mark all read")
    static let bellEmpty = LocalizedStringResource("school.notifications.empty", defaultValue: "Nothing new yet.")
    static let bellError = LocalizedStringResource("school.notifications.error", defaultValue: "Couldn't load notifications.")
    static let bellUnknownStudent = LocalizedStringResource("school.notifications.unknown_student", defaultValue: "A student")
    static func bellLabel(unread: Int) -> LocalizedStringResource {
        unread > 0
            ? LocalizedStringResource("school.notifications.bell_label_unread", defaultValue: "Notifications (\(unread) unread)")
            : LocalizedStringResource("school.notifications.bell_label", defaultValue: "Notifications")
    }

    /// One explicit key per kind; the bell only ever says who, which class
    /// and which assignment (web: teacherNotifications.notificationText).
    static func notification(_ n: TeacherNotification) -> LocalizedStringResource {
        let student = n.payload?.student_name.flatMap { $0.isEmpty ? nil : $0 }
            ?? String(localized: bellUnknownStudent)
        let className = n.payload?.class_name ?? ""
        let assignment = n.payload?.assignment_title ?? ""
        switch n.kind {
        case "hand_in":
            return LocalizedStringResource("school.notifications.kinds.hand_in", defaultValue: "\(student) handed in “\(assignment)”")
        case "hand_in_late":
            return LocalizedStringResource("school.notifications.kinds.hand_in_late", defaultValue: "\(student) handed in “\(assignment)” late")
        case "resubmit":
            return LocalizedStringResource("school.notifications.kinds.resubmit", defaultValue: "\(student) handed in “\(assignment)” again")
        case "all_handed_in":
            return LocalizedStringResource("school.notifications.kinds.all_handed_in", defaultValue: "Everyone in \(className) has handed in “\(assignment)”")
        case "help_book":
            return LocalizedStringResource("school.notifications.kinds.help_book", defaultValue: "\(student) would like help with their book")
        case "help_grownup":
            return LocalizedStringResource("school.notifications.kinds.help_grownup", defaultValue: "\(student) asked for a grown-up")
        default:
            return LocalizedStringResource("school.notifications.kinds.generic", defaultValue: "Something new in \(className)")
        }
    }

    // MARK: Notification settings
    static let settingsTitle = LocalizedStringResource("school.notifications.settings.title", defaultValue: "Class notifications")
    static let settingsSummary = LocalizedStringResource("school.notifications.settings.summary_label", defaultValue: "Summary email")
    static let settingsDaily = LocalizedStringResource("school.notifications.settings.summary_daily", defaultValue: "Daily summary")
    static let settingsWeekly = LocalizedStringResource("school.notifications.settings.summary_weekly", defaultValue: "Weekly (Fridays)")
    static let settingsOff = LocalizedStringResource("school.notifications.settings.summary_off", defaultValue: "Off")
    static let settingsUrgent = LocalizedStringResource("school.notifications.settings.urgent_label", defaultValue: "When a student asks for a grown-up during school hours")
    static let settingsPush = LocalizedStringResource("school.notifications.settings.push_urgent", defaultValue: "Alert me with a notification")
    static let settingsEmail = LocalizedStringResource("school.notifications.settings.email_urgent", defaultValue: "Alert me by email")
    static let settingsSaved = LocalizedStringResource("school.notifications.settings.saved", defaultValue: "Saved")
    static let settingsError = LocalizedStringResource("school.notifications.settings.error", defaultValue: "Couldn't save. Try again.")
    static let settingsLoadError = LocalizedStringResource("school.notifications.settings.load_error", defaultValue: "Couldn't load your notification settings.")

    // MARK: Errors (web: teacherErrors.teacherErrorText, standalone variants)
    static func error(_ code: String?) -> LocalizedStringResource {
        switch code {
        case "rate_limited": LocalizedStringResource("school.teacher.errors.rate_limited", defaultValue: "Too many requests — wait a moment and try again.")
        case "class_not_found": LocalizedStringResource("school.teacher.errors.class_not_found", defaultValue: "We can't find that class.")
        case "license_required": LocalizedStringResource("school.teacher.errors.license_required", defaultValue: "This class needs an active license.")
        case "student_not_found": LocalizedStringResource("school.teacher.errors.student_not_found", defaultValue: "We can't find that student.")
        case "book_not_found": LocalizedStringResource("school.teacher.errors.book_not_found", defaultValue: "We can't find that book.")
        case "not_configured": LocalizedStringResource("school.teacher.errors.not_configured", defaultValue: "Schools aren't set up on this server yet.")
        case "upstream": LocalizedStringResource("school.teacher.errors.upstream", defaultValue: "Something went wrong. Try again.")
        case "student_forbidden": LocalizedStringResource("school.teacher.errors.student_forbidden", defaultValue: "Class accounts can't do that.")
        case "assignment_not_found": LocalizedStringResource("school.teacher.errors.assignment_not_found", defaultValue: "We can't find that assignment.")
        case "submission_not_found": LocalizedStringResource("school.teacher.errors.submission_not_found", defaultValue: "We can't find that hand-in.")
        case "has_submissions": LocalizedStringResource("school.teacher.errors.has_submissions", defaultValue: "Students have handed this in. Close it instead.")
        case "invalid_transition": LocalizedStringResource("school.teacher.errors.invalid_transition", defaultValue: "That status change isn't allowed.")
        case "assignment_closed": LocalizedStringResource("school.teacher.errors.assignment_closed", defaultValue: "This assignment is closed.")
        case "past_due": LocalizedStringResource("school.teacher.errors.past_due", defaultValue: "This assignment is past its due date.")
        default: LocalizedStringResource("school.teacher.errors.generic", defaultValue: "Something went wrong. Try again.")
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
        case .takeBreak: "Take a break"
        case .quiet: "Make it quiet"
        case .help: "I need help"
        case .keepGoing: "Keep going"
        case .helpBook: "Help with my book"
        case .grownup: "I need a grown-up"
        }
    }
}

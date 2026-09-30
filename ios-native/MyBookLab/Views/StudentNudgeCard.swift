// Teacher nudges (api/school/nudges.js, migration 021): the copy both sides
// share, and the child's card at the top of "From your teacher".
//
// A preset is stored as a key and rendered here in the CHILD's app
// language; a custom message is shown exactly as the teacher wrote it.
// Children are on shared iPads and get no push: the card arrives with the
// home's existing ~60 s poll (MyAssignmentsSection).
//
// Same keys and EN/IT wording as src/i18n/locales/*/school.json (nudges.*).
import SwiftUI

enum NudgeCopy {
    // MARK: Shared: the preset messages

    static func preset(_ key: String?, assignmentTitle: String?) -> LocalizedStringResource? {
        switch key {
        case "story_waiting": AppText("school.nudges.presets.story_waiting", defaultValue: "Your story is waiting for you! ✏️")
        case "one_more_page": AppText("school.nudges.presets.one_more_page", defaultValue: "Let's add one more page today!")
        case "cant_wait": AppText("school.nudges.presets.cant_wait", defaultValue: "I can't wait to read what happens next!")
        case "hand_in":
            if let t = assignmentTitle {
                AppText("school.nudges.presets.hand_in", defaultValue: "Don't forget to hand in \"\(t)\"")
            } else {
                AppText("school.nudges.presets.hand_in_generic", defaultValue: "Don't forget to hand in your assignment!")
            }
        default: nil
        }
    }

    // MARK: Student card

    static var yourTeacher: LocalizedStringResource { AppText("school.nudges.student.your_teacher", defaultValue: "Your teacher") }
    static func says(_ name: String) -> LocalizedStringResource {
        AppText("school.nudges.student.says", defaultValue: "\(name) says:")
    }
    /// The one VoiceOver sentence for the card.
    static func spoken(_ name: String, _ message: String) -> LocalizedStringResource {
        AppText("school.nudges.student.spoken", defaultValue: "A note from \(name): \(message)")
    }
    static var gotIt: LocalizedStringResource { AppText("school.nudges.student.got_it", defaultValue: "Got it") }
    static var keepWriting: LocalizedStringResource { AppText("school.nudges.student.keep_writing", defaultValue: "Keep writing my book") }
    static var createBook: LocalizedStringResource { AppText("school.nudges.student.create_book", defaultValue: "Make a book") }
    static var listen: LocalizedStringResource { AppText("school.nudges.student.listen_aria", defaultValue: "Read the note out loud") }

    // MARK: Teacher

    static var nudgeButton: LocalizedStringResource { AppText("school.nudges.teacher.button", defaultValue: "Nudge") }
    static func nudgeOneAria(_ name: String) -> LocalizedStringResource {
        AppText("school.nudges.teacher.button_one_aria", defaultValue: "Send \(name) a nudge")
    }
    static var sheetTitle: LocalizedStringResource { AppText("school.nudges.teacher.title", defaultValue: "Send a friendly nudge") }
    static var sheetIntro: LocalizedStringResource { AppText("school.nudges.teacher.intro", defaultValue: "Children see it on their home screen the next time they open the app. No notifications are sent.") }
    static var whoHeading: LocalizedStringResource { AppText("school.nudges.teacher.who_heading", defaultValue: "Who") }
    static var suggestedNote: LocalizedStringResource { AppText("school.nudges.teacher.suggested_note", defaultValue: "We ticked the children who might like a nudge. Change it however you like.") }
    static var selectAll: LocalizedStringResource { AppText("school.nudges.teacher.select_all", defaultValue: "Select all") }
    static var selectNone: LocalizedStringResource { AppText("school.nudges.teacher.select_none", defaultValue: "Clear") }
    static var reasonQuiet: LocalizedStringResource { AppText("school.nudges.teacher.reason_quiet", defaultValue: "No writing for 3 days") }
    static var reasonNotHandedIn: LocalizedStringResource { AppText("school.nudges.teacher.reason_not_handed_in", defaultValue: "Assignment not handed in") }
    static var messageHeading: LocalizedStringResource { AppText("school.nudges.teacher.message_heading", defaultValue: "Message") }
    static var writeOwn: LocalizedStringResource { AppText("school.nudges.teacher.write_own", defaultValue: "Write your own") }
    static var placeholder: LocalizedStringResource { AppText("school.nudges.teacher.placeholder", defaultValue: "Something encouraging…") }
    static var assignmentLabel: LocalizedStringResource { AppText("school.nudges.teacher.assignment_label", defaultValue: "Link to an assignment") }
    static var assignmentNone: LocalizedStringResource { AppText("school.nudges.teacher.assignment_none", defaultValue: "No assignment") }
    static var signedAs: LocalizedStringResource { AppText("school.nudges.teacher.signed_note", defaultValue: "Signed with your name from your account.") }
    static func send(_ count: Int) -> LocalizedStringResource {
        AppText("school.nudges.teacher.send", defaultValue: "Send to \(count)")
    }
    static var sending: LocalizedStringResource { AppText("school.nudges.teacher.sending", defaultValue: "Sending…") }
    static var needStudents: LocalizedStringResource { AppText("school.nudges.teacher.need_students", defaultValue: "Tick at least one name.") }
    static var needMessage: LocalizedStringResource { AppText("school.nudges.teacher.need_message", defaultValue: "Pick a message or write one.") }
    static func sentCount(_ count: Int) -> LocalizedStringResource {
        AppText("school.nudges.teacher.sent_count", defaultValue: "Nudge sent to \(count) children.")
    }
    static func cappedCount(_ count: Int) -> LocalizedStringResource {
        AppText("school.nudges.teacher.capped_count", defaultValue: "\(count) children already had 3 nudges today, so we didn't send it again.")
    }
    static func handedInCount(_ count: Int) -> LocalizedStringResource {
        AppText("school.nudges.teacher.handed_in_count", defaultValue: "\(count) children have already handed it in, so we skipped them.")
    }
    static var statusSent: LocalizedStringResource { AppText("school.nudges.teacher.status_sent", defaultValue: "Sent") }
    static var statusSeen: LocalizedStringResource { AppText("school.nudges.teacher.status_seen", defaultValue: "Seen ✓") }
    static var chipSent: LocalizedStringResource { AppText("school.nudges.teacher.chip_sent", defaultValue: "Nudge sent") }
    static var chipSeen: LocalizedStringResource { AppText("school.nudges.teacher.chip_seen", defaultValue: "Nudge seen ✓") }
    static var lastNudge: LocalizedStringResource { AppText("school.nudges.teacher.last_nudge", defaultValue: "Last nudge") }
}

extension StudentNudge {
    /// The message in the child's app language (a preset) or as written.
    var displayText: String {
        if let r = NudgeCopy.preset(preset, assignmentTitle: assignment?.title) { return String(appLocalized: r) }
        return message ?? ""
    }

    var displayTeacher: String {
        if let n = teacher_name?.trimmingCharacters(in: .whitespaces), !n.isEmpty { return n }
        return String(appLocalized: NudgeCopy.yourTeacher)
    }
}

/// The child's card. One big action, a read-aloud button, and "Got it".
/// The caller decides what the big action does (the linked assignment's
/// Start/Continue writing, or the most recent book, or Create).
struct StudentNudgeCard: View {
    let nudge: StudentNudge
    let actionLabel: LocalizedStringResource
    let onAction: () -> Void
    let onGotIt: () -> Void

    @State private var speaker = SpeechSpeaker()
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let text = nudge.displayText
        let name = nudge.displayTeacher
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                Text(verbatim: "💌")
                    .font(.system(size: 40))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(NudgeCopy.says(name))
                        .font(.system(.subheadline, design: .rounded).weight(.semibold))
                        .foregroundStyle(.yellow)
                    Text(verbatim: text)
                        .font(.system(.title3, design: .rounded).weight(.bold))
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
                // One VoiceOver sentence for the note itself.
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text(NudgeCopy.spoken(name, text)))
                .frame(maxWidth: .infinity, alignment: .leading)
                Button {
                    // A spoken sentence that says who it is from, in the app language.
                    speaker.toggle(String(appLocalized: NudgeCopy.spoken(name, text)))
                } label: {
                    Image(systemName: speaker.isSpeaking ? "stop.fill" : "speaker.wave.2.fill")
                        .font(.body)
                        .frame(width: 48, height: 48)
                        .background(.cyan.opacity(0.18), in: Circle())
                        .foregroundStyle(.cyan)
                }
                .accessibilityLabel(Text(speaker.isSpeaking ? AssignmentCopy.stopReading : NudgeCopy.listen))
            }

            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 10) {
                    actionButton
                    gotItButton
                }
            } else {
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 12) {
                        actionButton.fixedSize()
                        gotItButton
                        Spacer(minLength: 0)
                    }
                    VStack(alignment: .leading, spacing: 10) {
                        actionButton
                        gotItButton
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [.yellow.opacity(0.16), .pink.opacity(0.14)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 18)
        )
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(.yellow.opacity(0.5), lineWidth: 1.5))
        .onDisappear { speaker.stop() }
    }

    private var actionButton: some View {
        SparkleButton(action: {
            speaker.stop()
            onAction()
        }, size: .regular) {
            Label {
                Text(actionLabel)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            } icon: {
                Image(systemName: "pencil.and.scribble")
            }
        }
        // Wraps (never overflows) at accessibility text sizes: the
        // stacked layout below gives it the full width.
        .frame(minHeight: 48)
    }

    private var gotItButton: some View {
        Button {
            speaker.stop()
            onGotIt()
        } label: {
            Text(NudgeCopy.gotIt)
                .font(.headline)
                .foregroundStyle(.white)
                .padding(.horizontal, 20)
                .frame(minHeight: 48)
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(.white.opacity(0.4)))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

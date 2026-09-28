// Mounted once, owns the sheet and whatever a chosen need opens.
//
// Two things differ from the web host, both because the platforms differ
// rather than by choice:
//
//   `help` genuinely opens Story Buddy here. On the web it cannot — Story
//   Buddy has no way to be opened from outside itself — so the web shows a
//   screen telling the child where to find it. iOS can, but not from this
//   host: StoryBuddyView needs the current book and page. So the store
//   publishes the request and the editor, which has that context, answers it.
//
//   `quiet` has no focus mode to turn on. The web routes it into
//   useAccessibilityStore's focusMode; iOS has no equivalent and inventing one
//   is a separate feature. Here it silences the background music and says so —
//   which is what the words on the tile promise.
//
// For a class (student) account only, every check-in is also copied to the
// teacher through SchoolShare (a no-op for family accounts), `help_book` also
// tells the teacher, and `grownup` asks the teacher directly and shows
// TeacherHelpView with how that ask went.

import SwiftUI

struct CheckInHost: ViewModifier {
    @Environment(CheckInStore.self) private var store

    @State private var breaking = false
    /// nil while closed. Pending the instant "I need a grown-up" lands, then
    /// whatever the ask came back with.
    @State private var teacherHelp: TeacherHelpView.Phase?
    /// Bumped for every new ask and on close, so a late answer can neither
    /// reopen a closed screen nor overwrite a newer ask's state.
    @State private var teacherHelpToken = 0
    @State private var quieted = false
    /// Guards against re-running a response when the view re-renders. Keyed on
    /// the entry's id rather than on the need, so two check-ins in a row that
    /// land on the same need both still get their screen.
    @State private var handledEntryID: String?

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: Binding(
                get: { store.stage != nil },
                set: { if !$0 { store.dismiss() } }
            )) {
                CheckInSheet()
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $breaking) { BreakScreen() }
            .sheet(isPresented: $quieted) { QuietScreen() }
            .sheet(isPresented: Binding(
                get: { teacherHelp != nil },
                set: { if !$0 { closeTeacherHelp() } }
            )) {
                if let teacherHelp { TeacherHelpView(phase: teacherHelp) }
            }
            .onChange(of: store.latest?.id) { _, _ in respond() }
    }

    private func respond() {
        guard let latest = store.latest, latest.id != handledEntryID else { return }
        handledEntryID = latest.id
        // Owner decision D7: a class account's teacher gets a copy. A no-op
        // (no request at all) for a family account, whose check-ins never
        // leave the device.
        SchoolShare.shareCheckIn(feeling: latest.feeling, need: latest.need)
        switch latest.need {
        case .takeBreak: breaking = true
        // Answered by the editor, which has the book and page StoryBuddyView
        // needs. If the child is not in the editor nothing opens, which is
        // correct: there is no story to get help with.
        case .help:      store.wantsStoryBuddy = true
        // Class accounts only. The teacher is told, and the child gets the
        // same Story Buddy answer as `help`.
        case .helpBook:
            Task { _ = await SchoolShare.askForHelp(.book) }
            store.wantsStoryBuddy = true
        case .grownup:   askTeacher()
        case .quiet:
            AudioService.shared.setMuted(true)
            quieted = true
        // Nothing to open: the sheet already closed with a warm line, and a
        // child who said "keep going" wants to keep going.
        case .keepGoing, .none: break
        }
    }
}

extension CheckInHost {
    private func askTeacher() {
        teacherHelpToken += 1
        let token = teacherHelpToken
        teacherHelp = .pending
        Task {
            let result = await SchoolShare.askForHelp(.grownup)
            // Stale if the child closed the screen or asked again meanwhile.
            guard token == teacherHelpToken, teacherHelp != nil else { return }
            teacherHelp = .sent(result)
        }
    }

    private func closeTeacherHelp() {
        teacherHelpToken += 1
        teacherHelp = nil
    }
}

extension View {
    /// Mount once, high in the hierarchy, beside the other global moments.
    func checkInHost() -> some View { modifier(CheckInHost()) }
}

/// The break. No timer and no task — the one thing a struggling child should
/// not be handed is another activity.
struct BreakScreen: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            CosmicBackground()
            VStack(spacing: 16) {
                Mascot(mood: .welcome, size: 96)
                Text("Your story is saved and waiting.")
                    .font(.system(.title3, design: .rounded).bold())
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                Text("Take as long as you like.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.75))
                SparkleButton(action: { dismiss() }) { Text("I'm ready") }
                    .padding(.top, 8)
            }
            .padding(28)
            .frame(maxWidth: ContentWidth.form)
        }
    }
}

/// What "make it quiet" does here: the music stops. Said plainly, because a
/// tile that claims to change something and changes nothing is worse than no
/// tile at all.
struct QuietScreen: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            CosmicBackground()
            VStack(spacing: 16) {
                Text("🤫").font(.system(size: 56))
                Text("The music is off.")
                    .font(.system(.title3, design: .rounded).bold())
                    .foregroundStyle(.white)
                Text("You can turn it back on any time from Settings.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.75))
                    .multilineTextAlignment(.center)
                SparkleButton(action: { dismiss() }) { Text("Okay") }
                    .padding(.top, 8)
            }
            .padding(28)
            .frame(maxWidth: ContentWidth.form)
        }
    }
}

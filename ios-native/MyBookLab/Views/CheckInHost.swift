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

import SwiftUI

struct CheckInHost: ViewModifier {
    @Environment(CheckInStore.self) private var store

    @State private var breaking = false
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
            .onChange(of: store.latest?.id) { _, _ in respond() }
    }

    private func respond() {
        guard let latest = store.latest, latest.id != handledEntryID else { return }
        handledEntryID = latest.id
        switch latest.need {
        case .takeBreak: breaking = true
        // Answered by the editor, which has the book and page StoryBuddyView
        // needs. If the child is not in the editor nothing opens, which is
        // correct: there is no story to get help with.
        case .help:      store.wantsStoryBuddy = true
        case .quiet:
            AudioService.shared.setMuted(true)
            quieted = true
        // Nothing to open: the sheet already closed with a warm line, and a
        // child who said "keep going" wants to keep going.
        case .keepGoing, .none: break
        }
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

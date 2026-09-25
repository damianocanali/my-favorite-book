// The popup shown when a kid shakes the device for a story idea.
// Mounted once as an overlay on MainTabView so it works on any tab.
import SwiftUI

struct StoryIdeaCard: View {
    /// The prompt currently on screen, already resolved through the
    /// String Catalog by `StoryIdeas.random(excluding:)`. It stays a
    /// `String` because that is what the binding's owner holds; the
    /// localization happens upstream, at the point the idea is picked.
    @Binding var idea: String?
    /// Receives the idea when the child taps "Write it!". The card used to
    /// switch to the Create tab and discard the text — so from the editor,
    /// which is already on that tab, the button visibly did nothing at all.
    /// The editor now owns the card and drops the idea into the page.
    var onWrite: (String) -> Void

    var body: some View {
        if let current = idea {
            ZStack {
                // Dim + tap-to-dismiss backdrop.
                Color.black.opacity(0.45)
                    .ignoresSafeArea()
                    .onTapGesture { dismiss() }

                VStack(spacing: 16) {
                    Text("💫 Story idea!")
                        .font(.system(.title3, design: .rounded).bold())
                        .foregroundStyle(.white)

                    // Verbatim on purpose: `current` came out of the
                    // catalog already translated, so looking it up a
                    // second time would only find nothing.
                    Text(verbatim: current)
                        .font(.system(.body, design: .rounded))
                        .foregroundStyle(.white.opacity(0.92))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 4)

                    HStack(spacing: 10) {
                        Button {
                            Haptics.tap()
                            AudioService.shared.playSFX(.sparkle)
                            idea = StoryIdeas.random(excluding: current)
                        } label: {
                            Label("Shake again", systemImage: "dice.fill")
                                .frame(maxWidth: .infinity)
                                .padding(12)
                                .background(.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 12))
                                .foregroundStyle(.white)
                        }

                        Button {
                            Haptics.bigTap()
                            onWrite(current)
                            dismiss()
                        } label: {
                            Label("Write it!", systemImage: "pencil.and.scribble")
                                .frame(maxWidth: .infinity)
                                .padding(12)
                                .background(.purple, in: RoundedRectangle(cornerRadius: 12))
                                .foregroundStyle(.white)
                        }
                    }

                    // Two whole sentences, not one sentence with the
                    // device noun spliced in. Italian inflects the
                    // article and the possessive to match the noun's
                    // gender ("il tuo iPad" vs "il tuo telefono"), so a
                    // shared "Shake your %@…" frame cannot be translated
                    // correctly no matter what goes in the blank.
                    Text(UIDevice.current.userInterfaceIdiom == .pad
                         ? LocalizedStringResource(
                            "story.idea.hint.pad.writing",
                            defaultValue: "Shake your iPad while you write for a new idea ✨",
                            comment: "Footnote on the story-idea popup, iPad wording")
                         : LocalizedStringResource(
                            "story.idea.hint.phone.writing",
                            defaultValue: "Shake your phone while you write for a new idea ✨",
                            comment: "Footnote on the story-idea popup, iPhone wording"))
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.5))
                }
                .padding(22)
                .background(
                    RoundedRectangle(cornerRadius: 24)
                        .fill(LinearGradient(
                            colors: [Color(red: 0.25, green: 0.15, blue: 0.45),
                                     Color(red: 0.45, green: 0.20, blue: 0.55)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ))
                        .shadow(color: .purple.opacity(0.6), radius: 24, y: 10)
                )
                .padding(.horizontal, 28)
                .frame(maxWidth: 420)
                .transition(.scale(scale: 0.85).combined(with: .opacity))
            }
        }
    }

    private func dismiss() {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { idea = nil }
    }
}

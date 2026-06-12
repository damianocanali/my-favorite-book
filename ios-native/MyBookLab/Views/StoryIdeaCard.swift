// The popup shown when a kid shakes the device for a story idea.
// Mounted once as an overlay on MainTabView so it works on any tab.
import SwiftUI

struct StoryIdeaCard: View {
    @Binding var idea: String?

    @Environment(AppRouter.self) private var router

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

                    Text(current)
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
                            dismiss()
                            // Jump to the Create tab so the idea can
                            // become a book right away.
                            withAnimation(.spring(response: 0.45, dampingFraction: 0.7)) {
                                router.selectedTab = .create
                            }
                        } label: {
                            Label("Write it!", systemImage: "pencil.and.scribble")
                                .frame(maxWidth: .infinity)
                                .padding(12)
                                .background(.purple, in: RoundedRectangle(cornerRadius: 12))
                                .foregroundStyle(.white)
                        }
                    }

                    Text("Shake your \(UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "phone") anytime for a new idea ✨")
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

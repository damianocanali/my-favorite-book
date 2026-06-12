// Celebration card shown when a badge is credited. Mounted once as an
// overlay on MainTabView, driven by RewardsStore.newBadge.
import SwiftUI

struct BadgePopup: View {
    @Environment(RewardsStore.self) private var rewards
    @State private var confettiTrigger = 0

    var body: some View {
        if let badge = rewards.newBadge {
            ZStack {
                Color.black.opacity(0.45)
                    .ignoresSafeArea()
                    .onTapGesture { dismiss() }

                VStack(spacing: 12) {
                    Text(badge.emoji)
                        .font(.system(size: 64))
                        .shadow(color: .yellow.opacity(0.7), radius: 18)

                    Text("Badge earned!")
                        .font(.system(.caption, design: .rounded).bold())
                        .foregroundStyle(.yellow)
                        .textCase(.uppercase)

                    Text(badge.label)
                        .font(.system(.title2, design: .rounded).bold())
                        .foregroundStyle(.white)

                    Text(badge.description)
                        .font(.system(.subheadline, design: .rounded))
                        .foregroundStyle(.white.opacity(0.8))
                        .multilineTextAlignment(.center)

                    if badge.coins > 0 {
                        Label("+\(badge.coins) coins", systemImage: "star.circle.fill")
                            .font(.system(.headline, design: .rounded))
                            .foregroundStyle(.yellow)
                            .padding(.vertical, 6)
                            .padding(.horizontal, 14)
                            .background(.yellow.opacity(0.15), in: Capsule())
                    }

                    Button {
                        dismiss()
                    } label: {
                        Text("Yay!")
                            .bold()
                            .frame(maxWidth: .infinity)
                            .padding(12)
                            .background(.purple, in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(.white)
                    }
                    .padding(.top, 6)
                }
                .padding(24)
                .background(
                    RoundedRectangle(cornerRadius: 24)
                        .fill(LinearGradient(
                            colors: [Color(red: 0.22, green: 0.14, blue: 0.42),
                                     Color(red: 0.40, green: 0.18, blue: 0.50)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        ))
                        .shadow(color: .purple.opacity(0.6), radius: 24, y: 10)
                )
                .padding(.horizontal, 36)
                .frame(maxWidth: 400)
                .transition(.scale(scale: 0.8).combined(with: .opacity))
                .overlay(Confetti(trigger: confettiTrigger))
            }
            .onAppear {
                confettiTrigger += 1
                AudioService.shared.playSFX(.celebrate)
                Haptics.burst()
            }
        }
    }

    private func dismiss() {
        Haptics.tap()
        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
            rewards.newBadge = nil
        }
    }
}

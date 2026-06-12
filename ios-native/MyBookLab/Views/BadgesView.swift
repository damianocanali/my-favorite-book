// Badge collection + streak. Earned badges glow; locked ones show what
// to do. Reached from the rewards card in Account.
import SwiftUI

struct BadgesView: View {
    @Environment(RewardsStore.self) private var rewards

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(spacing: 16) {
                    streakCard

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                        ForEach(rewards.badges, id: \.badge.id) { entry in
                            badgeCell(entry.badge, earned: entry.earned)
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical)
                .contentColumn(maxWidth: ContentWidth.form)
            }
        }
        .navigationTitle("Badges")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
    }

    private var streakCard: some View {
        HStack(spacing: 14) {
            Text("🔥").font(.system(size: 40))
            VStack(alignment: .leading, spacing: 2) {
                Text(rewards.currentStreak == 1
                     ? "1 day streak"
                     : "\(rewards.currentStreak) day streak")
                    .font(.system(.title3, design: .rounded).bold())
                    .foregroundStyle(.white)
                Text(rewards.currentStreak > 0
                     ? "Write a little every day to keep it alive! Best: \(rewards.longestStreak)"
                     : "Write something today to start a streak!")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.7))
            }
            Spacer()
        }
        .padding(16)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
        .padding(.horizontal)
    }

    private func badgeCell(_ badge: Badge, earned: Bool) -> some View {
        VStack(spacing: 6) {
            Text(badge.emoji)
                .font(.system(size: 38))
                .grayscale(earned ? 0 : 1)
                .opacity(earned ? 1 : 0.45)
                .shadow(color: earned ? .yellow.opacity(0.6) : .clear, radius: 10)
            Text(badge.label)
                .font(.system(.callout, design: .rounded).bold())
                .foregroundStyle(.white.opacity(earned ? 1 : 0.6))
            Text(badge.description)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.55))
                .multilineTextAlignment(.center)
            if badge.coins > 0 {
                Label("\(badge.coins)", systemImage: "star.circle.fill")
                    .font(.caption2.bold())
                    .foregroundStyle(earned ? .yellow : .white.opacity(0.4))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .padding(.horizontal, 8)
        .background(.white.opacity(earned ? 0.10 : 0.05), in: RoundedRectangle(cornerRadius: 18))
    }
}

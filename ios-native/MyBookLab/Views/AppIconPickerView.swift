// Unlockable alternate app icons. Cosmetic rewards for the coin/badge
// economy: some cost coins (spent server-side via CoinsStore), some
// unlock with streak badges. Ownership of purchased icons reuses the
// CoinsStore owned_items persistence (ids prefixed "icon_").
import SwiftUI

struct AppIconOption: Identifiable {
    let id: String           // owned_items id, e.g. "icon_rocket"
    let assetName: String?   // nil = the primary AppIcon
    let label: String
    let emoji: String
    let swatch: [Color]      // preview gradient (mirrors the asset art)
    let price: Int           // coins; 0 = free
    let requiredBadge: String?  // unlocks free when this badge is earned
}

struct AppIconPickerView: View {
    @Environment(CoinsStore.self) private var coins
    @Environment(RewardsStore.self) private var rewards

    @State private var currentIconName: String? = UIApplication.shared.alternateIconName
    @State private var busyId: String?
    @State private var error: String?

    private let options: [AppIconOption] = [
        AppIconOption(id: "icon_classic", assetName: nil, label: "Classic", emoji: "📖",
                      swatch: [Color(red: 0.30, green: 0.15, blue: 0.55), .purple],
                      price: 0, requiredBadge: nil),
        AppIconOption(id: "icon_rocket", assetName: "AppIconRocket", label: "Rocket", emoji: "🚀",
                      swatch: [Color(red: 0.04, green: 0.12, blue: 0.35), .cyan],
                      price: 100, requiredBadge: nil),
        AppIconOption(id: "icon_rainbow", assetName: "AppIconRainbow", label: "Rainbow", emoji: "🌈",
                      swatch: [.pink, .orange],
                      price: 100, requiredBadge: nil),
        AppIconOption(id: "icon_night", assetName: "AppIconNight", label: "Night Owl", emoji: "🌙",
                      swatch: [Color(red: 0.04, green: 0.03, blue: 0.16), .indigo],
                      price: 0, requiredBadge: "streak_7"),
    ]

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(spacing: 14) {
                    Text("Pick a look for your app icon. Earn more with coins and streaks!")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.75))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)

                    if let error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red.opacity(0.9))
                    }

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                        ForEach(options) { option in
                            iconCell(option)
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical)
                .contentColumn(maxWidth: ContentWidth.form)
            }
        }
        .navigationTitle("App Icon")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
    }

    private func iconCell(_ option: AppIconOption) -> some View {
        let owned = isOwned(option)
        let selected = currentIconName == option.assetName
        return Button {
            Task { await select(option) }
        } label: {
            VStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 18)
                        .fill(LinearGradient(colors: option.swatch,
                                             startPoint: .top, endPoint: .bottom))
                        .frame(width: 72, height: 72)
                        .overlay(
                            RoundedRectangle(cornerRadius: 18)
                                .stroke(selected ? Color.yellow : .white.opacity(0.15),
                                        lineWidth: selected ? 3 : 1)
                        )
                    Text(option.emoji).font(.system(size: 34))
                    if !owned {
                        RoundedRectangle(cornerRadius: 18)
                            .fill(.black.opacity(0.45))
                            .frame(width: 72, height: 72)
                        Image(systemName: "lock.fill")
                            .foregroundStyle(.white.opacity(0.9))
                    }
                }

                Text(option.label)
                    .font(.system(.callout, design: .rounded).bold())
                    .foregroundStyle(.white)

                if busyId == option.id {
                    ProgressView().tint(.white).controlSize(.small)
                } else if selected {
                    Label("In use", systemImage: "checkmark.circle.fill")
                        .font(.caption2).foregroundStyle(.green)
                } else if owned {
                    Text("Tap to use")
                        .font(.caption2).foregroundStyle(.white.opacity(0.6))
                } else if let badgeId = option.requiredBadge {
                    let badge = RewardsStore.catalog.first { $0.id == badgeId }
                    Text("Unlock: \(badge?.label ?? badgeId)")
                        .font(.caption2).foregroundStyle(.orange)
                } else {
                    Label("\(option.price)", systemImage: "star.circle.fill")
                        .font(.caption.bold()).foregroundStyle(.yellow)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
        }
        .disabled(busyId != nil)
    }

    private func isOwned(_ option: AppIconOption) -> Bool {
        if let badgeId = option.requiredBadge { return rewards.earnedBadges.contains(badgeId) }
        if option.price == 0 { return true }
        return coins.owns(item: option.id)
    }

    private func select(_ option: AppIconOption) async {
        error = nil

        if let badgeId = option.requiredBadge, !rewards.earnedBadges.contains(badgeId) {
            let badge = RewardsStore.catalog.first { $0.id == badgeId }
            error = "Keep your streak going to earn \(badge?.label ?? "this badge") first!"
            return
        }

        if !isOwned(option) {
            busyId = option.id
            defer { busyId = nil }
            switch await coins.spend(option.price, kind: "item", id: option.id) {
            case .ok:
                coins.markItemOwned(option.id)
            case .insufficient:
                error = "Not enough coins yet — keep creating to earn more!"
                return
            case .error(let message):
                error = message
                return
            }
        }

        guard UIApplication.shared.supportsAlternateIcons else {
            error = "This device doesn't support changing the icon."
            return
        }
        do {
            try await UIApplication.shared.setAlternateIconName(option.assetName)
            currentIconName = option.assetName
            Haptics.celebrate()
            AudioService.shared.playSFX(.sparkle)
        } catch {
            self.error = "Couldn't change the icon. Please try again."
        }
    }
}

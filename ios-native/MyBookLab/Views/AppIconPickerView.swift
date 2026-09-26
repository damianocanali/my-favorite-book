// Unlockable alternate app icons. Cosmetic rewards for the coin/badge
// economy: some cost coins (spent server-side via CoinsStore), some
// unlock with streak badges. Ownership of purchased icons reuses the
// CoinsStore owned_items persistence (ids prefixed "icon_").
import SwiftUI

struct AppIconOption: Identifiable {
    let id: String           // owned_items id, e.g. "icon_rocket" — wire value
    let assetName: String?   // nil = the primary AppIcon (asset catalog name)
    /// Display text — keyed so the literals below reach the String Catalog.
    let label: LocalizedStringResource
    let emoji: String
    let swatch: [Color]      // preview gradient (mirrors the asset art)
    let price: Int           // coins; 0 = free
    let requiredBadge: String?  // unlocks free when this badge is earned
}

struct AppIconPickerView: View {
    @Environment(CoinsStore.self) private var coins
    @Environment(RewardsStore.self) private var rewards

    /// Two kinds of failure text. `app` is our own copy and must be
    /// translated; `system` is an OS/URLSession message that iOS has
    /// already localized, so re-keying it would only make it worse.
    private enum Message {
        case app(LocalizedStringResource)
        case system(String)
    }

    @State private var currentIconName: String? = UIApplication.shared.alternateIconName
    @State private var busyId: String?
    @State private var error: Message?

    private let options: [AppIconOption] = [
        AppIconOption(id: "icon_classic", assetName: nil,
                      label: LocalizedStringResource("app_icon.classic.label", defaultValue: "Classic"),
                      emoji: "📖",
                      swatch: [Color(red: 0.30, green: 0.15, blue: 0.55), .purple],
                      price: 0, requiredBadge: nil),
        AppIconOption(id: "icon_rocket", assetName: "AppIconRocket",
                      label: LocalizedStringResource("app_icon.rocket.label", defaultValue: "Rocket"),
                      emoji: "🚀",
                      swatch: [Color(red: 0.04, green: 0.12, blue: 0.35), .cyan],
                      price: 100, requiredBadge: nil),
        AppIconOption(id: "icon_rainbow", assetName: "AppIconRainbow",
                      label: LocalizedStringResource("app_icon.rainbow.label", defaultValue: "Rainbow"),
                      emoji: "🌈",
                      swatch: [.pink, .orange],
                      price: 100, requiredBadge: nil),
        AppIconOption(id: "icon_dino", assetName: "AppIconDino",
                      label: LocalizedStringResource("app_icon.dino.label", defaultValue: "Dinosaur"),
                      emoji: "🦕",
                      swatch: [.green, .orange],
                      price: 100, requiredBadge: nil),
        AppIconOption(id: "icon_ocean", assetName: "AppIconOcean",
                      label: LocalizedStringResource("app_icon.ocean.label", defaultValue: "Ocean"),
                      emoji: "🐳",
                      swatch: [.cyan, .blue],
                      price: 100, requiredBadge: nil),
        AppIconOption(id: "icon_dragon", assetName: "AppIconDragon",
                      label: LocalizedStringResource("app_icon.dragon.label", defaultValue: "Dragon"),
                      emoji: "🐉",
                      swatch: [.purple, .indigo],
                      price: 100, requiredBadge: nil),
        AppIconOption(id: "icon_night", assetName: "AppIconNight",
                      label: LocalizedStringResource("app_icon.night.label", defaultValue: "Night Owl"),
                      emoji: "🌙",
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
                        errorText(error)
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

    private func errorText(_ message: Message) -> Text {
        switch message {
        case .app(let resource): return Text(resource)
        case .system(let text):  return Text(text)   // already localized by iOS
        }
    }

    private func iconCell(_ option: AppIconOption) -> some View {
        let owned = isOwned(option)
        let selected = currentIconName == option.assetName
        return Button {
            Task { await select(option) }
        } label: {
            VStack(spacing: 8) {
                ZStack {
                    // The real icon, not a stand-in. This cell used to draw a
                    // gradient with an emoji on it whatever the icon art was, so
                    // a child spent 100 coins on a coloured square and only found
                    // out what they had bought on the home screen. An app-icon
                    // set cannot be loaded with UIImage(named:), so each option
                    // has a plain "<asset>Preview" imageset beside it.
                    Group {
                        if let preview = UIImage(named: (option.assetName ?? "AppIcon") + "Preview") {
                            Image(uiImage: preview).resizable().scaledToFill()
                        } else {
                            LinearGradient(colors: option.swatch, startPoint: .top, endPoint: .bottom)
                                .overlay(Text(option.emoji).font(.system(size: 34)))
                        }
                    }
                    .frame(width: 72, height: 72)
                    // Continuous corners at iOS's own icon ratio, so the preview
                    // is the shape it will be on the home screen.
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(selected ? Color.yellow : .white.opacity(0.15),
                                    lineWidth: selected ? 3 : 1)
                    )
                    if !owned {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
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
                    Text("Unlock: \(Self.badgeName(badgeId))")
                        .font(.caption2).foregroundStyle(.orange)
                } else {
                    // A bare coin count: locale-formatted number, no key.
                    Label {
                        Text(option.price, format: .number)
                    } icon: {
                        Image(systemName: "star.circle.fill")
                    }
                    .font(.caption.bold()).foregroundStyle(.yellow)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
        }
        .disabled(busyId != nil)
    }

    /// Resolved badge name for interpolation into a sentence. Falls back
    /// to a translatable noun phrase rather than leaking the wire id.
    private static func badgeName(_ badgeId: String) -> String {
        guard let badge = RewardsStore.catalog.first(where: { $0.id == badgeId }) else {
            return String(localized: "badge.generic.name", defaultValue: "this badge")
        }
        return String(localized: badge.label)
    }

    private func isOwned(_ option: AppIconOption) -> Bool {
        if let badgeId = option.requiredBadge { return rewards.earnedBadges.contains(badgeId) }
        if option.price == 0 { return true }
        return coins.owns(item: option.id)
    }

    private func select(_ option: AppIconOption) async {
        error = nil

        if let badgeId = option.requiredBadge, !rewards.earnedBadges.contains(badgeId) {
            error = .app(LocalizedStringResource(
                "app_icon.locked_by_badge",
                defaultValue: "Keep your streak going to earn \(Self.badgeName(badgeId)) first!"))
            return
        }

        if !isOwned(option) {
            busyId = option.id
            defer { busyId = nil }
            switch await coins.spend(option.price, kind: "item", id: option.id) {
            case .ok:
                coins.markItemOwned(option.id)
            case .insufficient:
                error = .app(LocalizedStringResource(
                    "coins.insufficient",
                    defaultValue: "Not enough coins yet — keep creating to earn more!"))
                return
            case .error(let message):
                // CoinsStore hands back error.localizedDescription — OS text.
                error = .system(message)
                return
            }
        }

        guard UIApplication.shared.supportsAlternateIcons else {
            error = .app(LocalizedStringResource(
                "app_icon.unsupported_device",
                defaultValue: "This device doesn't support changing the icon."))
            return
        }
        do {
            try await UIApplication.shared.setAlternateIconName(option.assetName)
            currentIconName = option.assetName
            Haptics.celebrate()
            AudioService.shared.playSFX(.sparkle)
        } catch {
            self.error = .app(LocalizedStringResource(
                "app_icon.change_failed",
                defaultValue: "Couldn't change the icon. Please try again."))
        }
    }
}

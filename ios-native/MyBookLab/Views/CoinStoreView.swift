// The Coin Store. Mirrors the web's AvatarPage purchasable items —
// art styles for now (the only category that exists on the web).
// Future expansion: hats, accessories, clothing presets, etc.
//
// Tapping an unowned item triggers /api/spend-coins. The server
// debits atomically and returns the new balance. If the user doesn't
// have enough coins, the BuyCoinsSheet is presented inline.
import SwiftUI
import RevenueCat

// In-app coin buying via StoreKit IAP. Requires the three consumable
// products to be live in App Store Connect + linked in RevenueCat
// (see ios-native/LAUNCH-2.0.0.md). Each pack button shows the real
// localized App Store price — a placeholder bar while the products
// load, and "Unavailable" for packs that never arrive, rather than a
// guessed currency or a failure on tap.
let coinPurchasesEnabled = true

/// Two kinds of failure text. `app` is our own copy and must be
/// translated; `system` is an OS/URLSession message that iOS has already
/// localized, so re-keying it would only make it worse.
private enum StoreMessage {
    case app(LocalizedStringResource)
    case system(String)

    var text: Text {
        switch self {
        case .app(let resource): return Text(resource)
        case .system(let string): return Text(string)   // already localized by iOS
        }
    }
}

struct CoinStoreView: View {
    @Environment(CoinsStore.self) private var coins
    @Environment(\.dismiss) private var dismiss

    @State private var purchasing: String?
    @State private var error: StoreMessage?
    @State private var showingBuyCoins = false

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    header
                    artStylesSection
                    if let error {
                        error.text
                            .font(.footnote)
                            .foregroundStyle(.red.opacity(0.9))
                            .padding(.horizontal)
                    }
                    Spacer(minLength: 32)
                }
                .padding(.top, 8)
            }
        }
        .navigationTitle("Store")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                // Tappable (opens buy sheet) only when purchases are on;
                // otherwise it's a plain balance display.
                CoinBadge(balance: coins.balance,
                          action: coinPurchasesEnabled ? { showingBuyCoins = true } : nil)
            }
        }
        .sheet(isPresented: $showingBuyCoins) {
            NavigationStack { BuyCoinsSheet() }
                .presentationDragIndicator(.visible)
        }
        .task { await coins.refresh() }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 6) {
            Text("✨ Coin Store")
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundStyle(
                    LinearGradient(colors: [.cyan, .purple, .pink],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                )
            Text("Unlock magical art styles for your avatar.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.75))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Art styles section

    private var artStylesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Art styles")
                .font(.caption.bold())
                .foregroundStyle(.white.opacity(0.7))
                .textCase(.uppercase)
                .padding(.horizontal)

            // Adaptive grid: one column on iPhone, multiple on the wider
            // iPad screen so the styles aren't a thin single stack.
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 320, maximum: 420), spacing: 12)], spacing: 12) {
                ForEach(AvatarStyle.purchasable) { style in
                    styleCard(style)
                }
            }
            .padding(.horizontal)
        }
    }

    private func styleCard(_ style: AvatarStyle) -> some View {
        let owned = coins.owns(style: style.id)
        return Button {
            Task { await purchase(style) }
        } label: {
            HStack(spacing: 14) {
                StoreIcon(asset: StoreIcon.style(style.id), emoji: style.emoji, size: 56)
                VStack(alignment: .leading, spacing: 4) {
                    Text(style.displayLabel)
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text(style.description)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.65))
                        .lineLimit(2)
                }
                Spacer()
                if owned {
                    Label("Owned", systemImage: "checkmark.circle.fill")
                        .labelStyle(.iconOnly)
                        .foregroundStyle(.green)
                        .font(.title3)
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "circle.hexagongrid.fill")
                            .foregroundStyle(.yellow)
                            .font(.caption)
                        // A bare price in coins: locale-formatted number.
                        Text(style.price, format: .number)
                            .font(.subheadline.bold())
                            .foregroundStyle(.white)
                    }
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(.purple.opacity(0.35), in: Capsule())
                }
                if purchasing == style.id {
                    ProgressView().tint(.white)
                }
            }
            .padding(14)
            .background(
                .white.opacity(owned ? 0.04 : 0.08),
                in: RoundedRectangle(cornerRadius: 16)
            )
        }
        .buttonStyle(.plain)
        .disabled(owned || purchasing != nil)
    }

    private func purchase(_ style: AvatarStyle) async {
        guard !coins.owns(style: style.id) else { return }
        purchasing = style.id
        error = nil
        defer { purchasing = nil }
        switch await coins.spend(style.price, kind: "style", id: style.id) {
        case .ok:
            coins.markStyleOwned(style.id)
            Haptics.celebrate()
        case .insufficient:
            if coinPurchasesEnabled {
                showingBuyCoins = true
            } else {
                // No web steering — Apple's anti-steering rule forbids
                // pointing users to buy elsewhere from inside the app.
                self.error = .app(LocalizedStringResource(
                    "store.style.insufficient_coins",
                    defaultValue: "You need \(style.price) coins for this. Earn more coins by creating books and using features!"))
            }
        case .error(let message):
            // CoinsStore hands back error.localizedDescription — OS text.
            self.error = .system(message)
        }
    }
}

// MARK: - Coin balance pill

struct CoinBadge: View {
    let balance: Int
    let action: (() -> Void)?

    init(balance: Int, action: (() -> Void)? = nil) {
        self.balance = balance
        self.action = action
    }

    var body: some View {
        Button {
            action?()
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "circle.hexagongrid.fill")
                    .foregroundStyle(.yellow)
                    .font(.caption)
                // A bare balance: locale-formatted number, no catalog key.
                Text(balance, format: .number)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(.white.opacity(0.12), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(balance) coins")
    }
}

// MARK: - Buy coins sheet

struct BuyCoinsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(CoinsStore.self) private var coins

    @State private var purchasing: String?
    // Both are app-authored sentences (the failure one takes the OS
    // message as an argument), so both are localizable resources.
    @State private var error: LocalizedStringResource?
    @State private var pendingMessage: LocalizedStringResource?
    /// Nil until `loadCoinProducts` has run once. Without it, "no product"
    /// and "not loaded yet" look the same and every pack reads Unavailable.
    @State private var productsLoaded = false
    // Grown-up check before spending real money on a coin pack.
    // (Spending already-earned coins on an art style isn't gated —
    // no money changes hands there.)
    @State private var showParentalGate = false
    @State private var pendingPack: CoinPack?

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(spacing: 20) {
                    Text("💰").font(.system(size: 56)).padding(.top, 16)
                    Text("Get more coins")
                        .font(.system(size: 28, weight: .heavy, design: .rounded))
                        .foregroundStyle(
                            LinearGradient(colors: [.cyan, .purple, .pink],
                                           startPoint: .topLeading, endPoint: .bottomTrailing)
                        )
                    Text("Coins unlock magical art styles, accessories, and extra avatar regenerations.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.75))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)

                    VStack(spacing: 12) {
                        ForEach(CoinPack.all) { pack in
                            packCard(pack)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .task {
                        await coins.loadCoinProducts(ids: CoinPack.all.map(\.id))
                        productsLoaded = true
                    }

                    if let pendingMessage {
                        Text(pendingMessage)
                            .font(.footnote)
                            .foregroundStyle(.yellow)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                    }
                    if let error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red.opacity(0.9))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 24)
                    }

                    Text("Purchases go through the App Store. Coins are added to your account once payment confirms.")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.55))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                        .padding(.top, 16)
                }
                .padding(.bottom, 32)
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Close") { dismiss() }.foregroundStyle(.white)
            }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .parentalGate(isPresented: $showParentalGate) {
            guard let pack = pendingPack else { return }
            pendingPack = nil
            Task { await buy(pack) }
        }
    }

    private func packCard(_ pack: CoinPack) -> some View {
        // The only correct price is StoreKit's `localizedPriceString` —
        // it carries the storefront's currency, symbol placement and
        // separators. The old fallback was a hardcoded "$0.99", which is
        // wrong for every non-US storefront and untranslatable besides.
        // While the products load we show a placeholder bar instead.
        let product = coins.coinProducts[pack.id]
        let available = product != nil

        return Button {
            pendingPack = pack
            showParentalGate = true
        } label: {
            HStack(spacing: 14) {
                StoreIcon(asset: StoreIcon.coins(pack.id), emoji: pack.emoji, size: 56)
                VStack(alignment: .leading, spacing: 2) {
                    Text(pack.label).font(.headline).foregroundStyle(.white)
                    HStack(spacing: 4) {
                        Image(systemName: "circle.hexagongrid.fill")
                            .foregroundStyle(.yellow).font(.caption)
                        Text("\(pack.coins) coins")
                            .font(.caption).foregroundStyle(.white.opacity(0.7))
                    }
                }
                Spacer()
                if pack.popular && available {
                    Text("Best value")
                        .font(.caption.bold())
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(.yellow, in: Capsule())
                        .foregroundStyle(.black)
                }
                if purchasing == pack.id {
                    ProgressView().tint(.white)
                } else if let product {
                    Text(verbatim: product.localizedPriceString)
                        .font(.title3.bold()).foregroundStyle(.white)
                } else if !productsLoaded {
                    // Price skeleton — never a guessed currency.
                    RoundedRectangle(cornerRadius: 6)
                        .fill(.white.opacity(0.18))
                        .frame(width: 58, height: 20)
                        .accessibilityLabel("Loading price")
                } else {
                    Text("Unavailable").font(.caption).foregroundStyle(.white.opacity(0.5))
                }
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(pack.popular ? .purple.opacity(0.45) : .white.opacity(0.08))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(pack.popular && available ? .white.opacity(0.6) : .clear, lineWidth: 1.5)
            )
            .opacity(available ? 1 : 0.5)
        }
        .buttonStyle(.plain)
        .disabled(purchasing != nil || !available)
    }

    private func buy(_ pack: CoinPack) async {
        purchasing = pack.id
        error = nil
        pendingMessage = nil
        defer { purchasing = nil }
        let result = await coins.purchaseCoinPack(productId: pack.id, expectedCoins: pack.coins)
        switch result {
        case .success:
            Haptics.celebrate()
            dismiss()
        case .cancelled:
            break
        case .pending:
            pendingMessage = LocalizedStringResource(
                "coins.purchase.pending",
                defaultValue: "Payment confirmed. Your coins will appear in a moment — pull to refresh if they don't show up.")
        case .failed(let msg):
            // One sentence, one key; the StoreKit message (already
            // localized by iOS) goes in as an argument so a translation
            // can put it wherever the language wants it.
            error = LocalizedStringResource(
                "coins.purchase.failed",
                defaultValue: "Purchase failed: \(msg)")
        }
    }
}

// MARK: - Catalog

struct AvatarStyle: Identifiable, Hashable {
    /// owned_styles id — wire value shared with the web. Never localized.
    let id: String
    /// Display text, keyed so the literals below reach the String Catalog.
    let displayLabel: LocalizedStringResource
    let emoji: String
    let description: LocalizedStringResource
    let price: Int  // in coins

    /// Resolved plain text of `displayLabel`. AvatarEditorView's
    /// `styleChip(label:)` still takes a `String`; routing it through the
    /// catalog here means that screen gets the translation too, without
    /// this file duplicating the literal. Callers that can take a
    /// `LocalizedStringResource` should use `displayLabel` directly.
    var label: String { String(localized: displayLabel) }

    static func == (lhs: AvatarStyle, rhs: AvatarStyle) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    /// Mirrors the web's ART_STYLES catalog. `cartoon` is free + owned
    /// by default, so it doesn't appear here.
    static let purchasable: [AvatarStyle] = [
        .init(id: "pixar",
              displayLabel: LocalizedStringResource("avatar_style.pixar.label", defaultValue: "Pixar 3D"),
              emoji: "✨",
              description: LocalizedStringResource("avatar_style.pixar.description", defaultValue: "Polished 3D render. Big eyes, soft lighting."),
              price: 15),
        .init(id: "anime",
              displayLabel: LocalizedStringResource("avatar_style.anime.label", defaultValue: "Anime"),
              emoji: "🌸",
              description: LocalizedStringResource("avatar_style.anime.description", defaultValue: "Vivid colors, expressive lines, Ghibli-inspired."),
              price: 15),
        .init(id: "watercolor",
              displayLabel: LocalizedStringResource("avatar_style.watercolor.label", defaultValue: "Watercolor"),
              emoji: "🖌️",
              description: LocalizedStringResource("avatar_style.watercolor.description", defaultValue: "Soft painted brushstrokes, storybook look."),
              price: 15),
        .init(id: "pixel",
              displayLabel: LocalizedStringResource("avatar_style.pixel.label", defaultValue: "Pixel Art"),
              emoji: "👾",
              description: LocalizedStringResource("avatar_style.pixel.description", defaultValue: "16-bit retro game character vibes."),
              price: 15),
    ]
}

struct CoinPack: Identifiable, Hashable {
    /// App Store product identifier — wire value, never localized.
    let id: String
    let coins: Int
    /// Display text. The *price* deliberately has no field here: it comes
    /// from StoreKit's localizedPriceString, which is the only value that
    /// is right in every storefront.
    let label: LocalizedStringResource
    let emoji: String
    let popular: Bool

    static func == (lhs: CoinPack, rhs: CoinPack) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    /// Same coin packs as the web's BuyCoinsPanel + ios IAP product IDs.
    static let all: [CoinPack] = [
        .init(id: "com.myfavoritebook.app.coins.small",
              coins: 50,
              label: LocalizedStringResource("coin_pack.small.label", defaultValue: "Small pack"),
              emoji: "🪙", popular: false),
        .init(id: "com.myfavoritebook.app.coins.medium",
              coins: 200,
              label: LocalizedStringResource("coin_pack.medium.label", defaultValue: "Medium pack"),
              emoji: "💰", popular: true),
        .init(id: "com.myfavoritebook.app.coins.large",
              coins: 500,
              label: LocalizedStringResource("coin_pack.large.label", defaultValue: "Large pack"),
              emoji: "💎", popular: false),
    ]
}


/// The picture on a store row. Emoji used to stand in for everything a child
/// can buy; for something paid for with real money that read as unfinished,
/// and "Watercolor" as 🖌️ says nothing about what you get. Each art style now
/// shows the same boy drawn IN that style, so the icon is a preview, and the
/// coin packs grow from a stack to a pouch to a chest.
///
/// Falls back to the emoji if an imageset is ever missing, so a new catalog
/// item never renders as an empty square.
struct StoreIcon: View {
    let asset: String
    let emoji: String
    var size: CGFloat = 56

    var body: some View {
        if let image = UIImage(named: asset) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
                .shadow(color: .black.opacity(0.25), radius: 4, y: 2)
        } else {
            Text(emoji).font(.system(size: size * 0.64))
                .frame(width: size, height: size)
        }
    }

    /// "pixar" -> "StylePixar"
    static func style(_ id: String) -> String { "Style" + id.capitalized }

    /// "com.myfavoritebook.app.coins.medium" -> "CoinsMedium"
    static func coins(_ productID: String) -> String {
        "Coins" + (productID.split(separator: ".").last.map { String($0).capitalized } ?? "")
    }
}

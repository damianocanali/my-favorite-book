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
// localized App Store price; packs that aren't available yet show as
// "Unavailable" rather than failing on tap.
let coinPurchasesEnabled = true

struct CoinStoreView: View {
    @Environment(CoinsStore.self) private var coins
    @Environment(\.dismiss) private var dismiss

    @State private var purchasing: String?
    @State private var error: String?
    @State private var showingBuyCoins = false

    var body: some View {
        ZStack {
            CosmicBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    header
                    artStylesSection
                    if let error {
                        Text(error)
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

            VStack(spacing: 12) {
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
                Text(style.emoji).font(.system(size: 36))
                VStack(alignment: .leading, spacing: 4) {
                    Text(style.label)
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
                        Text("\(style.price)")
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
        switch await coins.spend(style.price) {
        case .ok:
            coins.markStyleOwned(style.id)
            Haptics.celebrate()
        case .insufficient:
            if coinPurchasesEnabled {
                showingBuyCoins = true
            } else {
                // No web steering — Apple's anti-steering rule forbids
                // pointing users to buy elsewhere from inside the app.
                self.error = "You need \(style.price) coins for this. Earn more coins by creating books and using features!"
            }
        case .error(let message):
            self.error = message
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
                Text("\(balance)")
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
    @State private var error: String?
    @State private var pendingMessage: String?

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
                    .task { await coins.loadCoinProducts(ids: CoinPack.all.map(\.id)) }

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
    }

    private func packCard(_ pack: CoinPack) -> some View {
        // Real localized App Store price when the product loaded;
        // fall back to the catalog price string only while loading.
        let product = coins.coinProducts[pack.id]
        let available = product != nil
        let priceText = product?.localizedPriceString ?? pack.price

        return Button {
            Task { await buy(pack) }
        } label: {
            HStack(spacing: 14) {
                Text(pack.emoji).font(.system(size: 40))
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
                } else if available {
                    Text(priceText).font(.title3.bold()).foregroundStyle(.white)
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
            pendingMessage = "Payment confirmed. Your coins will appear in a moment — pull to refresh if they don't show up."
        case .failed(let msg):
            error = "Purchase failed: \(msg)"
        }
    }
}

// MARK: - Catalog

struct AvatarStyle: Identifiable, Hashable {
    let id: String
    let label: String
    let emoji: String
    let description: String
    let price: Int  // in coins

    /// Mirrors the web's ART_STYLES catalog. `cartoon` is free + owned
    /// by default, so it doesn't appear here.
    static let purchasable: [AvatarStyle] = [
        .init(id: "pixar", label: "Pixar 3D", emoji: "✨",
              description: "Polished 3D render. Big eyes, soft lighting.",
              price: 15),
        .init(id: "anime", label: "Anime", emoji: "🌸",
              description: "Vivid colors, expressive lines, Ghibli-inspired.",
              price: 15),
        .init(id: "watercolor", label: "Watercolor", emoji: "🖌️",
              description: "Soft painted brushstrokes, storybook look.",
              price: 15),
        .init(id: "pixel", label: "Pixel Art", emoji: "👾",
              description: "16-bit retro game character vibes.",
              price: 15),
    ]
}

struct CoinPack: Identifiable, Hashable {
    let id: String
    let coins: Int
    let price: String
    let label: String
    let emoji: String
    let popular: Bool

    /// Same coin packs as the web's BuyCoinsPanel + ios IAP product IDs.
    static let all: [CoinPack] = [
        .init(id: "com.myfavoritebook.app.coins.small",
              coins: 50, price: "$0.99",
              label: "Small pack", emoji: "🪙", popular: false),
        .init(id: "com.myfavoritebook.app.coins.medium",
              coins: 200, price: "$2.99",
              label: "Medium pack", emoji: "💰", popular: true),
        .init(id: "com.myfavoritebook.app.coins.large",
              coins: 500, price: "$4.99",
              label: "Large pack", emoji: "💎", popular: false),
    ]
}

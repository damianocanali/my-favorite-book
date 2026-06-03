// Coin economy. Mirrors the web's useAvatarStore.coins logic — the
// server (`/api/coins` + `/api/spend-coins`) is authoritative; we
// cache the latest known balance locally so the UI can render it
// synchronously and update optimistically.
//
// Buying coins on iOS is a separate flow — App Store rules require
// IAP for in-app currency, so coin packs go through StoreKit (via
// RevenueCat consumables). See SubscriptionStore.purchaseCoinPack
// once that's wired up. The spend side (this file) is identical to
// the web.
import Foundation
import Observation
import RevenueCat

@Observable
@MainActor
final class CoinsStore {
    static let shared = CoinsStore()

    private(set) var balance: Int = 0
    private(set) var loading: Bool = false
    private(set) var error: String?

    /// Items the user owns. Mirrors useAvatarStore.ownedItems +
    /// ownedStyles on the web but stored locally here — the web side
    /// persists this in localStorage too. Future migration: move to a
    /// `user_inventory` table for cross-device sync.
    private(set) var ownedStyles: Set<String> = ["cartoon"] // cartoon is free + default
    private(set) var ownedItems: Set<String> = []

    private let ownedStylesKey = "owned_styles"
    private let ownedItemsKey = "owned_items"

    init() {
        // Restore the local "owned" sets so previously-purchased
        // styles persist across launches.
        if let stored = UserDefaults.standard.array(forKey: ownedStylesKey) as? [String] {
            ownedStyles.formUnion(stored)
        }
        if let stored = UserDefaults.standard.array(forKey: ownedItemsKey) as? [String] {
            ownedItems.formUnion(stored)
        }
    }

    // MARK: - Balance

    func refresh() async {
        guard let token = AuthStore.shared.accessToken else {
            balance = 0
            return
        }
        loading = true
        defer { loading = false }
        do {
            let res = try await CoinsAPI.fetchBalance(bearerToken: token)
            balance = res
            error = nil
        } catch is CancellationError {
            // ignore
        } catch let urlError as URLError where urlError.code == .cancelled {
            // ignore
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Spend `amount` coins server-side. Returns .ok with the new
    /// balance, .insufficient if the user can't afford it, or .error
    /// for everything else. The server is the source of truth — we
    /// only update local state from its response.
    enum SpendResult {
        case ok(balance: Int)
        case insufficient
        case error(String)
    }

    func spend(_ amount: Int) async -> SpendResult {
        guard amount > 0 else { return .ok(balance: balance) }
        guard let token = AuthStore.shared.accessToken else {
            return .error("Sign in to spend coins")
        }
        do {
            let result = try await CoinsAPI.spend(amount: amount, bearerToken: token)
            switch result {
            case .ok(let newBalance):
                balance = newBalance
                return .ok(balance: newBalance)
            case .insufficient:
                return .insufficient
            }
        } catch {
            return .error(error.localizedDescription)
        }
    }

    // MARK: - Local inventory

    func markStyleOwned(_ id: String) {
        ownedStyles.insert(id)
        UserDefaults.standard.set(Array(ownedStyles), forKey: ownedStylesKey)
    }

    func markItemOwned(_ id: String) {
        ownedItems.insert(id)
        UserDefaults.standard.set(Array(ownedItems), forKey: ownedItemsKey)
    }

    func owns(style id: String) -> Bool { ownedStyles.contains(id) }
    func owns(item id: String) -> Bool { ownedItems.contains(id) }

    // MARK: - Buy coins via App Store IAP (RevenueCat consumables)

    /// Loaded StoreKit products keyed by product identifier. Populated
    /// by loadCoinProducts(); used to show real localized prices and
    /// to detect which packs are actually available.
    private(set) var coinProducts: [String: StoreProduct] = [:]

    func loadCoinProducts(ids: [String]) async {
        let products = await Purchases.shared.products(ids)
        var map: [String: StoreProduct] = [:]
        for p in products { map[p.productIdentifier] = p }
        coinProducts = map
    }

    enum PurchaseResult {
        case success(newBalance: Int)
        case cancelled
        case pending      // RC succeeded but the webhook hasn't credited yet
        case failed(String)
    }

    /// Purchases a coin pack via RevenueCat. After the StoreKit
    /// transaction completes, the RevenueCat webhook fires server-side
    /// and adds the coins. Since that's async we POLL the balance for
    /// up to ~12 seconds, expecting to see at least `expectedCoins`
    /// more than we had before.
    func purchaseCoinPack(productId: String, expectedCoins: Int) async -> PurchaseResult {
        do {
            let products = await Purchases.shared.products([productId])
            guard let product = products.first else {
                return .failed("Coin pack \(productId) not available right now")
            }
            let before = balance
            let result = try await Purchases.shared.purchase(product: product)
            if result.userCancelled { return .cancelled }

            // Poll for the webhook to credit. RC usually fires it
            // within a couple of seconds; give it up to 12.
            for attempt in 0..<12 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)  // 1s
                await refresh()
                if balance >= before + expectedCoins {
                    return .success(newBalance: balance)
                }
                _ = attempt // silence the unused-var warning
            }
            // Transaction succeeded but the webhook hasn't shown up.
            // Surface as "pending" so the user knows their coins will
            // appear shortly — they won't be charged twice if they
            // retry since RC dedupes on transaction id.
            return .pending
        } catch {
            return .failed(error.localizedDescription)
        }
    }
}

// MARK: - API client

private enum CoinsAPI {
    enum SpendResult {
        case ok(newBalance: Int)
        case insufficient
    }

    static func fetchBalance(bearerToken: String) async throws -> Int {
        let url = AppConfig.shared.apiBase.appendingPathComponent("/api/coins")
        var req = URLRequest(url: url)
        req.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        let (data, _) = try await URLSession.shared.data(for: req)
        struct Response: Decodable { let balance: Int }
        return (try? JSONDecoder().decode(Response.self, from: data).balance) ?? 0
    }

    static func spend(amount: Int, bearerToken: String) async throws -> SpendResult {
        let url = AppConfig.shared.apiBase.appendingPathComponent("/api/spend-coins")
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        struct Body: Encodable { let amount: Int }
        req.httpBody = try JSONEncoder().encode(Body(amount: amount))

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.noData
        }
        if http.statusCode == 402 { return .insufficient }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.http(status: http.statusCode,
                                body: String(data: data, encoding: .utf8) ?? "")
        }
        struct Response: Decodable { let balance: Int }
        let r = try JSONDecoder().decode(Response.self, from: data)
        return .ok(newBalance: r.balance)
    }
}

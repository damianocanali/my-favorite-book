// Wraps RevenueCat. Web users get subscriptions via Stripe; iOS users
// must buy via StoreKit IAP per App Store rules. RevenueCat unifies
// both sides — a paying iOS user shows up entitled on web and vice
// versa, so the user only ever pays once.
//
// State exposed:
//   isPaid    — convenience boolean for any premium gate
//   planKey   — "free" | "family" | "classroom" (matches the web's plan keys)
//   offerings — current offering from RevenueCat (use for the paywall UI)
//
// Methods:
//   refresh() — pulls latest customerInfo + offerings
//   purchase(package:) — initiate IAP via StoreKit
//   restore() — restore prior purchases (App Store requirement)
import Foundation
import Observation
import RevenueCat
import Supabase

@Observable
@MainActor
final class SubscriptionStore {
    static let shared = SubscriptionStore()

    private(set) var customerInfo: CustomerInfo?
    private(set) var currentOffering: Offering?
    private(set) var loading: Bool = false
    private(set) var error: String?

    /// Subscription read from the Supabase `subscriptions` table — this
    /// is where web/Stripe purchases land. iOS IAP purchases come
    /// through RevenueCat. A user is "paid" if EITHER source says so,
    /// because the same person may have subscribed on the web.
    private(set) var serverPlan: String = "free"
    private(set) var serverStatusActive: Bool = false

    var isPaid: Bool {
        let rcActive = !(customerInfo?.entitlements.active.isEmpty ?? true)
        return rcActive || serverStatusActive
    }

    /// Best-known plan key: prefer an active RevenueCat entitlement,
    /// else the server (web/Stripe) plan, else free.
    var planKey: String {
        if let info = customerInfo {
            if info.entitlements["family"]?.isActive == true { return "family" }
            if info.entitlements["classroom"]?.isActive == true { return "classroom" }
        }
        if serverStatusActive { return serverPlan }
        return "free"
    }

    func bootstrap() async {
        // Sync RevenueCat user ID with Supabase user ID if signed in,
        // so web + iOS see the same RevenueCat customer.
        if let id = AuthStore.shared.user?.id.uuidString {
            do { _ = try await Purchases.shared.logIn(id) }
            catch { /* not fatal */ }
        }
        await refresh()
    }

    func refresh() async {
        loading = true
        error = nil
        defer { loading = false }
        // RevenueCat (iOS IAP) + Supabase subscriptions (web/Stripe) in
        // parallel; either can mark the user paid.
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.refreshRevenueCat() }
            group.addTask { await self.refreshServerSubscription() }
        }
    }

    private func refreshRevenueCat() async {
        do {
            async let info = Purchases.shared.customerInfo()
            async let offerings = Purchases.shared.offerings()
            self.customerInfo = try await info
            self.currentOffering = try await offerings.current
        } catch {
            // Non-fatal — server subscription may still cover the user.
        }
    }

    private struct SubRow: Decodable {
        let plan: String?
        let status: String?
    }

    private func refreshServerSubscription() async {
        guard let userId = AuthStore.shared.user?.id.uuidString else {
            serverStatusActive = false
            serverPlan = "free"
            return
        }
        do {
            let rows: [SubRow] = try await AuthStore.shared.supabase
                .from("subscriptions")
                .select("plan, status")
                .eq("user_id", value: userId)
                .execute()
                .value
            if let row = rows.first {
                serverPlan = row.plan ?? "free"
                // Treat active / trialing as paid.
                let s = (row.status ?? "").lowercased()
                serverStatusActive = (s == "active" || s == "trialing")
            } else {
                serverPlan = "free"
                serverStatusActive = false
            }
        } catch {
            // Leave previous state on transient failure.
        }
    }

    func purchase(_ package: Package) async throws {
        let result = try await Purchases.shared.purchase(package: package)
        if !result.userCancelled {
            self.customerInfo = result.customerInfo
        }
    }

    func restore() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            self.customerInfo = try await Purchases.shared.restorePurchases()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

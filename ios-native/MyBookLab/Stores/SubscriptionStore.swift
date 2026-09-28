// Wraps RevenueCat. Web users get subscriptions via Stripe; iOS users
// must buy via StoreKit IAP per App Store rules. RevenueCat unifies
// both sides — a paying iOS user shows up entitled on web and vice
// versa, so the user only ever pays once.
//
// State exposed:
//   isPaid    — convenience boolean for any premium gate
//   planKey   — "free" | "family" | "classroom" | "student" (matches the
//               web's plan keys; "student" is a class account, see ClassPlan)
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

    /// A class (student) account. It is never on a RevenueCat or Stripe plan:
    /// it gets the fixed ClassPlan, is never shown a price, and this store
    /// never reads entitlements for it — RevenueCat is not logged out on
    /// sign-out, so its cached customer may still be the previous parent's.
    private var isStudent: Bool { AuthStore.shared.isStudent }

    /// The class plan, mirroring `student` in src/lib/plans.js. Not a tier
    /// anyone buys: the school's licence covers it. `imagesPerDay` is UX
    /// only — the server's per-student allowance is what actually counts.
    enum ClassPlan {
        static let maxBooks: Int? = nil     // unlimited
        static let imagesPerDay = 15
        static let pdfExport = false        // no print, no PDF export
    }

    /// Whether printed copies / PDF export are on offer. Only a class account
    /// says no; family behaviour is unchanged.
    var allowsPrint: Bool { isStudent ? ClassPlan.pdfExport : true }

    var isPaid: Bool {
        // A class account is fully unlocked (never upsold), like the web's
        // `student` plan being !== 'free'.
        if isStudent { return true }
        let rcActive = !(customerInfo?.entitlements.active.isEmpty ?? true)
        return rcActive || serverStatusActive
    }

    /// Best-known plan key: prefer an active RevenueCat entitlement,
    /// else the server (web/Stripe) plan, else free.
    var planKey: String {
        if isStudent { return "student" }
        if let info = customerInfo {
            if info.entitlements["family"]?.isActive == true { return "family" }
            if info.entitlements["classroom"]?.isActive == true { return "classroom" }
        }
        if serverStatusActive { return serverPlan }
        return "free"
    }

    func bootstrap() async {
        if isStudent {
            await enterStudentMode()
            return
        }
        // Sync RevenueCat user ID with Supabase user ID if signed in,
        // so web + iOS see the same RevenueCat customer.
        if let id = AuthStore.shared.user?.id.uuidString {
            do { _ = try await Purchases.shared.logIn(id) }
            catch { /* not fatal */ }
        }
        await refresh()
    }

    func refresh() async {
        // Nothing to fetch for a class account, and fetching RevenueCat's
        // customer would read whatever parent was here before.
        if isStudent { return }
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

    /// Called when a class account signs in (and from bootstrap for one).
    /// Drops RevenueCat's identity so no cached customer info from the
    /// previous parent leaks into the child's session, and forgets what
    /// this store knew about that parent. A family account signing in next
    /// goes through bootstrap(), which logs RevenueCat back in as them.
    func enterStudentMode() async {
        customerInfo = nil
        currentOffering = nil
        serverPlan = "free"
        serverStatusActive = false
        error = nil
        // logOut() throws for an anonymous user, so only when identified.
        if !Purchases.shared.isAnonymous {
            _ = try? await Purchases.shared.logOut()
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
        // Never reachable from the UI for a class account; this is the
        // backstop, since the server cannot stop an on-device purchase.
        guard !isStudent else { return }
        let result = try await Purchases.shared.purchase(package: package)
        if !result.userCancelled {
            self.customerInfo = result.customerInfo
        }
    }

    func restore() async {
        guard !isStudent else { return }
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

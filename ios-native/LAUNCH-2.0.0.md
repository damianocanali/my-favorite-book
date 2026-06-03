# My Book Lab 2.0.0 — Native App Launch Checklist

The native SwiftUI rewrite. Ships to the SAME App Store listing as the
Capacitor build (same bundle id `com.myfavoritebook.app`). Existing
users update in place; their Supabase data + RevenueCat subscriptions
carry over.

---

## 0. Pre-flight config (one-time)

- [ ] `Config.local.xcconfig` has **production** secrets:
      `SUPABASE_ANON_KEY`, `GOOGLE_SIGN_IN_CLIENT_ID` (the **iOS** client),
      `REVENUECAT_API_KEY`
- [ ] Base URLs are hardcoded in `AppConfig.swift` (mybooklab.app +
      ydpblgmirurobwdhzbqj.supabase.co) — nothing to do
- [ ] `API_BASE_HOST` in the xcconfig is **blank** (so the app points at
      production, not a preview deployment)

## 1. Real-device test (REQUIRED before archiving)

The simulator can't exercise Face ID, IAP, or the camera. Run on a
physical iPhone (`Product → Destination → your iPhone`, then Cmd+R) and
verify each:

- [ ] **Email sign-in** → bookshelf shows your real books
- [ ] **Sign in with Apple** → native sheet, lands signed in
- [ ] **Google sign-in** → in-app browser, lands signed in
- [ ] **Face ID** → enable "Remember me", sign out, sign back in with Face ID
- [ ] **Orders tab** → real orders appear
- [ ] **Create a book** → wizard → save → confetti → appears on shelf
- [ ] **Create your hero** → photo → parental gate → cartoon hero appears
- [ ] **AI cover** → "Generate AI cover" returns an image (needs Together API budget)
- [ ] **Edit a book** → pencil → change a page → save → change persists
- [ ] **Story Buddy** → returns a reply (needs Anthropic API budget)
- [ ] **Read aloud** → speaks the page
- [ ] **Paywall** → shows plans; subscription status reflects your account
- [ ] **Print order** → Stripe sheet opens → (sandbox) pay → lands on Orders
- [ ] **Buy coins** → pack purchase (Sandbox) → balance increases
- [ ] **Coin store** → buy an art style with coins → marked owned

If any fail, fix before archiving — TestFlight review is slower to iterate than local.

## 2. Version

Already set in `project.yml`:
- `MARKETING_VERSION: 2.0.0`
- `CURRENT_PROJECT_VERSION: 1` (bump to 2, 3, … only if you re-upload)

If you change either, re-run `xcodegen`.

## 3. Capabilities (confirm in Xcode)

- [ ] Target → Signing & Capabilities → **Sign in with Apple** present
      (the entitlement is declared in project.yml; Xcode should show it)
- [ ] Automatic signing on, team = G53XBRCRVU
- [ ] (If using Apple Pay for print orders later) Apple Pay capability —
      not required for card-only Stripe

## 4. Archive + upload

```bash
cd ios-native && xcodegen
open MyBookLab.xcodeproj
```

In Xcode:
1. Device dropdown → **Any iOS Device (arm64)** (not a simulator)
2. **Product → Archive** (~3–5 min)
3. Organizer opens → **Distribute App → App Store Connect → Upload**
4. Keep defaults (symbols on) → Upload
5. Wait for the "processing complete" email (usually <30 min)

## 5. App Store Connect — the 2.0.0 version

1. My Book Lab → **+ Version** → `2.0.0`
2. **What's New:**
   > • A brand-new, faster, more magical app
   > • Create your own hero — turn a photo into a cartoon star of your book
   > • AI book covers
   > • Sign in with Face ID, Google, or Apple
   > • Order printed books, hardcover or softcover
3. **Build** → select `2.0.0 (1)` once processing finishes
4. **Age Rating** → fix the prior rejection: set **Age Assurance** and any
   **In-App Controls** to **None** (this was what blocked 1.5.0)
5. **App Review Information** → demo account creds (any real account works;
   no owner gate anymore)
6. Review notes (paste):
   > • Print orders use Stripe for physical goods (Guideline 3.1.1 — physical
   >   goods are exempt from IAP).
   > • A parental gate (math problem) appears before camera/photo use and
   >   before any purchase.
   > • Sign in with Apple is offered alongside Google (Guideline 4.8).
7. **Submit for Review**

## 6. Post-submit

- Apple review for a feature update is typically ~24h.
- Choose **Manual release** so you control go-live timing.
- Keep the Capacitor 1.5.0 build as a fallback until 2.0.0 is approved + stable.

---

## Coin IAP setup (REQUIRED for 2.0.0 — coins are a revenue stream)

`coinPurchasesEnabled = true`, so the app sells coin packs via StoreKit.
For purchases to work (and not show "Unavailable"), the three
consumables must exist in **both** App Store Connect and RevenueCat.

### App Store Connect

1. My Book Lab → **Monetization → In-App Purchases → +**
2. Create three **Consumable** products with these EXACT IDs:
   | Product ID | Reference name | Price |
   |---|---|---|
   | `com.myfavoritebook.app.coins.small` | 50 Coins | $0.99 |
   | `com.myfavoritebook.app.coins.medium` | 200 Coins | $2.99 |
   | `com.myfavoritebook.app.coins.large` | 500 Coins | $4.99 |
3. For each: add a display name + description, a screenshot (any 640×920+
   image of the coin store works), set price tier, **Save**.
4. Status should reach **Ready to Submit**. They get reviewed alongside
   the 2.0.0 build — attach them to the version under "In-App Purchases".

### RevenueCat

1. Dashboard → your project → **Products → + New** → import each of the
   three product IDs (type: consumable).
2. Webhook: **Project Settings → Integrations → Webhooks** must point at
   `https://mybooklab.app/api/revenuecat-webhook` with an Authorization
   header matching `REVENUECAT_WEBHOOK_SECRET` in Vercel. (Already set up
   for subscriptions — confirm it's there.)

### How the purchase + credit flow works

1. User taps a pack → StoreKit sheet (Sandbox in TestFlight) → pays
2. RevenueCat records the consumable purchase → fires the webhook
3. `/api/revenuecat-webhook` maps the product ID → coin amount → credits
   via the `add_coins` Supabase RPC (same path the web Stripe flow uses)
4. The app polls `/api/coins` for ~12s and the balance updates

### Sandbox test (do before submitting)

- TestFlight build or a Sandbox Apple ID
- Buy the small pack → watch the BuyCoinsSheet spinner → balance +50
- If it stays at "Unavailable": the product isn't loading from App Store
  Connect (not approved / wrong ID / not attached to the version)
- If purchase succeeds but balance doesn't rise: webhook isn't firing —
  check RevenueCat webhook config + `REVENUECAT_WEBHOOK_SECRET`

### Submit-time note for App Review

In-app purchases must be submitted **with** the build. In the 2.0.0
version page, scroll to **In-App Purchases** and check the three coin
products so they're reviewed together. Submitting the build without
them = coins show "Unavailable" to users until a later review.

## Known non-blockers for 2.0.0

- **Story Buddy / AI cover** need API budget (Anthropic / Together). The
  features work; they just need credit. Not a code issue.
- **Coin pack IAP** — if the three consumables aren't created in App Store
  Connect yet, the "Buy coins" flow won't complete. Either finish that
  setup or hide the buy button for 2.0.0; everything else is independent.

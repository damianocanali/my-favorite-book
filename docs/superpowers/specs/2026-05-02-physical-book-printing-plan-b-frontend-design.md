# Physical Book Printing — Plan B: Frontend Design

**Date:** 2026-05-02  
**Status:** Draft — needs human sign-off on Open Questions before implementation  
**Scope:** Frontend only. Backend (Plan A + A.5) is already shipped and verified.  
**Prerequisite reading:** `api/print-orders/create.js`, `api/print-orders/get.js`, `lib/print/pricing.js`, `lib/print/state.js`

---

## 1. Goals

- Let a parent place a physical print order for their child's book from both the iOS app and the web app.
- Surface the order entry point naturally at two moments: post-finish celebration and the bookshelf card.
- Use native Stripe Payment Sheet on iOS for the smoothest checkout UX. Fall back to Stripe Elements (web) on browser/Android.
- Show order history and real-time status at `/orders` and `/orders/:id`.
- Require a Parental Gate (existing `ParentalGate` component) before any payment is initiated.
- Send the user a set of transactional emails: placed, in production, shipped, delivered, refunded.

## 2. Non-Goals (YAGNI)

- No multi-language support.
- No international shipping — US only in v1; the create API already enforces this.
- No pricing experiments or A/B testing on format prices.
- No frontend test framework changes — the backend vitest setup is already in place and this spec does not propose adding React component tests.
- No admin order management UI — use Supabase dashboard for now.
- No offline order drafts — orders must be placed while connected.
- No order cancellation flow — Lulu does not support cancellation after submission; surface a "Report a problem" contact button instead.
- No Android-specific native Stripe integration — Android uses the web Payment Element inside a Capacitor web view, same as desktop web.
- No saved shipping addresses — user enters shipping details fresh each order.

---

## 3. Architecture Overview

### 3.1 Data flow

```
User action
  → OrderScreen (/order/:bookId)
      → POST /api/print-orders/create
          returns { orderId, clientSecret, totalCents }
      → ParentalGate (modal)
      → [iOS] StripePlugin.presentPaymentSheet(clientSecret)
        [Web/Android] Stripe.js Elements confirmPayment(clientSecret)
  → OrderConfirmPage (/orders/:id/confirm?new=1)
      polls GET /api/print-orders/get/:id until status !== 'pending'

Order list
  → /orders
      reads print_orders directly from Supabase JS client
      (RLS policy "Users read own print orders" already enforces row isolation)

Order detail
  → /orders/:id
      GET /api/print-orders/get/:id
      (API endpoint, not direct Supabase — avoids exposing internal fields)
```

### 3.2 Payment architecture: iOS vs Web

| Platform | SDK | How clientSecret is used |
|----------|-----|--------------------------|
| iOS (Capacitor) | `@capacitor-community/stripe` | `StripePlugin.createPaymentSheet({ paymentIntentClientSecret })` → `presentPaymentSheet()` |
| Android (Capacitor) | Stripe.js via WKWebView | Standard `stripe.confirmPayment()` in web layer |
| Web (browser) | `@stripe/stripe-js` + `@stripe/react-stripe-js` | `<PaymentElement>` + `stripe.confirmPayment()` |

The payment layer is abstracted behind a thin service at `src/services/printPaymentService.js` (to be written during implementation). It exposes a single `async pay(clientSecret): Promise<void>` that dispatches to the right path based on `isNative && platform === 'ios'`.

Physical print is a "physical goods" transaction (Apple guideline 3.1.3(a)) and is NOT routed through StoreKit/RevenueCat.

### 3.3 State management

A new Zustand store `src/stores/usePrintOrderStore.js` holds the in-progress order form so state survives the navigation round-trip when the user taps "Back" to change something.

```
usePrintOrderStore shape:
  bookId: string | null
  format: 'hardcover' | 'softcover'         // default 'hardcover'
  quantity: number                            // 1–10, default 1
  shipping: {
    name, address_line1, address_line2,
    city, state, postal_code, email, phone   // phone REQUIRED by Lulu
  }
  reviewChecked: boolean                      // "I've reviewed every page"
  finishedChecked: boolean                    // "This book is finished and ready to print"
  // Ephemeral — not persisted:
  orderId: string | null                      // set after successful POST
  clientSecret: string | null
  totalCents: number | null
  submitting: boolean
  error: string | null

  actions: setFormat, setQuantity, setShipping, setChecks,
           reset, setOrderResult
```

`usePrintOrderStore` uses `zustand/middleware` `persist` for the non-ephemeral fields (format, quantity, shipping) so the form is pre-filled if the user returns to the same order screen. The ephemeral fields (orderId, clientSecret, submitting, error) are excluded from persistence via `partialize`.

A second store is not needed for the orders list — `useOrdersStore` would be overkill. The list page fetches directly from Supabase on mount and stores results in local React state.

### 3.4 API call conventions

All API calls use the existing `apiFetchAuthed` helper from `src/lib/api.js`, which attaches the Supabase JWT and prepends `VITE_API_BASE_URL` on native.

GET /api/print-orders/get/:id — the backend extracts `:id` from `pathname.split('/').pop()`, so the frontend must call the URL as `/api/print-orders/get/${orderId}`.

Orders list uses the Supabase JS client directly (same pattern as `useSubscription.js`). The RLS policy already restricts results to the authenticated user's rows. Fields queried: all columns in `PUBLIC_FIELDS` from `get.js` plus `ship_name` (needed for list card display).

---

## 4. New Routes

These additions go into `src/App.jsx` inside the existing `<Routes>` block. All are protected by `<ProtectedRoute>`.

```
/order/:bookId          → PrintOrderPage          (order form + preview)
/orders                 → OrdersListPage           (order history)
/orders/:id             → OrderDetailPage          (status timeline + tracking)
/orders/:id/confirm     → OrderConfirmPage         (post-payment success)
```

`/order/:bookId` and `/orders/*` are all wrapped in `<ProtectedRoute>` — unauthenticated users are redirected to `/login`.

---

## 5. New Entry Points

### 5.1 Post-finish CTA (BookFinishedModal)

**Where:** Added to `src/components/editor/StoryEditor.jsx` (or wherever the editor's "Mark as done" action fires). When the user marks the last page as finished, a full-screen overlay appears.

**Component:** `src/components/print/BookFinishedModal.jsx`

```
BookFinishedModal
  ├── Confetti burst (reuse existing canvas-confetti via src/lib/celebrate.js)
  ├── motion.div animated slide-up card
  │   ├── Trophy / star illustration (emoji or Lucide Medal icon)
  │   ├── Heading: "Your book is done! 🎉"
  │   ├── Body: "You can order a real printed copy to hold in your hands."
  │   ├── SparkleButton "Order a print →"  → navigate('/order/:bookId')
  │   └── TextButton  "Maybe later"         → onClose()
  └── (close on backdrop tap)
```

Props: `book: BookShape`, `onClose: () => void`

### 5.2 Bookshelf card print icon

**Where:** `src/components/bookshelf/BookSpine.jsx` — add a third action icon alongside the existing Edit (pencil) and Delete (trash) icons that appear on hover/long-press.

**Icon:** `Printer` from lucide-react, positioned at `-bottom-2 -right-2` (or a different corner to avoid colliding with Delete).

**Behavior:** `onClick` → `navigate('/order/:bookId')`.

The parent `Bookshelf.jsx` passes an `onOrderPrint` handler down to `BookSpine`, matching the existing `onEdit` / `onDelete` pattern.

---

## 6. PrintOrderPage (`/order/:bookId`)

### 6.1 Component tree

```
PrintOrderPage
  ├── [auth guard: redirect to /login if no session]
  ├── LoadingState (while book data fetches from bookshelf store)
  ├── ErrorState  (book not found)
  └── OrderForm
      ├── Section: Preview
      │   └── PrintableBook (existing component, reused as scroll-in embed)
      │       scrollable container, max-height ~ 50vh, with page-flip for browsing
      ├── Section: Confirmation checkboxes
      │   ├── Checkbox "I've reviewed every page"     → reviewChecked
      │   └── Checkbox "This book is finished and ready to print" → finishedChecked
      ├── Section: Format
      │   ├── FormatCard "Hardcover" $39.99 (default selected)
      │   └── FormatCard "Softcover" $19.99
      ├── Section: Quantity
      │   └── QuantityStepper (− / count / +, clamps 1–10)
      ├── Section: Shipping address
      │   ├── input: Full name              (shipping.name)
      │   ├── input: Address line 1         (shipping.address_line1)
      │   ├── input: Address line 2         (shipping.address_line2, optional)
      │   ├── input: City                   (shipping.city)
      │   ├── input: State (2-letter)       (shipping.state)
      │   ├── input: ZIP code               (shipping.postal_code)
      │   ├── input: Email                  (shipping.email, pre-filled from auth user)
      │   └── input: Phone  ★ REQUIRED ★   (shipping.phone — Lulu mandatory)
      ├── Section: Order summary
      │   ├── Line: {qty} × {format} @ ${unit}  = ${subtotal}
      │   ├── Line: Shipping                     = $4.99
      │   ├── Line: Tax                          = $0.00
      │   └── Line: Total                        = ${total}
      └── Footer
          ├── "Continue to payment" SparkleButton
          │   disabled until: both checkboxes ticked + all required shipping fields valid
          └── On click → opens ParentalGate modal
                          onPass → submitOrder()
```

### 6.2 PrintableBook embed

`PrintableBook` is currently implemented for `window.print()` only (CSS class `hidden`). For the order screen, render it visibly inside a scrollable container — no CSS changes to `PrintableBook` itself; instead wrap it in a div that overrides `hidden` with an explicit `block` or `flex` wrapper. This is non-invasive.

The preview is purely read-only; tapping a page has no effect.

### 6.3 Form validation

All validation is client-side only (no server round-trip until submit):

- Both checkboxes must be checked.
- Required text fields: non-empty after trim.
- `shipping.state`: 2-letter uppercase US state code (simple `/^[A-Z]{2}$/` check).
- `shipping.postal_code`: 5-digit or ZIP+4 (`/^\d{5}(-\d{4})?$/`).
- `shipping.phone`: at least 10 digits (strip non-digits, check length ≥ 10).
- `shipping.email`: basic `type="email"` browser validation.

Invalid fields show an inline error message below the input (red text, `text-red-400`). The "Continue to payment" button stays disabled until all checks pass.

### 6.4 Order submission flow

```
1. User taps "Continue to payment" → opens ParentalGate
2. Parent solves multiplication problem → onPass fires
3. submitOrder():
   a. Set submitting=true in store
   b. POST /api/print-orders/create with { bookId, format, quantity, shipping }
   c. Store returns { orderId, clientSecret, totalCents }
   d. Store setOrderResult({ orderId, clientSecret, totalCents })
   e. Call printPaymentService.pay(clientSecret)
      → iOS: StripePlugin.createPaymentSheet + presentPaymentSheet
      → Web: stripe.confirmPayment with return_url = /orders/${orderId}/confirm?new=1
4. On payment success:
   → navigate('/orders/${orderId}/confirm?new=1')
5. On payment failure:
   → show inline error, reset submitting=false
   → orderId is already created (status='pending'); backend handles timeout/expiry
```

**Error display:** A dismissible banner below the footer (`bg-red-900/30 border border-red-500/40 text-red-300`) for API errors. Field-level validation errors appear inline. Payment errors from Stripe are shown in the payment sheet itself (handled by the native SDK / Stripe.js).

---

## 7. OrderConfirmPage (`/orders/:id/confirm`)

Shown immediately after a successful payment before Stripe's webhook has updated the order status.

```
OrderConfirmPage
  ├── motion.div (spring in from scale 0.9)
  ├── Animated checkmark (same pattern as SuccessPage)
  ├── Heading: "Order placed! 🎉"
  ├── Order ID: "Order #{orderId.slice(-8).toUpperCase()}"
  ├── Delivery estimate: "Usually arrives in 10–14 business days"  (static copy)
  ├── Note: "We'll send you an email when your book ships."
  ├── SparkleButton "Back to my shelf"  → navigate('/bookshelf')
  └── TextLink "View order status"      → navigate('/orders/:id')
```

When `?new=1` query param is present, fires a confetti burst (reuse `celebrate.js`).

Does NOT poll or wait for webhook — the confirmation message is intentionally decoupled from status to keep the UX fast. The user can check `/orders/:id` for live status.

---

## 8. OrdersListPage (`/orders`)

```
OrdersListPage
  ├── Header: "My Print Orders"  (BookMarked icon from lucide-react)
  ├── Loading spinner (while fetching)
  ├── EmptyState (no orders yet) with CTA to /bookshelf
  └── list of OrderListCard per order (sorted: newest first)

OrderListCard
  ├── Book title (from order.book_id — look up in bookshelf store by id, fallback to "Book")
  ├── Format + quantity badge  ("1 × Hardcover")
  ├── StatusPill (colored by status — see Section 9)
  ├── Ordered date  ("May 2, 2026")
  ├── Total  ("$44.98")
  └── → navigate('/orders/:id') on click
```

**Data source:** Direct Supabase query (Supabase JS client, matching the pattern in `useSubscription.js`):

```js
supabase
  .from('print_orders')
  .select('id, book_id, format, quantity, total_cents, status, created_at')
  .order('created_at', { ascending: false })
```

RLS enforces user isolation. No API proxy needed for the list.

---

## 9. OrderDetailPage (`/orders/:id`)

```
OrderDetailPage
  ├── Header with back arrow
  ├── Book title + format + quantity summary
  ├── StatusTimeline
  │   └── Steps: Ordered → Paid → In production → Shipped → Delivered
  │       Active step highlighted; future steps grayed out.
  │       If status is 'failed' or 'refunded', show red error step at the end.
  ├── [if shipped] TrackingSection
  │   ├── Carrier + tracking number
  │   └── ExternalLink "Track your package →"  (lulu_tracking_url)
  ├── OrderSummaryTable (format, qty, unit price, shipping, total)
  ├── ShippingAddressSummary (name, city, state, postal_code — from API response)
  ├── [if failed or in_production] ReportProblemButton
  │   └── Opens mailto: or navigates to /support
  └── Auto-refresh: useEffect polling every 30s while status is non-terminal
      (pending, paid, pdf_ready, submitted, in_production)
      stops polling once status reaches shipped, delivered, failed, or refunded
```

**Data source:** `GET /api/print-orders/get/${id}` via `apiFetchAuthed`.

**Status → label + color mapping:**

| status | label | color |
|--------|-------|-------|
| pending | Order received | `text-galaxy-text-muted` |
| paid | Payment confirmed | `text-galaxy-secondary` |
| pdf_ready | Preparing files | `text-galaxy-secondary` |
| submitted | Sent to printer | `text-galaxy-primary` |
| in_production | Being printed | `text-galaxy-primary` |
| shipped | Shipped! | `text-green-400` |
| delivered | Delivered | `text-green-400` |
| failed | Problem with order | `text-red-400` |
| refunded | Refunded | `text-yellow-400` |

**Polling interval:** 30 seconds while status is non-terminal. Use `useRef` for the interval ID, clear in the `useEffect` cleanup. Avoid polling once the component unmounts.

---

## 10. Email Templates

Email sending is triggered by backend events (Stripe webhook for payment, Lulu webhook for production/shipping). The frontend spec defines only the **content and structure** of each email; the actual sending mechanism is an open question (see Section 12).

All emails share:
- From: "My Book Lab <no-reply@mybooklab.com>" (domain TBD)
- Reply-to: support email
- Footer: unsubscribe link + "My Book Lab, [address]" (required by CAN-SPAM)

### Email 1: Order Placed
- **Trigger:** Stripe `payment_intent.succeeded` webhook (backend)
- **Subject:** "Your book order is confirmed! 📚"
- **Content:** Order summary table (format, qty, total), shipping address, estimated delivery ("10–14 business days"), link to `/orders/:id`.

### Email 2: In Production
- **Trigger:** Lulu webhook → status advances to `in_production`
- **Subject:** "Your book is being printed! 🖨️"
- **Content:** Short message that printing has started, expected ship date, link to `/orders/:id`.

### Email 3: Shipped
- **Trigger:** Lulu webhook → status advances to `shipped`
- **Subject:** "Your book is on its way! 📬"
- **Content:** Tracking number + carrier, tracking URL, link to `/orders/:id`.

### Email 4: Delivered (optional v1 skip)
- **Trigger:** Lulu webhook → status = `delivered` (Lulu may not send this)
- **Subject:** "Your book has arrived! 🎉"
- **Content:** Celebratory message, prompt to share a photo.

### Email 5: Refunded
- **Trigger:** Stripe `charge.refunded` webhook (backend)
- **Subject:** "Your refund has been processed"
- **Content:** Refund amount, last-4 of card (from Stripe), timeline (3–5 business days).

---

## 11. iOS Native Bridge Requirements

### 11.1 New Capacitor plugin: `@capacitor-community/stripe`

The existing `Podfile` adds plugins via `pod` declarations. Add:

```ruby
# in Podfile, inside the capacitor_pods block:
pod 'CapacitorCommunityStripe', :path => '../../node_modules/@capacitor-community/stripe'
```

Add to `package.json` dependencies:
```
"@capacitor-community/stripe": "^7.x"   (version TBD — see Open Questions)
```

After `npm install` and `cap sync`, the plugin registers itself with Capacitor automatically.

### 11.2 `capacitor.config.json` additions

```json
"StripePlugin": {
  "publishableKey": "pk_live_...",
  "enableGooglePay": false,
  "enableApplePay": false
}
```

`enableApplePay` is `false` for v1 to avoid the Apple Pay merchant ID provisioning requirement. Can be enabled in v1.1.

`publishableKey` should be sourced from `VITE_STRIPE_PUBLISHABLE_KEY` at build time, not hardcoded in the config. The plugin docs indicate the key can also be passed programmatically via `Stripe.initialize()` — prefer that approach to keep secrets out of `capacitor.config.json`.

### 11.3 `AppDelegate.swift` changes

No changes required for Payment Sheet. The plugin handles URL scheme callbacks internally. If Apple Pay is enabled later, the merchant session callback needs to be added here — defer to v1.1.

### 11.4 `Info.plist` changes

No new entries required for Payment Sheet v1. If Apple Pay is enabled later, add `NSApplePayMerchantIdentifier`.

### 11.5 Stripe initialization in `src/capacitor.js`

Add to `initCapacitor()`, after RevenueCat init:

```js
if (platform === 'ios') {
  const { Stripe } = await import('@capacitor-community/stripe')
  await Stripe.initialize({ publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY })
}
```

Dynamic import so the plugin module is only loaded on native iOS.

### 11.6 Stripe.js initialization on web

In `src/main.jsx` (or lazily in the order page), load `@stripe/stripe-js`:

```js
import { loadStripe } from '@stripe/stripe-js'
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
```

The `<Elements stripe={stripePromise}>` provider wraps `PrintOrderPage` and the payment step only.

### 11.7 New environment variable

`VITE_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key (safe to expose to frontend). Must be added to Vercel environment variables and to `.env.example`.

---

## 12. Open Questions

These must be resolved by a human before implementation begins.

**OQ-1: Exact `@capacitor-community/stripe` version and Capacitor 7 compatibility.**  
The plugin's published npm history needs to be checked for Capacitor 7 (`@capacitor/core ^7.x`) support. If the community plugin lags, the alternative is a custom Capacitor plugin wrapping `StripePaymentSheet` directly (2–3 Swift files), or using a Stripe-hosted checkout URL opened via `Browser` plugin. Recommend checking the plugin's GitHub issues before committing.

**OQ-2: Email provider.**  
No email provider is currently configured. Candidates: Resend (simple REST API, good DX), Postmark (strong deliverability), SendGrid (already common with Stripe). The transactional email trigger code lives in the backend (Stripe + Lulu webhooks) — this is nominally a backend concern, but the template HTML must be written and the provider SDK added. Plan B implementation should clarify whether this is in-scope for this sprint or deferred.

**OQ-3: `PrintableBook` in preview mode vs. print mode.**  
`PrintableBook` currently has `className="printable-book hidden"` — it's invisible on screen by design. The order screen needs to show it as a scrollable read-only book preview. The safest approach is to add a `visible` prop that swaps `hidden` for `block`. This is a 2-line change to `PrintableBook`, but it's technically a component change that was not in the original Plan A spec. Confirm this is acceptable before implementing.

**OQ-4: Delivery estimate display.**  
The backend stores no estimated delivery date. The order confirm and detail pages currently show a static "10–14 business days" estimate. Lulu's production + shipping SLA should be verified against their current docs and the static copy updated accordingly.

**OQ-5: List endpoint vs direct Supabase query for `/orders`.**  
The spec proposes a direct Supabase JS client query for the order list, relying on RLS. This is consistent with existing patterns but bypasses the API layer's field allowlist. If the team prefers a consistent "all order reads go through the API," a `GET /api/print-orders/list` endpoint needs to be added (a minor backend task). Flag for the next Plan A.5 patch if desired.

**OQ-6: `get.js` route convention.**  
The backend `get.js` uses `pathname.split('/').pop()` to extract the order ID, implying calls to `/api/print-orders/get/{uuid}`. Vercel's edge function routing should pass through the trailing path segment, but this is worth verifying with a real deploy before the frontend builds against it. If it doesn't work, the alternative is a `?id=` query parameter.

**OQ-7: Stale assumption — `create.js` comment says "Plan B will switch to Lulu's shipping calculator + Stripe Tax."**  
The `create.js` file contains: `// Flat US shipping placeholder; Plan B will switch to Lulu's shipping calculator + Stripe Tax.` If this shipping recalculation was intended for Plan B, it is currently absent from this frontend spec (which treats `$4.99` flat shipping as given). Clarify whether dynamic shipping/tax calculation belongs to Plan B or a future plan.

**OQ-8: `ship_phone` column constraint.**  
The `supabase-migrations/005_print_orders.sql` declares `ship_phone text` as nullable, but `create.js` enforces it as required at the API level. The frontend spec treats phone as required. No issue for v1, but worth noting that a DB-level `NOT NULL` constraint could be applied if desired (requires a migration).

**OQ-9: Original design doc location.**  
The task brief references `docs/superpowers/specs/2026-04-26-physical-book-printing-design.md` and `docs/superpowers/plans/2026-04-26-physical-book-printing-plan-a-backend.md`, but neither file exists in the repository at the time of this spec's authoring. This spec was written from direct source code inspection. If those documents exist in a different location (e.g., Notion, a private wiki), they should be compared for any contradictions.

---

## 13. Component / File Inventory

New files to create during implementation:

| File | Description |
|------|-------------|
| `src/stores/usePrintOrderStore.js` | Zustand store for in-progress order form state |
| `src/services/printPaymentService.js` | Thin abstraction: iOS native Stripe vs web Stripe.js |
| `src/pages/PrintOrderPage.jsx` | `/order/:bookId` — full order form |
| `src/pages/OrderConfirmPage.jsx` | `/orders/:id/confirm` — post-payment celebration |
| `src/pages/OrdersListPage.jsx` | `/orders` — order history list |
| `src/pages/OrderDetailPage.jsx` | `/orders/:id` — status timeline + tracking |
| `src/components/print/BookFinishedModal.jsx` | Post-finish CTA overlay |
| `src/components/print/FormatCard.jsx` | Hardcover / Softcover selector card |
| `src/components/print/QuantityStepper.jsx` | 1–10 stepper with − / + buttons |
| `src/components/print/OrderStatusPill.jsx` | Colored status badge (shared by list + detail) |
| `src/components/print/StatusTimeline.jsx` | Horizontal/vertical step indicator for detail page |
| `src/components/print/OrderSummaryTable.jsx` | Itemized price breakdown (shared by form + detail) |

Files to modify:

| File | Change |
|------|--------|
| `src/App.jsx` | Add 4 new routes (Section 4) |
| `src/components/bookshelf/BookSpine.jsx` | Add Printer icon + `onOrderPrint` prop |
| `src/components/bookshelf/Bookshelf.jsx` | Pass `onOrderPrint` handler to `BookSpine` |
| `src/components/editor/StoryEditor.jsx` | Mount `BookFinishedModal` on book completion |
| `src/components/print/PrintableBook.jsx` | Add `visible` prop to allow on-screen render (OQ-3) |
| `src/capacitor.js` | Initialize `@capacitor-community/stripe` on iOS (Section 11.5) |
| `capacitor.config.json` | Add `StripePlugin` block (Section 11.2) |
| `ios/App/Podfile` | Add `CapacitorCommunityStripe` pod (Section 11.1) |
| `package.json` | Add `@capacitor-community/stripe` and `@stripe/stripe-js` + `@stripe/react-stripe-js` |
| `.env.example` | Add `VITE_STRIPE_PUBLISHABLE_KEY` |

---

## 14. Out of Scope (explicit YAGNI list)

- Apple Pay / Google Pay native payment methods
- Saved/autofill shipping addresses
- Order cancellation or modification after placement
- Gift wrapping or custom messages
- Multi-copy bulk discount pricing
- PDF download option for the customer
- Book preview on the confirmation page
- Push notification when order ships (could reuse existing `src/services/notifications.js` — deferred to v1.1)
- Dark/light mode toggle for the order form (inherits app theme)
- Accessibility audit of new components (deferred to v1.1)
- Rate limiting on the order form (backend already rate-limits the API)
- Vitest/Jest component test setup for React

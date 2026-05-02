# Physical Book Printing — Plan B: Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the user-facing order flow on top of the verified Plan A + A.5 backend: post-finish CTA, bookshelf print icon, single-page order screen with embedded book preview, native iOS Stripe Payment Sheet (web Payment Element), and `/orders` history with status timeline + tracking.

**Architecture:** React/Vite SPA wrapped by Capacitor for iOS. Stripe Payment Sheet via `@capacitor-community/stripe` on iOS, `@stripe/stripe-js` + Elements on web. State via existing Zustand patterns. Direct Supabase reads for the orders list (RLS already enforces ownership), API endpoint for individual order detail. No new backend endpoints.

**Tech Stack:** React 19, Vite, Capacitor 7, Tailwind, motion/react, zustand, react-router-dom, lucide-react, `@stripe/stripe-js`, `@stripe/react-stripe-js`, `@capacitor-community/stripe`. Vitest already configured for backend modules.

**Spec reference:** [docs/superpowers/specs/2026-05-02-physical-book-printing-plan-b-frontend-design.md](../specs/2026-05-02-physical-book-printing-plan-b-frontend-design.md)

**Testing strategy:** Per the spec's explicit non-goal, we are NOT adding a React component test framework. Pure-logic modules (`lib/printPricing.js`, store actions) get Vitest unit tests using the existing setup. UI is manually smoke-tested against a Vercel preview deployment in the final task.

---

## File structure

```
src/
  lib/
    printPricing.js                  # NEW — display prices, total computation
  stores/
    usePrintOrderStore.js            # NEW — Zustand: in-progress form state
  services/
    printPaymentService.js           # NEW — iOS native vs web Stripe fork
  hooks/
    useOrderPolling.js               # NEW — fetch + 30s poll while non-terminal
  components/
    print/
      BookFinishedModal.jsx          # NEW — post-finish CTA
      FormatCard.jsx                 # NEW — Hardcover / Softcover selector
      QuantityStepper.jsx            # NEW — 1–10 stepper
      OrderStatusPill.jsx            # NEW — colored status badge
      StatusTimeline.jsx             # NEW — vertical step indicator
      OrderSummaryTable.jsx          # NEW — itemized totals
      PrintableBook.jsx              # MODIFIED — add `visible` prop
    bookshelf/
      BookSpine.jsx                  # MODIFIED — Printer icon + onOrderPrint
      Bookshelf.jsx                  # MODIFIED — pass onOrderPrint
    editor/
      StoryEditor.jsx                # MODIFIED — mount BookFinishedModal
  pages/
    PrintOrderPage.jsx               # NEW — /order/:bookId
    OrderConfirmPage.jsx             # NEW — /orders/:id/confirm
    OrdersListPage.jsx               # NEW — /orders
    OrderDetailPage.jsx              # NEW — /orders/:id
  App.jsx                            # MODIFIED — add 4 routes
  capacitor.js                       # MODIFIED — initialize Stripe on iOS
capacitor.config.json                # MODIFIED — Stripe plugin config (key set programmatically)
package.json                         # MODIFIED — add 3 deps
.env.example                         # MODIFIED — add VITE_STRIPE_PUBLISHABLE_KEY
tests/
  print/
    pricing-client.test.js           # NEW — unit tests for client pricing
    printOrderStore.test.js          # NEW — unit tests for store actions
```

---

## Task 0: Install Stripe + Capacitor plugin dependencies

**Files:**
- Modify: `package.json` (add 3 deps)
- Modify: `.env.example` (add publishable key entry)

- [ ] **Step 1: Install runtime + native deps**

```bash
npm install --save @stripe/stripe-js @stripe/react-stripe-js @capacitor-community/stripe
```

- [ ] **Step 2: Verify versions land in package.json**

```bash
node -e "const p=require('./package.json');console.log(p.dependencies['@stripe/stripe-js'],p.dependencies['@stripe/react-stripe-js'],p.dependencies['@capacitor-community/stripe'])"
```

Expected: three semver strings printed.

- [ ] **Step 3: Add `VITE_STRIPE_PUBLISHABLE_KEY` to `.env.example`**

If `.env.example` exists, append:

```
# Stripe publishable key (test pk_test_... in dev/preview, live pk_live_... in production)
# This value is safe to expose to the frontend bundle.
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_change_me
```

If `.env.example` does NOT exist, create it with the same content.

- [ ] **Step 4: Run cap sync to update iOS Pods**

```bash
npx cap sync ios
```

Expected: success message naming `CapacitorCommunityStripe` among the synced plugins.

- [ ] **Step 5: Verify build still passes**

```bash
npm run build
```

Expected: `✓ built in <N>s`. No errors. New deps may show in the bundle output.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example ios/App/Podfile.lock ios/App/Podfile
git commit -m "feat: install Stripe SDKs (web + Capacitor plugin) for Plan B"
```

(Only stage `Podfile`/`Podfile.lock` if they actually changed — `cap sync` may modify them. If `git status` shows other iOS native files changed, include them in the same commit.)

---

## Task 1: Initialize Stripe on iOS + web

**Files:**
- Modify: `src/capacitor.js` (initialize @capacitor-community/stripe)
- Create: `src/lib/stripe.js` (web Stripe.js singleton)

- [ ] **Step 1: Create `src/lib/stripe.js` with a lazy singleton**

```js
// Lazy Stripe.js singleton for the web payment path. The bundle is heavy
// (~150 KB), so we defer loading until the order screen calls getStripe().
import { loadStripe } from '@stripe/stripe-js'

let _stripePromise = null

export function getStripe() {
  if (!_stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.warn('[stripe] VITE_STRIPE_PUBLISHABLE_KEY not set')
      return Promise.resolve(null)
    }
    _stripePromise = loadStripe(key)
  }
  return _stripePromise
}
```

- [ ] **Step 2: Wire iOS initialization in `src/capacitor.js`**

Find `initCapacitor()` in `src/capacitor.js`. Add the Stripe init block after the existing RevenueCat init line (`supabase.auth.getSession().then(({ data }) => { initRevenueCat(data?.session?.user?.id) })`):

```js
  // Native Stripe Payment Sheet for print orders. Dynamic import so the
  // module is only evaluated on iOS — keeps the web bundle clean.
  if (platform === 'ios') {
    try {
      const { Stripe } = await import('@capacitor-community/stripe')
      const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
      if (key) {
        await Stripe.initialize({ publishableKey: key })
      } else {
        console.warn('[stripe-ios] VITE_STRIPE_PUBLISHABLE_KEY not set')
      }
    } catch (e) {
      console.warn('[stripe-ios] init failed', e?.message ?? e)
    }
  }
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: success. The dynamic import means web builds will not pull in the iOS plugin code.

- [ ] **Step 4: Commit**

```bash
git add src/lib/stripe.js src/capacitor.js
git commit -m "feat: initialize Stripe SDKs on iOS (Capacitor plugin) and web (lazy)"
```

---

## Task 2: Pricing module + tests

**Files:**
- Create: `src/lib/printPricing.js`
- Create: `tests/print/pricing-client.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/print/pricing-client.test.js
import { describe, it, expect } from 'vitest'
import { PRINT_PRICES, FLAT_SHIPPING_CENTS, totalCents, formatPriceCents } from '../../src/lib/printPricing.js'

describe('PRINT_PRICES', () => {
  it('hardcover is $39.99', () => {
    expect(PRINT_PRICES.hardcover.cents).toBe(3999)
    expect(PRINT_PRICES.hardcover.label).toBe('$39.99')
  })
  it('softcover is $19.99', () => {
    expect(PRINT_PRICES.softcover.cents).toBe(1999)
    expect(PRINT_PRICES.softcover.label).toBe('$19.99')
  })
})

describe('FLAT_SHIPPING_CENTS', () => {
  it('matches the backend flat shipping placeholder of $4.99', () => {
    expect(FLAT_SHIPPING_CENTS).toBe(499)
  })
})

describe('totalCents', () => {
  it('hardcover x 1 + shipping = 4498', () => {
    expect(totalCents({ format: 'hardcover', quantity: 1 })).toBe(4498)
  })
  it('softcover x 2 + shipping = 4497', () => {
    expect(totalCents({ format: 'softcover', quantity: 2 })).toBe(4497)
  })
  it('throws on unknown format', () => {
    expect(() => totalCents({ format: 'parchment', quantity: 1 })).toThrow(/format/i)
  })
  it('throws on quantity below 1', () => {
    expect(() => totalCents({ format: 'hardcover', quantity: 0 })).toThrow(/quantity/i)
  })
  it('throws on quantity above 10', () => {
    expect(() => totalCents({ format: 'hardcover', quantity: 11 })).toThrow(/quantity/i)
  })
})

describe('formatPriceCents', () => {
  it('formats whole-dollar amounts without trailing zeros after decimal point', () => {
    expect(formatPriceCents(0)).toBe('$0.00')
    expect(formatPriceCents(499)).toBe('$4.99')
    expect(formatPriceCents(4498)).toBe('$44.98')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/print/pricing-client.test.js
```

Expected: failures (`Cannot find module '../../src/lib/printPricing.js'`).

- [ ] **Step 3: Add `src/` to vitest coverage so tests find it**

Open `vitest.config.js`. Confirm the `include` glob covers `tests/**/*.test.js` (it does by default). The test imports from `../../src/...`, which is just a relative file import — no config change needed.

- [ ] **Step 4: Implement the module**

```js
// src/lib/printPricing.js
// Mirrors the server prices in lib/print/pricing.js. Used for client-side
// total display. Backend is the source of truth at order-create time —
// the totalCents we show is purely informational until /api/print-orders/create
// returns an authoritative number in clientSecret's PaymentIntent.

export const PRINT_PRICES = {
  hardcover: { cents: 3999, label: '$39.99', deliveryDays: '7–14' },
  softcover: { cents: 1999, label: '$19.99', deliveryDays: '5–10' },
}

// Flat US shipping placeholder. Matches FLAT_SHIPPING_CENTS in
// api/print-orders/create.js.
export const FLAT_SHIPPING_CENTS = 499

export function totalCents({ format, quantity }) {
  const price = PRINT_PRICES[format]
  if (!price) throw new Error(`Unknown print format: ${format}`)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new Error(`Invalid quantity: ${quantity} (must be 1–10)`)
  }
  return price.cents * quantity + FLAT_SHIPPING_CENTS
}

export function formatPriceCents(cents) {
  return `$${(cents / 100).toFixed(2)}`
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- tests/print/pricing-client.test.js
```

Expected: 9 passing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/printPricing.js tests/print/pricing-client.test.js
git commit -m "feat: client-side print pricing module + unit tests"
```

---

## Task 3: usePrintOrderStore (Zustand) + tests

**Files:**
- Create: `src/stores/usePrintOrderStore.js`
- Create: `tests/print/printOrderStore.test.js`

**Why:** The order screen has multiple sections (format, quantity, shipping, checkboxes). Storing the form state in Zustand instead of local React state lets the user navigate away and back without losing input. `persist` middleware writes to localStorage so a parent can come back hours later. Ephemeral fields (orderId, clientSecret, submitting, error) are excluded from persist via `partialize`.

- [ ] **Step 1: Write the failing test**

```js
// tests/print/printOrderStore.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { usePrintOrderStore } from '../../src/stores/usePrintOrderStore.js'

beforeEach(() => {
  usePrintOrderStore.getState().reset()
})

describe('usePrintOrderStore', () => {
  it('starts with sensible defaults', () => {
    const s = usePrintOrderStore.getState()
    expect(s.format).toBe('hardcover')
    expect(s.quantity).toBe(1)
    expect(s.reviewChecked).toBe(false)
    expect(s.finishedChecked).toBe(false)
    expect(s.shipping.country).toBe('US')
    expect(s.orderId).toBe(null)
    expect(s.clientSecret).toBe(null)
    expect(s.submitting).toBe(false)
  })

  it('setFormat changes format', () => {
    usePrintOrderStore.getState().setFormat('softcover')
    expect(usePrintOrderStore.getState().format).toBe('softcover')
  })

  it('setQuantity clamps to 1..10', () => {
    const { setQuantity } = usePrintOrderStore.getState()
    setQuantity(0); expect(usePrintOrderStore.getState().quantity).toBe(1)
    setQuantity(15); expect(usePrintOrderStore.getState().quantity).toBe(10)
    setQuantity(5); expect(usePrintOrderStore.getState().quantity).toBe(5)
  })

  it('setShipping merges fields without dropping others', () => {
    usePrintOrderStore.getState().setShipping({ name: 'A' })
    usePrintOrderStore.getState().setShipping({ city: 'B' })
    const s = usePrintOrderStore.getState().shipping
    expect(s.name).toBe('A')
    expect(s.city).toBe('B')
  })

  it('setChecks updates check fields independently', () => {
    usePrintOrderStore.getState().setChecks({ reviewChecked: true })
    expect(usePrintOrderStore.getState().reviewChecked).toBe(true)
    expect(usePrintOrderStore.getState().finishedChecked).toBe(false)
  })

  it('isFormValid returns false when checks unticked', () => {
    const valid = {
      shipping: { name: 'X', address_line1: '1 St', city: 'C', state: 'TX', postal_code: '78701', email: 'a@b.com', phone: '5125551212', country: 'US' },
    }
    usePrintOrderStore.getState().setShipping(valid.shipping)
    expect(usePrintOrderStore.getState().isFormValid()).toBe(false)
    usePrintOrderStore.getState().setChecks({ reviewChecked: true })
    expect(usePrintOrderStore.getState().isFormValid()).toBe(false)
    usePrintOrderStore.getState().setChecks({ finishedChecked: true })
    expect(usePrintOrderStore.getState().isFormValid()).toBe(true)
  })

  it('isFormValid returns false on bad state code', () => {
    usePrintOrderStore.getState().setShipping({
      name: 'X', address_line1: '1 St', city: 'C', state: 'texas', postal_code: '78701', email: 'a@b.com', phone: '5125551212', country: 'US',
    })
    usePrintOrderStore.getState().setChecks({ reviewChecked: true, finishedChecked: true })
    expect(usePrintOrderStore.getState().isFormValid()).toBe(false)
  })

  it('isFormValid returns false on bad zip', () => {
    usePrintOrderStore.getState().setShipping({
      name: 'X', address_line1: '1 St', city: 'C', state: 'TX', postal_code: 'abcd', email: 'a@b.com', phone: '5125551212', country: 'US',
    })
    usePrintOrderStore.getState().setChecks({ reviewChecked: true, finishedChecked: true })
    expect(usePrintOrderStore.getState().isFormValid()).toBe(false)
  })

  it('isFormValid returns false on phone shorter than 10 digits', () => {
    usePrintOrderStore.getState().setShipping({
      name: 'X', address_line1: '1 St', city: 'C', state: 'TX', postal_code: '78701', email: 'a@b.com', phone: '555', country: 'US',
    })
    usePrintOrderStore.getState().setChecks({ reviewChecked: true, finishedChecked: true })
    expect(usePrintOrderStore.getState().isFormValid()).toBe(false)
  })

  it('setOrderResult populates ephemeral fields', () => {
    usePrintOrderStore.getState().setOrderResult({ orderId: 'o', clientSecret: 'c', totalCents: 4498 })
    const s = usePrintOrderStore.getState()
    expect(s.orderId).toBe('o')
    expect(s.clientSecret).toBe('c')
    expect(s.totalCents).toBe(4498)
  })

  it('reset clears everything', () => {
    usePrintOrderStore.getState().setFormat('softcover')
    usePrintOrderStore.getState().setOrderResult({ orderId: 'o', clientSecret: 'c', totalCents: 4498 })
    usePrintOrderStore.getState().reset()
    const s = usePrintOrderStore.getState()
    expect(s.format).toBe('hardcover')
    expect(s.orderId).toBe(null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/print/printOrderStore.test.js
```

Expected: fail (`Cannot find module ../../src/stores/usePrintOrderStore.js`).

- [ ] **Step 3: Implement the store**

```js
// src/stores/usePrintOrderStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const EMPTY_SHIPPING = {
  name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  email: '',
  phone: '',
  country: 'US',
}

const INITIAL = {
  bookId: null,
  format: 'hardcover',
  quantity: 1,
  shipping: EMPTY_SHIPPING,
  reviewChecked: false,
  finishedChecked: false,
  // Ephemeral — cleared on reset, excluded from persist:
  orderId: null,
  clientSecret: null,
  totalCents: null,
  submitting: false,
  error: null,
}

const STATE_RE = /^[A-Z]{2}$/
const ZIP_RE = /^\d{5}(-\d{4})?$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const usePrintOrderStore = create(
  persist(
    (set, get) => ({
      ...INITIAL,

      setBookId: (bookId) => set({ bookId }),

      setFormat: (format) => set({ format }),

      setQuantity: (quantity) =>
        set({ quantity: Math.max(1, Math.min(10, Number(quantity) || 1)) }),

      setShipping: (patch) =>
        set((s) => ({ shipping: { ...s.shipping, ...patch } })),

      setChecks: (patch) => set(patch),

      setOrderResult: ({ orderId, clientSecret, totalCents }) =>
        set({ orderId, clientSecret, totalCents }),

      setSubmitting: (submitting) => set({ submitting }),

      setError: (error) => set({ error }),

      isFormValid: () => {
        const s = get()
        if (!s.reviewChecked || !s.finishedChecked) return false
        const sh = s.shipping
        if (!sh.name?.trim()) return false
        if (!sh.address_line1?.trim()) return false
        if (!sh.city?.trim()) return false
        if (!STATE_RE.test(sh.state || '')) return false
        if (!ZIP_RE.test(sh.postal_code || '')) return false
        if (!EMAIL_RE.test(sh.email || '')) return false
        const phoneDigits = (sh.phone || '').replace(/\D/g, '')
        if (phoneDigits.length < 10) return false
        return true
      },

      reset: () => set({ ...INITIAL, shipping: { ...EMPTY_SHIPPING } }),
    }),
    {
      name: 'mybooklab-print-order',
      // Persist only the form fields a parent might want to keep across visits.
      partialize: (s) => ({
        format: s.format,
        quantity: s.quantity,
        shipping: s.shipping,
        reviewChecked: s.reviewChecked,
        finishedChecked: s.finishedChecked,
        bookId: s.bookId,
      }),
    }
  )
)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/print/printOrderStore.test.js
```

Expected: 11 passing.

- [ ] **Step 5: Commit**

```bash
git add src/stores/usePrintOrderStore.js tests/print/printOrderStore.test.js
git commit -m "feat: usePrintOrderStore Zustand store with persist + isFormValid"
```

---

## Task 4: printPaymentService (iOS native vs web fork)

**Files:**
- Create: `src/services/printPaymentService.js`

**Why:** A thin abstraction so `PrintOrderPage` doesn't fork on platform internally. iOS uses Capacitor plugin (presents native sheet); web uses Stripe.js Elements (we'll mount Elements when needed). For v1 web we use `confirmPayment` against a `clientSecret` with `automatic_payment_methods` and a `return_url`.

> No tests for this module — it depends on real Stripe SDKs and DOM. Manually verified during the smoke test in Task 14.

- [ ] **Step 1: Implement the service**

```js
// src/services/printPaymentService.js
// Single entry point pay({ clientSecret, returnUrl }) that routes to the
// correct Stripe SDK by platform. Returns:
//   { ok: true, paymentIntentId } on success
//   { ok: false, error: string }  on failure
//   { ok: false, canceled: true }  if the user dismissed the sheet
import { Capacitor } from '@capacitor/core'
import { getStripe } from '../lib/stripe.js'

const isNativeIos =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

export async function pay({ clientSecret, returnUrl }) {
  if (!clientSecret) return { ok: false, error: 'Missing clientSecret' }

  if (isNativeIos) return payNativeIos(clientSecret)
  return payWeb(clientSecret, returnUrl)
}

async function payNativeIos(clientSecret) {
  try {
    const { Stripe } = await import('@capacitor-community/stripe')
    await Stripe.createPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      merchantDisplayName: 'My Book Lab',
      // Card-only for v1 — Apple Pay needs a merchant ID, deferred.
      style: 'alwaysLight',
    })
    const result = await Stripe.presentPaymentSheet()
    if (result?.paymentResult === 'paymentSheetCompleted') {
      return { ok: true, paymentIntentId: extractPiId(clientSecret) }
    }
    if (result?.paymentResult === 'paymentSheetCanceled') {
      return { ok: false, canceled: true }
    }
    return { ok: false, error: 'Payment failed' }
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) }
  }
}

async function payWeb(clientSecret, returnUrl) {
  try {
    const stripe = await getStripe()
    if (!stripe) return { ok: false, error: 'Stripe not configured' }
    // confirmPayment will redirect the browser to returnUrl on success;
    // execution doesn't continue past it. If it returns, an error occurred.
    const { error } = await stripe.confirmPayment({
      clientSecret,
      confirmParams: { return_url: returnUrl },
    })
    if (error) return { ok: false, error: error.message ?? 'Payment failed' }
    return { ok: true, paymentIntentId: extractPiId(clientSecret) }
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) }
  }
}

function extractPiId(clientSecret) {
  // pi_3TS..._secret_xyz → pi_3TS...
  return String(clientSecret).split('_secret_')[0]
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/services/printPaymentService.js
git commit -m "feat: printPaymentService — iOS Capacitor Stripe vs web Stripe.js"
```

---

## Task 5: PrintableBook visible prop

**Files:**
- Modify: `src/components/print/PrintableBook.jsx`

**Why:** The component is currently `className="printable-book hidden"` (only renders for `window.print()`). For the order screen we need an on-screen preview without changing the print behavior. A `visible` prop swaps `hidden` for `block`; default `false` preserves all existing call sites.

- [ ] **Step 1: Read the current component**

```bash
head -8 src/components/print/PrintableBook.jsx
```

Locate the line that begins with `<div className="printable-book hidden"` and the function signature.

- [ ] **Step 2: Add the prop and conditional class**

In `src/components/print/PrintableBook.jsx`:

Change the function signature from
```jsx
export default function PrintableBook({ book, printMode = 'browser' }) {
```
to
```jsx
export default function PrintableBook({ book, printMode = 'browser', visible = false }) {
```

Change the outer wrapper from
```jsx
<div className="printable-book hidden" data-print-mode={printMode}>
```
to
```jsx
<div className={`printable-book ${visible ? 'block' : 'hidden'}`} data-print-mode={printMode}>
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Manual sanity check**

```bash
grep -n "PrintableBook" src/ -r --include="*.jsx" --include="*.js"
```

Expected: existing call sites do not pass `visible` and continue to render hidden (browser-print only). New call site comes in Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/components/print/PrintableBook.jsx
git commit -m "feat: PrintableBook accepts visible prop for on-screen preview"
```

---

## Task 6: FormatCard + QuantityStepper components

**Files:**
- Create: `src/components/print/FormatCard.jsx`
- Create: `src/components/print/QuantityStepper.jsx`

- [ ] **Step 1: Implement `FormatCard`**

```jsx
// src/components/print/FormatCard.jsx
import { motion } from 'motion/react'
import { Check } from 'lucide-react'

export default function FormatCard({ format, label, price, deliveryDays, selected, onSelect }) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(format)}
      whileTap={{ scale: 0.98 }}
      className={`relative w-full p-4 rounded-xl border text-left transition-colors ${
        selected
          ? 'bg-galaxy-primary/15 border-galaxy-primary text-galaxy-text'
          : 'bg-galaxy-bg-light border-galaxy-text-muted/20 text-galaxy-text-muted hover:border-galaxy-text-muted/40'
      }`}
    >
      {selected && (
        <span className="absolute top-3 right-3 flex items-center justify-center w-6 h-6 rounded-full bg-galaxy-primary text-white">
          <Check size={14} />
        </span>
      )}
      <p className="font-heading text-lg font-bold">{label}</p>
      <p className="font-body text-2xl font-bold mt-1">{price}</p>
      <p className="font-body text-xs opacity-70 mt-1">{deliveryDays} business days</p>
    </motion.button>
  )
}
```

- [ ] **Step 2: Implement `QuantityStepper`**

```jsx
// src/components/print/QuantityStepper.jsx
import { Minus, Plus } from 'lucide-react'

export default function QuantityStepper({ value, onChange, min = 1, max = 10 }) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))
  return (
    <div className="inline-flex items-center gap-3 bg-galaxy-bg-light border border-galaxy-text-muted/20 rounded-xl p-1">
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-galaxy-text disabled:opacity-30 hover:bg-galaxy-bg transition-colors"
      >
        <Minus size={16} />
      </button>
      <span className="w-6 text-center font-body font-bold text-galaxy-text tabular-nums">{value}</span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-galaxy-text disabled:opacity-30 hover:bg-galaxy-bg transition-colors"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/print/FormatCard.jsx src/components/print/QuantityStepper.jsx
git commit -m "feat: FormatCard + QuantityStepper components for order screen"
```

---

## Task 7: PrintOrderPage

**Files:**
- Create: `src/pages/PrintOrderPage.jsx`

**Why:** The full order screen. Reads book by id from `useBookshelfStore`, renders preview + form, validates, calls `/api/print-orders/create`, then `printPaymentService.pay`. Parental gate before submit.

- [ ] **Step 1: Inspect the bookshelf store interface**

```bash
grep -n "loadCloudBooks\|export\|books\|byId" src/stores/useBookshelfStore.js | head -20
```

Confirm the shape — we need a way to fetch a single book by `book_id`. If the store exposes `books` array, use `books.find(b => b.book_id === bookId)`. Otherwise, query Supabase directly via `apiFetchAuthed` to a per-book endpoint, or read directly via supabase client. **Default**: read from the existing `books` array; if not present, fall back to a fresh Supabase query inside the page.

- [ ] **Step 2: Implement the page**

```jsx
// src/pages/PrintOrderPage.jsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react'

import { useAuthStore } from '../stores/useAuthStore'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { usePrintOrderStore } from '../stores/usePrintOrderStore'
import { apiFetchAuthed } from '../lib/api'
import { PRINT_PRICES, FLAT_SHIPPING_CENTS, totalCents, formatPriceCents } from '../lib/printPricing'
import { pay } from '../services/printPaymentService'

import PrintableBook from '../components/print/PrintableBook'
import FormatCard from '../components/print/FormatCard'
import QuantityStepper from '../components/print/QuantityStepper'
import ParentalGate from '../components/ui/ParentalGate'

export default function PrintOrderPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()

  const user = useAuthStore((s) => s.user)
  const books = useBookshelfStore((s) => s.books) ?? []
  const book = books.find((b) => b.book_id === bookId) ?? null

  const store = usePrintOrderStore()
  const [showGate, setShowGate] = useState(false)
  const [error, setError] = useState(null)

  // Pre-fill bookId + email once on mount; never overwrite user-edited values.
  useEffect(() => {
    if (store.bookId !== bookId) {
      store.setBookId(bookId)
    }
    if (!store.shipping.email && user?.email) {
      store.setShipping({ email: user.email })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, user?.email])

  if (!user) {
    return <Centered><Link to="/login" className="underline">Please log in to continue.</Link></Centered>
  }
  if (!book) {
    return (
      <Centered>
        <p className="text-galaxy-text-muted">Book not found.</p>
        <Link to="/bookshelf" className="underline mt-2">Back to bookshelf</Link>
      </Centered>
    )
  }

  const valid = store.isFormValid()
  const subtotal = PRINT_PRICES[store.format].cents * store.quantity
  const total = totalCents({ format: store.format, quantity: store.quantity })

  const handleContinue = () => {
    if (!valid) return
    setShowGate(true)
  }

  const submitOrder = async () => {
    setShowGate(false)
    setError(null)
    store.setSubmitting(true)
    try {
      const res = await apiFetchAuthed('/api/print-orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          format: store.format,
          quantity: store.quantity,
          shipping: store.shipping,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)

      store.setOrderResult({
        orderId: body.orderId,
        clientSecret: body.clientSecret,
        totalCents: body.totalCents,
      })

      const returnUrl = `${window.location.origin}/orders/${body.orderId}/confirm?new=1`
      const result = await pay({ clientSecret: body.clientSecret, returnUrl })

      if (result.ok) {
        // Web flow has already redirected via Stripe; iOS returns here.
        navigate(`/orders/${body.orderId}/confirm?new=1`)
      } else if (result.canceled) {
        setError(null) // user explicitly canceled — no error banner
      } else {
        setError(result.error || 'Payment failed')
      }
    } catch (e) {
      setError(e?.message ?? String(e))
    } finally {
      store.setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-galaxy-bg text-galaxy-text font-body">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <header className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} aria-label="Back" className="p-2 -ml-2 hover:bg-galaxy-bg-light rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-heading text-2xl font-bold">Order a print</h1>
        </header>

        {/* Preview */}
        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">Preview</h2>
          <div className="rounded-xl border border-galaxy-text-muted/20 bg-white max-h-[60vh] overflow-y-auto">
            <PrintableBook book={book.book_data} visible />
          </div>
          <p className="text-xs text-galaxy-text-muted mt-2">Scroll through every page to confirm before printing.</p>
        </section>

        {/* Confirmation checkboxes */}
        <section className="mb-8 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={store.reviewChecked}
              onChange={(e) => store.setChecks({ reviewChecked: e.target.checked })}
              className="mt-1 w-5 h-5 rounded border-galaxy-text-muted/40"
            />
            <span className="text-sm">I've reviewed every page</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={store.finishedChecked}
              onChange={(e) => store.setChecks({ finishedChecked: e.target.checked })}
              className="mt-1 w-5 h-5 rounded border-galaxy-text-muted/40"
            />
            <span className="text-sm">This book is finished and ready to print</span>
          </label>
        </section>

        {/* Format */}
        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">Format</h2>
          <div className="grid grid-cols-2 gap-3">
            <FormatCard
              format="hardcover"
              label="Hardcover"
              price={PRINT_PRICES.hardcover.label}
              deliveryDays={PRINT_PRICES.hardcover.deliveryDays}
              selected={store.format === 'hardcover'}
              onSelect={store.setFormat}
            />
            <FormatCard
              format="softcover"
              label="Softcover"
              price={PRINT_PRICES.softcover.label}
              deliveryDays={PRINT_PRICES.softcover.deliveryDays}
              selected={store.format === 'softcover'}
              onSelect={store.setFormat}
            />
          </div>
        </section>

        {/* Quantity */}
        <section className="mb-8 flex items-center justify-between">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted">Quantity</h2>
          <QuantityStepper value={store.quantity} onChange={store.setQuantity} />
        </section>

        {/* Shipping */}
        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">Shipping</h2>
          <ShippingFields store={store} />
        </section>

        {/* Totals */}
        <section className="mb-8 p-4 rounded-xl bg-galaxy-bg-light border border-galaxy-text-muted/10">
          <Row label={`${store.quantity} × ${PRINT_PRICES[store.format].label} ${store.format}`} value={formatPriceCents(subtotal)} />
          <Row label="Shipping" value={formatPriceCents(FLAT_SHIPPING_CENTS)} />
          <Row label="Tax" value="$0.00" />
          <div className="h-px bg-galaxy-text-muted/20 my-2" />
          <Row label="Total" value={formatPriceCents(total)} bold />
        </section>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/40 text-red-300 text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <motion.button
          onClick={handleContinue}
          disabled={!valid || store.submitting}
          whileTap={!valid || store.submitting ? {} : { scale: 0.98 }}
          className={`w-full py-4 rounded-xl font-heading text-lg font-bold transition-colors ${
            valid && !store.submitting
              ? 'bg-galaxy-primary text-white hover:bg-purple-500'
              : 'bg-galaxy-bg-light text-galaxy-text-muted cursor-not-allowed'
          }`}
        >
          {store.submitting ? (
            <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" />Processing…</span>
          ) : (
            <>Continue to payment · {formatPriceCents(total)}</>
          )}
        </motion.button>
      </div>

      {showGate && (
        <ParentalGate
          onPass={submitOrder}
          onClose={() => setShowGate(false)}
        />
      )}
    </div>
  )
}

function Centered({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center">
      <div>{children}</div>
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between text-sm py-1 ${bold ? 'font-bold text-galaxy-text' : 'text-galaxy-text-muted'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

function ShippingFields({ store }) {
  const sh = store.shipping
  const set = (patch) => store.setShipping(patch)
  const input = 'w-full px-3 py-2.5 rounded-lg bg-galaxy-bg-light border border-galaxy-text-muted/20 text-galaxy-text placeholder:text-galaxy-text-muted/50 focus:outline-none focus:border-galaxy-primary'
  return (
    <div className="grid grid-cols-2 gap-3">
      <input className={`${input} col-span-2`} placeholder="Full name" value={sh.name} onChange={(e) => set({ name: e.target.value })} />
      <input className={`${input} col-span-2`} placeholder="Address" value={sh.address_line1} onChange={(e) => set({ address_line1: e.target.value })} />
      <input className={`${input} col-span-2`} placeholder="Apt, suite, etc. (optional)" value={sh.address_line2} onChange={(e) => set({ address_line2: e.target.value })} />
      <input className={input} placeholder="City" value={sh.city} onChange={(e) => set({ city: e.target.value })} />
      <input className={input} placeholder="State (e.g. TX)" maxLength={2} value={sh.state} onChange={(e) => set({ state: e.target.value.toUpperCase() })} />
      <input className={input} placeholder="ZIP" value={sh.postal_code} onChange={(e) => set({ postal_code: e.target.value })} />
      <input className={input} type="tel" placeholder="Phone" value={sh.phone} onChange={(e) => set({ phone: e.target.value })} />
      <input className={`${input} col-span-2`} type="email" placeholder="Email" value={sh.email} onChange={(e) => set({ email: e.target.value })} />
    </div>
  )
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PrintOrderPage.jsx
git commit -m "feat: PrintOrderPage with preview, form, parental gate, payment dispatch"
```

---

## Task 8: BookFinishedModal + StoryEditor wiring

**Files:**
- Create: `src/components/print/BookFinishedModal.jsx`
- Modify: `src/components/editor/StoryEditor.jsx`

**Why:** When a child marks a book "finished" in the editor, show a celebratory modal with "Order a print →" as the primary action. Keep the existing finish flow intact.

- [ ] **Step 1: Implement the modal**

```jsx
// src/components/print/BookFinishedModal.jsx
import { motion, AnimatePresence } from 'motion/react'
import { Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function BookFinishedModal({ book, open, onClose }) {
  const navigate = useNavigate()
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative w-full max-w-md bg-galaxy-bg-light rounded-2xl p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-lg text-galaxy-text-muted hover:bg-galaxy-bg">
              <X size={18} />
            </button>
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="font-heading text-2xl font-bold text-galaxy-text">Your book is done!</h2>
            <p className="text-galaxy-text-muted mt-2 text-sm">You can order a real printed copy and hold it in your hands.</p>
            <button
              onClick={() => navigate(`/order/${book.book_id}`)}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-galaxy-primary text-white font-heading font-bold hover:bg-purple-500 transition-colors"
            >
              <Sparkles size={16} /> Order a print →
            </button>
            <button onClick={onClose} className="mt-2 w-full py-2.5 text-sm text-galaxy-text-muted hover:text-galaxy-text">
              Maybe later
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Find the StoryEditor "finish" trigger**

```bash
grep -n "finish\|onFinish\|markFinished\|isFinished" src/components/editor/StoryEditor.jsx
grep -n "finish\|onFinish" src/pages/CreatePage.jsx
```

Identify where the user marks a book as done. There may not be an explicit "finished" action — in that case, the modal opens on first save of a book that has at least N pages, OR via a new "I'm done!" button. **Default**: add a small "I'm done!" button to the editor's primary action area and trigger the modal from there.

- [ ] **Step 3: Wire BookFinishedModal into the editor's main file**

The exact integration depends on what Step 2 found. Pattern to follow regardless:

```jsx
// at the top of the editor file
import { useState } from 'react'
import BookFinishedModal from '../print/BookFinishedModal'

// inside the component
const [finishedOpen, setFinishedOpen] = useState(false)

// where the "finish" action fires:
setFinishedOpen(true)

// at the end of the JSX:
<BookFinishedModal
  open={finishedOpen}
  book={currentBook}
  onClose={() => setFinishedOpen(false)}
/>
```

If a "finish" trigger doesn't exist, add a clearly-labeled button somewhere natural in the editor toolbar:

```jsx
<button onClick={() => setFinishedOpen(true)} className="px-4 py-2 rounded-lg bg-galaxy-primary text-white font-bold">
  I'm done!
</button>
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/print/BookFinishedModal.jsx src/components/editor/StoryEditor.jsx
git commit -m "feat: BookFinishedModal celebratory CTA with Order a print action"
```

(Adjust `git add` to include whichever editor file Step 3 actually modified.)

---

## Task 9: Bookshelf "Order print" icon

**Files:**
- Modify: `src/components/bookshelf/BookSpine.jsx`
- Modify: `src/components/bookshelf/Bookshelf.jsx` (or wherever `BookSpine` is used)

- [ ] **Step 1: Identify the BookSpine action props**

```bash
grep -n "onEdit\|onDelete\|onClick\|Trash2\|Pencil" src/components/bookshelf/BookSpine.jsx | head -10
```

Locate the existing edit/delete icon pattern.

- [ ] **Step 2: Add Printer icon + onOrderPrint prop to BookSpine**

In `src/components/bookshelf/BookSpine.jsx`:

Add `Printer` to the lucide-react imports. Add `onOrderPrint` to the props destructure. Render the icon next to the existing action icons, with the same hover/tap motion treatment:

```jsx
{onOrderPrint && (
  <motion.button
    onClick={(e) => { e.stopPropagation(); onOrderPrint() }}
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    className="p-1.5 rounded-lg bg-galaxy-primary/20 text-galaxy-primary hover:bg-galaxy-primary/30"
    aria-label="Order a print of this book"
    title="Order a printed copy"
  >
    <Printer size={14} />
  </motion.button>
)}
```

Match exactly the styling of the existing edit/delete icons in the same file — the snippet above is illustrative; copy the existing pattern and only swap icon + handler.

- [ ] **Step 3: Pass `onOrderPrint` from the parent**

Find the parent that uses `<BookSpine ...>`:

```bash
grep -n "<BookSpine" src/components/bookshelf/Bookshelf.jsx src/pages/BookshelfPage.jsx 2>/dev/null
```

Modify the parent to pass:

```jsx
import { useNavigate } from 'react-router-dom'
const navigate = useNavigate()

// inside the BookSpine call:
onOrderPrint={() => navigate(`/order/${book.book_id}`)}
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/bookshelf/BookSpine.jsx src/components/bookshelf/Bookshelf.jsx src/pages/BookshelfPage.jsx
git commit -m "feat: bookshelf Printer icon to start print order from any saved book"
```

(Stage only the parent file that actually changed in Step 3.)

---

## Task 10: OrderStatusPill, StatusTimeline, OrderSummaryTable

**Files:**
- Create: `src/components/print/OrderStatusPill.jsx`
- Create: `src/components/print/StatusTimeline.jsx`
- Create: `src/components/print/OrderSummaryTable.jsx`

**Why:** Shared visual atoms used by both `/orders` (list) and `/orders/:id` (detail). Building them once now removes duplication later.

- [ ] **Step 1: Implement `OrderStatusPill`**

```jsx
// src/components/print/OrderStatusPill.jsx
const STATUS_META = {
  pending:       { label: 'Order received',    cls: 'bg-galaxy-text-muted/20 text-galaxy-text-muted' },
  paid:          { label: 'Payment confirmed', cls: 'bg-cyan-500/15 text-cyan-300' },
  pdf_ready:     { label: 'Preparing files',   cls: 'bg-cyan-500/15 text-cyan-300' },
  submitted:     { label: 'Sent to printer',   cls: 'bg-galaxy-primary/20 text-galaxy-primary' },
  in_production: { label: 'Being printed',     cls: 'bg-galaxy-primary/20 text-galaxy-primary' },
  shipped:       { label: 'Shipped!',          cls: 'bg-green-500/15 text-green-400' },
  delivered:     { label: 'Delivered',         cls: 'bg-green-500/15 text-green-400' },
  failed:        { label: 'Problem',           cls: 'bg-red-500/15 text-red-400' },
  refunded:      { label: 'Refunded',          cls: 'bg-yellow-500/15 text-yellow-300' },
}

export default function OrderStatusPill({ status }) {
  const meta = STATUS_META[status] ?? { label: status, cls: 'bg-galaxy-text-muted/20 text-galaxy-text-muted' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-body font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  )
}
```

- [ ] **Step 2: Implement `StatusTimeline`**

```jsx
// src/components/print/StatusTimeline.jsx
import { Check, AlertTriangle } from 'lucide-react'

const STEPS = [
  { key: 'paid',          label: 'Payment received' },
  { key: 'pdf_ready',     label: 'Files prepared' },
  { key: 'submitted',     label: 'Sent to printer' },
  { key: 'in_production', label: 'Being printed' },
  { key: 'shipped',       label: 'Shipped' },
  { key: 'delivered',     label: 'Delivered' },
]

const ORDER_INDEX = STEPS.reduce((m, s, i) => ((m[s.key] = i), m), {})

export default function StatusTimeline({ status }) {
  if (status === 'failed' || status === 'refunded') {
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
        <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-300 font-body font-semibold text-sm">
            {status === 'failed' ? 'There was a problem with your order' : 'Order refunded'}
          </p>
          <p className="text-red-300/80 text-xs mt-1">If you have questions, tap "Report a problem" below.</p>
        </div>
      </div>
    )
  }
  const currentIdx = ORDER_INDEX[status] ?? -1
  return (
    <ol className="space-y-3">
      {STEPS.map((step, i) => {
        const done = i <= currentIdx
        return (
          <li key={step.key} className="flex items-center gap-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${done ? 'bg-galaxy-primary text-white' : 'bg-galaxy-bg-light text-galaxy-text-muted'}`}>
              {done ? <Check size={12} /> : i + 1}
            </span>
            <span className={`text-sm ${done ? 'text-galaxy-text font-semibold' : 'text-galaxy-text-muted'}`}>{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
```

- [ ] **Step 3: Implement `OrderSummaryTable`**

```jsx
// src/components/print/OrderSummaryTable.jsx
import { formatPriceCents } from '../../lib/printPricing'

export default function OrderSummaryTable({ order }) {
  return (
    <div className="rounded-xl border border-galaxy-text-muted/20 overflow-hidden">
      <Row label="Format"   value={order.format} />
      <Row label="Quantity" value={order.quantity} />
      <Row label="Subtotal" value={formatPriceCents(order.unit_price_cents * order.quantity)} />
      <Row label="Shipping" value={formatPriceCents(order.shipping_cents)} />
      <Row label="Tax"      value={formatPriceCents(order.tax_cents)} />
      <Row label="Total"    value={formatPriceCents(order.total_cents)} bold />
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between px-4 py-2.5 text-sm border-b border-galaxy-text-muted/10 last:border-b-0 ${bold ? 'font-bold text-galaxy-text bg-galaxy-bg-light' : 'text-galaxy-text-muted'}`}>
      <span>{label}</span>
      <span className="tabular-nums text-galaxy-text">{value}</span>
    </div>
  )
}
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/print/OrderStatusPill.jsx src/components/print/StatusTimeline.jsx src/components/print/OrderSummaryTable.jsx
git commit -m "feat: shared print order display atoms — pill, timeline, summary table"
```

---

## Task 11: useOrderPolling hook + fix get.js query param

**Files:**
- Create: `src/hooks/useOrderPolling.js`
- Modify: `api/print-orders/get.js` (read id from query param, not path)

**Why fix get.js:** The Plan A endpoint extracts the order id with `new URL(req.url).pathname.split('/').pop()` which returns `"get"` (the file name) when called as `/api/print-orders/get?id=…`. Vercel's file routing maps `api/print-orders/get.js` to exactly `/api/print-orders/get` — there's no path parameter to extract from. Plan A's spec flagged this in OQ-6; it was never actually tested via GET. Fix here so the polling hook works on the first try.

- [ ] **Step 1: Patch `api/print-orders/get.js` to read `id` from the query string**

In `api/print-orders/get.js`, replace:

```js
  const id = new URL(req.url).pathname.split('/').pop()
```

with:

```js
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), {
    status: 400, headers: { 'Content-Type': 'application/json' },
  })
```

- [ ] **Step 2: Implement the polling hook**

```js
// src/hooks/useOrderPolling.js
// Fetches a print order by id and polls every 30s while in non-terminal
// states. Stops polling on the terminal states (delivered, failed, refunded)
// and on unmount.
import { useEffect, useRef, useState } from 'react'
import { apiFetchAuthed } from '../lib/api'

const POLL_MS = 30_000
const TERMINAL = new Set(['delivered', 'failed', 'refunded'])

export function useOrderPolling(orderId) {
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!orderId) return
    let cancelled = false

    async function fetchOnce() {
      try {
        const res = await apiFetchAuthed(`/api/print-orders/get?id=${encodeURIComponent(orderId)}`)
        const body = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(body?.error || `HTTP ${res.status}`)
        } else {
          setOrder(body)
          setError(null)
          if (TERMINAL.has(body.status) && intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message ?? String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchOnce()
    intervalRef.current = setInterval(fetchOnce, POLL_MS)

    return () => {
      cancelled = true
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [orderId])

  return { order, error, loading }
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

- [ ] **Step 4: Smoke-test the get.js fix from the existing preview deployment**

If a preview is already up with the old broken code, deploy this branch first; otherwise this validates after Task 16. To verify locally during implementation:

```bash
# Replace ORDER_ID with any real order in your DB, TOKEN with a fresh JWT.
curl -s "https://<preview-url>/api/print-orders/get?id=$ORDER_ID" \
  -H "x-vercel-protection-bypass: $BYPASS" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -10
```

Expected: JSON with `"id"`, `"status"`, etc. — not `{"error":"Not found"}`.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useOrderPolling.js api/print-orders/get.js
git commit -m "feat: useOrderPolling hook + fix get.js to read id from query param

Plan A's get.js extracted id from pathname.split('/').pop() which returns
'get' (the file name) when Vercel routes /api/print-orders/get?id=… —
the endpoint was never actually working for any real order id. Fix while
adding the polling hook that depends on it."
```

---

## Task 12: OrderConfirmPage

**Files:**
- Create: `src/pages/OrderConfirmPage.jsx`

- [ ] **Step 1: Implement the page**

```jsx
// src/pages/OrderConfirmPage.jsx
import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { CheckCircle2 } from 'lucide-react'

export default function OrderConfirmPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const isNew = params.get('new') === '1'

  useEffect(() => {
    if (!isNew) return
    let canceled = false
    import('canvas-confetti').then((mod) => {
      if (canceled) return
      const confetti = mod.default ?? mod
      confetti({ particleCount: 80, spread: 80, origin: { y: 0.5 } })
    }).catch(() => {})
    return () => { canceled = true }
  }, [isNew])

  const shortId = (id ?? '').slice(-8).toUpperCase()

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-galaxy-bg text-galaxy-text font-body">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        className="text-center max-w-md"
      >
        <CheckCircle2 size={64} className="mx-auto text-green-400 mb-4" />
        <h1 className="font-heading text-3xl font-bold mb-2">Order placed! 🎉</h1>
        <p className="text-galaxy-text-muted">Order #{shortId}</p>
        <p className="mt-6">Usually arrives in <span className="font-semibold">10–14 business days</span>.</p>
        <p className="text-galaxy-text-muted text-sm mt-2">We'll send you an email when your book ships.</p>
        <div className="mt-8 flex flex-col gap-3">
          <Link to="/bookshelf" className="w-full py-3 rounded-xl bg-galaxy-primary text-white font-heading font-bold hover:bg-purple-500 transition-colors">
            Back to my shelf
          </Link>
          <Link to={`/orders/${id}`} className="text-sm text-galaxy-text-muted hover:text-galaxy-text underline">
            View order status
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/OrderConfirmPage.jsx
git commit -m "feat: OrderConfirmPage with confetti and shelf/tracking links"
```

---

## Task 13: OrdersListPage (direct Supabase read)

**Files:**
- Create: `src/pages/OrdersListPage.jsx`

- [ ] **Step 1: Implement the page**

```jsx
// src/pages/OrdersListPage.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import OrderStatusPill from '../components/print/OrderStatusPill'
import { formatPriceCents } from '../lib/printPricing'

export default function OrdersListPage() {
  const user = useAuthStore((s) => s.user)
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user || !supabase) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('print_orders')
        .select('id, book_id, format, quantity, total_cents, status, created_at, ship_name')
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) setError(error.message)
      else setOrders(data ?? [])
    })()
    return () => { cancelled = true }
  }, [user?.id])

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center"><Link to="/login" className="underline">Log in to see your orders.</Link></div>
  }

  return (
    <div className="min-h-screen bg-galaxy-bg text-galaxy-text font-body">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="font-heading text-2xl font-bold mb-6 flex items-center gap-2">
          <Package size={22} /> My print orders
        </h1>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {orders === null ? (
          <div className="flex items-center justify-center py-12 text-galaxy-text-muted">
            <Loader2 className="animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-galaxy-text-muted mb-4">No orders yet.</p>
            <Link to="/bookshelf" className="text-galaxy-primary hover:underline">Pick a book to print →</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="block p-4 rounded-xl bg-galaxy-bg-light border border-galaxy-text-muted/10 hover:border-galaxy-text-muted/30 transition-colors">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-body font-semibold truncate">{o.ship_name || 'Print order'}</p>
                      <p className="text-xs text-galaxy-text-muted mt-0.5">
                        {o.quantity} × {o.format} · {new Date(o.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <OrderStatusPill status={o.status} />
                      <p className="text-sm font-bold text-galaxy-text mt-1.5">{formatPriceCents(o.total_cents)}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/OrdersListPage.jsx
git commit -m "feat: /orders list page reads print_orders directly via Supabase + RLS"
```

---

## Task 14: OrderDetailPage with polling

**Files:**
- Create: `src/pages/OrderDetailPage.jsx`

- [ ] **Step 1: Implement the page**

```jsx
// src/pages/OrderDetailPage.jsx
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Loader2, AlertTriangle } from 'lucide-react'
import { useOrderPolling } from '../hooks/useOrderPolling'
import OrderStatusPill from '../components/print/OrderStatusPill'
import StatusTimeline from '../components/print/StatusTimeline'
import OrderSummaryTable from '../components/print/OrderSummaryTable'

export default function OrderDetailPage() {
  const { id } = useParams()
  const { order, error, loading } = useOrderPolling(id)

  if (loading) {
    return <Centered><Loader2 className="animate-spin text-galaxy-text-muted" /></Centered>
  }
  if (error || !order) {
    return (
      <Centered>
        <AlertTriangle className="text-red-400 mb-2" />
        <p className="text-galaxy-text-muted text-sm">{error || 'Order not found'}</p>
        <Link to="/orders" className="underline text-sm mt-3">All orders</Link>
      </Centered>
    )
  }

  const shortId = order.id.slice(-8).toUpperCase()
  const supportSubject = encodeURIComponent(`Help with print order ${shortId}`)
  const supportBody = encodeURIComponent(`Order ID: ${order.id}\n\nWhat happened: `)

  return (
    <div className="min-h-screen bg-galaxy-bg text-galaxy-text font-body">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <header className="flex items-center gap-3 mb-6">
          <Link to="/orders" aria-label="Back" className="p-2 -ml-2 hover:bg-galaxy-bg-light rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold truncate">Order #{shortId}</h1>
          </div>
          <div className="ml-auto"><OrderStatusPill status={order.status} /></div>
        </header>

        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">Progress</h2>
          <StatusTimeline status={order.status} />
        </section>

        {order.lulu_tracking_url && (
          <section className="mb-8 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
            <p className="font-body font-semibold text-green-300 mb-1">Your book is on its way!</p>
            <p className="text-xs text-galaxy-text-muted mb-3">
              {order.lulu_carrier ? `${order.lulu_carrier} · ` : ''}{order.lulu_tracking_number ?? ''}
            </p>
            <a
              href={order.lulu_tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-green-300 hover:underline"
            >
              Track your package <ExternalLink size={14} />
            </a>
          </section>
        )}

        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">Summary</h2>
          <OrderSummaryTable order={order} />
        </section>

        <section className="mb-8">
          <h2 className="font-heading text-sm uppercase tracking-wide text-galaxy-text-muted mb-3">Shipping to</h2>
          <div className="rounded-xl bg-galaxy-bg-light border border-galaxy-text-muted/10 p-4 text-sm">
            <p className="font-semibold">{order.ship_name}</p>
            <p className="text-galaxy-text-muted">{order.ship_city}, {order.ship_state} {order.ship_postal_code}</p>
          </div>
        </section>

        <a
          href={`mailto:support@mybooklab.app?subject=${supportSubject}&body=${supportBody}`}
          className="block w-full text-center py-3 rounded-xl bg-galaxy-bg-light border border-galaxy-text-muted/20 text-sm hover:border-galaxy-text-muted/40 transition-colors"
        >
          Report a problem
        </a>
      </div>
    </div>
  )
}

function Centered({ children }) {
  return <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">{children}</div>
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/OrderDetailPage.jsx
git commit -m "feat: OrderDetailPage with timeline, tracking, summary, polling"
```

---

## Task 15: Wire routes in App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports + routes**

In `src/App.jsx` near the other page imports add:

```jsx
import PrintOrderPage from './pages/PrintOrderPage'
import OrderConfirmPage from './pages/OrderConfirmPage'
import OrdersListPage from './pages/OrdersListPage'
import OrderDetailPage from './pages/OrderDetailPage'
```

Inside `<Routes>`, add:

```jsx
<Route path="/order/:bookId" element={<PrintOrderPage />} />
<Route path="/orders" element={<OrdersListPage />} />
<Route path="/orders/:id" element={<OrderDetailPage />} />
<Route path="/orders/:id/confirm" element={<OrderConfirmPage />} />
```

If the existing routes use `<ProtectedRoute>`, wrap the four new routes the same way.

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Smoke check the dev server**

```bash
npm run dev
```

In another terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/orders
```

Expected: `200` (the SPA index serves all routes — actual route gating happens client-side).

Stop the dev server with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire /order/:bookId, /orders, /orders/:id, /orders/:id/confirm"
```

---

## Task 16: End-to-end manual smoke against preview deployment

**Files:**
- (none)

**Why:** UI flows can't be unit-tested without a component test framework (deliberately deferred per spec). Verify on a real preview deployment with the verified backend pipeline.

> The Plan A smoke verified backend end-to-end against Lulu sandbox order 295198 ACCEPTED. This task verifies the user-visible path from "Order print" tap to confirmation screen.

- [ ] **Step 1: Push the implementation branch and trigger a preview build**

```bash
git push -u origin spec/print-pipeline-plan-b
```

(Or whichever branch the implementation lands on — substitute the name.) Watch Vercel for the preview URL.

- [ ] **Step 2: Add the Stripe publishable key to Vercel preview env**

In your terminal:

```bash
cd /Users/damianocanali/Documents/my-favorite-book
npx vercel env add VITE_STRIPE_PUBLISHABLE_KEY preview
```

When prompted, paste the **test** publishable key (`pk_test_...`) from the Stripe Dashboard → Developers → API Keys → Test mode. Confirm "all Preview branches" and "Sensitive: yes".

Trigger a redeploy if needed:

```bash
git commit --allow-empty -m "chore: trigger preview redeploy after VITE_STRIPE_PUBLISHABLE_KEY"
git push
```

- [ ] **Step 3: Open the preview URL in a browser**

The deployment may be gated by Vercel's deployment protection — use the existing automation bypass token (`x-vercel-protection-bypass: ...`) as a query param if needed:

`https://my-favorite-book-<id>-canalidamiano.vercel.app/?x-vercel-protection-bypass=<token>&x-vercel-set-bypass-cookie=true`

That sets a bypass cookie for the session.

Log in with your account (Supabase auth).

- [ ] **Step 4: Walk the full happy path**

1. Bookshelf → tap the new "Order print" icon on any book.
2. Order screen loads with the book preview at the top.
3. Scroll through every page in the preview.
4. Tick both confirmation checkboxes.
5. Choose Hardcover.
6. Set quantity to 1.
7. Fill all shipping fields. Use your real email and any phone number with ≥10 digits.
8. "Continue to payment" — solve the parental gate.
9. The Stripe Payment Element appears (web) — pay with the test card `4242 4242 4242 4242`, any future date, any CVC.
10. Should redirect to `/orders/<id>/confirm?new=1` — confetti fires, "Order placed! 🎉".
11. Tap "View order status" — `/orders/<id>` loads with timeline + summary. Status will start at `pending` and march to `submitted` over a couple of minutes (PDF worker + Lulu submission).
12. Visit `/orders` — the new order appears in the list.

- [ ] **Step 5: Sanity-check the Lulu sandbox order**

```bash
TOKEN=$(curl -s -X POST https://api.sandbox.lulu.com/auth/realms/glasstree/protocol/openid-connect/token \
  -u "$LULU_CLIENT_KEY:$LULU_CLIENT_SECRET" \
  -d 'grant_type=client_credentials' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
```

Get the new `lulu_order_id` from the order detail page or Supabase, then:

```bash
curl -s "https://api.sandbox.lulu.com/print-jobs/$LULU_ID/" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("status:",d.get("status",{}).get("name"));[print("li:",li["status"]["name"]) for li in d.get("line_items",[])]'
```

Expected: line item status `ACCEPTED`. Same as Plan A's smoke result.

- [ ] **Step 6: Tear down test orders (optional)**

If you want to clean up in Supabase:

```sql
delete from print_orders where status in ('failed','refunded') and created_at > now() - interval '1 day';
```

(Cancellable PIs in Stripe test mode auto-expire — no Stripe cleanup needed.)

- [ ] **Step 7: Commit a smoke-test note**

If anything in the walkthrough produced unexpected behavior, capture it in a follow-up `docs/superpowers/notes/` markdown and commit. Otherwise no commit for this task — the verification itself is the deliverable.

---

## Wrap-up

After Task 16 passes, the print order frontend is shippable end-to-end against the verified backend. Merge the branch into `main` (PR or fast-forward, your call), then:

- Update Vercel **production** env: `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...` (use the live key, not test). Keep the test key on Preview/Development.
- Acquire **production Lulu API credentials** (separate signup from sandbox) and add `LULU_CLIENT_KEY` / `LULU_CLIENT_SECRET` / `LULU_API_BASE=https://api.lulu.com` to Vercel production.
- Configure the **production Lulu webhook** to point at `https://mybooklab.app/api/webhooks/lulu` with the production webhook secret (re-using `LULU_CLIENT_SECRET` per the multi-scheme verifier already shipped in [api/webhooks/lulu.js](../../../api/webhooks/lulu.js)).
- Test in production with one real order to yourself before opening up to users.
- Submit a new App Store build that includes the print order entry points; in App Review notes, cite Guideline 3.1.1 (physical goods exempt from IAP) and call out the parental gate.

### Items deferred to later plans

- **Custom transactional emails** ("preparing your book", "shipped" with custom branding) — Plan B currently relies on Stripe receipts + Lulu shipping emails. A separate plan can layer on a transactional email provider.
- **Apple Pay / Google Pay** native methods — needs merchant ID provisioning. Card-only for v1.
- **Saved shipping addresses** — the order form fills cleanly each time via Zustand persist (last-used address sticks); a saved-addresses UI is a nice-to-have.
- **Push notification on shipped** — reuse `src/services/notifications.js` once we have a backend hook to fire it.
- **Production Lulu webhook signing scheme verification** — the multi-scheme verifier in `api/webhooks/lulu.js` will log which scheme actually matches on the first real production webhook. Tighten to that single scheme afterward.
- **Frontend component test framework** — deliberately deferred; revisit if the order screen logic grows.

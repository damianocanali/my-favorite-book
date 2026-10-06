# Plan B Production Launch Checklist

**Feature:** My Book Lab physical book printing (Plan A backend + Plan B frontend)  
**Status at time of writing:** End-to-end verified against Lulu sandbox. Plan B frontend pages (PrintOrderPage, OrdersListPage, OrderDetailPage, OrderConfirmPage, PaymentSheetModal) implemented and smoke-tested.  
**Date:** 2026-05-04  

---

## Prerequisites

- [ ] You have access to the Vercel project dashboard for `mybooklab.app`
- [ ] You have access to the Stripe Dashboard in **live mode**
- [ ] You have (or are obtaining) Lulu Direct **production** credentials
- [ ] You have access to the Supabase project dashboard

---

## 1. Vercel Environment Variables

All variables must be set on the **Production** environment in Vercel → Project Settings → Environment Variables.

> **How to check:** Vercel Dashboard → my-book-lab → Settings → Environment Variables → filter by "Production".

### Complete variable table

| Variable | Production value required | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` | **Already set** — confirm live key is present |
| `STRIPE_TEST_SECRET_KEY` | _(not set)_ | Must **not** be present in Production. `lib/print/stripe-key.js` uses the live key when `VERCEL_ENV === 'production'`; the test key is only needed in Preview/Development. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | **NEW — must be added.** Currently set to `pk_test_...` in Preview. The Plan B web payment UI (`src/lib/stripe.js` singleton, `src/components/print/PaymentSheetModal.jsx`) reads this at build time. Set the **live** publishable key. |
| `STRIPE_PRICE_HARDCOVER` | `price_live_...` (hardcover) | **NEW — must be added.** Currently only test price IDs exist. Create the live price via `scripts/setup-stripe-products.mjs` (see §2) and paste the returned ID here. |
| `STRIPE_PRICE_SOFTCOVER` | `price_live_...` (softcover) | **NEW — must be added.** Same as above. |
| `LULU_API_BASE` | `https://api.lulu.com` | **NEW — must be added.** `lib/print/lulu.js` defaults to `https://api.sandbox.lulu.com` if this env var is absent. Production must point to the live API. |
| `LULU_CLIENT_KEY` | _(production key from Lulu)_ | **NEW — must be added.** Sandbox credentials are different from production. Obtain from Lulu after production access is approved (see §3). |
| `LULU_CLIENT_SECRET` | _(production secret from Lulu)_ | **NEW — must be added.** Same as above. |
| `LULU_WEBHOOK_SECRET` | _(same value as production `LULU_CLIENT_SECRET`)_ | **NEW — must be added.** `api/webhooks/lulu.js` tries both `LULU_WEBHOOK_SECRET` and `LULU_CLIENT_SECRET` in its multi-scheme verifier. Once the real webhook signing secret is known from Lulu (see §3), set it here explicitly. Until then, setting it to the `LULU_CLIENT_SECRET` value allows the verifier to match. |
| `PRINT_WORKER_SECRET` | _(random secret string)_ | **Already set** — confirm it is present. Used to authenticate internal calls between `api/stripe-webhook.js → api/print-orders/pdf-worker.js → api/print-orders/submit-to-lulu.js → api/print-orders/refund.js`. |
| `PUBLIC_BASE_URL` | `https://mybooklab.app` | **Already set** — confirm value. Used by `api/stripe-webhook.js` and `api/print-orders/pdf-worker.js` to dispatch internal worker calls. |
| `OWNER_USER_ID` | _(Supabase UUID of owner account)_ | **Already set** — confirm. Gates the `/admin` cost dashboard. |
| `VITE_OWNER_USER_ID` | _(same UUID)_ | **Already set** — confirm. Client-side gate for admin UI. |
| `SUPABASE_URL` | `https://<project>.supabase.co` | **Already set** — confirm. |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **Already set** — confirm. |
| `TOGETHER_API_KEY` | `...` | **Already set** — confirm. Used by `lib/print/upscale.js` for illustration upscaling. |

> **Note on `.npmrc`:** `legacy-peer-deps=true` is committed to the repo root, so Vercel CI resolves peer dependency conflicts without manual intervention. No Vercel-side action needed.

### Checklist

- [ ] `STRIPE_SECRET_KEY` confirmed present in Production (live key, `sk_live_...`)
- [ ] `STRIPE_TEST_SECRET_KEY` confirmed **absent** from Production environment
- [ ] `VITE_STRIPE_PUBLISHABLE_KEY` added to Production with live `pk_live_...` value
- [ ] `STRIPE_PRICE_HARDCOVER` added to Production with live price ID
- [ ] `STRIPE_PRICE_SOFTCOVER` added to Production with live price ID
- [ ] `LULU_API_BASE` set to `https://api.lulu.com` in Production
- [ ] `LULU_CLIENT_KEY` set to production Lulu key
- [ ] `LULU_CLIENT_SECRET` set to production Lulu secret
- [ ] `LULU_WEBHOOK_SECRET` set (to Lulu webhook signing secret, or `LULU_CLIENT_SECRET` value as interim)
- [ ] `PRINT_WORKER_SECRET` confirmed present
- [ ] `PUBLIC_BASE_URL` confirmed = `https://mybooklab.app`
- [ ] `OWNER_USER_ID` and `VITE_OWNER_USER_ID` confirmed
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` confirmed
- [ ] `TOGETHER_API_KEY` confirmed
- [ ] Redeploy Production after all env var changes (Vercel → Deployments → Redeploy latest)

---

## 2. Stripe Dashboard Configuration (Live Mode)

### Create live Products and Prices

The script `scripts/setup-stripe-products.mjs` is idempotent — it looks up existing products by name before creating.

**Operator action (run from your local machine, NOT in CI):**

```bash
# Run with the LIVE secret key
STRIPE_SECRET_KEY=sk_live_... node scripts/setup-stripe-products.mjs
```

The script outputs the created price IDs. Copy them into Vercel Production env vars:

```
STRIPE_PRICE_HARDCOVER = price_live_xxxx   # hardcover 8.5"×8.5" — $39.99
STRIPE_PRICE_SOFTCOVER = price_live_yyyy   # softcover 8.5"×8.5" — $19.99
```

- [ ] Live Stripe products and prices created via `scripts/setup-stripe-products.mjs`
- [ ] Live price IDs recorded and added to Vercel Production env vars (§1)

### Register the live Stripe webhook

The print pipeline shares the endpoint `https://mybooklab.app/api/stripe-webhook` with subscriptions. It must be registered in **live mode** in the Stripe Dashboard.

Navigate to: Stripe Dashboard (live mode) → Developers → Webhooks → Add endpoint

- **Endpoint URL:** `https://mybooklab.app/api/stripe-webhook`
- **Events to listen for:**
  - `payment_intent.succeeded` — triggers PDF generation + Lulu submission
  - `payment_intent.payment_failed` — _(optional for v1, no handler yet — add for observability)_
  - `charge.refunded` — _(optional for v1, no handler yet — add for observability)_
  - `checkout.session.completed` — already handles subscriptions and coin packs
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

After creating the endpoint, copy the **Signing secret** (`whsec_...`) and set it as `STRIPE_WEBHOOK_SECRET` in Vercel Production env vars.

- [ ] Live Stripe webhook endpoint registered at `https://mybooklab.app/api/stripe-webhook`
- [ ] All required events selected (especially `payment_intent.succeeded`)
- [ ] Stripe webhook signing secret (`whsec_...`) set as `STRIPE_WEBHOOK_SECRET` in Vercel Production

### Verify live publishable key

In Stripe Dashboard (live mode) → Developers → API keys — copy the **Publishable key** (`pk_live_...`) and confirm it matches what you set for `VITE_STRIPE_PUBLISHABLE_KEY`.

- [ ] Live publishable key confirmed and matches Vercel `VITE_STRIPE_PUBLISHABLE_KEY`

---

## 3. Lulu Direct Production API Access

### Production signup

Sandbox credentials (`api.sandbox.lulu.com`) are separate from production (`api.lulu.com`). Production access requires a separate signup and verification by Lulu.

**Operator action:**

1. Apply for Lulu Direct production access at [https://developers.lulu.com](https://developers.lulu.com) if not already approved.
2. Once approved, log into the Lulu production developer portal and create a new API application to obtain a production `client_key` and `client_secret`.
3. Add these to Vercel Production as `LULU_CLIENT_KEY` and `LULU_CLIENT_SECRET` (§1).

- [ ] Lulu Direct production access approved
- [ ] Production `LULU_CLIENT_KEY` and `LULU_CLIENT_SECRET` obtained and set in Vercel

### Register the Lulu production webhook

After setting production credentials, register the webhook so Lulu can push status updates (`in_production`, `shipped`, etc.) to our handler at `api/webhooks/lulu.js`.

```bash
# Replace <TOKEN> with a valid Lulu production OAuth token (client_credentials flow)
curl -X POST https://api.lulu.com/webhooks/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "PRINT_JOB_STATUS_CHANGED",
    "url": "https://mybooklab.app/api/webhooks/lulu"
  }'
```

The response includes a webhook `secret`. Copy it and set it as `LULU_WEBHOOK_SECRET` in Vercel Production.

> The multi-scheme verifier in `api/webhooks/lulu.js` tries three header names (`lulu-hmac-sha256`, `x-lulu-hmac-sha256`, `lulu-signature`), two secrets (`LULU_WEBHOOK_SECRET`, `LULU_CLIENT_SECRET`), and two encodings (hex, base64). The first real production webhook will log which combination matched — see §6 for how to tighten it after.

- [ ] Lulu production webhook registered (`POST https://api.lulu.com/webhooks/`)
- [ ] Returned webhook secret set as `LULU_WEBHOOK_SECRET` in Vercel Production

### Verify POD package IDs for production

The pod package IDs are hardcoded in `api/print-orders/pdf-worker.js:16-19` and `api/print-orders/submit-to-lulu.js:17-20`:

| Format | pod_package_id |
|---|---|
| Hardcover | `0850X0850FCSTDCW080CW444MXX` |
| Softcover | `0850X0850FCSTDPB080CW444MXX` |

Lulu can change SKU codes between sandbox and production. Verify these IDs are still valid before the first real order.

```bash
# Probe the cost-calc endpoint with production credentials to confirm the SKUs exist
curl -X GET "https://api.lulu.com/print-jobs/cost-calculations/?pod_package_id=0850X0850FCSTDCW080CW444MXX&page_count=32&quantity=1&country=US" \
  -H "Authorization: Bearer <TOKEN>"
```

- [ ] `0850X0850FCSTDCW080CW444MXX` (hardcover) confirmed valid in Lulu production
- [ ] `0850X0850FCSTDPB080CW444MXX` (softcover) confirmed valid in Lulu production
- [ ] If SKUs differ in production, update both `api/print-orders/pdf-worker.js:16-19` and `api/print-orders/submit-to-lulu.js:17-20` and redeploy

---

## 4. App Store Submission Notes

The next iOS build submitted to App Store Review **must** address the following.

### Review notes to include

In the App Review Information notes field, include:

> This update adds a physical book printing feature. Users pay for physical goods (printed children's books) delivered by US mail. Payment is processed via Stripe (credit/debit card). Per App Store Review Guideline 3.1.1, apps may use payment methods other than in-app purchase to sell goods or services consumed outside the app. Printed books are physical goods consumed outside the app — Stripe payment is therefore permitted.

### Parental Gate

`src/components/ui/ParentalGate.jsx` is displayed before any payment flow is initiated. Confirm it is present on all entry points:

- [ ] Bookshelf Printer icon → Parental Gate shown before print flow
- [ ] PreviewPage "Order a print" button → Parental Gate shown before print flow
- [ ] BookFinishedModal print option → Parental Gate shown before print flow

### Apple Pay

Apple Pay is **not enabled in v1**. The iOS native path uses Stripe Payment Sheet (card-only, via `src/services/printPaymentService.js`). The web path uses Stripe Payment Element (card-only, via `src/components/print/PaymentSheetModal.jsx`). This intentionally avoids the merchant ID provisioning requirement for v1.

Include in review notes:

> Apple Pay is not offered in this version. Only credit/debit card entry via Stripe is available.

### Checklist

- [ ] App Review notes drafted referencing Guideline 3.1.1
- [ ] Parental Gate verified on all three print entry points
- [ ] Apple Pay not enabled — no merchant ID required for this build
- [ ] Print order entry points (Printer icon, "Order a print" button, BookFinishedModal) noted as new UI in review notes

---

## 5. Pre-Launch Smoke Test (Production)

Run one real end-to-end order against production before opening the feature to users.

### Order

- [ ] Log in as the **owner account** on `https://mybooklab.app`
- [ ] Open any completed book
- [ ] Tap the Printer icon → complete Parental Gate → select **Softcover** (1 copy, $19.99 + $4.99 shipping = $24.98)
- [ ] Enter owner's **real** shipping address (book will physically ship to you)
- [ ] Complete payment with a real card in production Stripe

### Status progression — verify each step in Supabase

```sql
SELECT id, status, lulu_order_id, lulu_tracking_url, updated_at
FROM print_orders
ORDER BY created_at DESC
LIMIT 5;
```

| Step | Expected `status` | Trigger |
|---|---|---|
| After payment | `pending` → `paid` | `payment_intent.succeeded` Stripe webhook |
| After PDF generation | `paid` → `pdf_ready` | `api/print-orders/pdf-worker` completes |
| After Lulu submission | `pdf_ready` → `submitted` | `api/print-orders/submit-to-lulu` completes |
| Lulu starts printing | `submitted` → `in_production` | Lulu webhook `IN_PRODUCTION` |
| Lulu ships | `in_production` → `shipped` | Lulu webhook `SHIPPED`; `lulu_tracking_url` populated |

- [ ] Order reaches `paid` within ~10 seconds of payment
- [ ] Order reaches `pdf_ready` within ~5 minutes (PDF generation + upscale)
- [ ] Order reaches `submitted` within ~1 minute of `pdf_ready`
- [ ] Order reaches `in_production` within 1 business day (Lulu webhook)
- [ ] Order reaches `shipped` within ~5 business days; tracking URL populated
- [ ] Book physically arrives; inspect print quality (known soft area — see §7)

### If anything goes wrong

Check Vercel function logs for `api/print-orders/pdf-worker` and `api/print-orders/submit-to-lulu`. If the order reaches `failed`, the refund is triggered automatically via `api/print-orders/refund.js`. Confirm the Stripe refund appears in the live Stripe Dashboard.

- [ ] Smoke test order completes all status transitions end-to-end
- [ ] Printed book received and quality reviewed

---

## 6. Monitoring During Launch

### Owner cost dashboard

URL: `https://mybooklab.app/admin` (gated by `OWNER_USER_ID`)

- [ ] Confirm admin page loads and shows Anthropic + Together AI spend

### Vercel function logs

Vercel Dashboard → my-book-lab → Logs. Filter by function path:

- `api/print-orders/create` — order creation + Stripe PaymentIntent
- `api/print-orders/pdf-worker` — PDF generation; watch for 500s
- `api/print-orders/submit-to-lulu` — Lulu job submission; watch for Lulu API errors
- `api/print-orders/refund` — auto-refund triggers (should be rare)
- `api/webhooks/lulu` — watch for `signature verification FAILED` log lines
- `api/stripe-webhook` — watch for `failed to mark paid` log lines

- [ ] Vercel log tab bookmarked for these paths
- [ ] Alert / Slack notification configured for 5xx spikes (if available)

### Stripe Dashboard (live mode)

- [ ] Monitor → Payments: watch for failed payments, unexpected refunds, disputes
- [ ] Monitor → Webhooks: confirm `payment_intent.succeeded` events are being delivered (not failing)

### Supabase print_orders table

Run periodically to catch stuck orders:

```sql
-- Orders stuck in non-terminal states for > 30 minutes
SELECT id, status, created_at, updated_at, status_message
FROM print_orders
WHERE status NOT IN ('shipped', 'delivered', 'refunded')
  AND updated_at < NOW() - INTERVAL '30 minutes'
ORDER BY updated_at ASC;

-- Count by status
SELECT status, COUNT(*)
FROM print_orders
GROUP BY status
ORDER BY count DESC;
```

- [ ] Supabase queries bookmarked
- [ ] Check print_orders table daily for the first week

### Lulu webhook scheme — tighten after first production webhook

`api/webhooks/lulu.js` logs the matching scheme on every verified webhook:

```
[lulu-webhook] verified via <header>:<secret>:<encoding>
```

After receiving the first real production webhook from Lulu, find this log line in Vercel logs and note the scheme. Then open a follow-up PR to narrow the verifier to that single scheme (removes dead-code branches and reduces attack surface).

- [ ] First production Lulu webhook received and scheme logged
- [ ] Follow-up PR created to tighten `api/webhooks/lulu.js` to the confirmed scheme

---

## 7. Known Gaps — Tracked for After Launch

The following are intentional deferrals. Do not block launch on these.

| Gap | Details | Tracking |
|---|---|---|
| Stripe webhook test-mode forwarding to Preview | In Preview deployments, `payment_intent.succeeded` webhooks don't reach the function automatically. Currently we manually advance `pending → paid` for sandbox tests. | Post-launch |
| Together AI upscale model | `lib/print/upscale.js` passes the 768×512 source image through to print when `TOGETHER_UPSCALE_MODEL` is not set or returns an error. Printed image quality is visibly soft on close inspection. Requires a valid Together AI upscale model slug in `TOGETHER_UPSCALE_MODEL`. | Post-launch |
| Transactional emails | Users receive Stripe receipts and Lulu's default shipping notification. Custom emails ("your book is being printed", "your book shipped — here's a photo") are not implemented. | Post-launch |
| Stripe Tax | `api/print-orders/create.js` hardcodes `FLAT_TAX_CENTS = 0`. Tax computation via Stripe Tax `automatic_tax` is deferred. | Post-launch |
| Lulu shipping cost API | `api/print-orders/create.js` hardcodes `FLAT_SHIPPING_CENTS = 499` ($4.99). Actual Lulu shipping costs vary by destination and weight. Lulu's `/shipping-options/` API (`lib/print/lulu.js:getShippingOptions`) is already wired but not called at order time. | Post-launch |
| Apple Pay on iOS | Deferred to v1.1. Requires Apple merchant ID provisioning. Current iOS path uses Stripe Payment Sheet card-only. | v1.1 |
| Lulu webhook signing scheme | The multi-scheme verifier in `api/webhooks/lulu.js` accepts several header/secret/encoding combinations. After first real production webhook confirms the scheme, narrow to a single path (see §6). | Post first production webhook |
| International shipping | `api/print-orders/create.js` rejects non-US shipping (`country !== 'US'`). | Post-launch |

---

## Sign-off

| Check | Owner | Done |
|---|---|---|
| All Vercel Production env vars set | | ☐ |
| Stripe live products + prices created | | ☐ |
| Stripe live webhook registered + `STRIPE_WEBHOOK_SECRET` set | | ☐ |
| Lulu production access approved + credentials set | | ☐ |
| Lulu production webhook registered + `LULU_WEBHOOK_SECRET` set | | ☐ |
| Lulu POD package IDs verified in production | | ☐ |
| App Store review notes drafted | | ☐ |
| Parental Gate verified on all print entry points | | ☐ |
| Production smoke test order completed + book received | | ☐ |
| Monitoring dashboards / queries bookmarked | | ☐ |

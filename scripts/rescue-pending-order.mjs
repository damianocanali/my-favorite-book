// scripts/rescue-pending-order.mjs
//
// Manually advance a print order that is stuck in `pending` because the
// Stripe webhook never fired (or fired and was rejected for signature
// mismatch). Verifies the PaymentIntent actually succeeded in Stripe
// before touching the DB — never advances on unpaid orders.
//
// Run with:
//   set -a && source .env.production && set +a && \
//     node scripts/rescue-pending-order.mjs <SHORT_ID>
//
// Steps:
//   1. Look up the order by short id (last-8-uppercased of the uuid)
//   2. Pull the PaymentIntent from Stripe — confirm status === 'succeeded'
//   3. PATCH the order: status = 'paid', stripe_charge_id = latest_charge
//   4. POST /api/print-orders/pdf-worker with the worker secret to kick
//      the PDF + Lulu chain

const required = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  PRINT_WORKER_SECRET: process.env.PRINT_WORKER_SECRET,
}
for (const [name, value] of Object.entries(required)) {
  if (!value) {
    console.error(`Missing required env: ${name}`)
    process.exit(1)
  }
}
const SUPABASE_URL = required.SUPABASE_URL
const SERVICE_KEY = required.SUPABASE_SERVICE_ROLE_KEY
const STRIPE_KEY = required.STRIPE_SECRET_KEY
const WORKER_SECRET = required.PRINT_WORKER_SECRET
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? 'https://mybooklab.app'

const shortId = (process.argv[2] || '').trim().toUpperCase()
if (!shortId) {
  console.error('Usage: node scripts/rescue-pending-order.mjs <SHORT_ID>')
  process.exit(1)
}

const suffix = shortId.toLowerCase()
const lookup = await fetch(
  `${SUPABASE_URL}/rest/v1/print_orders?select=*&order=created_at.desc&limit=200`,
  { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
)
if (!lookup.ok) {
  console.error(`Lookup failed (${lookup.status}): ${await lookup.text()}`)
  process.exit(1)
}
const order = (await lookup.json()).find((o) => String(o.id).endsWith(suffix))
if (!order) {
  console.error(`No order ending in ${suffix}`)
  process.exit(1)
}

console.log(`Order ${order.id}`)
console.log(`  current status: ${order.status}`)
console.log(`  stripe PI:      ${order.stripe_payment_intent_id ?? '(none)'}`)

if (order.status !== 'pending') {
  console.error(`Order is not pending (status=${order.status}); refusing to advance.`)
  process.exit(1)
}
if (!order.stripe_payment_intent_id) {
  console.error('Order has no PaymentIntent; cannot verify payment.')
  process.exit(1)
}

const pir = await fetch(
  `https://api.stripe.com/v1/payment_intents/${order.stripe_payment_intent_id}`,
  { headers: { Authorization: `Bearer ${STRIPE_KEY}` } }
)
if (!pir.ok) {
  console.error(`Stripe lookup failed (${pir.status}): ${await pir.text()}`)
  process.exit(1)
}
const pi = await pir.json()
console.log(`  stripe status:  ${pi.status}`)
console.log(`  latest_charge:  ${pi.latest_charge ?? '(none)'}`)

if (pi.status !== 'succeeded') {
  console.error(`PaymentIntent is not succeeded (status=${pi.status}); refusing to advance.`)
  process.exit(1)
}

console.log('\nAdvancing order: pending → paid …')
const patch = await fetch(
  `${SUPABASE_URL}/rest/v1/print_orders?id=eq.${order.id}&status=eq.pending`,
  {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      status: 'paid',
      stripe_charge_id: pi.latest_charge ?? null,
    }),
  }
)
if (!patch.ok) {
  console.error(`Patch failed (${patch.status}): ${await patch.text()}`)
  process.exit(1)
}
console.log('  marked paid ✓')

console.log(`\nDispatching PDF worker at ${PUBLIC_BASE_URL}/api/print-orders/pdf-worker …`)
const dispatch = await fetch(`${PUBLIC_BASE_URL}/api/print-orders/pdf-worker`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${WORKER_SECRET}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ orderId: order.id }),
})
const dispatchBody = await dispatch.text()
console.log(`  worker response: HTTP ${dispatch.status} ${dispatchBody.slice(0, 400)}`)

console.log('\nDone. Re-run check-order.mjs in 30–90 sec to watch it progress.')

// scripts/cancel-lulu-job.mjs
//
// Cancels a Lulu print job and marks the corresponding order in our DB
// as `refunded` (so the UI and state machine reflect reality). Use this
// for orders that are stuck UNPAID and we don't want to fulfill.
//
// Idempotent: re-running on an already-canceled job exits cleanly.
//
// Run with:
//   LULU_API_BASE='https://api.lulu.com' \
//   LULU_CLIENT_KEY='...' LULU_CLIENT_SECRET='...' \
//   set -a && source .env.production && set +a && \
//     node scripts/cancel-lulu-job.mjs <SHORT_ID>

import { LuluClient } from '../lib/print/lulu.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

for (const [k, v] of Object.entries({
  SUPABASE_URL, SERVICE_KEY,
  LULU_CLIENT_KEY: process.env.LULU_CLIENT_KEY,
  LULU_CLIENT_SECRET: process.env.LULU_CLIENT_SECRET,
})) {
  if (!v) {
    console.error(`Missing required env: ${k}`)
    process.exit(1)
  }
}

const shortId = (process.argv[2] || '').trim().toUpperCase()
if (!shortId) {
  console.error('Usage: node scripts/cancel-lulu-job.mjs <SHORT_ID>')
  process.exit(1)
}

const suffix = shortId.toLowerCase()
const lookup = await fetch(
  `${SUPABASE_URL}/rest/v1/print_orders?select=*&order=created_at.desc&limit=200`,
  { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
)
const order = (await lookup.json()).find((o) => String(o.id).toLowerCase().includes(suffix))
if (!order) {
  console.error(`No order matching "${shortId}"`)
  process.exit(1)
}

console.log(`Order ${order.id}`)
console.log(`  current status:    ${order.status}`)
console.log(`  lulu_order_id:     ${order.lulu_order_id ?? '(none)'}`)

const lulu = new LuluClient()

if (order.lulu_order_id) {
  console.log(`\nFetching Lulu job ${order.lulu_order_id}…`)
  const job = await lulu.getPrintJob(order.lulu_order_id)
  console.log(`  Lulu status:       ${job.status?.name}`)
  console.log(`  is_cancellable:    ${job.is_cancellable}`)

  if (job.status?.name === 'CANCELED') {
    console.log('  (Lulu job already canceled.)')
  } else if (!job.is_cancellable) {
    console.error(`  Lulu refuses to cancel from status ${job.status?.name}. Aborting.`)
    process.exit(1)
  } else {
    // Lulu cancels UNPAID jobs via DELETE on the print-job resource.
    const token = await lulu.getToken()
    const res = await fetch(
      `${lulu.base}/print-jobs/${order.lulu_order_id}/`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    if (!res.ok && res.status !== 204) {
      console.error(`Lulu cancel failed (${res.status}): ${await res.text()}`)
      process.exit(1)
    }
    console.log('  Lulu job canceled ✓')
  }
}

console.log('\nMarking order as refunded in our DB…')
const patch = await fetch(
  `${SUPABASE_URL}/rest/v1/print_orders?id=eq.${order.id}`,
  {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      status: 'refunded',
      status_message: 'Canceled — print job did not auto-pay (legacy)',
    }),
  }
)
if (!patch.ok) {
  console.error(`Patch failed (${patch.status}): ${await patch.text()}`)
  process.exit(1)
}
console.log('  order patched ✓')

if (order.stripe_payment_intent_id && !order.stripe_refund_id) {
  console.log('\nReminder: this script does NOT refund the Stripe charge.')
  console.log('If you want to refund the customer, run /api/print-orders/refund')
  console.log(`or refund manually in the Stripe Dashboard for ${order.stripe_payment_intent_id}.`)
}

// scripts/replay-stripe-webhook.mjs
//
// Manually re-fire a payment_intent.succeeded webhook for a given
// PaymentIntent. Pulls the live PI from Stripe, wraps it in a synthetic
// Stripe-Event envelope, signs it with the live STRIPE_WEBHOOK_SECRET,
// and POSTs it to /api/stripe-webhook just like Stripe would.
//
// Use when the Stripe Dashboard "Resend" UI isn't available (newer
// dashboards hide it for older events), or when you've just configured
// a fresh webhook endpoint and need to backfill the missed delivery.
//
// Run with:
//   set -a && source .env.production && set +a && \
//     STRIPE_WEBHOOK_SECRET='whsec_...' \
//     node scripts/replay-stripe-webhook.mjs pi_3TWocWHzjLHLtScb1RxoG5rY
//
// The STRIPE_WEBHOOK_SECRET is required inline because Vercel marks it
// sensitive and won't include it in `vercel env pull`. Copy it from the
// Stripe Dashboard → Webhooks → your endpoint → Signing secret (Reveal).

import { createHmac } from 'node:crypto'

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const TARGET_URL = process.env.WEBHOOK_URL ?? 'https://mybooklab.app/api/stripe-webhook'

for (const [k, v] of Object.entries({ STRIPE_KEY, WEBHOOK_SECRET })) {
  if (!v) {
    const name = k === 'STRIPE_KEY' ? 'STRIPE_SECRET_KEY' : 'STRIPE_WEBHOOK_SECRET'
    console.error(`Missing required env: ${name}`)
    process.exit(1)
  }
}

const piId = (process.argv[2] || '').trim()
if (!piId.startsWith('pi_')) {
  console.error('Usage: node scripts/replay-stripe-webhook.mjs <pi_xxx>')
  process.exit(1)
}

console.log(`Fetching ${piId} from Stripe…`)
const r = await fetch(`https://api.stripe.com/v1/payment_intents/${piId}`, {
  headers: { Authorization: `Bearer ${STRIPE_KEY}` },
})
if (!r.ok) {
  console.error(`Stripe lookup failed (${r.status}): ${await r.text()}`)
  process.exit(1)
}
const pi = await r.json()
console.log(`  status:        ${pi.status}`)
console.log(`  metadata.type: ${pi.metadata?.type ?? '(none)'}`)
console.log(`  metadata.order_id: ${pi.metadata?.order_id ?? '(none)'}`)
console.log(`  latest_charge: ${pi.latest_charge ?? '(none)'}`)

if (pi.status !== 'succeeded') {
  console.error(`PI is not succeeded; refusing to replay.`)
  process.exit(1)
}

// Wrap in the shape Stripe sends to webhooks.
const event = {
  id: `evt_replay_${Date.now()}`,
  object: 'event',
  api_version: '2024-04-10',
  created: Math.floor(Date.now() / 1000),
  type: 'payment_intent.succeeded',
  livemode: pi.livemode,
  data: { object: pi },
  request: { id: null, idempotency_key: null },
  pending_webhooks: 1,
}
const payload = JSON.stringify(event)
const timestamp = Math.floor(Date.now() / 1000)
const signedPayload = `${timestamp}.${payload}`
const signature = createHmac('sha256', WEBHOOK_SECRET)
  .update(signedPayload)
  .digest('hex')
const stripeSignature = `t=${timestamp},v1=${signature}`

console.log(`\nPOSTing to ${TARGET_URL}…`)
const post = await fetch(TARGET_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Stripe-Signature': stripeSignature,
  },
  body: payload,
})
const responseBody = await post.text()
console.log(`  HTTP ${post.status}: ${responseBody}`)

if (post.status === 200) {
  console.log('\nWebhook accepted. The order should advance to `paid`')
  console.log('within ~1 sec, then PDF worker kicks the chain. Re-run')
  console.log('check-order.mjs in 60–120 sec to confirm.')
} else if (post.status === 400) {
  console.error('\nSignature rejected. The STRIPE_WEBHOOK_SECRET you passed')
  console.error('does not match what is deployed in Vercel. Double-check:')
  console.error('  - Vercel Production STRIPE_WEBHOOK_SECRET matches the live whsec_')
  console.error('  - That you redeployed after updating it (npx vercel --prod)')
  console.error('  - That you pasted the value without trailing newline/spaces')
} else {
  console.error('\nUnexpected status — see response body above.')
}

export const config = { maxDuration: 30 }

import { canAdvance } from '../../lib/print/state.js'
import { getStripeSecretKey } from '../../lib/print/stripe-key.js'
import { hasWorkerSecret } from '../_workerAuth.js'

const SUPABASE = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WORKER_SECRET = process.env.PRINT_WORKER_SECRET

async function getOrder(id) {
  const r = await fetch(`${SUPABASE}/rest/v1/print_orders?id=eq.${id}&select=*`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  return (await r.json())[0] ?? null
}

async function patchOrder(id, patch) {
  await fetch(`${SUPABASE}/rest/v1/print_orders?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  })
}

async function stripeRefund(paymentIntentId) {
  const params = new URLSearchParams()
  params.set('payment_intent', paymentIntentId)
  const r = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  if (!r.ok) throw new Error(`stripe refund failed (${r.status}): ${await r.text()}`)
  return await r.json()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!hasWorkerSecret(req)) return res.status(401).json({ error: 'Unauthorized' })
  const { orderId, reason } = req.body || {}
  if (!orderId) return res.status(400).json({ error: 'Missing orderId' })

  const order = await getOrder(orderId)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  if (!order.stripe_payment_intent_id) return res.status(409).json({ error: 'No payment to refund' })
  if (!canAdvance(order.status, 'refunded')) {
    if (order.status !== 'failed') {
      await patchOrder(orderId, { status: 'failed', status_message: reason ?? 'auto-refund triggered' })
    }
  }

  try {
    await stripeRefund(order.stripe_payment_intent_id)
    await patchOrder(orderId, { status: 'refunded', status_message: reason ?? 'auto-refund' })
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) })
  }
}

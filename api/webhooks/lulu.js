// Edge runtime. Verifies HMAC SHA-256 of the body using LULU_WEBHOOK_SECRET.
// Lulu sends header `Lulu-HMAC-SHA256` with hex-encoded HMAC of the raw body.
export const config = { runtime: 'edge' }

import { canAdvance } from '../../lib/print/state.js'

const SUPABASE = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WEBHOOK_SECRET = process.env.LULU_WEBHOOK_SECRET

const STATUS_MAP = {
  CREATED: 'submitted',
  UNPAID: 'submitted',
  PAYMENT_IN_PROGRESS: 'submitted',
  PRODUCTION_READY: 'submitted',
  PRODUCTION_DELAYED: 'submitted',
  IN_PRODUCTION: 'in_production',
  SHIPPED: 'shipped',
  REJECTED: 'failed',
  CANCELED: 'failed',
}

async function verify(body, signatureHex) {
  if (!signatureHex) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
  if (computed.length !== signatureHex.length) return false
  let mismatch = 0
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ signatureHex.charCodeAt(i)
  }
  return mismatch === 0
}

async function findOrderByLuluId(luluId) {
  const r = await fetch(`${SUPABASE}/rest/v1/print_orders?lulu_order_id=eq.${encodeURIComponent(luluId)}&select=id,status`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  const rows = await r.json()
  return rows?.[0] ?? null
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

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }
  const body = await req.text()
  const sig = req.headers.get('lulu-hmac-sha256') || req.headers.get('Lulu-HMAC-SHA256')
  if (!await verify(body, sig)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const event = JSON.parse(body)
  const luluId = String(event?.data?.id ?? '')
  if (!luluId) return new Response(JSON.stringify({ received: true }), { status: 200 })

  const order = await findOrderByLuluId(luluId)
  if (!order) return new Response(JSON.stringify({ received: true, unknown: luluId }), { status: 200 })

  const luluStatus = event?.data?.status?.name
  const targetStatus = STATUS_MAP[luluStatus]
  if (!targetStatus) return new Response(JSON.stringify({ received: true, ignored: luluStatus }), { status: 200 })

  if (!canAdvance(order.status, targetStatus)) {
    return new Response(JSON.stringify({ received: true, ignored_backwards: { from: order.status, to: targetStatus } }), { status: 200 })
  }

  const patch = { status: targetStatus }
  if (luluStatus === 'SHIPPED') {
    patch.lulu_tracking_url = event?.data?.tracking_urls?.[0] ?? null
    patch.lulu_tracking_number = event?.data?.tracking_id ?? null
    patch.lulu_carrier = event?.data?.carrier_name ?? null
  }
  if (targetStatus === 'failed') {
    patch.status_message = `Lulu reported ${luluStatus}`
  }

  await patchOrder(order.id, patch)
  return new Response(JSON.stringify({ received: true, advanced_to: targetStatus }), { status: 200 })
}

// Edge runtime. Verifies the HMAC signature on inbound Lulu webhooks.
//
// Lulu's docs are thin on the exact signing scheme, so we try multiple
// known/plausible combinations:
//   - header: Lulu-HMAC-SHA256 | X-Lulu-HMAC-SHA256 | Lulu-Signature
//   - secret: LULU_WEBHOOK_SECRET (set explicitly) || LULU_CLIENT_SECRET
//             (some providers re-use the API client secret for webhook signing)
//   - encoding: hex || base64
// If none match, we log the full header set + a body prefix so we can see
// what Lulu actually sent and tighten the verifier on the next deploy.
export const config = { runtime: 'edge' }

import { canAdvance } from '../../lib/print/state.js'

const SUPABASE = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WEBHOOK_SECRET = process.env.LULU_WEBHOOK_SECRET
const CLIENT_SECRET = process.env.LULU_CLIENT_SECRET

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

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function bytesToBase64(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function constantTimeEq(a, b) {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

async function hmac(secret, body) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return new Uint8Array(sig)
}

// Tries every plausible combination of header / secret / encoding. Returns
// the matching scheme name on success, or null if none verified.
async function verifyAny(req, body) {
  const headers = ['lulu-hmac-sha256', 'x-lulu-hmac-sha256', 'lulu-signature']
  const secrets = [
    WEBHOOK_SECRET && ['LULU_WEBHOOK_SECRET', WEBHOOK_SECRET],
    CLIENT_SECRET && ['LULU_CLIENT_SECRET', CLIENT_SECRET],
  ].filter(Boolean)

  for (const h of headers) {
    const provided = req.headers.get(h)
    if (!provided) continue
    for (const [secretName, secret] of secrets) {
      const sigBytes = await hmac(secret, body)
      const hex = bytesToHex(sigBytes)
      const b64 = bytesToBase64(sigBytes)
      if (constantTimeEq(hex, provided.trim())) return `${h}:${secretName}:hex`
      if (constantTimeEq(b64, provided.trim())) return `${h}:${secretName}:base64`
    }
  }
  return null
}

// Used when verification fails — captures headers + body prefix to Vercel
// logs so the next time Lulu fires we can see what they actually sent.
function logFailedVerification(req, body) {
  const hdrs = {}
  for (const [k, v] of req.headers.entries()) {
    // Don't log auth bearer tokens or cookies; those aren't from Lulu and
    // could leak third-party state.
    if (/authorization|cookie/i.test(k)) continue
    hdrs[k] = v
  }
  console.warn('[lulu-webhook] signature verification FAILED', {
    headers: hdrs,
    body_prefix: body.slice(0, 400),
  })
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
  const scheme = await verifyAny(req, body)
  if (!scheme) {
    logFailedVerification(req, body)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  // Once we see which scheme works in production logs, narrow this verifier
  // to a single, fast path for security/clarity.
  console.log('[lulu-webhook] verified via', scheme)

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

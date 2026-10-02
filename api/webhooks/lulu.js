// Edge runtime. Verifies the HMAC signature on inbound Lulu webhooks.
//
// Two modes (review §7 item 21):
//   - DEFAULT (LULU_WEBHOOK_SCHEME unset): the original behaviour, so prod
//     print status never breaks — any of 3 headers (Lulu-HMAC-SHA256,
//     X-Lulu-HMAC-SHA256, Lulu-Signature) × 2 secrets (LULU_WEBHOOK_SECRET,
//     LULU_CLIENT_SECRET) × hex|base64. Every verified request logs which
//     scheme matched: "[lulu-webhook] verified via <header>:<SECRET_ENV>:<enc>"
//     (the env var NAME, never a secret or a signature).
//   - PINNED: once the owner has seen that log line, set
//     LULU_WEBHOOK_SCHEME=<header>:<SECRET_ENV>:<hex|base64> (e.g.
//     lulu-hmac-sha256:LULU_CLIENT_SECRET:hex) and only that scheme is
//     accepted. A malformed value refuses every webhook, loudly.
// A failure logs header NAMES and the body length only — never the body
// (shipping PII).
export const config = { runtime: 'edge' }

import { canAdvance } from '../../lib/print/state.js'
import { canMovePrint } from '../../lib/school/writingYear.js'

const SUPABASE = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

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

const HEADERS = new Set(['lulu-hmac-sha256', 'x-lulu-hmac-sha256', 'lulu-signature'])
const SECRET_ENVS = new Set(['LULU_WEBHOOK_SECRET', 'LULU_CLIENT_SECRET'])

/// The pinned scheme from LULU_WEBHOOK_SCHEME: { header, secretEnv,
/// encoding }; undefined when unset (default mode); null when malformed.
/// Exported for tests.
export function pinnedScheme(env = process.env) {
  const raw = env.LULU_WEBHOOK_SCHEME
  if (!raw || !String(raw).trim()) return undefined
  const [header, secretEnv, encoding] = String(raw).trim().split(':')
  if (!HEADERS.has(header?.toLowerCase()) || !SECRET_ENVS.has(secretEnv) || !['hex', 'base64'].includes(encoding)) return null
  return { header: header.toLowerCase(), secretEnv, encoding }
}

/// Every scheme the default mode accepts, in the original order.
function defaultSchemes(env) {
  const out = []
  for (const header of HEADERS) {
    for (const secretEnv of SECRET_ENVS) {
      if (!env[secretEnv]) continue
      for (const encoding of ['hex', 'base64']) out.push({ header, secretEnv, encoding })
    }
  }
  return out
}

/// Returns the matching scheme name ("<header>:<SECRET_ENV>:<enc>") or null.
export async function verifyLuluSignature(req, body, env = process.env) {
  const pinned = pinnedScheme(env)
  if (pinned === null) {
    console.error('[lulu-webhook] LULU_WEBHOOK_SCHEME is malformed — refusing every webhook')
    return null
  }
  const schemes = pinned ? [pinned] : defaultSchemes(env)
  const sigs = new Map()
  for (const s of schemes) {
    const secret = env[s.secretEnv]
    const provided = (req.headers.get(s.header) || '').trim()
    if (!secret || !provided) continue
    if (!sigs.has(s.secretEnv)) sigs.set(s.secretEnv, await hmac(secret, body))
    const sig = sigs.get(s.secretEnv)
    const expected = s.encoding === 'hex' ? bytesToHex(sig) : bytesToBase64(sig)
    if (constantTimeEq(expected, provided)) return `${s.header}:${s.secretEnv}:${s.encoding}`
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
  // Log only the header names present and the body length — never the body
  // itself, which contains shipping PII.
  console.warn('[lulu-webhook] signature verification FAILED', {
    header_names: Object.keys(hdrs),
    body_length: body.length,
  })
}

async function findOrderByLuluId(luluId) {
  const r = await fetch(`${SUPABASE}/rest/v1/print_orders?lulu_order_id=eq.${encodeURIComponent(luluId)}&select=id,status`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  const rows = await r.json()
  return rows?.[0] ?? null
}

// A class print (the "My Writing Year" books, migration 024) is one Lulu
// print job too; its id lives on class_print_requests.
async function findClassPrintByLuluId(luluId) {
  const r = await fetch(`${SUPABASE}/rest/v1/class_print_requests?lulu_print_job_id=eq.${encodeURIComponent(luluId)}&select=id,status`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!r.ok) return null
  const rows = await r.json().catch(() => [])
  return rows?.[0] ?? null
}

async function advanceClassPrint(req, luluId, event) {
  const cp = await findClassPrintByLuluId(luluId)
  if (!cp) return new Response(JSON.stringify({ received: true, unknown: luluId }), { status: 200 })
  const luluStatus = event?.data?.status?.name
  const target = STATUS_MAP[luluStatus]
  const patch = { lulu_status: luluStatus ?? null, updated_at: new Date().toISOString() }
  if (target && canMovePrint(cp.status, target)) {
    patch.status = target
    if (target === 'shipped') {
      patch.shipped_at = new Date().toISOString()
      patch.tracking = {
        url: event?.data?.tracking_urls?.[0] ?? null,
        number: event?.data?.tracking_id ?? null,
        carrier: event?.data?.carrier_name ?? null,
      }
    }
    if (target === 'failed') patch.error = `Lulu reported ${luluStatus}`
  }
  await fetch(`${SUPABASE}/rest/v1/class_print_requests?id=eq.${cp.id}&status=eq.${cp.status}`, {
    method: 'PATCH',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  })
  return new Response(JSON.stringify({ received: true, class_print: cp.id, advanced_to: patch.status ?? null }), { status: 200 })
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
  const scheme = await verifyLuluSignature(req, body)
  if (!scheme) {
    logFailedVerification(req, body)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  // Names only (header, env var name, encoding) — never a secret or the
  // signature. The owner copies this into LULU_WEBHOOK_SCHEME to pin it.
  console.log('[lulu-webhook] verified via', scheme, pinnedScheme() ? '(pinned)' : '(default: set LULU_WEBHOOK_SCHEME to pin)')

  let event
  try { event = JSON.parse(body) } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }
  const luluId = String(event?.data?.id ?? '')
  if (!luluId) return new Response(JSON.stringify({ received: true }), { status: 200 })

  const order = await findOrderByLuluId(luluId)
  if (!order) return advanceClassPrint(req, luluId, event)

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

// APNs, Edge side. APNs only speaks HTTP/2, and Edge `fetch` gives no
// HTTP/2 guarantee (Node's undici fetch is HTTP/1.1 by default), so the
// actual send lives in ONE Node-runtime function, api/notify/apns.js, using
// node:http2 (lib/notify/apnsHttp2.js). Edge callers hand off to it here.
//
// Env: APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8 (the .p8 contents),
// APNS_TOPIC (the app's bundle id), APNS_ENV ('production' | 'sandbox',
// the default for tokens registered without one). Missing any of the first
// four → a logged no-op.
import { signJwtES256, importP8 } from './jwt.js'
import { infoOnce } from './log.js'

const TOKEN_TTL_MS = 50 * 60 * 1000 // valid 60 min; refresh no more than every 20
const TIMEOUT_MS = 10000

export function apnsConfig() {
  const { APNS_KEY_ID: keyId, APNS_TEAM_ID: teamId, APNS_KEY_P8: p8, APNS_TOPIC: topic } = process.env
  if (!keyId || !teamId || !p8 || !topic) return null
  return { keyId, teamId, p8, topic, defaultEnv: process.env.APNS_ENV === 'sandbox' ? 'sandbox' : 'production' }
}

let cached = null // { raw, jwt, at }
export async function apnsJwt() {
  const cfg = apnsConfig()
  if (!cfg) throw new Error('APNs not configured')
  const raw = `${cfg.keyId}|${cfg.teamId}|${cfg.p8}`
  if (cached?.raw === raw && Date.now() - cached.at < TOKEN_TTL_MS) return cached.jwt
  const key = await importP8(cfg.p8)
  const jwt = await signJwtES256({ alg: 'ES256', kid: cfg.keyId }, { iss: cfg.teamId, iat: Math.floor(Date.now() / 1000) }, key)
  cached = { raw, jwt, at: Date.now() }
  return jwt
}

// The Edge → Node hop is signed: x-notify-ts (unix seconds) and
// x-notify-sig = hex HMAC-SHA256(secret, ts + "." + hex sha256(body)).
// The worker refuses anything more than 300 s off, so a captured request
// can't be replayed later or with a different body. The secret is
// NOTIFY_WORKER_SECRET; if unset, a key derived (HMAC of a fixed label)
// from the service-role key, which both sides already hold — the service
// key itself never goes over the wire.
const MAX_SKEW_S = 300
const enc = (s) => new TextEncoder().encode(s)
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function hmacHex(key, message) {
  const k = await globalThis.crypto.subtle.importKey('raw', enc(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await globalThis.crypto.subtle.sign('HMAC', k, enc(message)))
}

export async function workerSecret() {
  if (process.env.NOTIFY_WORKER_SECRET) return process.env.NOTIFY_WORKER_SECRET
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  return key ? hmacHex(key, 'mybooklab:apns-worker:v1') : null
}

async function signature(secret, ts, body) {
  const bodyHash = hex(await globalThis.crypto.subtle.digest('SHA-256', enc(body)))
  return hmacHex(secret, `${ts}.${bodyHash}`)
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export async function signWorkerRequest(body) {
  const secret = await workerSecret()
  if (!secret) return null
  const ts = String(Math.floor(Date.now() / 1000))
  return { 'x-notify-ts': ts, 'x-notify-sig': await signature(secret, ts, body) }
}

export async function verifyWorkerRequest(ts, sig, body) {
  const secret = await workerSecret()
  if (!secret || !/^\d{1,12}$/.test(ts || '') || typeof sig !== 'string') return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_SKEW_S) return false
  return safeEqual(sig, await signature(secret, ts, body))
}

// Where the worker lives. Production → its own domain. A preview (or any
// non-production Vercel deployment) → that deployment's own URL, so a
// preview can never push through production. Off Vercel → PUBLIC_BASE_URL.
function workerBase() {
  const trim = (u) => u.replace(/\/+$/, '')
  if (process.env.VERCEL_ENV === 'production') {
    if (process.env.PUBLIC_BASE_URL) return trim(process.env.PUBLIC_BASE_URL)
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.PUBLIC_BASE_URL) return trim(process.env.PUBLIC_BASE_URL)
  return null
}

/** Never throws. Asks the Node worker to alert every iOS device of userId. */
export async function requestApns({ userId, title, body, url, kind, tag }) {
  if (!apnsConfig()) {
    infoOnce('apns', '[notify] APNs not configured (APNS_KEY_ID/APNS_TEAM_ID/APNS_KEY_P8/APNS_TOPIC); skipping')
    return { ok: false, skipped: true }
  }
  const base = workerBase()
  if (!base) {
    infoOnce('apns-base', '[notify] APNs worker URL unknown (set PUBLIC_BASE_URL); skipping')
    return { ok: false, skipped: true }
  }
  try {
    const payload = JSON.stringify({ userId, title, body, url, kind, tag })
    const headers = await signWorkerRequest(payload)
    if (!headers) {
      infoOnce('apns-secret', '[notify] no NOTIFY_WORKER_SECRET or service key; skipping APNs')
      return { ok: false, skipped: true }
    }
    const res = await fetch(`${base}/api/notify/apns`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: payload,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) console.error('[notify] APNs worker failed:', res.status)
    // The worker answers {sent, removed} (or {skipped} when it has no keys).
    const data = res.ok ? await res.json().catch(() => null) : null
    const sent = Number.isInteger(data?.sent) ? data.sent : 0
    return { ok: res.ok, status: res.status, sent, ...(data?.skipped ? { skipped: true } : {}) }
  } catch (e) {
    console.error('[notify] APNs worker unreachable:', e?.message)
    return { ok: false, status: 0 }
  }
}

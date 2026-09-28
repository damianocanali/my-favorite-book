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

// The Edge → Node hop is authenticated with an HMAC of a fixed label under
// the service-role key: both sides already hold that key, so there is no
// new secret to manage, and the key itself never goes over the wire.
export async function apnsWorkerSecret() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!key) return null
  const k = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', k, new TextEncoder().encode('mybooklab:apns-worker:v1')))
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Production domain (Vercel sets VERCEL_PROJECT_PRODUCTION_URL). Not
// VERCEL_URL: deployment URLs sit behind Vercel's deployment protection.
function workerBase() {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return null
}

/** Never throws. Asks the Node worker to alert every iOS device of userId. */
export async function requestApns({ userId, title, body, url, kind }) {
  if (!apnsConfig()) {
    infoOnce('apns', '[notify] APNs not configured (APNS_KEY_ID/APNS_TEAM_ID/APNS_KEY_P8/APNS_TOPIC); skipping')
    return { ok: false, skipped: true }
  }
  const base = workerBase()
  const secret = await apnsWorkerSecret().catch(() => null)
  if (!base || !secret) {
    infoOnce('apns-base', '[notify] APNs worker URL unknown (set PUBLIC_BASE_URL); skipping')
    return { ok: false, skipped: true }
  }
  try {
    const res = await fetch(`${base}/api/notify/apns`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-notify-secret': secret },
      body: JSON.stringify({ userId, title, body, url, kind }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) console.error('[notify] APNs worker failed:', res.status)
    return { ok: res.ok, status: res.status }
  } catch (e) {
    console.error('[notify] APNs worker unreachable:', e?.message)
    return { ok: false, status: 0 }
  }
}

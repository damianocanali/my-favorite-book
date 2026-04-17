/**
 * Sliding-window rate limiter.
 *
 * Two backends:
 *   1. Upstash Redis REST — enabled when UPSTASH_REDIS_REST_URL and
 *      UPSTASH_REDIS_REST_TOKEN are set. Counters are shared across all
 *      edge/serverless instances, so limits are enforced globally.
 *   2. In-memory Map (fallback) — per-instance only. Under Vercel's
 *      serverless scaling, each cold instance has its own counters, so
 *      a determined attacker can bypass the limit by spraying requests
 *      across regions. Fine for casual abuse protection; do NOT rely on
 *      it for anything billable.
 *
 * The API is synchronous-looking — checkRateLimit returns a plain object.
 * The Upstash path uses fire-and-forget increments so we don't block the
 * request on a network round-trip; we compare the "before increment" count
 * with the limit. The worst case is a single over-budget request slipping
 * through per window, which matches how upstash/ratelimit's sliding window
 * handles it.
 */

const store = new Map() // key -> { count, windowStart }

const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const WINDOW_S = Math.floor(WINDOW_MS / 1000)

const UPSTASH_URL = typeof process !== 'undefined' ? process.env.UPSTASH_REDIS_REST_URL : ''
const UPSTASH_TOKEN = typeof process !== 'undefined' ? process.env.UPSTASH_REDIS_REST_TOKEN : ''
const HAS_UPSTASH = Boolean(UPSTASH_URL && UPSTASH_TOKEN)

// Best-effort Redis call. Returns the previous counter value (before the
// increment) on success, or null when the backend is unavailable — callers
// fall through to the in-memory limiter in that case.
async function redisIncrAndExpire(key) {
  try {
    // Pipeline INCR + EXPIRE in one HTTP round-trip.
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(WINDOW_S), 'NX'],
      ]),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    const incr = Array.isArray(data) ? data[0] : null
    if (!incr || typeof incr.result !== 'number') return null
    return incr.result
  } catch {
    return null
  }
}

/**
 * @param {string} key    - e.g. "story-buddy:1.2.3.4"
 * @param {number} limit  - max requests per hour
 * @returns {{ allowed: boolean, remaining: number }}
 *
 * Kept synchronous for the in-memory path so existing callers don't need
 * to await. The Upstash path fires a background increment and relies on
 * the in-memory counter as a fast local cache, so a burst that arrives
 * before Redis ACKs still gets caught on the same instance.
 */
export function checkRateLimit(key, limit) {
  const now = Date.now()
  const entry = store.get(key)

  let count
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now })
    count = 1
  } else {
    entry.count++
    count = entry.count
  }

  if (HAS_UPSTASH) {
    // Reconcile with the shared counter in the background. If the global
    // count is higher than our local one, promote it so subsequent requests
    // on this instance see reality.
    redisIncrAndExpire(`rl:${key}`).then((globalCount) => {
      if (globalCount && globalCount > (store.get(key)?.count ?? 0)) {
        store.set(key, { count: globalCount, windowStart: now })
      }
    })
  }

  if (count > limit) return { allowed: false, remaining: 0 }
  return { allowed: true, remaining: limit - count }
}

export function getClientIp(req) {
  const forwarded = req.headers.get?.('x-forwarded-for') ?? req.headers['x-forwarded-for']
  return (forwarded ? forwarded.split(',')[0] : '').trim() || 'unknown'
}

// Per-request CORS state. Edge handlers are short-lived and single-threaded,
// so stashing the resolved origin on the request itself avoids a second
// env parse in withCors().
const ORIGIN_KEY = '__mfbAllowedOrigin'

function parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS
  if (!raw) return null // null means "allow any"
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function resolveAllowedOrigin(req) {
  const origin = req.headers.get?.('origin') ?? ''
  const allowed = parseAllowedOrigins()
  // Capacitor native web views use capacitor:// and https://localhost; these
  // are always allowed so the app works on-device regardless of ALLOWED_ORIGINS.
  if (origin.startsWith('capacitor://') || origin === 'https://localhost') return origin
  if (!allowed) return '*'
  if (origin && allowed.includes(origin)) return origin
  return allowed[0] || '*'
}

function buildCorsHeaders(req) {
  const cached = req[ORIGIN_KEY]
  const allowOrigin = cached ?? resolveAllowedOrigin(req)
  if (!cached) req[ORIGIN_KEY] = allowOrigin
  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
  if (allowOrigin !== '*') headers['Vary'] = 'Origin'
  return headers
}

/** Handle CORS preflight — returns a Response if OPTIONS, otherwise null. */
export function handleCors(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(req) })
  }
  return null
}

/**
 * Merge CORS headers into a plain headers object.
 * NOTE: pass the request as the second arg so we can echo back the verified
 * Origin. Older callers that only pass headers still work but will emit "*".
 */
export function withCors(headers = {}, req) {
  const cors = req ? buildCorsHeaders(req) : {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
  return { ...cors, ...headers }
}

/**
 * Simple sliding-window rate limiter using an in-memory Map.
 * Works because Vercel reuses warm Node.js function instances.
 * Counters reset on cold starts — good enough for abuse protection
 * without requiring an external Redis service.
 */

const store = new Map() // key -> { count, windowStart }

const WINDOW_MS = 60 * 60 * 1000 // 1 hour

/**
 * @param {string} key    - e.g. "story-buddy:1.2.3.4"
 * @param {number} limit  - max requests per hour
 * @returns {{ allowed: boolean, remaining: number }}
 */
export function checkRateLimit(key, limit) {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: limit - 1 }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count }
}

export function getClientIp(req) {
  const forwarded = req.headers.get?.('x-forwarded-for') ?? req.headers['x-forwarded-for']
  return (forwarded ? forwarded.split(',')[0] : '').trim() || 'unknown'
}

// Atlas's reference implementation (Node), verbatim from the partner
// contract, plus a minter that signs exactly the way Atlas does. Tests check
// lib/atlas/referral.js (Web Crypto) against these.
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'

export const SECRET = 'a'.repeat(32) + '0123456789abcdef0123456789abcdef' // 64 hex, test only

export function referenceVerify(token, secret, opts = {}) {
  const parts = token.split('.'); if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  let payload; try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) } catch { return null }
  if (!payload?.uid || !payload?.n || payload.p !== 'mybooklab' || !payload.exp) return null
  if (!opts.ignoreExpiry && payload.exp < Math.floor(Date.now() / 1000)) return null
  return payload
}

export const signBody = (body, secret = SECRET) => `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`

export function mint(overrides = {}, secret = SECRET) {
  const iat = Math.floor(Date.now() / 1000)
  const payload = { uid: 'atlas-user-1', p: 'mybooklab', iat, exp: iat + 30 * 86400, n: randomBytes(16).toString('hex'), ...overrides }
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k]
  return { token: signBody(Buffer.from(JSON.stringify(payload)).toString('base64url'), secret), payload }
}

export const config = { runtime: 'edge' }

// POST /api/referral/capture { ref }
// A visitor arrived from Atlas Mind Academy with ?ref=<token>. Verifies the
// token and:
//   * signed in (valid bearer, family account) → attaches it to the account
//     now; no cookie, no code;
//   * signed out → stores the raw token in an httpOnly cookie for
//     /api/referral/attach after sign-up, and returns an 8-character code
//     ({ code: "K7M4-Q2XP" }) the family can type into the iOS app.
// Invalid / expired / feature off → 204, silently: the page never shows an
// error for this. The token is never logged or echoed back.
import { handleCors, withCors, checkRateLimit, hashedClientIp } from '../_rateLimit.js'
import { verifyJwt } from '../_auth.js'
import { sb, sbEnv, isStudent } from '../_school.js'
import { atlasConfig, verifyAtlasReferral, setCookieHeader, formatCode, MAX_AGE_S } from '../../lib/atlas/referral.js'
import { attachReferral, codeForToken } from '../../lib/atlas/store.js'

const CAPTURE_PER_HOUR = 30

const empty = (req) => new Response(null, { status: 204, headers: withCors({}, req) })
const json = (req, status, body, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: withCors({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra }, req) })

export default async function handler(req, ctx) {
  const pre = handleCors(req)
  if (pre) return pre
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' })

  const cfg = atlasConfig()
  if (!cfg.capture || !sbEnv()) return empty(req)

  const ip = await hashedClientIp(req)
  if (!checkRateLimit(`atlas-capture:${ip}`, CAPTURE_PER_HOUR, ctx).allowed) return json(req, 429, { code: 'rate_limited' })

  const body = await req.json().catch(() => null)
  const ref = typeof body?.ref === 'string' ? body.ref.trim() : ''
  const payload = ref ? await verifyAtlasReferral(ref, cfg.secret) : null
  if (!payload) return empty(req)

  // Signed in: attach straight away. A bearer that doesn't verify is
  // treated as signed out (an expired session shouldn't lose the referral).
  if ((req.headers.get('authorization') || '').startsWith('Bearer ')) {
    const auth = await verifyJwt(req)
    if (auth.ok) {
      if (isStudent(auth)) return empty(req) // referrals are for family accounts
      try {
        const r = await attachReferral(sb, auth.userId, ref, payload)
        return json(req, 200, { attached: r.attached })
      } catch (e) {
        console.error('[atlas] capture attach failed', e?.message)
        // fall through to the cookie, so /attach can try again later
      }
    }
  }

  const maxAge = Math.min(MAX_AGE_S, payload.exp - Math.floor(Date.now() / 1000))
  let code = null
  try {
    code = await codeForToken(sb, ref, payload)
  } catch (e) {
    console.error('[atlas] capture code failed', e?.message)
  }
  return json(req, 200, { code: code ? formatCode(code) : null }, { 'Set-Cookie': setCookieHeader(ref, maxAge) })
}

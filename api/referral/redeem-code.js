export const config = { runtime: 'edge' }

// POST /api/referral/redeem-code { code } (auth required)
// The iOS app's way in: the family types the code the web page showed them
// after arriving from Atlas. Single-use, unexpired codes only. Errors are
// deliberately generic — unknown, expired and already-used codes all answer
// `invalid_code`, so the endpoint is no oracle.
//   200 { ok: true }
//   400 { code: 'invalid_code' }
//   409 { code: 'already_referred' }   the account already has a referral that was (being) reported
//   429 { code: 'rate_limited' }       10/hour per account, 30/hour per IP
//   503 { code: 'unavailable' }
// Class (student) accounts → 403.
import { handleCors, withCors, checkRateLimit, hashedClientIp } from '../_rateLimit.js'
import { verifyJwt } from '../_auth.js'
import { sb, sbEnv, rejectStudent } from '../_school.js'
import { atlasConfig, verifyAtlasReferral, normalizeCode, noncePrefix } from '../../lib/atlas/referral.js'
import { attachReferral, getReferral, isLocked, findLiveCode, claimCode, releaseCode } from '../../lib/atlas/store.js'

export const PER_USER_HOUR = 10
export const PER_IP_HOUR = 30

const json = (req, status, body) =>
  new Response(JSON.stringify(body), { status, headers: withCors({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, req) })
const invalid = (req) => json(req, 400, { error: 'That code did not work.', code: 'invalid_code' })

export default async function handler(req, ctx) {
  const pre = handleCors(req)
  if (pre) return pre
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' })

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response
  const blocked = rejectStudent(auth, req)
  if (blocked) return blocked

  const cfg = atlasConfig()
  if (!cfg.capture || !sbEnv()) return json(req, 503, { code: 'unavailable' })

  const ip = await hashedClientIp(req)
  const perUser = checkRateLimit(`atlas-redeem:u:${auth.userId}`, PER_USER_HOUR, ctx)
  const perIp = checkRateLimit(`atlas-redeem:ip:${ip}`, PER_IP_HOUR, ctx)
  if (!perUser.allowed || !perIp.allowed) return json(req, 429, { code: 'rate_limited' })

  const body = await req.json().catch(() => null)
  const code = normalizeCode(body?.code)
  if (!code) return invalid(req)

  let claimed = false
  try {
    const existing = await getReferral(sb, auth.userId)
    if (isLocked(existing)) return json(req, 409, { code: 'already_referred' })

    const row = await findLiveCode(sb, code)
    if (!row) return invalid(req)
    const payload = await verifyAtlasReferral(row.token, cfg.secret)
    if (!payload) return invalid(req)

    claimed = await claimCode(sb, code, auth.userId)
    if (!claimed) return invalid(req) // someone else just used it

    const r = await attachReferral(sb, auth.userId, row.token, payload)
    if (r.attached || r.reason === 'older') return json(req, 200, { ok: true })
    if (r.reason === 'locked') {
      await releaseCode(sb, code, auth.userId)
      return json(req, 409, { code: 'already_referred' })
    }
    // nonce_in_use: this token already belongs to another account.
    console.warn('[atlas] code for a token another account holds', `nonce=${noncePrefix(payload.n)}`)
    return invalid(req)
  } catch (e) {
    console.error('[atlas] redeem-code failed', e?.message)
    if (claimed) await releaseCode(sb, code, auth.userId)
    return json(req, 503, { code: 'unavailable' })
  }
}

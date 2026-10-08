export const config = { runtime: 'edge' }

// POST /api/referral/attach (auth required)
// Called once by the web app after a sign-in / sign-up. Reads the
// mbl_atlas_ref cookie set by /api/referral/capture, re-verifies it, attaches
// it to the caller's account (lib/atlas/store.js attach rule) and clears the
// cookie. No cookie → 204. Class (student) accounts → 403.
import { handleCors, withCors, checkRateLimit } from '../_rateLimit.js'
import { verifyJwt } from '../_auth.js'
import { sb, sbEnv, rejectStudent } from '../_school.js'
import { atlasConfig, verifyAtlasReferral, readCookie, clearCookieHeader } from '../../lib/atlas/referral.js'
import { attachReferral } from '../../lib/atlas/store.js'

function json(req, status, body, extra = {}) {
  const base = body === null ? { 'Cache-Control': 'no-store' } : { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  const headers = withCors({ ...base, ...extra }, req)
  return new Response(body === null ? null : JSON.stringify(body), { status, headers })
}

export default async function handler(req, ctx) {
  const pre = handleCors(req)
  if (pre) return pre
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' })

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response
  const blocked = rejectStudent(auth, req)
  if (blocked) return blocked

  const token = readCookie(req)
  if (!token) return json(req, 204, null)
  const cfg = atlasConfig()
  if (!cfg.capture || !sbEnv()) return json(req, 204, null)
  if (!checkRateLimit(`atlas-attach:${auth.userId}`, 20, ctx).allowed) return json(req, 429, { code: 'rate_limited' })

  const clear = { 'Set-Cookie': clearCookieHeader() }
  const payload = await verifyAtlasReferral(token, cfg.secret)
  if (!payload) return json(req, 204, null, clear)
  try {
    const r = await attachReferral(sb, auth.userId, token, payload)
    return json(req, 200, { attached: r.attached }, clear)
  } catch (e) {
    console.error('[atlas] attach failed', e?.message)
    return json(req, 503, { code: 'unavailable' }) // keep the cookie: the next sign-in retries
  }
}

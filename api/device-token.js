export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'
import { sb, sbEnv, json, rejectStudent } from './_school.js'

// APNs device tokens are hex (32 bytes today; Apple says don't assume the
// length, so allow up to 100 bytes).
const TOKEN_RE = /^[0-9a-f]{64,200}$/i
const ENVS = ['production', 'sandbox']

// The iOS app registers (POST) or forgets (DELETE) its APNs token for the
// signed-in grown-up. Class (student) accounts never get pushes.
export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    }
    if (!sbEnv()) return json(req, 503, { error: 'Not configured', code: 'not_configured' })
    const auth = await verifyJwt(req)
    if (!auth.ok) return auth.response
    const student = rejectStudent(auth, req)
    if (student) return student
    if (!checkRateLimit(`device-token:${auth.userId}`, 60).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }

    const body = (await req.json().catch(() => null)) ?? {}
    const token = typeof body.token === 'string' ? body.token.toLowerCase() : ''
    if (!TOKEN_RE.test(token)) return json(req, 400, { error: 'Invalid token', code: 'bad_request' })

    if (req.method === 'DELETE') {
      const res = await sb(`/rest/v1/device_tokens?token=eq.${token}&user_id=eq.${encodeURIComponent(auth.userId)}`, { method: 'DELETE' })
      if (!res.ok) return json(req, 502, { error: 'Could not update', code: 'upstream' })
      return json(req, 200, { ok: true })
    }

    const env = body.env ?? (process.env.APNS_ENV === 'sandbox' ? 'sandbox' : 'production')
    if (!ENVS.includes(env)) return json(req, 400, { error: 'Invalid env', code: 'bad_request' })
    // A device (token) belongs to whoever signed in on it last, e.g. a
    // school iPad handed to another teacher. If another user holds it, their
    // row is DELETED first and a fresh row created for the caller — never
    // re-pointed in place — so the upsert below can only ever merge into the
    // caller's own row. If that delete fails, nothing is written.
    const release = await sb(`/rest/v1/device_tokens?token=eq.${token}&user_id=neq.${encodeURIComponent(auth.userId)}`, { method: 'DELETE' })
    if (!release.ok) return json(req, 502, { error: 'Could not save', code: 'upstream' })
    const res = await sb('/rest/v1/device_tokens?on_conflict=token', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: auth.userId, token, platform: 'ios', env }),
    })
    if (!res.ok) return json(req, 502, { error: 'Could not save', code: 'upstream' })
    return json(req, 200, { ok: true })
  } catch (e) {
    console.error('device-token: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

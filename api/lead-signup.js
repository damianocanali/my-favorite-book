export const config = { runtime: 'edge' }

// POST /api/lead-signup { email, role, adult, website }
// A parent or teacher asks for the free worksheets by email. Fires the
// Resend event `lead.signup`, which starts the "Lead nurture - free
// worksheets" automation (it adds the contact to the leads segment and
// sends the four-email series). Nothing is stored on our side.
//
// Adults only: the form is for parents and teachers, and the request must
// carry adult:true (the form's required checkbox). `website` is a honeypot:
// a filled value is answered 200 and dropped. The address is never logged.
//
// Env: RESEND_API_KEY (must be a full-access key; a sending-only key cannot
// send events). Missing → 503.
import { handleCors, withCors, checkRateLimit, hashedClientIp } from './_rateLimit.js'

const SIGNUPS_PER_HOUR = 5
const TIMEOUT_MS = 8000
const EVENT = 'lead.signup'
const ROLES = new Set(['parent', 'teacher'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function json(req, status, body) {
  const headers = withCors({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, req)
  return new Response(JSON.stringify(body), { status, headers })
}

export default async function handler(req, ctx) {
  const pre = handleCors(req)
  if (pre) return pre
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' })

  const ip = await hashedClientIp(req)
  if (!checkRateLimit(`lead-signup:${ip}`, SIGNUPS_PER_HOUR, ctx).allowed) {
    return json(req, 429, { code: 'rate_limited' })
  }

  const body = await req.json().catch(() => null)
  if (typeof body?.website === 'string' && body.website.trim()) return json(req, 200, { ok: true })

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = ROLES.has(body?.role) ? body.role : 'parent'
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return json(req, 400, { code: 'invalid_email' })
  if (body?.adult !== true) return json(req, 400, { code: 'adult_required' })

  const key = process.env.RESEND_API_KEY
  if (!key) return json(req, 503, { code: 'unavailable' })

  try {
    const res = await fetch('https://api.resend.com/events/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: EVENT, email, payload: { role, source: 'worksheets' } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error('[lead-signup] event rejected:', res.status)
      return json(req, 502, { code: 'unavailable' })
    }
  } catch (e) {
    console.error('[lead-signup] event failed:', e?.name)
    return json(req, 502, { code: 'unavailable' })
  }
  return json(req, 200, { ok: true })
}

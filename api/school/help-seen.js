export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireTeacher, sb, json, isUuid } from '../_school.js'

function embeddedOwner(row) {
  const c = row?.classrooms
  return Array.isArray(c) ? c[0]?.owner_user_id : c?.owner_user_id
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const t = await requireTeacher(req)
    if (!t.ok) return t.response
    if (!checkRateLimit(`school-help-seen:${t.auth.userId}`, 300).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }

    const body = await req.json().catch(() => ({}))
    // Same "doesn't exist" answer for a bad id, a foreign class's help
    // request, and a missing one — ids must not be probeable.
    if (!isUuid(body.id)) return json(req, 404, { error: 'Not found', code: 'not_found' })

    // Fails closed: a broken ownership lookup must never read as "not
    // found" — that would silently let a transient DB hiccup masquerade as
    // a stale/foreign id instead of the outage it actually is.
    const res = await sb(`/rest/v1/class_help_requests?id=eq.${body.id}&select=id,classrooms(owner_user_id)`)
    if (!res.ok) throw new Error(`help lookup failed: ${res.status}`)
    const rows = await res.json()
    const row = rows?.[0]
    if (!row || embeddedOwner(row) !== t.auth.userId) return json(req, 404, { error: 'Not found', code: 'not_found' })

    const patchRes = await sb(`/rest/v1/class_help_requests?id=eq.${body.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ seen_at: new Date().toISOString(), seen_by: t.auth.userId }),
    })
    if (!patchRes.ok) return json(req, 502, { error: 'Could not update', code: 'upstream' })
    return json(req, 200, { ok: true })
  } catch (e) {
    console.error('school/help-seen: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

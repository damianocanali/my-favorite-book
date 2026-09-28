export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireTeacher, sb, json } from '../_school.js'

export const DEFAULT_SETTINGS = { summary: 'daily', push_urgent: true, email_urgent: true }
const SUMMARY = ['daily', 'weekly', 'off']
const FIELDS = 'summary,push_urgent,email_urgent'

const pick = (row) => ({
  summary: SUMMARY.includes(row?.summary) ? row.summary : DEFAULT_SETTINGS.summary,
  push_urgent: typeof row?.push_urgent === 'boolean' ? row.push_urgent : DEFAULT_SETTINGS.push_urgent,
  email_urgent: typeof row?.email_urgent === 'boolean' ? row.email_urgent : DEFAULT_SETTINGS.email_urgent,
})

// A teacher's own notification settings. No row means the defaults; PUT
// upserts only the fields sent, keyed by the session's user id.
export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'GET' && req.method !== 'PUT') {
      return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    }
    const t = await requireTeacher(req)
    if (!t.ok) return t.response
    const me = t.auth.userId

    if (req.method === 'GET') {
      if (!checkRateLimit(`school-notification-settings-read:${me}`, 300).allowed) {
        return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
      }
      const res = await sb(`/rest/v1/teacher_settings?user_id=eq.${encodeURIComponent(me)}&select=${FIELDS}`)
      if (!res.ok) throw new Error(`teacher_settings read failed: ${res.status}`)
      const rows = await res.json()
      return json(req, 200, pick(Array.isArray(rows) ? rows[0] : null))
    }

    if (!checkRateLimit(`school-notification-settings:${me}`, 120).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    const body = (await req.json().catch(() => null)) ?? {}
    const patch = {}
    if (body.summary !== undefined) {
      if (!SUMMARY.includes(body.summary)) return json(req, 400, { error: 'Invalid summary', code: 'bad_request' })
      patch.summary = body.summary
    }
    for (const k of ['push_urgent', 'email_urgent']) {
      if (body[k] === undefined) continue
      if (typeof body[k] !== 'boolean') return json(req, 400, { error: `Invalid ${k}`, code: 'bad_request' })
      patch[k] = body[k]
    }
    if (!Object.keys(patch).length) return json(req, 400, { error: 'Nothing to change', code: 'bad_request' })

    const res = await sb(`/rest/v1/teacher_settings?on_conflict=user_id&select=${FIELDS}`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ user_id: me, ...patch, updated_at: new Date().toISOString() }),
    })
    if (!res.ok) return json(req, 502, { error: 'Could not save', code: 'upstream' })
    const rows = await res.json().catch(() => [])
    return json(req, 200, pick(Array.isArray(rows) ? rows[0] : null))
  } catch (e) {
    console.error('school/notification-settings: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

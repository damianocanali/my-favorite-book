export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireStudent, sb, json, isUuid } from '../_school.js'
import { isWithinSchoolHours } from '../../lib/school/hours.js'

const DEDUP_MS = 15 * 60 * 1000
const KINDS = ['book', 'grownup']

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const s = await requireStudent(req)
    if (!s.ok) return s.response
    const { student, classroom } = s

    if (req.method === 'GET') {
      const id = new URL(req.url).searchParams.get('id')
      if (!isUuid(id)) return json(req, 400, { error: 'Invalid id', code: 'bad_request' })
      // Fails CLOSED: a lookup error must never be read as "not found" — that
      // would let a transient DB hiccup quietly tell a child no one is coming.
      const res = await sb(`/rest/v1/class_help_requests?id=eq.${id}&student_id=eq.${student.id}&select=seen_at`)
      if (!res.ok) throw new Error(`class_help_requests lookup failed: ${res.status}`)
      const rows = await res.json().catch(() => [])
      if (!rows?.[0]) return json(req, 404, { error: 'Not found', code: 'not_found' })
      const seen = !!rows[0].seen_at
      let teacherName = null
      if (seen && classroom.owner_user_id) {
        const t = await sb(`/auth/v1/admin/users/${classroom.owner_user_id}`).then((r) => r.json()).catch(() => null)
        teacherName = t?.user_metadata?.display_name ?? null
      }
      return json(req, 200, { seen, teacher_name: teacherName })
    }

    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    if (!checkRateLimit(`school-help:${student.id}`, 20).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    const body = (await req.json().catch(() => null)) ?? {}
    const { kind } = body
    if (!KINDS.includes(kind)) return json(req, 400, { error: 'Invalid kind', code: 'bad_request' })

    const inHours = isWithinSchoolHours(classroom.school_hours, classroom.timezone)
    const since = new Date(Date.now() - DEDUP_MS).toISOString()
    // Same fail-closed rule: a DB error here must never be read as "no open
    // request", or a child tapping through an outage gets a duplicate alert
    // storm once the DB recovers instead of one deduped ask.
    const dedupRes = await sb(
      `/rest/v1/class_help_requests?student_id=eq.${student.id}&kind=eq.${kind}&seen_at=is.null` +
        `&updated_at=gte.${encodeURIComponent(since)}&select=id,asks&order=updated_at.desc&limit=1`
    )
    if (!dedupRes.ok) throw new Error(`dedup lookup failed: ${dedupRes.status}`)
    const open = await dedupRes.json().catch(() => [])

    // A child tapping ten times is one ask, not ten alerts.
    if (open?.[0]) {
      const patchRes = await sb(`/rest/v1/class_help_requests?id=eq.${open[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify({ asks: open[0].asks + 1, updated_at: new Date().toISOString() }),
      })
      if (!patchRes.ok) return json(req, 502, { error: 'Could not send', code: 'upstream' })
      return json(req, 200, { id: open[0].id, in_hours: inHours })
    }

    const res = await sb('/rest/v1/class_help_requests', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ classroom_id: student.classroom_id, student_id: student.id, kind, in_hours: inHours }),
    })
    if (!res.ok) return json(req, 502, { error: 'Could not send', code: 'upstream' })
    const [row] = await res.json()
    return json(req, 200, { id: row.id, in_hours: inHours })
  } catch (e) {
    console.error('school/help: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

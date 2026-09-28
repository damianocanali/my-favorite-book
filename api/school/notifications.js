export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireTeacher, sb, json, isUuid } from '../_school.js'

const LIMIT = 50
const MAX_IDS = 100

// Bell rows store the student's id, never their name: the name is looked up
// here, at read time, and only among students in the caller's own classes.
// A student who has since been removed (or a lookup hiccup) reads as null,
// which the UI shows as "a student" — the bell still works.
async function nameStudents(notifications, me) {
  const ids = [...new Set(notifications.map((n) => n?.payload?.student_id).filter(isUuid))]
  for (const n of notifications) {
    if (n?.payload?.student_id !== undefined) n.payload = { ...n.payload, student_name: null }
  }
  if (!ids.length) return
  try {
    const res = await sb(
      `/rest/v1/class_students?id=in.(${ids.join(',')})` +
        `&select=id,display_name,classrooms!inner(owner_user_id)&classrooms.owner_user_id=eq.${me}`
    )
    if (!res.ok) throw new Error(`class_students ${res.status}`)
    const names = new Map(((await res.json()) || []).map((r) => [r.id, r.display_name]))
    for (const n of notifications) {
      const id = n?.payload?.student_id
      if (id) n.payload.student_name = names.get(id) ?? null
    }
  } catch (e) {
    console.error('school/notifications: student names unavailable', e?.message)
  }
}

// The teacher's bell (spec §12.4): latest 50 + unread count, and "mark
// read". Every query is filtered by the caller's own auth id, so a
// notification id from someone else's bell simply matches nothing.
export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    }
    const t = await requireTeacher(req)
    if (!t.ok) return t.response
    const me = encodeURIComponent(t.auth.userId)
    if (!checkRateLimit(`school-notifications:${t.auth.userId}`, 600).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }

    if (req.method === 'GET') {
      const [listRes, countRes] = await Promise.all([
        sb(
          `/rest/v1/teacher_notifications?teacher_user_id=eq.${me}` +
            `&select=id,classroom_id,kind,payload,created_at,read_at&order=created_at.desc&limit=${LIMIT}`
        ),
        sb(`/rest/v1/teacher_notifications?teacher_user_id=eq.${me}&read_at=is.null&select=id&limit=1`, {
          headers: { Prefer: 'count=exact' },
        }),
      ])
      if (!listRes.ok || !countRes.ok) throw new Error(`notifications read failed: ${listRes.status}/${countRes.status}`)
      const list = await listRes.json()
      const notifications = Array.isArray(list) ? list : []
      await nameStudents(notifications, me)
      // PostgREST puts the exact count in Content-Range: "0-0/<total>".
      const total = Number((countRes.headers.get('content-range') || '').split('/')[1])
      return json(req, 200, {
        notifications,
        unread: Number.isFinite(total) ? total : 0,
      })
    }

    const body = (await req.json().catch(() => null)) ?? {}
    if (body.action !== 'read') return json(req, 400, { error: 'Invalid action', code: 'bad_request' })
    let filter = ''
    if (body.ids !== undefined) {
      if (!Array.isArray(body.ids) || body.ids.length > MAX_IDS || !body.ids.every(isUuid)) {
        return json(req, 400, { error: 'Invalid ids', code: 'bad_request' })
      }
      if (!body.ids.length) return json(req, 200, { ok: true })
      filter = `&id=in.(${body.ids.join(',')})`
    }
    const res = await sb(`/rest/v1/teacher_notifications?teacher_user_id=eq.${me}&read_at=is.null${filter}`, {
      method: 'PATCH',
      body: JSON.stringify({ read_at: new Date().toISOString() }),
    })
    if (!res.ok) return json(req, 502, { error: 'Could not update', code: 'upstream' })
    return json(req, 200, { ok: true })
  } catch (e) {
    console.error('school/notifications: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

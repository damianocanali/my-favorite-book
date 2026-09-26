// Shared guards for the schools feature. Every school table is closed to the
// client keys (migration 018), so all access is here, with the service role.
import { verifyJwt } from './_auth.js'
import { withCors } from './_rateLimit.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s) => typeof s === 'string' && UUID_RE.test(s)

export function sbEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  return url && key ? { url, key } : null
}

export function sb(path, init = {}) {
  const { url, key } = sbEnv()
  return fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
}

export function json(req, status, body) {
  return new Response(JSON.stringify(body), { status, headers: withCors({ 'Content-Type': 'application/json' }, req) })
}

export const fail = (req, status, code, error) => ({ ok: false, response: json(req, status, { error, code }) })

export const isStudent = (auth) => auth?.appMetadata?.role === 'student'

export function rejectStudent(auth, req) {
  return isStudent(auth)
    ? json(req, 403, { error: 'Not available for class accounts', code: 'student_forbidden' })
    : null
}

export async function requireTeacher(req) {
  if (!sbEnv()) return fail(req, 503, 'not_configured', 'Schools feature not configured')
  const auth = await verifyJwt(req)
  if (!auth.ok) return { ok: false, response: auth.response }
  if (isStudent(auth)) return fail(req, 403, 'student_forbidden', 'Not available for class accounts')
  return { ok: true, auth }
}

export async function requireClassOwner(req, classroomId) {
  const t = await requireTeacher(req)
  if (!t.ok) return t
  if (!isUuid(classroomId)) return fail(req, 400, 'bad_request', 'Invalid class id')
  try {
    const res = await sb(
      `/rest/v1/classrooms?id=eq.${classroomId}&owner_user_id=eq.${encodeURIComponent(t.auth.userId)}` +
        `&select=id,code,name,locale,sign_in_open,timezone,school_hours,archived_at`
    )
    if (!res.ok) return fail(req, 503, 'upstream', 'Service unavailable, try again')
    const rows = await res.json().catch(() => [])
    // Same answer for "missing" and "someone else's": ids must not be probeable.
    if (!Array.isArray(rows) || !rows.length) return fail(req, 404, 'class_not_found', 'Class not found')
    return { ok: true, auth: t.auth, classroom: rows[0] }
  } catch (e) {
    return fail(req, 503, 'upstream', 'Service unavailable, try again')
  }
}

export async function requireStudent(req) {
  if (!sbEnv()) return fail(req, 503, 'not_configured', 'Schools feature not configured')
  const auth = await verifyJwt(req)
  if (!auth.ok) return { ok: false, response: auth.response }
  if (!isStudent(auth)) return fail(req, 403, 'not_a_student', 'Class accounts only')
  try {
    const res = await sb(
      `/rest/v1/class_students?auth_user_id=eq.${encodeURIComponent(auth.userId)}&status=eq.active` +
        `&select=id,classroom_id,display_name,classrooms(id,name,timezone,school_hours,owner_user_id)`
    )
    if (!res.ok) return fail(req, 503, 'upstream', 'Service unavailable, try again')
    const rows = await res.json().catch(() => [])
    if (!Array.isArray(rows) || !rows.length) return fail(req, 403, 'student_removed', 'Ask your teacher')
    const { classrooms: classroom, ...student } = rows[0]
    return { ok: true, auth, student, classroom }
  } catch (e) {
    return fail(req, 503, 'upstream', 'Service unavailable, try again')
  }
}

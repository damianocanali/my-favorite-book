// Shared guards for the schools feature. Every school table is closed to the
// client keys (migration 018), so all access is here, with the service role.
import { verifyJwt } from './_auth.js'
import { withCors } from './_rateLimit.js'
import { STUDENT_DAILY_IMAGES } from '../lib/school/license.js'

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

// Migration 023's columns on an assignments read. A deploy that lands
// before the migration must not 503 every assignment list (book ones
// included): when PostgREST says the column doesn't exist (42703), the read
// is retried once without them — every row then reads as a book.
export const WORKSHEET_COLS = ',kind,worksheet'
export async function sbAssignments(path, init = {}) {
  const res = await sb(path, init)
  if (res.ok || res.status !== 400 || !path.includes(WORKSHEET_COLS)) return res
  const body = await res.clone().json().catch(() => null)
  if (body?.code !== '42703') return res
  return sb(path.replace(WORKSHEET_COLS, ''), init)
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

// Atomically spends one image from a student's class allowance via
// school_bump_image. Shared by enforceStudentImageCap (the student id comes
// from the CALLER's own JWT — a student spending their own allowance) and
// api/school/student-avatar.js (the id is an explicit param — a teacher
// spending a specific student's allowance on their behalf), so the two
// callers can never drift on the RPC call, the fail-closed behaviour, or
// the error copy. Returns a Response to return immediately (503 on RPC
// failure, 429 once the allowance is used up), or null to continue.
export async function bumpStudentImage(studentId, req) {
  try {
    const res = await sb('/rest/v1/rpc/school_bump_image', {
      method: 'POST',
      body: JSON.stringify({ p_student_id: studentId, p_daily_limit: STUDENT_DAILY_IMAGES }),
    })
    if (!res.ok) return json(req, 503, { error: 'Try again in a minute', code: 'upstream' })
    const allowed = await res.json()
    if (allowed === false) {
      return json(req, 429, { error: "That's all the pictures for today. Ask your teacher.", code: 'class_image_limit' })
    }
    return null
  } catch {
    return json(req, 503, { error: 'Try again in a minute', code: 'upstream' })
  }
}

// Students draw AI images from their class's allowance (owner decision D5),
// not the consumer daily cap. Fails CLOSED: an unmetered class is a bill.
export async function enforceStudentImageCap(auth, req) {
  if (!isStudent(auth)) return null
  const studentId = auth.appMetadata?.student_id
  if (!studentId) return json(req, 403, { error: 'Not available for class accounts', code: 'student_forbidden' })
  return bumpStudentImage(studentId, req)
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
        `&select=id,classroom_id,display_name,classrooms(id,name,timezone,school_hours,owner_user_id,archived_at,locale)`
    )
    if (!res.ok) return fail(req, 503, 'upstream', 'Service unavailable, try again')
    const rows = await res.json().catch(() => [])
    if (!Array.isArray(rows) || !rows.length) return fail(req, 403, 'student_removed', 'Ask your teacher')
    const { classrooms: classroom, ...student } = rows[0]
    // An archived class gets nothing — same "ask your teacher" framing as a
    // resting (unpaid) license, never "your class was archived".
    if (classroom?.archived_at) return fail(req, 403, 'class_resting', 'Ask your teacher')
    return { ok: true, auth, student, classroom }
  } catch (e) {
    return fail(req, 503, 'upstream', 'Service unavailable, try again')
  }
}

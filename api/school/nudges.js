export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireClassOwner, requireStudent, sb, json, isUuid } from '../_school.js'
import { raisedName } from '../../lib/school/assignments.js'
import {
  isOpenAssignment, NUDGE_PRESETS, NUDGE_MAX_STUDENTS, NUDGE_DAILY_CAP, NUDGE_MESSAGE_MAX, cleanNudgeMessage, teacherDisplayName,
} from '../../lib/school/nudges.js'

// How far back the teacher's "Sent" / "Seen ✓" view looks. Older nudges
// don't change what a teacher does today.
const TEACHER_LOOKBACK_DAYS = 30
const TEACHER_LOOKBACK_MS = TEACHER_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
// PostgREST caps every response at max_rows (1000 on Supabase), silently.
// The window can hold more (35 children × 3 a day × 30 days), so the read
// is paged with a stable order, like api/cron/teacher-summary.js.
const PAGE = 1000

const bad = (req, error) => json(req, 400, { error, code: 'bad_request' })

// Every read fails CLOSED: a non-2xx throws, and the handler's try/catch
// turns it into 503 upstream — never "no nudge" or "nobody in the class".
async function read(path, what) {
  const res = await sb(path)
  if (!res.ok) throw new Error(`${what} lookup failed: ${res.status}`)
  return res.json()
}

// Every page of a read, until a short page. `path` must not carry its own
// order/limit/offset; `order` must be total (ties broken by id).
async function readAll(path, order, what) {
  const all = []
  for (let offset = 0; ; offset += PAGE) {
    const rows = await read(`${path}&order=${order}&limit=${PAGE}&offset=${offset}`, what)
    all.push(...rows)
    if (rows.length < PAGE) return all
  }
}

const limited = (req, key, n) =>
  checkRateLimit(key, n).allowed ? null : json(req, 429, { error: 'Too many requests', code: 'rate_limited' })

// ── Teacher: send ───────────────────────────────────────────────────────
async function send(req, o, body) {
  const classroomId = o.classroom.id
  // An archived class is read-only (the RPC re-checks).
  if (o.classroom.archived_at) return json(req, 409, { error: 'This class is archived', code: 'class_archived' })
  if (!Array.isArray(body.studentIds) || body.studentIds.length < 1) return bad(req, 'Pick at least one student')
  if (body.studentIds.length > NUDGE_MAX_STUDENTS) return bad(req, `At most ${NUDGE_MAX_STUDENTS} students at a time`)
  if (!body.studentIds.every(isUuid)) return bad(req, 'Invalid student id')
  const studentIds = [...new Set(body.studentIds.map((s) => s.toLowerCase()))]

  const hasPreset = body.preset !== undefined && body.preset !== null
  const hasMessage = body.message !== undefined && body.message !== null
  if (hasPreset === hasMessage) return bad(req, 'Send a preset or a message')
  let preset = null
  let message = null
  if (hasPreset) {
    if (!NUDGE_PRESETS.includes(body.preset)) return bad(req, 'Invalid preset')
    preset = body.preset
  } else {
    message = cleanNudgeMessage(body.message)
    if (!message) return bad(req, `Message must be 1-${NUDGE_MESSAGE_MAX} characters`)
  }

  let assignmentId = null
  if (body.assignmentId !== undefined && body.assignmentId !== null) {
    if (!isUuid(body.assignmentId)) return bad(req, 'Invalid assignment id')
    assignmentId = body.assignmentId
  }
  if (preset === 'hand_in' && !assignmentId) return bad(req, 'Pick the assignment to hand in')

  if (assignmentId) {
    const [a] = await read(
      `/rest/v1/assignments?id=eq.${assignmentId}&classroom_id=eq.${classroomId}&status=eq.published&select=id,due_at,allow_late`,
      'assignment'
    )
    // Open = published and not past a due date that refuses late work.
    if (!a || !isOpenAssignment(a)) return json(req, 404, { error: 'Assignment not found', code: 'assignment_not_found' })
  }

  // Only this class's ACTIVE students; anyone else is skipped as not_found
  // (same answer for "removed" and "someone else's": ids aren't probeable).
  const rows = await read(
    `/rest/v1/class_students?classroom_id=eq.${classroomId}&status=eq.active&id=in.(${studentIds.join(',')})&select=id`,
    'class_students'
  )
  const inClass = new Set(rows.map((r) => r.id))
  // "Don't forget to hand in" never goes to a child who already has.
  const handedIn = new Set()
  if (preset === 'hand_in' && inClass.size) {
    const subs = await read(
      `/rest/v1/class_submissions?assignment_id=eq.${assignmentId}&student_id=in.(${[...inClass].join(',')})&select=student_id`,
      'class_submissions'
    )
    for (const s of subs) handedIn.add(s.student_id)
  }
  const teacherName = teacherDisplayName(o.auth.userMetadata)

  const sent = []
  const skipped = []
  // One RPC per child: each one locks that child's row, so caps hold even
  // if the teacher double-taps or has two tabs open.
  const results = await Promise.all(
    studentIds.map(async (studentId) => {
      if (!inClass.has(studentId)) return { studentId, code: 'not_found' }
      if (handedIn.has(studentId)) return { studentId, code: 'handed_in' }
      try {
        const res = await sb('/rest/v1/rpc/school_send_nudge', {
          method: 'POST',
          body: JSON.stringify({
            p_classroom_id: classroomId, p_student_id: studentId, p_teacher_user_id: o.auth.userId,
            p_teacher_name: teacherName, p_preset: preset, p_message: message, p_assignment_id: assignmentId,
            p_daily_cap: NUDGE_DAILY_CAP,
          }),
        })
        if (res.ok) {
          const row = await res.json()
          return { studentId, id: row?.id ?? null }
        }
        const name = await raisedName(res)
        if (name === 'daily_cap') return { studentId, code: 'daily_cap' }
        if (name === 'student_not_found') return { studentId, code: 'not_found' }
        if (name === 'assignment_not_found') return { studentId, code: 'assignment_not_found' }
        if (name === 'handed_in') return { studentId, code: 'handed_in' }
        if (name === 'class_archived') return { studentId, code: 'class_archived' }
        console.error('school/nudges: send failed', res.status)
        return { studentId, code: 'upstream' }
      } catch (e) {
        console.error('school/nudges: send threw', e?.message)
        return { studentId, code: 'upstream' }
      }
    })
  )
  for (const r of results) {
    if (r.code) skipped.push({ student_id: r.studentId, code: r.code })
    else sent.push({ student_id: r.studentId, id: r.id })
  }
  // Nothing went out and at least one failure was the database: say so,
  // rather than a 200 that looks like every child was simply skipped.
  if (!sent.length && skipped.some((s) => s.code === 'upstream')) {
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
  return json(req, 200, { sent, skipped })
}

// ── Teacher: latest nudge per child ─────────────────────────────────────
async function teacherLatest(req, classroomId) {
  const since = new Date(Date.now() - TEACHER_LOOKBACK_MS).toISOString()
  // Only the class as it is now: a removed child's history is not shown.
  const roster = await read(`/rest/v1/class_students?classroom_id=eq.${classroomId}&status=eq.active&select=id`, 'class_students')
  if (!roster.length) return json(req, 200, { nudges: [] })
  const rows = await readAll(
    `/rest/v1/class_nudges?classroom_id=eq.${classroomId}&student_id=in.(${roster.map((r) => r.id).join(',')})` +
      `&created_at=gte.${encodeURIComponent(since)}&select=id,student_id,created_at,seen_at,preset,message`,
    'created_at.desc,id.desc',
    'class_nudges'
  )
  const latest = new Map()
  for (const r of rows) {
    if (!latest.has(r.student_id)) {
      latest.set(r.student_id, {
        id: r.id, student_id: r.student_id, created_at: r.created_at, seen_at: r.seen_at, preset: r.preset, message: r.message,
      })
    }
  }
  return json(req, 200, { nudges: [...latest.values()] })
}

// ── Student: my unread nudge ────────────────────────────────────────────
function firstOf(v) {
  return Array.isArray(v) ? v[0] ?? null : v ?? null
}

async function studentCurrent(req, student) {
  const rows = await read(
    `/rest/v1/class_nudges?student_id=eq.${student.id}&seen_at=is.null` +
      `&select=id,teacher_name,preset,message,created_at,assignment_id,assignments(id,title)&order=created_at.desc&limit=1`,
    'class_nudges'
  )
  const r = rows?.[0]
  if (!r) return json(req, 200, { nudge: null })
  const a = firstOf(r.assignments)
  return json(req, 200, {
    nudge: {
      id: r.id, teacher_name: r.teacher_name || null, preset: r.preset, message: r.message, created_at: r.created_at,
      assignment: a ? { id: a.id, title: a.title } : null,
    },
  })
}

async function markSeen(req, student, body) {
  if (!isUuid(body.id)) return bad(req, 'Invalid id')
  // Scoped to the caller's own row: a child can never mark another child's.
  const res = await sb(`/rest/v1/class_nudges?id=eq.${body.id}&student_id=eq.${student.id}&seen_at=is.null&select=id`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ seen_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`class_nudges patch failed: ${res.status}`)
  const [row] = await res.json()
  if (row) return json(req, 200, { ok: true })
  // Already seen is fine (a double tap); someone else's or missing is 404.
  const [mine] = await read(`/rest/v1/class_nudges?id=eq.${body.id}&student_id=eq.${student.id}&select=id`, 'class_nudges')
  if (!mine) return json(req, 404, { error: 'Not found', code: 'not_found' })
  return json(req, 200, { ok: true })
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)

    if (req.method === 'GET') {
      const classId = url.searchParams.get('classId')
      if (classId === null) {
        const s = await requireStudent(req)
        if (!s.ok) return s.response
        const rl = limited(req, `school-nudges-student:${s.student.id}`, 600)
        if (rl) return rl
        return await studentCurrent(req, s.student)
      }
      const o = await requireClassOwner(req, classId)
      if (!o.ok) return o.response
      const rl = limited(req, `school-nudges-read:${o.auth.userId}`, 600)
      if (rl) return rl
      return await teacherLatest(req, o.classroom.id)
    }

    if (req.method === 'PATCH') {
      const s = await requireStudent(req)
      if (!s.ok) return s.response
      const rl = limited(req, `school-nudges-seen:${s.student.id}`, 120)
      if (rl) return rl
      const body = (await req.json().catch(() => null)) ?? {}
      return await markSeen(req, s.student, body)
    }

    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const body = (await req.json().catch(() => null)) ?? {}
    const o = await requireClassOwner(req, body.classId)
    if (!o.ok) return o.response
    const rl = limited(req, `school-nudges:${o.auth.userId}`, 60)
    if (rl) return rl
    return await send(req, o, body)
  } catch (e) {
    console.error('school/nudges: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

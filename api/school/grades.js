export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireClassOwner, requireStudent, sb, json, isUuid } from '../_school.js'
import { COMMENT_MAX, STICKERS, raisedName } from '../../lib/school/assignments.js'
import { LEVELS, cleanTips, gradeShape, GRADE_SELECT } from '../../lib/school/grading.js'

// Grading with tips (migration 022).
//
//   POST {classId, submissionId, version, level, tips?, returned?, comment?, sticker?}
//        teacher (class owner): grade one hand-in, optionally send it back
//        to revise, optionally with a sticker/comment — one transaction.
//   POST {id}                   student: mark their own grade as seen.
//   GET  ?classId&studentId     teacher: one child's levels over time.
//   GET  ?classId               teacher: every grade in the class (the CSV
//                               export is built from this in the browser).
//
// The per-assignment grid (every child's level at a glance) rides on
// GET /api/school/submissions?classId&assignmentId, and a child reads their
// own level and tips on GET /api/school/submissions?id and
// GET /api/school/assignments — always scoped to their own student id, so a
// child never sees another child's level and there are no class totals.

const bad = (req, error) => json(req, 400, { error, code: 'bad_request' })
const one = (v) => (Array.isArray(v) ? v[0] : v) ?? {}

// Raised by school_grade_submission (migration 022).
const RPC_ERRORS = {
  submission_not_found: [404, 'Submission not found', 'submission_not_found'],
  version_changed: [409, 'They handed in a new version. Have a look at it first.', 'version_changed'],
  cannot_return: [409, 'This assignment is closed, so it can\'t be sent back', 'cannot_return'],
}

// Fails CLOSED: a non-2xx throws and becomes 503 upstream.
async function read(path, what) {
  const res = await sb(path)
  if (!res.ok) throw new Error(`${what} lookup failed: ${res.status}`)
  return res.json()
}

async function teacherGrade(req, o, body) {
  if (o.classroom.archived_at) return json(req, 409, { error: 'This class is archived', code: 'class_archived' })
  if (!isUuid(body.submissionId)) return bad(req, 'Invalid submission id')
  if (!Number.isInteger(body.version) || body.version < 1) return bad(req, 'Invalid version')
  if (!LEVELS.includes(body.level)) return bad(req, 'Unknown level')
  const tips = cleanTips(body.tips)
  if (!tips.ok) return bad(req, tips.error)
  if (body.returned !== undefined && typeof body.returned !== 'boolean') return bad(req, 'Invalid returned')
  const returned = body.returned === true
  // Sending back is "try again, here's how": never without a tip.
  if (returned && !tips.tips.length) return bad(req, 'Add a tip so they know what to change')

  let comment = null
  if (body.comment !== undefined && body.comment !== null) {
    if (typeof body.comment !== 'string') return bad(req, 'Invalid comment')
    comment = body.comment.trim() || null
    if (comment && comment.length > COMMENT_MAX) return bad(req, `Comment must be at most ${COMMENT_MAX} characters`)
  }
  let sticker = null
  if (body.sticker !== undefined && body.sticker !== null) {
    if (!STICKERS.includes(body.sticker)) return bad(req, 'Unknown sticker')
    sticker = body.sticker
  }

  // One locked transaction: scoped to the teacher's class (another class's
  // submission reads as missing), version-checked, re-checks that a sent-back
  // child can still hand in again.
  const res = await sb('/rest/v1/rpc/school_grade_submission', {
    method: 'POST',
    body: JSON.stringify({
      p_classroom_id: o.classroom.id,
      p_submission_id: body.submissionId,
      p_version: body.version,
      p_author_user_id: o.auth.userId,
      p_level: body.level,
      p_tips: tips.tips,
      p_returned: returned,
      p_comment: comment,
      p_sticker: sticker,
    }),
  })
  if (!res.ok) {
    const mapped = RPC_ERRORS[await raisedName(res)]
    if (mapped) return json(req, mapped[0], { error: mapped[1], code: mapped[2] })
    return json(req, 502, { error: 'Could not save the grade', code: 'upstream' })
  }
  const out = await res.json()
  const f = out?.feedback
  return json(req, 201, {
    grade: gradeShape(out.grade),
    feedback: f ? { id: f.id, submission_id: f.submission_id, comment: f.comment, sticker: f.sticker, created_at: f.created_at, seen_at: f.seen_at } : null,
  })
}

// Grades are embedded in the hand-in read (FK submission_grades ->
// class_submissions), so a big class never builds an id list into a URL.

// One child's levels over time: every graded version of every hand-in,
// oldest first, with the assignment title.
async function teacherStudent(req, classroomId, studentId) {
  if (!isUuid(studentId)) return bad(req, 'Invalid student id')
  const subs = await read(
    `/rest/v1/class_submissions?classroom_id=eq.${classroomId}&student_id=eq.${studentId}` +
      `&select=id,assignment_id,version,assignments(title),submission_grades(${GRADE_SELECT})`,
    'class_submissions'
  )
  const history = subs
    .flatMap((s) => (s.submission_grades ?? []).map((g) => ({
      ...gradeShape(g), submission_id: s.id, assignment_id: s.assignment_id,
      assignment_title: one(s.assignments).title ?? '', current_version: s.version,
    })))
    .sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)))
  return json(req, 200, { grades: history })
}

// Every grade in the class (every graded version), for the CSV export.
// Display name and assignment title only: no account ids, no tips text,
// nothing else about the child.
async function teacherClass(req, classroomId) {
  const subs = await read(
    `/rest/v1/class_submissions?classroom_id=eq.${classroomId}` +
      `&select=id,assignment_id,student_id,class_students(display_name),assignments(title,created_at),` +
      `submission_grades(version,level,returned,created_at,updated_at)`,
    'class_submissions'
  )
  const rows = subs.flatMap((s) => (s.submission_grades ?? []).map((g) => ({
    student_id: s.student_id,
    display_name: one(s.class_students).display_name ?? null,
    assignment_id: s.assignment_id,
    assignment_title: one(s.assignments).title ?? '',
    assignment_created_at: one(s.assignments).created_at ?? null,
    version: g.version,
    level: g.level,
    returned: !!g.returned,
    graded_at: g.updated_at ?? g.created_at,
  })))
  rows.sort((a, b) =>
    String(a.display_name ?? '').localeCompare(String(b.display_name ?? '')) ||
    String(a.assignment_created_at ?? '').localeCompare(String(b.assignment_created_at ?? '')) ||
    a.version - b.version
  )
  return json(req, 200, { grades: rows })
}

// Student: mark their own grade as seen.
async function studentSeen(req, student, id) {
  if (!isUuid(id)) return bad(req, 'Invalid id')
  const [row] = await read(`/rest/v1/submission_grades?id=eq.${id}&select=id,class_submissions(student_id)`, 'submission_grades')
  // Someone else's grade and a missing one get the same 404.
  if (!row || one(row.class_submissions).student_id !== student.id) {
    return json(req, 404, { error: 'Not found', code: 'not_found' })
  }
  const patch = await sb(`/rest/v1/submission_grades?id=eq.${id}&seen_at=is.null`, {
    method: 'PATCH',
    body: JSON.stringify({ seen_at: new Date().toISOString() }),
  })
  if (!patch.ok) return json(req, 502, { error: 'Could not update', code: 'upstream' })
  return json(req, 200, { ok: true })
}

const limited = (req, key, n) =>
  checkRateLimit(key, n).allowed ? null : json(req, 429, { error: 'Too many requests', code: 'rate_limited' })

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method === 'GET') {
      const params = new URL(req.url).searchParams
      const o = await requireClassOwner(req, params.get('classId'))
      if (!o.ok) return o.response
      const rl = limited(req, `school-grades:${o.auth.userId}`, 600)
      if (rl) return rl
      if (params.get('studentId') !== null) return await teacherStudent(req, o.classroom.id, params.get('studentId'))
      return await teacherClass(req, o.classroom.id)
    }

    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const body = (await req.json().catch(() => null)) ?? {}

    // classId present: the teacher route (a student gets 403 there);
    // absent: the student route (a teacher gets 403 not_a_student).
    if (body.classId !== undefined) {
      const o = await requireClassOwner(req, body.classId)
      if (!o.ok) return o.response
      const rl = limited(req, `school-grades:${o.auth.userId}`, 600)
      if (rl) return rl
      return await teacherGrade(req, o, body)
    }

    const s = await requireStudent(req)
    if (!s.ok) return s.response
    const rl = limited(req, `school-grades-seen:${s.student.id}`, 300)
    if (rl) return rl
    return await studentSeen(req, s.student, body.id)
  } catch (e) {
    console.error('school/grades: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

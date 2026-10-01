export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireClassOwner, requireStudent, sb, sbAssignments, json, isUuid } from '../_school.js'
import { isLate } from '../../lib/school/assignments.js'
import { GRADE_SELECT, gradeShape, latestGrade } from '../../lib/school/grading.js'
import { isWorksheetSnapshot } from '../../lib/school/worksheets.js'

const FEEDBACK_SELECT = 'id,comment,sticker,created_at,seen_at'

// Allowlisted: author_user_id (a teacher's auth id) is never sent anywhere.
const feedbackShape = (f) => ({ id: f.id, comment: f.comment, sticker: f.sticker, created_at: f.created_at, seen_at: f.seen_at })

// To-one embeds come back as objects; be defensive about one-element arrays
// (same as dashboard.js's embeddedName).
const one = (v) => (Array.isArray(v) ? v[0] : v) ?? {}

// A worksheet hand-in (migration 023) is a snapshot of kind 'worksheet':
// its answers (and the prompts they answered) are surfaced as their own
// fields so neither client has to know where they are stored.
const worksheetFields = (snap) => (isWorksheetSnapshot(snap)
  ? { kind: 'worksheet', answers: snap.answers ?? {}, worksheet: { templateId: snap.templateId, boxes: snap.boxes ?? [], word: snap.word ?? null } }
  : { kind: 'book', answers: null, worksheet: null })

// Fails CLOSED: a non-2xx throws and becomes 503 upstream, never an empty
// list that reads as "nobody handed in" or "no feedback yet".
async function read(path, what) {
  // Assignment reads tolerate migration 023 not being applied yet.
  const res = await (path.startsWith('/rest/v1/assignments') ? sbAssignments(path) : sb(path))
  if (!res.ok) throw new Error(`${what} lookup failed: ${res.status}`)
  return res.json()
}

const feedbackFor = (submissionId) =>
  read(`/rest/v1/submission_feedback?submission_id=eq.${submissionId}&select=${FEEDBACK_SELECT}&order=created_at.asc`, 'submission_feedback')

async function teacherAssignmentView(req, classroomId, assignmentId) {
  if (!isUuid(assignmentId)) return json(req, 400, { error: 'Invalid assignment id', code: 'bad_request' })
  const [assignment] = await read(
    `/rest/v1/assignments?id=eq.${assignmentId}&classroom_id=eq.${classroomId}&select=id,title,status,due_at,allow_late,kind,worksheet`,
    'assignment'
  )
  if (!assignment) return json(req, 404, { error: 'Assignment not found', code: 'assignment_not_found' })

  const students = await read(
    `/rest/v1/class_students?classroom_id=eq.${classroomId}&status=eq.active&select=id,display_name,avatar_emoji&order=display_name.asc`,
    'class_students'
  )
  const subs = await read(
    `/rest/v1/class_submissions?assignment_id=eq.${assignmentId}&classroom_id=eq.${classroomId}` +
      `&select=id,student_id,version,submitted_at,returned_at,book_title,class_students(display_name,avatar_emoji),` +
      `submission_grades(version,level)`,
    'class_submissions'
  )
  const feedbackCount = new Map()
  if (subs.length) {
    const fb = await read(`/rest/v1/submission_feedback?submission_id=in.(${subs.map((s) => s.id).join(',')})&select=submission_id`, 'submission_feedback')
    for (const f of fb) feedbackCount.set(f.submission_id, (feedbackCount.get(f.submission_id) ?? 0) + 1)
  }

  // Every hand-in is listed, including one from a student since removed
  // (the teacher may still need to review it); every active student who
  // hasn't handed in gets a not_started row.
  const handedIn = new Set(subs.map((s) => s.student_id))
  const rows = [
    ...subs.map((s) => {
      const who = one(s.class_students)
      // The newest grade, whichever version it was for: a "v2" chip next to
      // a v1 level tells the teacher the revision hasn't been looked at yet.
      const g = latestGrade(s.submission_grades)
      return {
        id: s.id, student_id: s.student_id, display_name: who.display_name ?? null, avatar_emoji: who.avatar_emoji ?? null,
        status: 'handed_in', version: s.version, submitted_at: s.submitted_at, late: isLate(s.submitted_at, assignment.due_at),
        book_title: s.book_title, feedback_count: feedbackCount.get(s.id) ?? 0,
        level: g?.level ?? null, graded_version: g?.version ?? null, returned: !!s.returned_at,
      }
    }),
    ...students.filter((st) => !handedIn.has(st.id)).map((st) => ({
      id: null, student_id: st.id, display_name: st.display_name, avatar_emoji: st.avatar_emoji,
      status: 'not_started', version: null, submitted_at: null, late: false, book_title: null, feedback_count: 0,
      level: null, graded_version: null, returned: false,
    })),
  ].sort((a, b) => String(a.display_name ?? '').localeCompare(String(b.display_name ?? '')))

  return json(req, 200, {
    assignment: {
      id: assignment.id, title: assignment.title, status: assignment.status, due_at: assignment.due_at, allow_late: assignment.allow_late,
      kind: assignment.kind === 'worksheet' ? 'worksheet' : 'book',
      worksheet: assignment.kind === 'worksheet' ? assignment.worksheet ?? null : null,
    },
    submissions: rows,
  })
}

async function teacherOne(req, classroomId, id) {
  if (!isUuid(id)) return json(req, 400, { error: 'Invalid submission id', code: 'bad_request' })
  const [s] = await read(
    `/rest/v1/class_submissions?id=eq.${id}&classroom_id=eq.${classroomId}` +
      `&select=id,assignment_id,student_id,version,submitted_at,returned_at,book_id,book_title,book_snapshot,` +
      `class_students(display_name,avatar_emoji),assignments(due_at),submission_grades(${GRADE_SELECT})`,
    'class_submissions'
  )
  if (!s) return json(req, 404, { error: 'Submission not found', code: 'submission_not_found' })
  const feedback = await feedbackFor(s.id)
  const who = one(s.class_students)
  return json(req, 200, {
    submission: {
      id: s.id, assignment_id: s.assignment_id, student_id: s.student_id,
      display_name: who.display_name ?? null, avatar_emoji: who.avatar_emoji ?? null,
      version: s.version, submitted_at: s.submitted_at, late: isLate(s.submitted_at, one(s.assignments).due_at),
      book_id: s.book_id, book_title: s.book_title, book_snapshot: s.book_snapshot,
      returned: !!s.returned_at,
      ...worksheetFields(s.book_snapshot),
    },
    feedback: feedback.map(feedbackShape),
    // Every graded version, newest first: the teacher sees the previous
    // grade (and whether it was sent back) next to the new version.
    grades: (s.submission_grades ?? []).map(gradeShape).sort((a, b) => b.version - a.version),
  })
}

async function studentOne(req, student, id) {
  if (!isUuid(id)) return json(req, 400, { error: 'Invalid submission id', code: 'bad_request' })
  // Scoped by the student's own id: someone else's submission id reads as missing.
  const [s] = await read(
    `/rest/v1/class_submissions?id=eq.${id}&student_id=eq.${student.id}` +
      `&select=id,version,returned_at,book_snapshot,submission_grades(${GRADE_SELECT})`,
    'class_submissions'
  )
  if (!s) return json(req, 404, { error: 'Submission not found', code: 'submission_not_found' })
  const feedback = await feedbackFor(s.id)
  // Only the grade for the version they handed in last: once they hand in
  // again, the old level and tips have done their job.
  const g = (s.submission_grades ?? []).find((x) => x.version === s.version)
  return json(req, 200, {
    book_snapshot: s.book_snapshot,
    // Their own answers, so "Try again" on another device starts from
    // what they handed in (drafts only live on the device).
    ...worksheetFields(s.book_snapshot),
    feedback: feedback.map(feedbackShape),
    grade: g ? gradeShape(g) : null,
    returned: !!s.returned_at,
  })
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'GET') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const params = new URL(req.url).searchParams
    const classId = params.get('classId')

    if (classId === null) {
      const s = await requireStudent(req)
      if (!s.ok) return s.response
      if (!checkRateLimit(`school-submissions-student:${s.student.id}`, 600).allowed) {
        return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
      }
      return await studentOne(req, s.student, params.get('id'))
    }

    const o = await requireClassOwner(req, classId)
    if (!o.ok) return o.response
    if (!checkRateLimit(`school-submissions:${o.auth.userId}`, 600).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    if (params.get('id') !== null) return await teacherOne(req, o.classroom.id, params.get('id'))
    if (params.get('assignmentId') !== null) return await teacherAssignmentView(req, o.classroom.id, params.get('assignmentId'))
    return json(req, 400, { error: 'assignmentId or id is required', code: 'bad_request' })
  } catch (e) {
    console.error('school/submissions: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

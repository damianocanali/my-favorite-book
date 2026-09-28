export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireClassOwner, requireStudent, sb, json, isUuid } from '../_school.js'
import {
  TITLE_MAX, PROMPT_MAX, STATUSES, canTransition, cleanText, parseDue, isLate, isPastDue, raisedName,
} from '../../lib/school/assignments.js'

const SELECT = 'id,title,prompt,due_at,status,allow_late,created_at,updated_at'

// Allowlisted output: classroom_id (and anything else PostgREST adds) is
// never copied through by omission.
function teacherShape(r, extra = {}) {
  return {
    id: r.id, title: r.title, prompt: r.prompt, due_at: r.due_at, status: r.status,
    allow_late: r.allow_late, created_at: r.created_at, updated_at: r.updated_at, ...extra,
  }
}

const bad = (req, error) => json(req, 400, { error, code: 'bad_request' })

// Every read below fails CLOSED: a non-2xx throws, and the handler's
// try/catch turns it into 503 upstream rather than "no assignments" or
// "nobody handed in" (which would let a DELETE through, for one).
async function read(path, what) {
  const res = await sb(path)
  if (!res.ok) throw new Error(`${what} lookup failed: ${res.status}`)
  return res.json()
}

async function teacherList(req, classroomId) {
  const rows = await read(`/rest/v1/assignments?classroom_id=eq.${classroomId}&select=${SELECT}&order=created_at.desc`, 'assignments')
  const students = await read(`/rest/v1/class_students?classroom_id=eq.${classroomId}&status=eq.active&select=id`, 'class_students')
  const subs = await read(`/rest/v1/class_submissions?classroom_id=eq.${classroomId}&select=assignment_id,student_id`, 'class_submissions')

  // A removed student's old hand-in stays on record but no longer counts
  // toward "x of N" for the class as it is now.
  const active = new Set(students.map((s) => s.id))
  const handedIn = new Map()
  for (const s of subs) {
    if (!active.has(s.student_id)) continue
    handedIn.set(s.assignment_id, (handedIn.get(s.assignment_id) ?? 0) + 1)
  }
  return json(req, 200, {
    assignments: rows.map((r) => teacherShape(r, { counts: { handed_in: handedIn.get(r.id) ?? 0, total_students: active.size } })),
  })
}

async function studentList(req, student) {
  const rows = await read(
    `/rest/v1/assignments?classroom_id=eq.${student.classroom_id}&status=in.(published,closed)` +
      `&select=id,title,prompt,due_at,status,allow_late,created_at&order=created_at.desc`,
    'assignments'
  )
  const subs = await read(`/rest/v1/class_submissions?student_id=eq.${student.id}&select=id,assignment_id,version,submitted_at`, 'class_submissions')
  const unseen = new Map()
  if (subs.length) {
    const fb = await read(
      `/rest/v1/submission_feedback?submission_id=in.(${subs.map((s) => s.id).join(',')})&seen_at=is.null&select=submission_id`,
      'submission_feedback'
    )
    for (const f of fb) unseen.set(f.submission_id, (unseen.get(f.submission_id) ?? 0) + 1)
  }
  const subByAssignment = new Map(subs.map((s) => [s.assignment_id, s]))
  const now = Date.now()
  return json(req, 200, {
    assignments: rows.map((r) => {
      const s = subByAssignment.get(r.id)
      return {
        id: r.id, title: r.title, prompt: r.prompt, due_at: r.due_at, status: r.status,
        allow_late: r.allow_late, created_at: r.created_at,
        past_due: isPastDue(r.due_at, now),
        my_submission: s
          ? { id: s.id, version: s.version, submitted_at: s.submitted_at, late: isLate(s.submitted_at, r.due_at), feedback_unseen: unseen.get(s.id) ?? 0 }
          : null,
      }
    }),
  })
}

async function create(req, classroomId, body) {
  const title = cleanText(body.title, TITLE_MAX)
  if (!title) return bad(req, `Title must be 1-${TITLE_MAX} characters`)
  const prompt = cleanText(body.prompt, PROMPT_MAX)
  if (!prompt) return bad(req, `Prompt must be 1-${PROMPT_MAX} characters`)
  const due = parseDue(body.due_at)
  if (!due.ok) return bad(req, 'Invalid due date')
  if (body.allow_late !== undefined && typeof body.allow_late !== 'boolean') return bad(req, 'Invalid allow_late')
  const status = body.status ?? 'draft'
  if (status !== 'draft' && status !== 'published') return bad(req, 'Invalid status')

  const res = await sb('/rest/v1/assignments', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      classroom_id: classroomId, title, prompt, due_at: due.value ?? null, allow_late: body.allow_late ?? true, status,
    }),
  })
  if (!res.ok) return json(req, 502, { error: 'Could not save assignment', code: 'upstream' })
  const [row] = await res.json()
  return json(req, 201, { assignment: teacherShape(row) })
}

async function update(req, classroomId, body) {
  if (!isUuid(body.id)) return bad(req, 'Invalid assignment id')
  const patch = {}
  if (body.title !== undefined) {
    patch.title = cleanText(body.title, TITLE_MAX)
    if (!patch.title) return bad(req, `Title must be 1-${TITLE_MAX} characters`)
  }
  if (body.prompt !== undefined) {
    patch.prompt = cleanText(body.prompt, PROMPT_MAX)
    if (!patch.prompt) return bad(req, `Prompt must be 1-${PROMPT_MAX} characters`)
  }
  if (body.due_at !== undefined) {
    const due = parseDue(body.due_at)
    if (!due.ok) return bad(req, 'Invalid due date')
    patch.due_at = due.value
  }
  if (body.allow_late !== undefined) {
    if (typeof body.allow_late !== 'boolean') return bad(req, 'Invalid allow_late')
    patch.allow_late = body.allow_late
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return bad(req, 'Invalid status')
    patch.status = body.status
  }
  if (!Object.keys(patch).length) return bad(req, 'Nothing to update')

  const scoped = `/rest/v1/assignments?id=eq.${body.id}&classroom_id=eq.${classroomId}`
  const [current] = await read(`${scoped}&select=id,status`, 'assignment')
  if (!current) return json(req, 404, { error: 'Assignment not found', code: 'assignment_not_found' })
  if (patch.status && !canTransition(current.status, patch.status)) {
    return json(req, 409, { error: `Cannot go from ${current.status} to ${patch.status}`, code: 'invalid_transition' })
  }
  patch.updated_at = new Date().toISOString()

  // A status change only applies if the status is still the one checked
  // above: two tabs racing (close vs reopen) can't skip the transition rules.
  const guard = patch.status ? `&status=eq.${current.status}` : ''
  const res = await sb(`${scoped}${guard}&select=${SELECT}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) return json(req, 502, { error: 'Could not save assignment', code: 'upstream' })
  const [row] = await res.json()
  if (!row && guard) return json(req, 409, { error: 'The assignment changed, reload and try again', code: 'invalid_transition' })
  if (!row) return json(req, 404, { error: 'Assignment not found', code: 'assignment_not_found' })
  return json(req, 200, { assignment: teacherShape(row) })
}

async function remove(req, classroomId, id) {
  if (!isUuid(id)) return bad(req, 'Invalid assignment id')
  // One locked transaction (migration 019): the "nobody handed in" check and
  // the delete can't be split by a hand-in landing in between, so children's
  // work is never deleted as a side effect of tidying up. Once anyone has
  // handed in, the teacher closes the assignment instead.
  const res = await sb('/rest/v1/rpc/school_delete_assignment', {
    method: 'POST',
    body: JSON.stringify({ p_classroom_id: classroomId, p_assignment_id: id }),
  })
  if (res.ok) return json(req, 200, { ok: true })
  const name = await raisedName(res)
  if (name === 'has_submissions') return json(req, 409, { error: 'Students have handed this in. Close it instead.', code: 'has_submissions' })
  if (name === 'assignment_not_found') return json(req, 404, { error: 'Assignment not found', code: 'assignment_not_found' })
  throw new Error(`school_delete_assignment failed: ${res.status}`)
}

const limited = (req, key, n) =>
  checkRateLimit(key, n).allowed ? null : json(req, 429, { error: 'Too many requests', code: 'rate_limited' })

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)

    if (req.method === 'GET') {
      const classId = url.searchParams.get('classId')
      if (classId === null) {
        // No classId: the student view of their own class.
        const s = await requireStudent(req)
        if (!s.ok) return s.response
        const rl = limited(req, `school-assignments-student:${s.student.id}`, 600)
        if (rl) return rl
        return await studentList(req, s.student)
      }
      const o = await requireClassOwner(req, classId)
      if (!o.ok) return o.response
      const rl = limited(req, `school-assignments:${o.auth.userId}`, 600)
      if (rl) return rl
      return await teacherList(req, o.classroom.id)
    }

    if (req.method === 'DELETE') {
      const o = await requireClassOwner(req, url.searchParams.get('classId'))
      if (!o.ok) return o.response
      const rl = limited(req, `school-assignments:${o.auth.userId}`, 600)
      if (rl) return rl
      return await remove(req, o.classroom.id, url.searchParams.get('id'))
    }

    if (req.method !== 'POST' && req.method !== 'PATCH') {
      return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    }
    const body = (await req.json().catch(() => null)) ?? {}
    const o = await requireClassOwner(req, body.classId)
    if (!o.ok) return o.response
    const rl = limited(req, `school-assignments:${o.auth.userId}`, 600)
    if (rl) return rl
    return req.method === 'POST' ? await create(req, o.classroom.id, body) : await update(req, o.classroom.id, body)
  } catch (e) {
    console.error('school/assignments: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

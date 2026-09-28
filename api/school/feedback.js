export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireClassOwner, requireStudent, sb, json, isUuid } from '../_school.js'
import { COMMENT_MAX, STICKERS } from '../../lib/school/assignments.js'

const bad = (req, error) => json(req, 400, { error, code: 'bad_request' })
const one = (v) => (Array.isArray(v) ? v[0] : v) ?? {}

// Teacher: leave a comment and/or sticker on a hand-in in their own class.
async function teacherPost(req, o, body) {
  if (!isUuid(body.submissionId)) return bad(req, 'Invalid submission id')
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
  if (!comment && !sticker) return bad(req, 'Add a comment or a sticker')

  // Scoped to the teacher's class — fails closed.
  const sRes = await sb(`/rest/v1/class_submissions?id=eq.${body.submissionId}&classroom_id=eq.${o.classroom.id}&select=id`)
  if (!sRes.ok) throw new Error(`class_submissions lookup failed: ${sRes.status}`)
  const [sub] = await sRes.json()
  if (!sub) return json(req, 404, { error: 'Submission not found', code: 'submission_not_found' })

  const res = await sb('/rest/v1/submission_feedback', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ submission_id: sub.id, author_user_id: o.auth.userId, comment, sticker }),
  })
  if (!res.ok) return json(req, 502, { error: 'Could not send feedback', code: 'upstream' })
  const [row] = await res.json()
  return json(req, 201, {
    feedback: { id: row.id, submission_id: row.submission_id, comment: row.comment, sticker: row.sticker, created_at: row.created_at, seen_at: row.seen_at },
  })
}

// Student: mark one piece of feedback on their own hand-in as seen.
async function studentSeen(req, student, id) {
  // Malformed is a client bug (400, like every other student route); a
  // well-formed foreign id and a missing one get the same 404.
  if (!isUuid(id)) return bad(req, 'Invalid id')
  const res = await sb(`/rest/v1/submission_feedback?id=eq.${id}&select=id,class_submissions(student_id)`)
  if (!res.ok) throw new Error(`submission_feedback lookup failed: ${res.status}`)
  const [row] = await res.json()
  if (!row || one(row.class_submissions).student_id !== student.id) {
    return json(req, 404, { error: 'Not found', code: 'not_found' })
  }
  // seen_at=is.null keeps the FIRST time it was seen.
  const patch = await sb(`/rest/v1/submission_feedback?id=eq.${id}&seen_at=is.null`, {
    method: 'PATCH',
    body: JSON.stringify({ seen_at: new Date().toISOString() }),
  })
  if (!patch.ok) return json(req, 502, { error: 'Could not update', code: 'upstream' })
  return json(req, 200, { ok: true })
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const body = (await req.json().catch(() => null)) ?? {}

    // classId present: the teacher route (a student gets 403 there);
    // absent: the student route (a teacher gets 403 not_a_student).
    if (body.classId !== undefined) {
      const o = await requireClassOwner(req, body.classId)
      if (!o.ok) return o.response
      if (!checkRateLimit(`school-feedback:${o.auth.userId}`, 600).allowed) {
        return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
      }
      return await teacherPost(req, o, body)
    }

    const s = await requireStudent(req)
    if (!s.ok) return s.response
    if (!checkRateLimit(`school-feedback-seen:${s.student.id}`, 300).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    return await studentSeen(req, s.student, body.id)
  } catch (e) {
    console.error('school/feedback: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

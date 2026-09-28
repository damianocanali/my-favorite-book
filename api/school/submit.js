export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireStudent, sb, json, isUuid } from '../_school.js'
import { snapshotBook } from '../../lib/school/snapshot.js'
import { isLate, isPastDue } from '../../lib/school/assignments.js'

const MAX_BOOK_ID_LEN = 128
const MAX_TITLE_LEN = 200

// A student hands in one of their own books for an assignment. Everything
// that decides WHAT is stored comes from the server: the class and student
// ids from requireStudent, the book from user_books read by the caller's own
// auth id. The request only names which assignment and which of their books.
export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const s = await requireStudent(req)
    if (!s.ok) return s.response
    const { auth, student } = s
    if (!checkRateLimit(`school-submit:${student.id}`, 60).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }

    const body = (await req.json().catch(() => null)) ?? {}
    const { assignmentId, bookId } = body
    if (!isUuid(assignmentId)) return json(req, 400, { error: 'Invalid assignment', code: 'bad_request' })
    if (typeof bookId !== 'string' || !bookId || bookId.length > MAX_BOOK_ID_LEN) {
      return json(req, 400, { error: 'Invalid book', code: 'bad_request' })
    }

    // Scoped to the student's own class. Fails closed.
    const aRes = await sb(
      `/rest/v1/assignments?id=eq.${assignmentId}&classroom_id=eq.${student.classroom_id}&select=id,status,due_at,allow_late`
    )
    if (!aRes.ok) throw new Error(`assignment lookup failed: ${aRes.status}`)
    const [assignment] = await aRes.json()
    // A draft is invisible to students, so it reads the same as missing.
    if (!assignment || assignment.status === 'draft') {
      return json(req, 404, { error: 'Assignment not found', code: 'assignment_not_found' })
    }
    if (assignment.status === 'closed') {
      return json(req, 409, { error: 'This assignment is closed', code: 'assignment_closed' })
    }
    if (!assignment.allow_late && isPastDue(assignment.due_at)) {
      return json(req, 409, { error: 'This assignment is past its due date', code: 'past_due' })
    }

    const bRes = await sb(
      `/rest/v1/user_books?user_id=eq.${encodeURIComponent(auth.userId)}&book_id=eq.${encodeURIComponent(bookId)}&select=title,book_data`
    )
    if (!bRes.ok) throw new Error(`user_books lookup failed: ${bRes.status}`)
    const [book] = await bRes.json()
    if (!book) return json(req, 404, { error: 'Book not found', code: 'book_not_found' })

    const snapshot = snapshotBook(book.book_data)
    if (!snapshot) return json(req, 413, { error: 'This book is too big to hand in', code: 'book_too_large' })
    const title = String(book.title ?? book.book_data?.title ?? '').slice(0, MAX_TITLE_LEN)

    // One atomic upsert (migration 019): a resubmission bumps version under
    // the row lock, so two taps at once can't both claim the same version.
    const res = await sb('/rest/v1/rpc/school_submit', {
      method: 'POST',
      body: JSON.stringify({
        p_classroom_id: student.classroom_id,
        p_assignment_id: assignment.id,
        p_student_id: student.id,
        p_user_id: auth.userId,
        p_book_id: bookId,
        p_book_title: title,
        p_book_snapshot: snapshot,
      }),
    })
    if (!res.ok) return json(req, 502, { error: 'Could not hand in', code: 'upstream' })
    const row = await res.json()
    return json(req, 200, {
      id: row.id,
      version: row.version,
      submitted_at: row.submitted_at,
      late: isLate(row.submitted_at, assignment.due_at),
    })
  } catch (e) {
    console.error('school/submit: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

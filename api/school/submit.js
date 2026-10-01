export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireStudent, sb, json, isUuid } from '../_school.js'
import { snapshotBook } from '../../lib/school/snapshot.js'
import { isLate, isPastDue, raisedName } from '../../lib/school/assignments.js'
import { startHandIn, runAfterResponse } from '../../lib/notify/notify.js'
import { cleanAnswers, answersText, snapshotWorksheet } from '../../lib/school/worksheets.js'
import { moderatePrompt } from '../_aiGuard.js'

const MAX_BOOK_ID_LEN = 128
const MAX_TITLE_LEN = 200

// Raised by school_submit (migration 019) when the lock-time re-check fails.
const RPC_ERRORS = {
  assignment_not_found: [404, 'Assignment not found', 'assignment_not_found'],
  assignment_closed: [409, 'This assignment is closed', 'assignment_closed'],
  past_due: [409, 'This assignment is past its due date', 'past_due'],
  // Migration 023: a book handed in to a worksheet assignment, or answers
  // to a book assignment.
  wrong_kind: [409, 'This assignment takes a different kind of work', 'wrong_kind'],
}

const wrongKind = (req) => json(req, 409, { error: 'This assignment takes a different kind of work', code: 'wrong_kind' })

/// A worksheet hand-in (migration 023): the answers come from the request
/// (there is no server draft — the device autosaves them), validated
/// against the assignment's own worksheet and moderated like other child
/// text. Returns { ok: true, bookId, title, snapshot } or { ok: false, response }.
async function worksheetHandIn(req, assignment, answersIn) {
  const checked = cleanAnswers(assignment.worksheet, answersIn)
  if (!checked.ok) {
    const status = checked.code === 'answer_too_long' ? 413 : 400
    return { ok: false, response: json(req, status, { error: checked.error, code: checked.code }) }
  }
  // Only the teacher reads a hand-in, but it is still a child's free text
  // going to an adult: same screen as the other child-text paths.
  // moderatePrompt fails open on a provider error (a child's hand-in is
  // never lost to an outage) and answers 400 'unkind' when flagged.
  const flagged = await moderatePrompt(answersText(checked.answers), req)
  if (flagged) return { ok: false, response: flagged }
  return {
    ok: true,
    bookId: `worksheet:${assignment.id}`,
    title: String(assignment.title ?? '').slice(0, MAX_TITLE_LEN),
    snapshot: snapshotWorksheet(assignment.worksheet, checked.answers, checked.word),
  }
}

// A student hands in one of their own books for an assignment. Everything
// that decides WHAT is stored comes from the server: the class and student
// ids from requireStudent, the book from user_books read by the caller's own
// auth id. The request only names which assignment and which of their books.
// For a worksheet assignment (migration 023) the request carries the
// answers instead ({ assignmentId, answers }); the boxes and prompts they
// answer come from the assignment row.
// ctx: Vercel Edge's { waitUntil } — the "everyone handed in" check and its
// alert run after the child already has their answer.
export default async function handler(req, ctx) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const s = await requireStudent(req)
    if (!s.ok) return s.response
    const { auth, student, classroom } = s
    if (!checkRateLimit(`school-submit:${student.id}`, 60).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }

    const body = (await req.json().catch(() => null)) ?? {}
    const { assignmentId, bookId, answers } = body
    if (!isUuid(assignmentId)) return json(req, 400, { error: 'Invalid assignment', code: 'bad_request' })
    // A book hand-in names a book; a worksheet hand-in carries answers.
    const isWorksheet = answers !== undefined
    if (isWorksheet) {
      if (bookId !== undefined) return json(req, 400, { error: 'Send a book or answers, not both', code: 'bad_request' })
    } else if (typeof bookId !== 'string' || !bookId || bookId.length > MAX_BOOK_ID_LEN) {
      return json(req, 400, { error: 'Invalid book', code: 'bad_request' })
    }

    // Fast path only: school_submit re-checks all of this under a lock with
    // the database clock (RPC_ERRORS below). Scoped to the student's own
    // class. Fails closed.
    const aRes = await sb(
      `/rest/v1/assignments?id=eq.${assignmentId}&classroom_id=eq.${student.classroom_id}&select=id,title,status,due_at,allow_late,kind,worksheet`
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

    // school_submit re-checks the kind under its lock (migration 023).
    if ((assignment.kind === 'worksheet') !== isWorksheet) return wrongKind(req)

    let handIn
    if (isWorksheet) {
      handIn = await worksheetHandIn(req, assignment, answers)
      if (!handIn.ok) return handIn.response
    } else {
      const bRes = await sb(
        `/rest/v1/user_books?user_id=eq.${encodeURIComponent(auth.userId)}&book_id=eq.${encodeURIComponent(bookId)}&select=title,book_data`
      )
      if (!bRes.ok) throw new Error(`user_books lookup failed: ${bRes.status}`)
      const [book] = await bRes.json()
      if (!book) return json(req, 404, { error: 'Book not found', code: 'book_not_found' })

      const snapshot = snapshotBook(book.book_data)
      if (!snapshot) return json(req, 413, { error: 'This book is too big to hand in', code: 'book_too_large' })
      // A book's own data can't pose as a worksheet hand-in.
      if (snapshot.kind === 'worksheet') delete snapshot.kind
      handIn = { bookId, title: String(book.title ?? book.book_data?.title ?? '').slice(0, MAX_TITLE_LEN), snapshot }
    }

    // One atomic upsert (migration 019): a resubmission bumps version under
    // the row lock, so two taps at once can't both claim the same version.
    const res = await sb('/rest/v1/rpc/school_submit', {
      method: 'POST',
      body: JSON.stringify({
        p_classroom_id: student.classroom_id,
        p_assignment_id: assignment.id,
        p_student_id: student.id,
        p_user_id: auth.userId,
        p_book_id: handIn.bookId,
        p_book_title: handIn.title,
        p_book_snapshot: handIn.snapshot,
      }),
    })
    if (!res.ok) {
      const mapped = RPC_ERRORS[await raisedName(res)]
      if (mapped) return json(req, mapped[0], { error: mapped[1], code: mapped[2] })
      return json(req, 502, { error: 'Could not hand in', code: 'upstream' })
    }
    const row = await res.json()
    const late = isLate(row.submitted_at, assignment.due_at)
    // Bell row for the teacher now; the "everyone has handed in" check after
    // the response. Never throws.
    const h = await startHandIn({ classroom, student, assignment, submission: row, late })
    await runAfterResponse(ctx, h.done)
    return json(req, 200, {
      id: row.id,
      version: row.version,
      submitted_at: row.submitted_at,
      late,
    })
  } catch (e) {
    console.error('school/submit: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

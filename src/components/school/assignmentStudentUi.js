// Pure helpers behind the assignments STUDENT UI (Task S3) — the bookshelf's
// "My assignments" cards and the Hand-in flow on PreviewPage. Kept i18n-free
// and DOM-free (same convention as assignmentUi.js/rosterText.js) so the
// friendly due-date wording and card state are unit-tested directly;
// MyAssignments/AssignmentCard/HandInPanel themselves are exercised by hand
// (simulator/browser) and by `npx vite build`.
//
// Sticker emoji are NOT duplicated here — reuse STICKER_EMOJI from
// ./assignmentUi.js (the teacher UI already has them).
//
// Shape this all operates on is api/school/assignments.js's studentList
// row: { id, title, prompt, due_at, status: 'published'|'closed',
// allow_late, created_at, past_due, my_submission:
// {id,version,submitted_at,late,feedback_unseen}|null }.

// The card's three visible states (brief: "Not started" / "Handed in ✓" /
// "Closed"). Closed wins over everything — once a teacher closes it, it
// reads Closed even for a student who already handed something in (they can
// still open the feedback, just not resubmit).
export function assignmentCardStatus(assignment) {
  if (!assignment) return 'not_started'
  if (assignment.status === 'closed') return 'closed'
  return assignment.my_submission ? 'handed_in' : 'not_started'
}

// "Hand in again" only offers while the assignment is still open (brief:
// "+ Hand in again if still open"). past_due/allow_late is deliberately NOT
// checked here — attempting it just surfaces the server's own past_due
// error same as any other hand-in attempt, rather than hiding the button
// and leaving a student stuck with no visible way to try.
export function canHandInAgain(assignment) {
  return !!assignment && assignment.status === 'published' && !!assignment.my_submission
}

// Whether a student can attempt to hand in at all right now (drives whether
// "Start writing"/"Hand in" is offered vs. only "Closed").
export function canSubmitTo(assignment) {
  return !!assignment && assignment.status === 'published'
}

export function hasUnseenFeedback(assignment) {
  return (assignment?.my_submission?.feedback_unseen ?? 0) > 0
}

const DAY_MS = 24 * 60 * 60 * 1000
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/**
 * Friendly due-date wording (brief: "Due Friday", "Due today", "Late is
 * OK"). Returns a `{ kind, date? }` pair — i18n-free by design, so the
 * caller maps `kind` to a translated string (and formats `date` with its
 * own locale via Intl for the weekday/date kinds).
 *
 * `kind` is one of:
 *   'none'      — no due date at all
 *   'today' | 'tomorrow' | 'weekday' | 'date' — still open, not due yet
 *   'late_ok'   — past due, but the teacher still allows late hand-in
 *   'past_due'  — past due and late hand-in is not allowed
 *
 * past_due/allow_late are read from the assignment (server-computed,
 * api/school/assignments.js's isPastDue against the DB clock — the same
 * clock the hand-in RPC re-checks against) rather than recomputed against
 * the browser's own clock, so this never disagrees with what actually
 * happens on submit.
 */
export function dueWording(assignment, now = Date.now()) {
  if (!assignment?.due_at) return { kind: 'none' }
  const due = new Date(assignment.due_at)
  if (Number.isNaN(due.getTime())) return { kind: 'none' }

  if (assignment.past_due) {
    return assignment.allow_late ? { kind: 'late_ok', date: due } : { kind: 'past_due', date: due }
  }

  const diffDays = Math.round((startOfDay(due) - startOfDay(new Date(now))) / DAY_MS)
  if (diffDays <= 0) return { kind: 'today', date: due }
  if (diffDays === 1) return { kind: 'tomorrow', date: due }
  if (diffDays <= 6) return { kind: 'weekday', date: due }
  return { kind: 'date', date: due }
}

/**
 * The Hand-in button's control flow (brief S3 #3: "make sure the latest
 * version is synced … then POST /api/school/submit"), extracted out of
 * HandInPanel so it's unit-testable without mocking React state, fetch, or
 * the Supabase client — just two injected functions.
 *
 * `syncFn` and `submitFn` are called in sequence, and submitFn is only
 * ever called once syncFn resolves true. A failed sync must never fall
 * through to handing in a stale (or entirely un-uploaded) copy of the
 * book — that would show "Handed in!" over a book the teacher's
 * class_submissions row doesn't actually match, since school/submit reads
 * the book straight out of user_books, not off whatever the request sent.
 *
 * Returns the same `{ok, code?}` shape schoolFetch already returns, so a
 * caller never needs a separate branch for "the sync failed" vs "the
 * submit failed" — both surface as one `{ok: false, code}` to render with
 * the same error-copy lookup (`school:student.hand_in.errors.<code>`).
 *
 * @param {() => Promise<boolean>} syncFn
 * @param {() => Promise<{ok: boolean, code?: string}>} submitFn
 * @returns {Promise<{ok: boolean, code?: string}>}
 */
export async function runHandInSequence(syncFn, submitFn) {
  const synced = await syncFn()
  if (!synced) return { ok: false, code: 'sync_failed' }
  return submitFn()
}

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
// {id,version,submitted_at,late,feedback_unseen,level,grade_unseen,returned}|null }.

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

// New feedback or a new grade (migration 022) the child hasn't opened yet.
export function hasUnseenFeedback(assignment) {
  const s = assignment?.my_submission
  return (s?.feedback_unseen ?? 0) > 0 || s?.grade_unseen === true
}

// The teacher sent it back with tips and the child can still hand in again
// (iPad: StudentAssignment.isSentBack).
export function isSentBack(assignment) {
  return !!assignment?.my_submission?.returned && canHandInAgain(assignment)
}

// What the home's "From your teacher" card says (iPad: StudentAssignment
// .homeStatus — keep the two in step). `hasBook`: a book on this device is
// already tagged for it; `seen`: the child has opened it (see the seen-ids
// helpers below). One of 'new' | 'not_started' | 'in_progress' |
// 'handed_in' | 'feedback' | 'closed'.
export function homeStatus(assignment, { hasBook = false, seen = false } = {}) {
  if (hasUnseenFeedback(assignment)) return 'feedback'
  const card = assignmentCardStatus(assignment)
  if (card !== 'not_started') return card
  if (hasBook) return 'in_progress'
  return seen ? 'not_started' : 'new'
}

// Open work only, plus a closed one the child handed in (its feedback stays
// reachable). A closed, never-started assignment is nothing to do.
export function showsOnHome(assignment) {
  return !!assignment && (assignment.status === 'published' || !!assignment.my_submission)
}

const HOME_RANK = { new: 0, feedback: 1, in_progress: 2, not_started: 3, handed_in: 4, closed: 5 }

// What the child has to act on first: new, then fresh feedback, then in
// progress, then the rest; each group keeps the server's order.
export function sortForHome(assignments, statusOf) {
  return assignments
    .map((a, i) => ({ a, i, r: HOME_RANK[statusOf(a)] ?? 9 }))
    .sort((x, y) => x.r - y.r || x.i - y.i)
    .map((x) => x.a)
}

// Whether an open draft holds anything a child would miss (iPad:
// MyAssignmentsSection.hasWork).
export function draftHasWork(book) {
  if (!book) return false
  const filled = (s) => typeof s === 'string' && s.trim() !== ''
  return filled(book.title) || filled(book.authorName)
    || (book.characters?.length ?? 0) > 0 || !!book.setting || !!book.coverImage
    || (book.pages ?? []).some((p) => filled(p?.text) || !!p?.illustrationData)
}

// What "Start writing" does with the draft that is open right now (iPad:
// startOrContinue): 'resume' when it already is this assignment's book,
// 'confirm' before replacing a draft that has work in it, else 'start'.
export function startDecision(draft, assignmentId) {
  if (draft && draft.assignmentId === assignmentId) return 'resume'
  return draftHasWork(draft) ? 'confirm' : 'start'
}

// Which assignments this child has opened, so a new one wears a "New" badge
// until they do. Per student user id (class devices are shared, and ids
// never cross between children), in localStorage only. Deliberately KEPT
// across sign-out: a child signing back in must not see everything as New
// again. It stays small because every load prunes it to the assignments
// still listed (pruneSeenAssignments). Every storage call is guarded:
// private mode or blocked storage just means every assignment reads "New".
const SEEN_PREFIX = 'assignmentsSeen.'

export function readSeenAssignments(userId, storage = globalThis.localStorage) {
  if (!userId) return new Set()
  try {
    const raw = storage?.getItem(SEEN_PREFIX + userId)
    const list = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function markAssignmentSeen(userId, assignmentId, storage = globalThis.localStorage) {
  const seen = readSeenAssignments(userId, storage)
  if (!userId || !assignmentId || seen.has(assignmentId)) return seen
  seen.add(assignmentId)
  try {
    storage?.setItem(SEEN_PREFIX + userId, JSON.stringify([...seen]))
  } catch { /* storage full or blocked: the badge just comes back */ }
  return seen
}

// Drops seen ids for assignments no longer in the list (deleted, or gone
// from the class), so the stored set never grows past the live list.
export function pruneSeenAssignments(userId, liveIds, storage = globalThis.localStorage) {
  const seen = readSeenAssignments(userId, storage)
  if (!userId) return seen
  const live = new Set(liveIds)
  const kept = [...seen].filter((id) => live.has(id))
  if (kept.length === seen.size) return seen
  try {
    storage?.setItem(SEEN_PREFIX + userId, JSON.stringify(kept))
  } catch { /* the stale ids just stay a little longer */ }
  return new Set(kept)
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

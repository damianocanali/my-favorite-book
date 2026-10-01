// Pure helpers behind the assignments teacher UI (Task S2): due-date
// formatting/round-tripping for the datetime-local input, the status/hand-in
// chip label a row shows, and the delete guard. Kept i18n-free and DOM-free
// (same convention as rosterText.js/relativeTime.js) so they're unit-tested
// directly — AssignmentsSection/AssignmentReview themselves are exercised by
// hand (simulator/browser) and by `npx vite build`.

// assignments.status ('draft'|'published'|'closed') -> the i18n key suffix
// under school:teacher.assignments.status.*. "published" reads as "Open" to
// a teacher (the brief's own wording) — the server-side name never changes.
export const STATUS_CHIP_KEY = { draft: 'draft', published: 'open', closed: 'closed' }

// A hand-in's chip key. submissions.js's per-row shape is
// { status: 'handed_in'|'not_started', late: boolean }; the dashboard's
// per-student map is already one of the flattened strings ('handed_in',
// 'late', 'not_started', or 'revising' — sent back to revise). Both funnel
// through this so the two surfaces render identical chips.
export function handInChipKey(row) {
  if (!row) return 'not_started'
  if (typeof row === 'string') return row
  return row.status === 'not_started' ? 'not_started' : row.late ? 'late' : 'handed_in'
}

// A localized "due <date>" string, or null when there's no due date at all
// (callers show their own "No due date" copy for null).
export function formatDueDate(dueAt, locale) {
  if (!dueAt) return null
  const d = new Date(dueAt)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

// datetime-local <input> <-> ISO. A value with no timezone offset (what a
// datetime-local input always produces) is parsed as LOCAL time by `Date`,
// so `localInputToIso` round-trips through the browser's own zone exactly as
// the brief asks ("use the browser's local time and send ISO") — no
// timezone math of our own.
export function localInputToIso(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function isoToLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// A row's Delete action is only offered once nothing has been handed in —
// mirrors api/school/assignments.js's own 409 has_submissions guard so the
// button is simply absent rather than present-but-always-rejected.
export const canDeleteAssignment = (counts) => (counts?.handed_in ?? 0) === 0

// draft -> published -> closed; closed -> published (reopen). Mirrors
// lib/school/assignments.js's canTransition without importing server code
// into the client bundle, and drives which of Publish/Close/Reopen shows.
export function nextStatusActions(status) {
  if (status === 'draft') return ['published']
  if (status === 'published') return ['closed']
  if (status === 'closed') return ['published']
  return []
}

export const STICKER_EMOJI = {
  star: '⭐',
  rocket: '🚀',
  heart: '❤️',
  wow: '😮',
  keep_going: '💪',
  rainbow: '🌈',
}

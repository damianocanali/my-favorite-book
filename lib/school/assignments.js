// Shared rules for assignments, hand-ins and feedback (migration 019). The
// limits here mirror the SQL checks so a bad value is a 400 from the API,
// never a 502 from a Postgres check violation.
export const TITLE_MAX = 80
export const PROMPT_MAX = 1000
export const COMMENT_MAX = 500
export const STICKERS = ['star', 'rocket', 'heart', 'wow', 'keep_going', 'rainbow']
export const STATUSES = ['draft', 'published', 'closed']

// draft -> published -> closed; a closed assignment may reopen. Staying put
// is allowed so a client can send the current status alongside other edits.
const TRANSITIONS = {
  draft: ['draft', 'published'],
  published: ['published', 'closed'],
  closed: ['closed', 'published'],
}
export const canTransition = (from, to) => !!TRANSITIONS[from]?.includes(to)

/// A trimmed string of 1..max chars, or null if the value doesn't qualify.
export function cleanText(value, max) {
  if (typeof value !== 'string') return null
  const s = value.trim()
  return s.length >= 1 && s.length <= max ? s : null
}

/// Parses an optional due date. Returns { ok: true, value } where value is
/// undefined (not sent), null (cleared) or an ISO string; or { ok: false }.
export function parseDue(value) {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null) return { ok: true, value: null }
  if (typeof value !== 'string' || !value.trim()) return { ok: false }
  const t = Date.parse(value)
  return Number.isNaN(t) ? { ok: false } : { ok: true, value: new Date(t).toISOString() }
}

/// Handed in after the due date. No due date means never late.
export function isLate(submittedAt, dueAt) {
  if (!dueAt || !submittedAt) return false
  return new Date(submittedAt).getTime() > new Date(dueAt).getTime()
}

export const isPastDue = (dueAt, now = Date.now()) => !!dueAt && now > new Date(dueAt).getTime()

/// The name raised by a 019 RPC (`raise exception 'past_due'`), which
/// PostgREST returns as { code: 'P0001', message: 'past_due' }. Null for any
/// other failure, which callers treat as upstream.
export async function raisedName(res) {
  const body = await res.json().catch(() => null)
  return body?.code === 'P0001' && typeof body.message === 'string' ? body.message : null
}

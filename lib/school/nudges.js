// Shared rules for teacher nudges (migration 021). The limits mirror the SQL
// checks so a bad value is a 400 from the API, never a 502 from Postgres.
export const NUDGE_PRESETS = ['story_waiting', 'one_more_page', 'cant_wait', 'hand_in']
// Counted in UTF-16 code units (JS String.length), the same unit the iOS
// and web composers count. Postgres' char_length counts code points, which
// is never more than UTF-16 units, so anything accepted here fits the SQL.
export const NUDGE_MESSAGE_MAX = 140
export const NUDGE_TEACHER_NAME_MAX = 60
export const NUDGE_MAX_STUDENTS = 35
export const NUDGE_DAILY_CAP = 3

/// A trimmed custom message of 1..140 UTF-16 units, or null.
export function cleanNudgeMessage(value) {
  if (typeof value !== 'string') return null
  const s = value.trim()
  return s.length >= 1 && s.length <= NUDGE_MESSAGE_MAX ? s : null
}

/// The teacher's display name from their own profile (user_metadata),
/// trimmed and cut to 60 code points; '' when unset — each client then
/// shows "Your teacher" in the child's language. Never the email address.
export function teacherDisplayName(meta) {
  for (const k of ['display_name', 'full_name', 'name']) {
    const v = meta?.[k]
    if (typeof v === 'string' && v.trim()) return [...v.trim()].slice(0, NUDGE_TEACHER_NAME_MAX).join('')
  }
  return ''
}

/// An assignment a nudge may link to: published, and not past a due date
/// that refuses late work. Same rule as the RPC, the web and the iPad.
export function isOpenAssignment(a, now = Date.now()) {
  if (!a || (a.status !== undefined && a.status !== 'published')) return false
  if (a.allow_late === false && a.due_at && new Date(a.due_at).getTime() < now) return false
  return true
}

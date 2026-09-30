// Pure helpers behind teacher nudges (api/school/nudges.js, migration 021),
// shared by NudgeSheet (teacher) and StudentNudgeCard / MyAssignments
// (child). Unit-tested in isolation (tests/school-nudges-web.test.js), same
// split as assignmentStudentUi.js. Mirrors the iPad's NudgeRules.
import { draftHasWork } from './assignmentStudentUi'

export const NUDGE_PRESETS = ['story_waiting', 'one_more_page', 'cant_wait', 'hand_in']
// UTF-16 code units — JS String.length — exactly what the server counts.
export const NUDGE_MESSAGE_MAX = 140
export const NUDGE_MAX_STUDENTS = 35
export const QUIET_MS = 3 * 24 * 60 * 60 * 1000

const notHandedIn = (student, a) => (student.assignments?.[a.id] ?? 'not_started') === 'not_started'

/// Published assignments this student hasn't handed in yet.
export function openNotHandedIn(student, assignments = []) {
  return assignments.filter((a) => a.status === 'published' && notHandedIn(student, a))
}

/// Why a student is pre-ticked: 'quiet' (no book edited in the last 3
/// days, never counts too) and/or 'not_handed_in' (a published assignment
/// still open for them).
export function nudgeReasons(student, assignments = [], now = Date.now()) {
  const out = []
  const last = student.last_book_edited_at ? new Date(student.last_book_edited_at).getTime() : NaN
  if (Number.isNaN(last) || now - last >= QUIET_MS) out.push('quiet')
  if (openNotHandedIn(student, assignments).length) out.push('not_handed_in')
  return out
}

/// The ids pre-ticked in the class-wide sheet (never more than 35).
export function suggestedIds(students = [], assignments = [], now = Date.now()) {
  return students
    .filter((s) => nudgeReasons(s, assignments, now).length)
    .slice(0, NUDGE_MAX_STUDENTS)
    .map((s) => s.id)
}

/// A custom message as the server will store it, or null if it won't fit.
export function cleanMessage(value) {
  if (typeof value !== 'string') return null
  const s = value.trim()
  return s.length >= 1 && s.length <= NUDGE_MESSAGE_MAX ? s : null
}

/// Cut to at most `max` UTF-16 units without splitting a character.
export function truncateUtf16(s, max = NUDGE_MESSAGE_MAX) {
  if (s.length <= max) return s
  let out = ''
  for (const ch of s) {
    if (out.length + ch.length > max) break
    out += ch
  }
  return out
}

/// The POST body, or { error } naming what's missing.
export function buildNudgeBody({ classId, selected, choice, custom, assignmentId }) {
  const studentIds = [...selected]
  if (!studentIds.length) return { error: 'need_students' }
  const body = { classId, studentIds }
  if (choice === 'custom') {
    const message = cleanMessage(custom)
    if (!message) return { error: 'need_message' }
    body.message = message
  } else if (NUDGE_PRESETS.includes(choice)) {
    if (choice === 'hand_in' && !assignmentId) return { error: 'need_message' }
    body.preset = choice
  } else {
    return { error: 'need_message' }
  }
  if (assignmentId) body.assignmentId = assignmentId
  return { body }
}

/// The nudge text in the reader's language (a preset) or as written.
export function nudgeText(t, nudge) {
  if (!nudge) return ''
  if (nudge.preset === 'hand_in') {
    return nudge.assignment?.title
      ? t('school:nudges.presets.hand_in', { title: nudge.assignment.title })
      : t('school:nudges.presets.hand_in_generic')
  }
  if (NUDGE_PRESETS.includes(nudge.preset)) return t(`school:nudges.presets.${nudge.preset}`)
  return nudge.message ?? ''
}

export function nudgeTeacher(t, nudge) {
  const n = typeof nudge?.teacher_name === 'string' ? nudge.teacher_name.trim() : ''
  return n || t('school:nudges.student.your_teacher')
}

/// What the child's big button does: the linked assignment (if it is still
/// one they can write for), else the book in progress, the most recent
/// book, or a new one.
export function nudgeAction(nudge, { assignments = [], books = [], draft = null } = {}) {
  const linked = nudge?.assignment?.id ? assignments.find((a) => a.id === nudge.assignment.id) : null
  if (linked && linked.status === 'published' && !linked.my_submission) return { kind: 'assignment', assignment: linked }
  if (draftHasWork(draft)) return { kind: 'draft' }
  const recent = [...books].sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))[0]
  if (recent) return { kind: 'book', book: recent }
  return { kind: 'create' }
}

/// One line for the teacher after a send.
export function nudgeResultText(t, result) {
  const parts = []
  const sent = result?.sent?.length ?? 0
  const skipped = result?.skipped ?? []
  const capped = skipped.filter((s) => s.code === 'daily_cap').length
  if (sent) parts.push(t('school:nudges.teacher.sent_count', { count: sent }))
  if (capped) parts.push(t('school:nudges.teacher.capped_count', { count: capped }))
  if (skipped.length > capped || !parts.length) parts.push(t('school:teacher.errors.upstream'))
  return parts.join(' ')
}

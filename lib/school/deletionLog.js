// deletion_log (migration 028): the evidence trail for every deletion of
// school data — who asked, what, when, and how much — that an NDPA
// Exhibit D "certification of disposal" is written from.
//
// A row never holds a child's name or any content: ids, the action, the
// actor and row counts only. The row is written BEFORE the purge starts
// (status 'started') and closed after ('done' / 'failed'), so a crash
// mid-purge still leaves a trace. Callers fail closed when the opening
// write fails: no evidence, no deletion.

export const DELETION_ACTIONS = ['delete_student', 'delete_class', 'purge_removed_student', 'purge_lapsed_class']

/// Row counts for a deletion's evidence. Best-effort: an unreadable count
/// is recorded as null rather than blocking the deletion.
export async function countRows(sb, path) {
  try {
    const res = await sb(`${path}${path.includes('?') ? '&' : '?'}select=id&limit=1`, {
      headers: { Prefer: 'count=exact' },
    })
    if (!res.ok) return null
    const range = res.headers?.get?.('content-range') ?? ''
    const n = Number(range.split('/')[1])
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export async function studentCounts(sb, student) {
  const [hand_ins, check_ins, writing_year_items, books] = await Promise.all([
    countRows(sb, `/rest/v1/class_submissions?student_id=eq.${student.id}`),
    countRows(sb, `/rest/v1/class_checkins?student_id=eq.${student.id}`),
    countRows(sb, `/rest/v1/writing_year_items?student_id=eq.${student.id}`),
    student.auth_user_id ? countRows(sb, `/rest/v1/user_books?user_id=eq.${student.auth_user_id}`) : null,
  ])
  return { students: 1, hand_ins, check_ins, writing_year_items, books }
}

export async function classCounts(sb, classroomId) {
  const [students, assignments, hand_ins, check_ins] = await Promise.all([
    countRows(sb, `/rest/v1/class_students?classroom_id=eq.${classroomId}`),
    countRows(sb, `/rest/v1/assignments?classroom_id=eq.${classroomId}`),
    countRows(sb, `/rest/v1/class_submissions?classroom_id=eq.${classroomId}`),
    countRows(sb, `/rest/v1/class_checkins?classroom_id=eq.${classroomId}`),
  ])
  return { students, assignments, hand_ins, check_ins }
}

/// Opens a log row. Returns its id, or null when it could not be written.
export async function startDeletionLog(sb, { actorUserId = null, actorKind, action, classroomId = null, targetId = null, counts = {}, reason = null }) {
  try {
    const res = await sb('/rest/v1/deletion_log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        actor_user_id: actorUserId,
        actor_kind: actorKind,
        action,
        classroom_id: classroomId,
        target_id: targetId,
        counts,
        reason,
        status: 'started',
      }),
    })
    if (!res.ok) {
      console.error('[deletion-log] could not open a row', action, res.status)
      return null
    }
    const rows = await res.json().catch(() => null)
    return (Array.isArray(rows) ? rows[0]?.id : rows?.id) ?? null
  } catch (e) {
    console.error('[deletion-log] open threw', action, e?.message)
    return null
  }
}

/// Closes a log row. Best-effort: the deletion already happened (or didn't).
export async function finishDeletionLog(sb, id, ok) {
  if (id == null) return
  try {
    const res = await sb(`/rest/v1/deletion_log?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ status: ok ? 'done' : 'failed', completed_at: new Date().toISOString() }),
    })
    if (!res.ok) console.error('[deletion-log] could not close row', id, res.status)
  } catch (e) {
    console.error('[deletion-log] close threw', id, e?.message)
  }
}

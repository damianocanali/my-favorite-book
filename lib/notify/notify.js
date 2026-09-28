// Teacher notifications (spec §12). Every event becomes a bell row
// (teacher_notifications). Urgent kinds also fan out, per teacher_settings,
// to web push, APNs and email:
//   help_grownup   — only inside the class's school hours (§12.2)
//   all_handed_in  — any time, once per assignment (dedup_key)
// Nothing here ever throws into the caller: a child's help ask or hand-in
// must succeed even if every channel is down. Log and continue.
//
// Two phases, so the child never waits on a push service: the bell row is
// written (awaited) by startNotification / startHandIn, and the rest comes
// back as a `done` promise the endpoint hands to ctx.waitUntil via
// runAfterResponse.
import { sb } from '../../api/_school.js'
import { isWithinSchoolHours } from '../school/hours.js'
import { sendWebPush, vapidPublicKey } from './webpush.js'
import { requestApns } from './apns.js'
import { sendEmail, emailConfigured } from './email.js'
import { urgentMessage } from './text.js'

export const KINDS = ['hand_in', 'hand_in_late', 'resubmit', 'all_handed_in', 'help_book', 'help_grownup']
const HOURS_GATED = new Set(['help_grownup'])
// The only payload keys a bell row may carry. A caller can't smuggle a
// feeling or a need into a notification, even by accident. The student is
// stored by id and named at read time (api/school/notifications.js), so a
// renamed or removed child isn't frozen into old rows.
const PAYLOAD_KEYS = ['assignment_id', 'assignment_title', 'submission_id', 'help_id']
const DEFAULT_SETTINGS = { push_urgent: true, email_urgent: true }
const NAME_MAX = 80

const clip = (s) => (typeof s === 'string' ? s.slice(0, NAME_MAX) : null)

function cleanPayload(payload, { studentId, className }) {
  const out = { class_name: clip(className) }
  if (typeof studentId === 'string' && studentId) out.student_id = studentId.slice(0, 64)
  for (const k of PAYLOAD_KEYS) if (payload?.[k] != null) out[k] = typeof payload[k] === 'string' ? payload[k].slice(0, 200) : payload[k]
  return out
}

/**
 * Deferred work after the response: Vercel's ctx.waitUntil when there is
 * one (Edge), otherwise just await it (tests, other runtimes).
 */
export async function runAfterResponse(ctx, promise) {
  if (typeof ctx?.waitUntil === 'function') {
    ctx.waitUntil(promise)
    return
  }
  await promise
}

async function loadSettings(userId) {
  try {
    const res = await sb(`/rest/v1/teacher_settings?user_id=eq.${encodeURIComponent(userId)}&select=push_urgent,email_urgent`)
    if (!res.ok) throw new Error(`teacher_settings ${res.status}`)
    const rows = await res.json()
    return { ...DEFAULT_SETTINGS, ...(Array.isArray(rows) && rows[0] ? rows[0] : {}) }
  } catch (e) {
    // An urgent ask is worth more than a preference: fall back to the
    // defaults (both on) rather than dropping it silently.
    console.error('[notify] settings read failed, using defaults:', e?.message)
    return { ...DEFAULT_SETTINGS }
  }
}

async function pushToBrowsers(userId, msg) {
  if (!vapidPublicKey()) return sendWebPush({}, {}) // logs the no-op once
  const res = await sb(`/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=id,endpoint,p256dh,auth`)
  if (!res.ok) throw new Error(`push_subscriptions ${res.status}`)
  const subs = (await res.json()) || []
  const results = await Promise.all(
    subs.map(async (s) => ({ id: s.id, ...(await sendWebPush(s, { title: msg.title, body: msg.body, url: msg.url, tag: msg.tag })) }))
  )
  const gone = results.filter((r) => r.gone).map((r) => r.id)
  const used = results.filter((r) => r.ok).map((r) => r.id)
  const me = encodeURIComponent(userId)
  await Promise.all([
    gone.length && sb(`/rest/v1/push_subscriptions?id=in.(${gone.join(',')})&user_id=eq.${me}`, { method: 'DELETE' }),
    used.length && sb(`/rest/v1/push_subscriptions?id=in.(${used.join(',')})&user_id=eq.${me}`, {
      method: 'PATCH',
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    }),
  ])
}

async function emailTeacher(userId, msg) {
  if (!emailConfigured()) return sendEmail({}) // logs the no-op once
  const res = await sb(`/auth/v1/admin/users/${encodeURIComponent(userId)}`)
  if (!res.ok) throw new Error(`teacher lookup ${res.status}`)
  const user = await res.json()
  if (!user?.email) return
  await sendEmail({ to: user.email, subject: msg.subject, text: msg.emailText, html: msg.emailHtml })
}

async function fanOut({ teacherUserId, kind, classroom, studentName, payload }) {
  try {
    const msg = urgentMessage(kind, {
      studentName,
      className: classroom?.name,
      assignmentTitle: payload?.assignment_title,
      classroomId: classroom?.id,
      assignmentId: payload?.assignment_id,
      locale: classroom?.locale,
    })
    const tag = `${kind}:${payload?.help_id ?? payload?.assignment_id ?? ''}`
    const settings = await loadSettings(teacherUserId)
    const jobs = []
    if (settings.push_urgent) {
      jobs.push(pushToBrowsers(teacherUserId, { ...msg, tag }))
      jobs.push(requestApns({ userId: teacherUserId, title: msg.title, body: msg.body, url: msg.url, kind, tag }))
    }
    if (settings.email_urgent) jobs.push(emailTeacher(teacherUserId, msg))
    for (const r of await Promise.allSettled(jobs)) {
      if (r.status === 'rejected') console.error('[notify] channel failed:', r.reason?.message)
    }
  } catch (e) {
    console.error('[notify] fan-out failed:', e?.message)
  }
}

/**
 * Phase 1: write the bell row (awaited) and decide whether to fan out.
 * Phase 2 (push / APNs / email) is started but NOT awaited: it's `done`,
 * which never rejects. `fannedOut` says whether phase 2 sends anything.
 *
 * @param {object} a
 * @param {string} a.teacherUserId  the class owner's auth id
 * @param {string} a.kind           one of KINDS
 * @param {object} a.classroom      {id, name, timezone, school_hours, locale}
 * @param {string} [a.studentId]    stored on the bell row
 * @param {string} [a.studentName]  used only for push/email text, never stored
 * @param {boolean} [a.urgent]      fan out beyond the bell
 * @param {object} [a.payload]      assignment_id / assignment_title / submission_id / help_id
 * @param {string} [a.dedupKey]     makes the event fire at most once
 * @returns {Promise<{stored: boolean, fannedOut: boolean, done: Promise<void>}>}
 */
export async function startNotification({ teacherUserId, kind, classroom, studentId, studentName, urgent = false, payload = {}, dedupKey }) {
  const result = { stored: false, fannedOut: false, done: Promise.resolve() }
  try {
    if (!teacherUserId || !KINDS.includes(kind)) return result
    const row = {
      teacher_user_id: teacherUserId,
      classroom_id: classroom?.id ?? null,
      kind,
      payload: cleanPayload(payload, { studentId, className: classroom?.name }),
    }
    if (dedupKey) row.dedup_key = dedupKey
    const res = await sb(`/rest/v1/teacher_notifications${dedupKey ? '?on_conflict=dedup_key' : ''}`, {
      method: 'POST',
      headers: { Prefer: dedupKey ? 'resolution=ignore-duplicates,return=representation' : 'return=minimal' },
      body: JSON.stringify(row),
    })
    if (res.ok && dedupKey) {
      const rows = await res.json().catch(() => null)
      // Already sent for this event (ON CONFLICT DO NOTHING returned no row).
      if (!Array.isArray(rows) || !rows.length) return result
    }
    if (!res.ok) {
      console.error('[notify] bell row failed:', res.status)
      // A once-only event whose dedup insert failed can't prove it's the
      // first: stay quiet rather than risk sending it twice. An urgent help
      // ask has no such key and still goes out.
      if (dedupKey) return result
    } else {
      result.stored = true
    }

    if (!urgent) return result
    if (HOURS_GATED.has(kind) && !isWithinSchoolHours(classroom?.school_hours, classroom?.timezone)) return result
    result.fannedOut = true
    result.done = fanOut({ teacherUserId, kind, classroom, studentName, payload })
  } catch (e) {
    console.error('[notify] notification failed:', e?.message)
  }
  return result
}

/** Both phases, awaited. For callers with nothing to defer to. */
export async function notifyTeacher(args) {
  const { stored, fannedOut, done } = await startNotification(args)
  await done
  return { stored, fannedOut }
}

/**
 * After a successful hand-in. Phase 1 (awaited): the bell row (hand_in /
 * hand_in_late / resubmit). Phase 2 (`done`, never rejects): on a first
 * hand-in, the roster check and — if it completes the class — one
 * "everyone has handed in" alert.
 */
export async function startHandIn({ classroom, student, assignment, submission, late }) {
  const idle = { done: Promise.resolve() }
  try {
    const teacherUserId = classroom?.owner_user_id
    const resubmit = Number(submission?.version) > 1
    await notifyTeacher({
      teacherUserId,
      kind: resubmit ? 'resubmit' : late ? 'hand_in_late' : 'hand_in',
      classroom,
      studentId: student?.id,
      payload: { assignment_id: assignment?.id, assignment_title: assignment?.title, submission_id: submission?.id },
    })
    if (resubmit || !assignment?.id || !classroom?.id) return idle
    return { done: checkAllHandedIn({ teacherUserId, classroom, assignment }) }
  } catch (e) {
    console.error('[notify] hand-in notification failed:', e?.message)
    return idle
  }
}

async function checkAllHandedIn({ teacherUserId, classroom, assignment }) {
  try {
    const [sRes, subRes] = await Promise.all([
      sb(`/rest/v1/class_students?classroom_id=eq.${classroom.id}&status=eq.active&select=id`),
      sb(`/rest/v1/class_submissions?assignment_id=eq.${assignment.id}&select=student_id`),
    ])
    if (!sRes.ok || !subRes.ok) return
    const active = await sRes.json().catch(() => null)
    const handed = await subRes.json().catch(() => null)
    if (!Array.isArray(active) || !Array.isArray(handed) || !active.length) return
    const done = new Set(handed.map((h) => h.student_id))
    if (!active.every((s) => done.has(s.id))) return

    await notifyTeacher({
      teacherUserId,
      kind: 'all_handed_in',
      classroom,
      urgent: true,
      dedupKey: `all_handed_in:${assignment.id}`,
      payload: { assignment_id: assignment.id, assignment_title: assignment.title },
    })
  } catch (e) {
    console.error('[notify] all-handed-in check failed:', e?.message)
  }
}

/** Both phases of a hand-in, awaited. */
export async function notifyHandIn(args) {
  const { done } = await startHandIn(args)
  await done
}

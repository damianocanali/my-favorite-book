// Teacher notifications (spec §12). Every event becomes a bell row
// (teacher_notifications). Urgent kinds also fan out, per teacher_settings,
// to web push, APNs and email:
//   help_grownup   — only inside the class's school hours (§12.2)
//   all_handed_in  — any time, once per assignment (dedup_key)
// Nothing here ever throws into the caller: a child's help ask or hand-in
// must succeed even if every channel is down. Log and continue.
import { sb } from '../../api/_school.js'
import { isWithinSchoolHours } from '../school/hours.js'
import { sendWebPush, vapidPublicKey } from './webpush.js'
import { requestApns } from './apns.js'
import { sendEmail, emailConfigured } from './email.js'
import { urgentMessage } from './text.js'

export const KINDS = ['hand_in', 'hand_in_late', 'resubmit', 'all_handed_in', 'help_book', 'help_grownup']
const HOURS_GATED = new Set(['help_grownup'])
// The only payload keys a bell row may carry. A caller can't smuggle a
// feeling or a need into a notification, even by accident.
const PAYLOAD_KEYS = ['assignment_id', 'assignment_title', 'submission_id', 'help_id']
const DEFAULT_SETTINGS = { push_urgent: true, email_urgent: true }
const NAME_MAX = 80

const clip = (s) => (typeof s === 'string' ? s.slice(0, NAME_MAX) : null)

function cleanPayload(payload, { studentName, className }) {
  const out = { student_name: clip(studentName), class_name: clip(className) }
  for (const k of PAYLOAD_KEYS) if (payload?.[k] != null) out[k] = typeof payload[k] === 'string' ? payload[k].slice(0, 200) : payload[k]
  return out
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
  if (gone.length) {
    await sb(`/rest/v1/push_subscriptions?id=in.(${gone.join(',')})&user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE' })
  }
}

async function emailTeacher(userId, msg) {
  if (!emailConfigured()) return sendEmail({}) // logs the no-op once
  const res = await sb(`/auth/v1/admin/users/${encodeURIComponent(userId)}`)
  if (!res.ok) throw new Error(`teacher lookup ${res.status}`)
  const user = await res.json()
  if (!user?.email) return
  await sendEmail({ to: user.email, subject: msg.subject, text: msg.emailText, html: msg.emailHtml })
}

/**
 * @param {object} a
 * @param {string} a.teacherUserId  the class owner's auth id
 * @param {string} a.kind           one of KINDS
 * @param {object} a.classroom      {id, name, timezone, school_hours, locale}
 * @param {string} [a.studentName]
 * @param {boolean} [a.urgent]      fan out beyond the bell
 * @param {object} [a.payload]      assignment_id / assignment_title / submission_id / help_id
 * @param {string} [a.dedupKey]     makes the event fire at most once
 * @returns {Promise<{stored: boolean, fannedOut: boolean}>}
 */
export async function notifyTeacher({ teacherUserId, kind, classroom, studentName, urgent = false, payload = {}, dedupKey }) {
  const result = { stored: false, fannedOut: false }
  try {
    if (!teacherUserId || !KINDS.includes(kind)) return result
    const row = {
      teacher_user_id: teacherUserId,
      classroom_id: classroom?.id ?? null,
      kind,
      payload: cleanPayload(payload, { studentName, className: classroom?.name }),
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

    const msg = urgentMessage(kind, {
      studentName,
      className: classroom?.name,
      assignmentTitle: payload?.assignment_title,
      classroomId: classroom?.id,
      assignmentId: payload?.assignment_id,
      locale: classroom?.locale,
    })
    msg.tag = `${kind}:${payload?.help_id ?? payload?.assignment_id ?? ''}`
    const settings = await loadSettings(teacherUserId)
    const jobs = []
    if (settings.push_urgent) {
      jobs.push(pushToBrowsers(teacherUserId, msg))
      jobs.push(requestApns({ userId: teacherUserId, title: msg.title, body: msg.body, url: msg.url, kind }))
    }
    if (settings.email_urgent) jobs.push(emailTeacher(teacherUserId, msg))
    for (const r of await Promise.allSettled(jobs)) {
      if (r.status === 'rejected') console.error('[notify] channel failed:', r.reason?.message)
    }
  } catch (e) {
    console.error('[notify] notifyTeacher failed:', e?.message)
  }
  return result
}

/**
 * After a successful hand-in: a bell row (hand_in / hand_in_late /
 * resubmit), and — on a first hand-in that completes the class — one
 * "everyone has handed in" alert. Never throws.
 */
export async function notifyHandIn({ classroom, student, assignment, submission, late }) {
  try {
    const teacherUserId = classroom?.owner_user_id
    const resubmit = Number(submission?.version) > 1
    const payload = { assignment_id: assignment?.id, assignment_title: assignment?.title, submission_id: submission?.id }
    await notifyTeacher({
      teacherUserId,
      kind: resubmit ? 'resubmit' : late ? 'hand_in_late' : 'hand_in',
      classroom,
      studentName: student?.display_name,
      payload,
    })
    if (resubmit || !assignment?.id || !classroom?.id) return

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
    console.error('[notify] notifyHandIn failed:', e?.message)
  }
}

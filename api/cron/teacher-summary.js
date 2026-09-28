export const config = { runtime: 'edge' }

// Daily at 22:00 UTC (vercel.json; Vercel Hobby allows crons at most once
// a day). One summary email per teacher whose non-archived classes had
// activity since their last summary (spec §12.3): 'daily' teachers every
// run, 'weekly' teachers on Fridays, 'off' never. No settings row = daily.
//
// The activity log is the bell (teacher_notifications), so this reads
// what the teacher was already told, never check-ins or feelings.
//
// Batching: teachers are handled 50 at a time (every DB read is one
// `in.(...)` query per chunk) and each chunk's emails go out as ONE Resend
// batch call, which keeps a run inside Resend's rate limit and the Edge
// time budget. A teacher is stamped (last_summary_at) only after their
// batch is accepted, so a failed send rolls into the next run.
import { sb, sbEnv } from '../_school.js'
import { emailConfigured, sendEmailBatch } from '../../lib/notify/email.js'
import { summaryMessage } from '../../lib/notify/text.js'

const CHUNK = 50
const PAGE = 1000
const DAY_MS = 86400000
const ACTIVITY_KINDS = ['hand_in', 'hand_in_late', 'help_book', 'help_grownup']

const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))
const inList = (ids) => `in.(${ids.map(encodeURIComponent).join(',')})`

async function readJson(path) {
  const res = await sb(path)
  if (!res.ok) throw new Error(`${path.split('?')[0]} ${res.status}`)
  const rows = await res.json()
  return Array.isArray(rows) ? rows : []
}

async function hashHex(s) {
  const d = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  return [...d.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function listClasses() {
  const all = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await readJson(
      `/rest/v1/classrooms?archived_at=is.null&owner_user_id=not.is.null` +
        `&select=id,name,owner_user_id,locale&order=id.asc&limit=${PAGE}&offset=${offset}`
    )
    all.push(...page)
    if (page.length < PAGE) return all
  }
}

// Per class: counts since `since`, plus who hasn't handed in its newest
// published assignment.
async function classStats(classIds, eventsByClass) {
  if (!classIds.length) return new Map()
  const [assignments, students] = await Promise.all([
    readJson(`/rest/v1/assignments?classroom_id=${inList(classIds)}&status=eq.published&select=id,classroom_id,title,created_at&order=created_at.desc`),
    readJson(`/rest/v1/class_students?classroom_id=${inList(classIds)}&status=eq.active&select=id,classroom_id`),
  ])
  const openByClass = new Map()
  for (const a of assignments) if (!openByClass.has(a.classroom_id)) openByClass.set(a.classroom_id, a)
  const openIds = [...openByClass.values()].map((a) => a.id)
  const subs = openIds.length
    ? await readJson(`/rest/v1/class_submissions?assignment_id=${inList(openIds)}&select=assignment_id,student_id`)
    : []
  const handed = new Set(subs.map((s) => `${s.assignment_id}:${s.student_id}`))

  const stats = new Map()
  for (const id of classIds) {
    const ev = eventsByClass.get(id) ?? []
    const count = (k) => ev.filter((e) => e.kind === k).length
    const open = openByClass.get(id)
    const roster = students.filter((s) => s.classroom_id === id)
    stats.set(id, {
      handIns: count('hand_in') + count('hand_in_late'),
      late: count('hand_in_late'),
      helpAsks: count('help_book') + count('help_grownup'),
      open: open ? { title: open.title, notYet: roster.filter((s) => !handed.has(`${open.id}:${s.id}`)).length } : null,
    })
  }
  return stats
}

export default async function handler(req) {
  const secret = process.env.CRON_SECRET
  if (!secret || !safeEqual(req.headers.get('authorization') || '', `Bearer ${secret}`)) {
    return reply(401, { error: 'Unauthorized' })
  }
  if (!sbEnv()) return reply(503, { error: 'Not configured' })
  if (!emailConfigured()) {
    console.info('[teacher-summary] email not configured (RESEND_API_KEY/EMAIL_FROM); skipping')
    return reply(200, { skipped: 'email_not_configured' })
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const today = nowIso.slice(0, 10)
  const friday = now.getUTCDay() === 5

  let classes
  try {
    classes = await listClasses()
  } catch (e) {
    console.error('[teacher-summary] could not list classes:', e?.message)
    return reply(502, { error: 'Could not list classes' })
  }
  const classesByTeacher = new Map()
  for (const c of classes) {
    if (!classesByTeacher.has(c.owner_user_id)) classesByTeacher.set(c.owner_user_id, [])
    classesByTeacher.get(c.owner_user_id).push(c)
  }
  const teachers = [...classesByTeacher.keys()]
  const totals = { considered: teachers.length, sent: 0, skipped: 0, failed: 0 }

  for (const chunk of chunks(teachers, CHUNK)) {
    const before = totals.skipped + totals.sent + totals.failed
    try {
      const settingsRows = await readJson(`/rest/v1/teacher_settings?user_id=${inList(chunk)}&select=user_id,summary,last_summary_at`)
      const settings = new Map(settingsRows.map((s) => [s.user_id, s]))

      const due = []
      for (const uid of chunk) {
        const s = settings.get(uid)
        const summary = s?.summary ?? 'daily'
        const weekly = summary === 'weekly'
        if (summary === 'off' || (weekly && !friday)) {
          totals.skipped++
          continue
        }
        const fallback = new Date(now.getTime() - (weekly ? 7 : 1) * DAY_MS).toISOString()
        due.push({ uid, weekly, since: s?.last_summary_at || fallback })
      }
      if (!due.length) continue

      const minSince = due.map((d) => d.since).sort()[0]
      const events = await readJson(
        `/rest/v1/teacher_notifications?teacher_user_id=${inList(due.map((d) => d.uid))}` +
          `&created_at=gt.${encodeURIComponent(minSince)}&kind=${inList(ACTIVITY_KINDS)}` +
          `&select=teacher_user_id,classroom_id,kind,created_at&limit=20000`
      )

      // Keep each teacher's own events, since their own last summary, in
      // their own non-archived classes.
      const eventsByClass = new Map()
      const withActivity = []
      for (const d of due) {
        const mine = new Set(classesByTeacher.get(d.uid).map((c) => c.id))
        const ev = events.filter(
          (e) => e.teacher_user_id === d.uid && mine.has(e.classroom_id) && new Date(e.created_at) > new Date(d.since)
        )
        if (!ev.length) {
          totals.skipped++
          continue
        }
        for (const e of ev) {
          if (!eventsByClass.has(e.classroom_id)) eventsByClass.set(e.classroom_id, [])
          eventsByClass.get(e.classroom_id).push(e)
        }
        withActivity.push(d)
      }
      if (!withActivity.length) continue

      const stats = await classStats([...eventsByClass.keys()], eventsByClass)
      const outgoing = []
      await Promise.all(
        withActivity.map(async (d) => {
          const res = await sb(`/auth/v1/admin/users/${encodeURIComponent(d.uid)}`)
          const user = res.ok ? await res.json().catch(() => null) : null
          if (!user?.email) {
            totals.failed++
            return
          }
          const active = classesByTeacher.get(d.uid).filter((c) => eventsByClass.has(c.id))
          const msg = summaryMessage({
            weekly: d.weekly,
            locale: active[0]?.locale,
            classes: active.map((c) => ({ name: c.name, ...stats.get(c.id) })),
          })
          outgoing.push({ uid: d.uid, email: { to: user.email, subject: msg.subject, text: msg.text, html: msg.html } })
        })
      )
      if (!outgoing.length) continue

      outgoing.sort((a, b) => (a.uid < b.uid ? -1 : 1))
      const key = `teacher-summary:${today}:${await hashHex(outgoing.map((o) => o.uid).join(','))}`
      const sent = await sendEmailBatch(outgoing.map((o) => o.email), { idempotencyKey: key })
      if (!sent.ok) {
        totals.failed += outgoing.length
        continue
      }
      totals.sent += outgoing.length
      const stamp = await sb('/rest/v1/teacher_settings?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(outgoing.map((o) => ({ user_id: o.uid, last_summary_at: nowIso }))),
      })
      if (!stamp.ok) console.error('[teacher-summary] could not stamp last_summary_at:', stamp.status)
    } catch (e) {
      console.error('[teacher-summary] chunk failed:', e?.message)
      // Whoever in this chunk wasn't already counted as skipped/sent/failed.
      totals.failed += chunk.length - (totals.skipped + totals.sent + totals.failed - before)
    }
  }

  return reply(200, totals)
}

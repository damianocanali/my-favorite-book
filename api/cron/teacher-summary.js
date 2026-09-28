// Daily at 01:30 UTC (vercel.json; Vercel Hobby allows crons at most once a
// day). 01:30 UTC is late afternoon/evening on the US West Coast and
// overnight in Europe, so a US school day is complete when it runs. One
// summary email per teacher whose non-archived classes had activity since
// their last summary (spec §12.3): 'daily' teachers every run, 'weekly'
// teachers on the Saturday-UTC run (= Friday afternoon in the US), 'off'
// never. No settings row = daily.
//
// The activity log is the bell (teacher_notifications), so this reads what
// the teacher was already told, never check-ins or feelings.
//
// Node runtime with a 300 s budget. Every read is paged (limit/offset).
// Teachers are served longest-waiting first (never summarised, then oldest
// last_summary_at) in chunks of 50; each chunk's emails go out as ONE
// Resend batch call (Resend's rate limit). No new chunk starts after
// BUDGET_MS; whoever is left is logged as backlog and goes first next run.
// A teacher is stamped (last_summary_at) only after their batch is
// accepted, so a failed send rolls into the next run.
export const config = { runtime: 'nodejs', maxDuration: 300 }

import { sb, sbEnv } from '../_school.js'
import { emailConfigured, sendEmailBatch } from '../../lib/notify/email.js'
import { summaryMessage } from '../../lib/notify/text.js'

const CHUNK = 50
const PAGE = 1000
const DAY_MS = 86400000
const BUDGET_MS = 240_000 // of the 300 s maxDuration, leaving room for the last chunk
const ACTIVITY_KINDS = ['hand_in', 'hand_in_late', 'help_book', 'help_grownup']
const WEEKLY_UTC_DAY = 6 // Saturday 01:30 UTC = Friday afternoon/evening in the US

const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))
const inList = (ids) => `in.(${ids.map(encodeURIComponent).join(',')})`

// Every read goes through here: a stable `order` plus limit/offset pages
// until a short page, so no result is ever silently cut at PostgREST's cap.
async function readAll(path, order) {
  const all = []
  for (let offset = 0; ; offset += PAGE) {
    const res = await sb(`${path}&order=${order}&limit=${PAGE}&offset=${offset}`)
    if (!res.ok) throw new Error(`${path.split('?')[0]} ${res.status}`)
    const rows = await res.json()
    if (!Array.isArray(rows)) throw new Error(`${path.split('?')[0]} not a list`)
    all.push(...rows)
    if (rows.length < PAGE) return all
  }
}

async function hashHex(s) {
  const d = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  return [...d.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Per class: counts since `since`, plus who hasn't handed in its newest
// published assignment.
async function classStats(classIds, eventsByClass) {
  if (!classIds.length) return new Map()
  const [assignments, students] = await Promise.all([
    readAll(`/rest/v1/assignments?classroom_id=${inList(classIds)}&status=eq.published&select=id,classroom_id,title,created_at`, 'created_at.desc,id.asc'),
    readAll(`/rest/v1/class_students?classroom_id=${inList(classIds)}&status=eq.active&select=id,classroom_id`, 'id.asc'),
  ])
  const openByClass = new Map()
  for (const a of assignments) if (!openByClass.has(a.classroom_id)) openByClass.set(a.classroom_id, a)
  const openIds = [...openByClass.values()].map((a) => a.id)
  const subs = openIds.length
    ? await readAll(`/rest/v1/class_submissions?assignment_id=${inList(openIds)}&select=assignment_id,student_id`, 'assignment_id.asc,student_id.asc')
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

async function stamp(uids, nowIso) {
  const body = JSON.stringify(uids.map((user_id) => ({ user_id, last_summary_at: nowIso })))
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await sb('/rest/v1/teacher_settings?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body,
    }).catch(() => null)
    if (res?.ok) return true
  }
  // Not fatal: the Idempotency-Key stops a same-day re-send; tomorrow's
  // summary would just count from the older stamp.
  console.error('[teacher-summary] could not stamp last_summary_at for', uids.length, 'teachers')
  return false
}

async function processChunk(chunk, { classesByTeacher, now, nowIso, today, totals }) {
  const minSince = chunk.map((d) => d.since).sort()[0]
  const events = await readAll(
    `/rest/v1/teacher_notifications?teacher_user_id=${inList(chunk.map((d) => d.uid))}` +
      `&created_at=gt.${encodeURIComponent(minSince)}&kind=${inList(ACTIVITY_KINDS)}` +
      `&select=id,teacher_user_id,classroom_id,kind,created_at`,
    'created_at.asc,id.asc'
  )

  // Keep each teacher's own events, since their own last summary, in their
  // own non-archived classes.
  const eventsByClass = new Map()
  const withActivity = []
  for (const d of chunk) {
    const mine = new Set(classesByTeacher.get(d.uid).map((c) => c.id))
    const since = new Date(d.since)
    const ev = events.filter((e) => e.teacher_user_id === d.uid && mine.has(e.classroom_id) && new Date(e.created_at) > since)
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
  if (!withActivity.length) return

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
  if (!outgoing.length) return

  outgoing.sort((a, b) => (a.uid < b.uid ? -1 : 1))
  const key = `teacher-summary:${today}:${await hashHex(outgoing.map((o) => o.uid).join(','))}`
  const sent = await sendEmailBatch(outgoing.map((o) => o.email), { idempotencyKey: key })
  if (!sent.ok) {
    totals.failed += outgoing.length
    return
  }
  totals.sent += outgoing.length
  await stamp(outgoing.map((o) => o.uid), nowIso)
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (!secret || !safeEqual(request.headers.get('authorization') || '', `Bearer ${secret}`)) {
    return reply(401, { error: 'Unauthorized' })
  }
  if (!sbEnv()) return reply(503, { error: 'Not configured' })
  if (!emailConfigured()) {
    console.info('[teacher-summary] email not configured (RESEND_API_KEY/EMAIL_FROM); skipping')
    return reply(200, { skipped: 'email_not_configured' })
  }

  const started = Date.now()
  const now = new Date()
  const nowIso = now.toISOString()
  const today = nowIso.slice(0, 10)
  const weeklyDay = now.getUTCDay() === WEEKLY_UTC_DAY

  let classes, settingsRows
  try {
    ;[classes, settingsRows] = await Promise.all([
      readAll('/rest/v1/classrooms?archived_at=is.null&owner_user_id=not.is.null&select=id,name,owner_user_id,locale', 'id.asc'),
      readAll('/rest/v1/teacher_settings?select=user_id,summary,last_summary_at', 'user_id.asc'),
    ])
  } catch (e) {
    console.error('[teacher-summary] could not read classes/settings:', e?.message)
    return reply(502, { error: 'Could not list classes' })
  }

  const classesByTeacher = new Map()
  for (const c of classes) {
    if (!classesByTeacher.has(c.owner_user_id)) classesByTeacher.set(c.owner_user_id, [])
    classesByTeacher.get(c.owner_user_id).push(c)
  }
  const settings = new Map(settingsRows.map((s) => [s.user_id, s]))
  const totals = { considered: classesByTeacher.size, sent: 0, skipped: 0, failed: 0, backlog: 0 }

  const due = []
  for (const uid of classesByTeacher.keys()) {
    const s = settings.get(uid)
    const summary = s?.summary ?? 'daily'
    const weekly = summary === 'weekly'
    if (summary === 'off' || (weekly && !weeklyDay)) {
      totals.skipped++
      continue
    }
    const fallback = new Date(now.getTime() - (weekly ? 7 : 1) * DAY_MS).toISOString()
    due.push({ uid, weekly, last: s?.last_summary_at ?? null, since: s?.last_summary_at || fallback })
  }
  // Longest-waiting first: never summarised, then oldest stamp.
  due.sort((a, b) => {
    if (a.last === b.last) return a.uid < b.uid ? -1 : 1
    if (a.last === null) return -1
    if (b.last === null) return 1
    return a.last < b.last ? -1 : 1
  })

  const parts = chunks(due, CHUNK)
  for (let i = 0; i < parts.length; i++) {
    if (Date.now() - started > BUDGET_MS) {
      totals.backlog = parts.slice(i).reduce((n, c) => n + c.length, 0)
      console.info('[teacher-summary] time budget reached; backlog (teachers left for the next run):', totals.backlog)
      break
    }
    const before = totals.skipped + totals.sent + totals.failed
    try {
      await processChunk(parts[i], { classesByTeacher, now, nowIso, today, totals })
    } catch (e) {
      console.error('[teacher-summary] chunk failed:', e?.message)
      // Whoever in this chunk wasn't already counted as skipped/sent/failed.
      totals.failed += parts[i].length - (totals.skipped + totals.sent + totals.failed - before)
    }
  }

  return reply(200, totals)
}

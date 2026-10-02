// Nightly retention (vercel.json crons, 04:00 UTC — after purge-deletions).
// Privacy review §4.7 / §7.1, 7.2, 7.3, 7.5, 7.22, 7.23, 7.26. Each job is
// independent: one failing never stops the others, and every failure is
// counted, logged and emailed to the owner (counts and ids only).
//
//   checkins            class_checkins older than 30 days (spec §5a)
//   sign_in_attempts    student_sign_in_attempts older than 30 days
//   removed_students    students removed 30+ days ago → full account purge
//                       (purgeUser), with a deletion_log row each
//   licenses            lapse → warnings → class purge (lib/school/lifecycle.js)
//   class_deletes       resumes a teacher's class delete that stopped
//                       part-way (deletion_log 'partial', or 'started' and
//                       over an hour old)
//   legacy_submissions  after the sunset, ownerless legacy hand-ins (with a
//                       deletion_log row)
//   order_pdfs          consumer print PDFs (lib/print/orderRetention.js)
//   vendor_retries      queued Stripe / RevenueCat deletions
//
// DRY RUN: RETENTION_DRY_RUN is "true" unless it is exactly "false". A dry
// run reads only — it deletes nothing, emails no teacher, stamps nothing —
// and emails the owner a summary of what it WOULD do (counts and ids). The
// owner flips it to "false" after reviewing a run.
//
// Node runtime with a 300 s budget: a class purge is up to ~35 account
// purges. Batches are bounded; whatever is left goes first tomorrow.
// Needs migrations 026, 027, 028 and 031.
export const config = { runtime: 'nodejs', maxDuration: 300 }

import { purgeUser, purgeClassroom } from '../../lib/deleteUser.js'
import { runLicenseLifecycle } from '../../lib/school/lifecycle.js'
import { legacySunset, legacySunsetPassed } from '../../lib/school/legacy.js'
import { purgeOldOrderPdfs } from '../../lib/print/orderRetention.js'
import { retryVendorDeletions } from '../../lib/vendorDeletion.js'
import { startDeletionLog, finishDeletionLog, studentCounts, countRows } from '../../lib/school/deletionLog.js'
import { sendOwnerAlert, summaryLines } from '../../lib/notify/ownerAlert.js'

export const CHECKIN_RETENTION_DAYS = 30
export const ATTEMPT_RETENTION_DAYS = 30
export const REMOVED_STUDENT_DAYS = 30
const REMOVED_BATCH = 25
const RESUME_BATCH = 3
const DAY = 86400000

export const isDryRun = () => process.env.RETENTION_DRY_RUN !== 'false'

const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

const iso = (now, days) => encodeURIComponent(new Date(now - days * DAY).toISOString())

/// DELETE … returning only the count (Content-Range "*/N").
async function deleteWhere(sb, path) {
  const res = await sb(path, { method: 'DELETE', headers: { Prefer: 'return=minimal,count=exact' } })
  if (!res.ok) return { ok: false, deleted: 0, status: res.status }
  const n = Number((res.headers?.get?.('content-range') ?? '').split('/')[1])
  return { ok: true, deleted: Number.isFinite(n) ? n : 0 }
}

/// Age-based delete, or (dry run) its count.
async function ageJob(sb, path, dryRun) {
  if (dryRun) {
    const n = await countRows(sb, path)
    return { would_delete: n, failed: n == null ? 1 : 0 }
  }
  const r = await deleteWhere(sb, path)
  return { deleted: r.deleted, failed: r.ok ? 0 : 1 }
}

async function purgeRemovedStudents(sb, ctx, now, dryRun) {
  const out = { purged: 0, failed: 0 }
  const res = await sb(
    `/rest/v1/class_students?status=eq.removed&removed_at=lt.${iso(now, REMOVED_STUDENT_DAYS)}` +
      `&select=id,classroom_id,auth_user_id&order=removed_at.asc&limit=${REMOVED_BATCH}`
  )
  if (!res.ok) {
    console.error('[retention] could not list removed students', res.status)
    out.failed++
    return out
  }
  const rows = await res.json().catch(() => null)
  const list = Array.isArray(rows) ? rows : []
  if (dryRun) return { ...out, would_purge: list.length, student_ids: list.map((s) => s.id) }
  for (const s of list) {
    try {
      const logId = await startDeletionLog(sb, {
        actorKind: 'system', action: 'purge_removed_student', classroomId: s.classroom_id,
        targetId: s.id, counts: await studentCounts(sb, s), reason: `removed ${REMOVED_STUDENT_DAYS}+ days`,
      })
      if (logId == null) throw new Error('deletion log unavailable')
      const r = await purgeUser(s.auth_user_id, { ...ctx, skipVendors: true })
      await finishDeletionLog(sb, logId, r.ok)
      if (!r.ok) throw new Error('purge failed')
      out.purged++
    } catch (e) {
      out.failed++
      console.error('[retention] removed-student purge failed', s.id, e?.message)
    }
  }
  return out
}

/// A teacher's class delete that stopped part-way (api/school/classes.js
/// marks it 'partial'; a crash leaves 'started'). Finish it.
async function resumeClassDeletes(sb, ctx, now, dryRun) {
  const out = { resumed: 0, failed: 0 }
  const res = await sb(
    `/rest/v1/deletion_log?action=eq.delete_class&status=in.(started,partial)` +
      `&created_at=lt.${encodeURIComponent(new Date(now - 3600000).toISOString())}` +
      `&select=id,classroom_id,actor_user_id&order=created_at.asc&limit=${RESUME_BATCH}`
  )
  if (!res.ok) {
    out.failed++
    return out
  }
  const rows = await res.json().catch(() => null)
  const list = Array.isArray(rows) ? rows : []
  if (dryRun) return { ...out, would_resume: list.length, classroom_ids: list.map((r) => r.classroom_id) }
  for (const row of list) {
    try {
      const c = await sb(`/rest/v1/classrooms?id=eq.${row.classroom_id}&select=id,code`)
      if (!c.ok) throw new Error(`classroom ${c.status}`)
      const [classroom] = await c.json()
      if (!classroom) { // already gone
        await finishDeletionLog(sb, row.id, true)
        out.resumed++
        continue
      }
      const r = await purgeClassroom(classroom, { ...ctx, deletionLog: { actorKind: 'teacher', actorUserId: row.actor_user_id } })
      await finishDeletionLog(sb, row.id, r.ok ? true : 'partial')
      if (!r.ok) throw new Error('class purge failed')
      out.resumed++
    } catch (e) {
      out.failed++
      console.error('[retention] class delete resume failed', row.id, e?.message)
    }
  }
  return out
}

async function legacySubmissions(sb, now, dryRun) {
  if (!legacySunsetPassed(now)) return { deleted: 0, failed: 0, active: false }
  const path = `/rest/v1/submissions?user_id=is.null&submitted_at=lt.${encodeURIComponent(legacySunset().toISOString())}`
  const n = await countRows(sb, path)
  if (n == null) return { deleted: 0, failed: 1, active: true }
  if (dryRun) return { would_delete: n, failed: 0, active: true }
  if (n === 0) return { deleted: 0, failed: 0, active: true }
  const logId = await startDeletionLog(sb, {
    actorKind: 'system', action: 'legacy_sunset', counts: { submissions: n }, reason: 'anonymous legacy hand-ins after the sunset',
  })
  if (logId == null) return { deleted: 0, failed: 1, active: true }
  const r = await deleteWhere(sb, path)
  await finishDeletionLog(sb, logId, r.ok)
  return { deleted: r.deleted, failed: r.ok ? 0 : 1, active: true }
}

/// Runs one job, turning a throw into a counted failure.
async function job(name, fn) {
  try {
    return await fn()
  } catch (e) {
    console.error(`[retention] ${name} threw`, e?.message)
    return { failed: 1 }
  }
}

export async function GET(req) {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization') || ''
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) return reply(401, { error: 'Unauthorized' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return reply(503, { error: 'Not configured' })
  const ctx = {
    supabaseUrl, serviceKey,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    revenueCatKey: process.env.REVENUECAT_SECRET_API_KEY,
  }
  const sb = (path, init = {}) => fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const now = new Date()
  const dryRun = isDryRun()

  const result = { dry_run: dryRun }
  result.checkins = await job('checkins', () =>
    ageJob(sb, `/rest/v1/class_checkins?created_at=lt.${iso(now, CHECKIN_RETENTION_DAYS)}`, dryRun))
  result.sign_in_attempts = await job('sign_in_attempts', () =>
    ageJob(sb, `/rest/v1/student_sign_in_attempts?created_at=lt.${iso(now, ATTEMPT_RETENTION_DAYS)}`, dryRun))
  result.removed_students = await job('removed_students', () => purgeRemovedStudents(sb, ctx, now, dryRun))
  result.licenses = await job('licenses', () => runLicenseLifecycle(sb, ctx, { now, dryRun }))
  result.class_deletes = await job('class_deletes', () => resumeClassDeletes(sb, ctx, now, dryRun))
  result.legacy_submissions = await job('legacy_submissions', () => legacySubmissions(sb, now, dryRun))
  result.order_pdfs = await job('order_pdfs', () => purgeOldOrderPdfs({ supabaseUrl, serviceKey, now: now.getTime(), dryRun }))
  result.vendor_retries = await job('vendor_retries', () => retryVendorDeletions(sb, ctx, { dryRun }))

  const failed = Object.values(result).reduce((n, r) => n + (r?.failed ?? 0), 0)
  const unsendable = result.licenses?.unsendable ?? []
  const lines = summaryLines(result)
  // Ids (never names) for what needs a human, or what a dry run would touch.
  const idLines = []
  if (unsendable.length) idLines.push(`Lapse warnings NOT sent (no email provider or no teacher address), class ids: ${unsendable.join(', ')}`)
  if (dryRun) {
    const planned = result.licenses?.planned ?? []
    for (const p of planned) idLines.push(`would ${p.step}: class ${p.classroom_id} (license ${p.license_id})`)
    if (result.removed_students?.student_ids?.length) idLines.push(`would purge removed students: ${result.removed_students.student_ids.join(', ')}`)
    if (result.class_deletes?.classroom_ids?.length) idLines.push(`would resume class deletes: ${result.class_deletes.classroom_ids.join(', ')}`)
    if (result.order_pdfs?.order_ids?.length) idLines.push(`would purge print PDFs of orders: ${result.order_pdfs.order_ids.join(', ')}`)
  }
  console.log('[retention] run', JSON.stringify({ dry_run: dryRun, failed, lines }))
  if (dryRun || failed > 0 || unsendable.length) {
    const date = now.toISOString().slice(0, 10)
    await sendOwnerAlert({
      subject: dryRun ? `Retention DRY RUN: what tonight's run would do` : `Retention job: ${failed} failure(s)`,
      lines: [
        dryRun
          ? 'DRY RUN (RETENTION_DRY_RUN is not "false"): nothing was deleted, no teacher was emailed. Set RETENTION_DRY_RUN=false once this looks right.'
          : 'The nightly retention job (api/cron/retention.js) needs attention.',
        '', ...lines, ...(idLines.length ? ['', ...idLines] : []),
      ],
      idempotencyKey: `retention-${dryRun ? 'dry' : 'alert'}-${date}`,
    })
  }
  return reply(200, { ...result, failed })
}

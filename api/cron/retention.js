// Nightly retention (vercel.json crons, 04:00 UTC — after purge-deletions).
// Privacy review §4.7 / §7.1, 7.2, 7.5, 7.22, 7.23, 7.26. Each job is
// independent: one failing never stops the others, and every failure is
// counted, logged and emailed to the owner (counts and ids only).
//
//   checkins            class_checkins older than 30 days (spec §5a)
//   sign_in_attempts    student_sign_in_attempts older than 30 days
//   removed_students    students removed 30+ days ago → full account purge
//                       (purgeUser), with a deletion_log row each
//   licenses            lapse → warnings at 60/83 days → class purge at 90
//                       (lib/school/lifecycle.js)
//   legacy_submissions  after the sunset, ownerless legacy hand-ins
//   order_pdfs          consumer print PDFs 90 days after the order is final
//   vendor_retries      queued Stripe / RevenueCat deletions
//
// Node runtime with a 300 s budget: a class purge is up to ~35 account
// purges. Batches are bounded; whatever is left goes first tomorrow.
// Needs migrations 026, 027 and 028.
export const config = { runtime: 'nodejs', maxDuration: 300 }

import { purgeUser } from '../../lib/deleteUser.js'
import { runLicenseLifecycle } from '../../lib/school/lifecycle.js'
import { legacySunset, legacySunsetPassed } from '../../lib/school/legacy.js'
import { purgeOldOrderPdfs } from '../../lib/print/orderRetention.js'
import { retryVendorDeletions } from '../../lib/vendorDeletion.js'
import { startDeletionLog, finishDeletionLog, studentCounts } from '../../lib/school/deletionLog.js'
import { sendOwnerAlert, summaryLines } from '../../lib/notify/ownerAlert.js'

export const CHECKIN_RETENTION_DAYS = 30
export const ATTEMPT_RETENTION_DAYS = 30
export const REMOVED_STUDENT_DAYS = 30
const REMOVED_BATCH = 25
const DAY = 86400000

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

async function purgeRemovedStudents(sb, ctx, now) {
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
  for (const s of Array.isArray(rows) ? rows : []) {
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

  const result = {}
  result.checkins = await job('checkins', async () => {
    const r = await deleteWhere(sb, `/rest/v1/class_checkins?created_at=lt.${iso(now, CHECKIN_RETENTION_DAYS)}`)
    return { deleted: r.deleted, failed: r.ok ? 0 : 1 }
  })
  result.sign_in_attempts = await job('sign_in_attempts', async () => {
    const r = await deleteWhere(sb, `/rest/v1/student_sign_in_attempts?created_at=lt.${iso(now, ATTEMPT_RETENTION_DAYS)}`)
    return { deleted: r.deleted, failed: r.ok ? 0 : 1 }
  })
  result.removed_students = await job('removed_students', () => purgeRemovedStudents(sb, ctx, now))
  result.licenses = await job('licenses', () => runLicenseLifecycle(sb, ctx, { now }))
  result.legacy_submissions = await job('legacy_submissions', async () => {
    if (!legacySunsetPassed(now)) return { deleted: 0, failed: 0, active: false }
    const r = await deleteWhere(
      sb, `/rest/v1/submissions?user_id=is.null&submitted_at=lt.${encodeURIComponent(legacySunset().toISOString())}`
    )
    return { deleted: r.deleted, failed: r.ok ? 0 : 1, active: true }
  })
  result.order_pdfs = await job('order_pdfs', () => purgeOldOrderPdfs({ supabaseUrl, serviceKey, now: now.getTime() }))
  result.vendor_retries = await job('vendor_retries', () => retryVendorDeletions(sb, ctx))

  const failed = Object.values(result).reduce((n, r) => n + (r?.failed ?? 0), 0)
  if (failed > 0) {
    console.error('[retention] finished with failures', failed)
    await sendOwnerAlert({
      subject: `Retention job: ${failed} failure(s)`,
      lines: ['The nightly retention job (api/cron/retention.js) had failures.', '', ...summaryLines(result)],
      idempotencyKey: `retention-alert-${now.toISOString().slice(0, 10)}`,
    })
  }
  return reply(200, { ...result, failed })
}

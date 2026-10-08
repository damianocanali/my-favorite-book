// Reporting a referred family's FIRST paid payment to Atlas, and a refund of
// it. Single winner per row: every call goes through a conditional PATCH
// ("claim") so replayed or concurrent webhooks and the cron can never send
// /redeemed twice for one row.
//
// Never throws into a webhook: every exported entry point catches and logs
// (nonce prefix only — never a token, signature or secret).
import { atlasConfig, noncePrefix } from './referral.js'
import { reportRedeemed, reportReversed } from './callbacks.js'
import { getReferral, getReferralByExternalRef } from './store.js'
import { sendOwnerAlert } from '../notify/ownerAlert.js'

const T = '/rest/v1/atlas_referrals'
const REP = { Prefer: 'return=representation' }
const enc = encodeURIComponent

// Retry backoff after the 1st, 2nd, … failed attempt (minutes); the last
// value repeats. After MAX_ATTEMPTS the row is failed_final + owner alert.
export const BACKOFF_MIN = [1, 5, 30, 120, 720]
export const MAX_ATTEMPTS = 8
export const STALE_CLAIM_MS = 15 * 60 * 1000

export const backoffMs = (attempt) => BACKOFF_MIN[Math.min(Math.max(attempt, 1), BACKOFF_MIN.length) - 1] * 60000

async function rows(res, what) {
  if (!res.ok) throw new Error(`${what} ${res.status}`)
  const data = await res.json().catch(() => null)
  return Array.isArray(data) ? data : []
}

// ── owner alerts (no PII: counts, kinds, nonce prefixes) ─────────────────
const alerted = new Set()
export function _resetAlertsForTests() { alerted.clear() }

export async function alertOwnerOnce(kind, lines, { now = new Date() } = {}) {
  const day = now.toISOString().slice(0, 10)
  const key = `atlas-${kind}-${day}`
  if (alerted.has(key)) return
  alerted.add(key)
  try {
    await sendOwnerAlert({ subject: `Atlas referrals: ${kind.replace(/_/g, ' ')}`, lines, idempotencyKey: key })
  } catch { /* sendOwnerAlert never throws; belt and braces */ }
}

const CONFIG_MISSING_LINES = [
  'A referred family paid, but the Atlas callback settings are missing',
  '(PARTNER_CALLBACK_SECRET and/or ATLAS_BASE_URL). Nothing was sent to Atlas.',
  'The payment is recorded; the nightly retention cron reports it once the settings are in place.',
]

// ── first payment ────────────────────────────────────────────────────────

/**
 * A paid payment was seen for this account. Records it against the
 * account's referral row (first one only) and reports it.
 *
 * @param {object} p
 * @param {string} p.userId
 * @param {string} p.externalRef   Stripe subscription id / App Store original_transaction_id
 * @param {string} [p.paymentRef]  Stripe invoice id / store transaction id
 * @param {(row) => Promise<boolean>|boolean} [p.precheck]  extra "is this really the first paid payment" check, run only when a row exists
 * @param {object} [deps] { sb, cfg, fetchImpl, now }
 * @returns {Promise<{ result: string, deferred?: Promise }>} `deferred` is the Atlas call, for ctx.waitUntil
 */
export async function recordFirstPayment({ userId, externalRef, paymentRef = null, precheck }, deps = {}) {
  const cfg = deps.cfg ?? atlasConfig()
  if (!cfg.capture || !userId || !externalRef) return { result: 'off' }
  const now = deps.now ?? new Date()
  try {
    const row = await getReferral(deps.sb, userId)
    if (!row) return { result: 'no_referral' }
    if (row.external_ref == null) {
      if (row.report_status !== 'pending') return { result: 'not_pending' }
      if (precheck && !(await precheck(row))) return { result: 'not_first_payment' }
      const r = await deps.sb(`${T}?user_id=eq.${enc(userId)}&external_ref=is.null&report_status=eq.pending`, {
        method: 'PATCH', headers: REP,
        body: JSON.stringify({ external_ref: String(externalRef).slice(0, 200), payment_ref: paymentRef ? String(paymentRef).slice(0, 200) : null, paid_at: now.toISOString(), next_attempt_at: null, updated_at: now.toISOString() }),
      })
      await rows(r, 'atlas_referrals record')
    }
    if (!cfg.callbacks) {
      console.warn('[atlas] payment recorded, callbacks not configured; left pending', `nonce=${noncePrefix(row.nonce)}`)
      await alertOwnerOnce('callbacks_not_configured', CONFIG_MISSING_LINES, { now })
      return { result: 'recorded_no_config' }
    }
    return { result: 'recorded', deferred: processReport(userId, { ...deps, cfg }) }
  } catch (e) {
    console.error('[atlas] recordFirstPayment failed', e?.message)
    return { result: 'error' }
  }
}

/**
 * Claims the row (pending + payment seen + due) and calls /redeemed.
 * Exactly one concurrent caller wins the claim; the rest return claimed:false.
 */
export const processReport = (userId, deps = {}) => claimAndReport(`user_id=eq.${enc(userId)}`, deps)
/// Same, by row id (the cron; also reaches rows detached by an account purge).
export const processReportRow = (rowId, deps = {}) => claimAndReport(`id=eq.${enc(rowId)}`, deps)

async function claimAndReport(match, deps) {
  const cfg = deps.cfg ?? atlasConfig()
  if (!cfg.callbacks) return { claimed: false, outcome: 'off' }
  const sb = deps.sb
  const now = deps.now ?? new Date()
  try {
    const nowIso = enc(now.toISOString())
    const claim = await sb(
      `${T}?${match}&report_status=eq.pending&external_ref=not.is.null&reversal_status=is.null` +
        `&or=(next_attempt_at.is.null,next_attempt_at.lte.${nowIso})`,
      { method: 'PATCH', headers: REP, body: JSON.stringify({ report_status: 'reporting', updated_at: now.toISOString() }) }
    )
    const [row] = await rows(claim, 'atlas_referrals claim')
    if (!row) return { claimed: false }

    const attempts = (row.report_attempts ?? 0) + 1
    const r = await reportRedeemed({ token: row.token, externalRef: row.external_ref }, cfg, deps)
    // A timeout / 5xx may still have been recorded by Atlas.
    const maybeRecorded = !!row.report_maybe_recorded || r.outcome === 'retry'
    const tag = `nonce=${noncePrefix(row.nonce)}`
    let patch
    if (r.outcome === 'recorded' || r.outcome === 'already_redeemed') {
      patch = { report_status: 'reported', reported_status: r.outcome, reported_at: now.toISOString(), last_error: null, next_attempt_at: null }
      console.log('[atlas] redeemed', r.outcome, tag)
    } else if (r.outcome === 'invalid') {
      patch = { report_status: 'failed_final', last_error: `atlas_${r.httpStatus}_invalid_or_expired`, next_attempt_at: null }
      console.warn('[atlas] redeemed rejected (invalid/expired), not retrying', tag)
    } else if (r.outcome === 'config_error') {
      patch = { report_status: 'config_error', last_error: `atlas_${r.httpStatus}_config`, next_attempt_at: null }
      console.error('[atlas] redeemed: Atlas refused our credentials/URL', r.httpStatus, tag)
      await alertOwnerOnce('config_error', [
        `Atlas answered ${r.httpStatus} to /api/referral/redeemed: check PARTNER_CALLBACK_SECRET and ATLAS_BASE_URL.`,
        'Affected rows have report_status = config_error. After fixing, reset them to pending',
        '(refunded payments are excluded: they are failed_final / have a reversal_status, and must never be reported):',
        "  update atlas_referrals set report_status = 'pending', next_attempt_at = null where report_status = 'config_error' and reversal_status is null;",
      ], { now })
    } else if (attempts >= MAX_ATTEMPTS) {
      patch = { report_status: 'failed_final', last_error: `gave_up_after_${attempts}_${r.error ?? r.httpStatus}`, next_attempt_at: null }
      r.outcome = 'gave_up'
      console.error('[atlas] redeemed: giving up after retries', tag)
      await alertOwnerOnce('report_gave_up', [`A referral report to Atlas failed ${attempts} times and was given up (${tag}).`], { now })
    } else {
      patch = { report_status: 'pending', last_error: `retry_${r.error ?? r.httpStatus}`, next_attempt_at: new Date(now.getTime() + backoffMs(attempts)).toISOString() }
      console.warn('[atlas] redeemed: will retry', r.error ?? r.httpStatus, tag)
    }
    await sb(`${T}?id=eq.${enc(row.id)}&report_status=eq.reporting`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...patch, report_attempts: attempts, report_maybe_recorded: maybeRecorded, updated_at: now.toISOString() }),
    })
    // A refund may have arrived while the call was in flight (recordRefund
    // marks reversal_status = 'pending' on a 'reporting' row). Re-read:
    //   reported now                   → reverse straight away;
    //   not reported, maybe recorded   → /reversed anyway (refunded_uncertain);
    //   not reported, surely not       → never report it (refunded_before_report).
    await settleRefundDuringReport(row.id, { ...deps, cfg, now })
    return { claimed: true, outcome: r.outcome }
  } catch (e) {
    console.error('[atlas] processReport failed', e?.message)
    return { claimed: false, outcome: 'error' }
  }
}

// ── refunds ──────────────────────────────────────────────────────────────

async function settleRefundDuringReport(rowId, deps) {
  const { sb, now } = deps
  const [fresh] = await rows(await sb(`${T}?id=eq.${enc(rowId)}&select=*`), 'atlas_referrals reread')
  if (!fresh || fresh.reversal_status !== 'pending') return
  if (fresh.report_status === 'reported') {
    await processReversal(fresh.id, deps)
  } else if (['pending', 'config_error', 'failed_final'].includes(fresh.report_status)) {
    if ((await settleUnreportedRefund(sb, fresh, now)) === 'reverse') await processReversal(fresh.id, deps)
  }
}

/// A full refund of a payment that was never confirmed reported.
///   Atlas may have recorded it (an attempt timed out / got a 5xx, or a
///   claim was released after its worker died) → stop reporting and send
///   /reversed anyway: Atlas answers not_billable if it never recorded it.
///   Surely never recorded → cancel the report for good, send nothing.
/// → 'reverse' | 'cancelled' | null (the row moved on meanwhile)
async function settleUnreportedRefund(sb, row, now) {
  if (row.report_maybe_recorded) {
    const r = await sb(`${T}?id=eq.${enc(row.id)}&report_status=in.(pending,config_error,failed_final)&reported_at=is.null`, {
      method: 'PATCH', headers: REP,
      body: JSON.stringify({
        report_status: 'failed_final', last_error: 'refunded_uncertain', next_attempt_at: null,
        reversal_status: 'pending', reversal_next_attempt_at: null, updated_at: now.toISOString(),
      }),
    })
    const hit = (await rows(r, 'atlas_referrals uncertain')).length > 0
    if (hit) console.log('[atlas] refunded with an uncertain report; sending /reversed anyway', `nonce=${noncePrefix(row.nonce)}`)
    return hit ? 'reverse' : null
  }
  return (await cancelUnreported(sb, row, now)) ? 'cancelled' : null
}

/// Refunded before Atlas ever recorded it: the report must never be sent,
/// now or after an owner's config_error reset.
async function cancelUnreported(sb, row, now) {
  const r = await sb(`${T}?id=eq.${enc(row.id)}&report_status=in.(pending,config_error)&report_maybe_recorded=is.false`, {
    method: 'PATCH', headers: REP,
    body: JSON.stringify({ report_status: 'failed_final', last_error: 'refunded_before_report', next_attempt_at: null, updated_at: now.toISOString() }),
  })
  const hit = (await rows(r, 'atlas_referrals cancel')).length > 0
  if (hit) console.log('[atlas] refunded before reporting; report cancelled', `nonce=${noncePrefix(row.nonce)}`)
  return hit
}

/// The row a refund is about: by the specific payment first (survives an
/// account purge, which detaches the row), else by the subscription /
/// original transaction.
async function findRefundRow(sb, { externalRef, paymentRef }) {
  if (paymentRef) {
    const r = await sb(`${T}?payment_ref=eq.${enc(paymentRef)}&select=*&limit=1`)
    const [row] = await rows(r, 'atlas_referrals read')
    if (row) return row
  }
  return externalRef ? getReferralByExternalRef(sb, externalRef) : null
}

/**
 * A FULL refund of the first paid payment (the callers only pass full
 * refunds: owner ruling — a partial refund keeps Atlas's fee). Matched by
 * payment_ref first (works for a row detached by an account purge), else by
 * external ref; a refund of a later payment is ignored.
 * Refunded before it was ever reported (pending / config_error) → the
 * report is cancelled for good (failed_final, refunded_before_report).
 */
export async function recordRefund({ externalRef, paymentRef = null }, deps = {}) {
  const cfg = deps.cfg ?? atlasConfig()
  if (!cfg.capture || (!externalRef && !paymentRef)) return { result: 'off' }
  const sb = deps.sb
  const now = deps.now ?? new Date()
  try {
    const row = await findRefundRow(sb, { externalRef, paymentRef })
    if (!row) return { result: 'no_referral' }
    if (paymentRef && row.payment_ref && paymentRef !== row.payment_ref) return { result: 'not_first_payment' }
    if (row.reversal_status && row.reversal_status !== 'pending') return { result: 'already_handled' }
    // Not confirmed reported (pending, config_error waiting for an owner
    // reset, or given up): cancel for good — or, if Atlas may have recorded
    // it, reverse anyway.
    if (['pending', 'config_error', 'failed_final'].includes(row.report_status) && row.reported_at == null && !row.reversal_status) {
      const how = await settleUnreportedRefund(sb, row, now)
      if (how === 'cancelled') return { result: 'report_cancelled' }
      if (how === 'reverse') {
        if (!cfg.callbacks) {
          await alertOwnerOnce('callbacks_not_configured', CONFIG_MISSING_LINES, { now })
          return { result: 'marked_no_config' }
        }
        return { result: 'reversing_uncertain', deferred: processReversal(row.id, { ...deps, cfg }) }
      }
      if (row.report_status === 'failed_final') return { result: 'never_reported' }
    }
    // Otherwise reported, or 'reporting' right now (settled when it lands).
    if (!row.reversal_status) {
      await rows(await sb(`${T}?id=eq.${enc(row.id)}&reversal_status=is.null`, {
        method: 'PATCH', headers: REP,
        body: JSON.stringify({ reversal_status: 'pending', reversal_next_attempt_at: null, updated_at: now.toISOString() }),
      }), 'atlas_referrals reversal mark')
    }
    if (!cfg.callbacks) {
      await alertOwnerOnce('callbacks_not_configured', CONFIG_MISSING_LINES, { now })
      return { result: 'marked_no_config' }
    }
    return { result: 'marked', deferred: processReversal(row.id, { ...deps, cfg }) }
  } catch (e) {
    console.error('[atlas] recordRefund failed', e?.message)
    return { result: 'error' }
  }
}

/// Claims a pending reversal on a REPORTED row and calls /reversed. Refunds
/// ignore token expiry (Atlas checks only the signature).
export async function processReversal(rowId, deps = {}) {
  const cfg = deps.cfg ?? atlasConfig()
  if (!cfg.callbacks) return { claimed: false, outcome: 'off' }
  const sb = deps.sb
  const now = deps.now ?? new Date()
  try {
    const claim = await sb(
      `${T}?id=eq.${enc(rowId)}&reversal_status=eq.pending&report_status=in.(reported,failed_final)` +
        `&or=(reversal_next_attempt_at.is.null,reversal_next_attempt_at.lte.${enc(now.toISOString())})`,
      { method: 'PATCH', headers: REP, body: JSON.stringify({ reversal_status: 'reversing', updated_at: now.toISOString() }) }
    )
    const [row] = await rows(claim, 'atlas_referrals reversal claim')
    if (!row) return { claimed: false }
    const attempts = (row.reversal_attempts ?? 0) + 1
    const r = await reportReversed({ token: row.token, reason: 'refunded' }, cfg, deps)
    const tag = `nonce=${noncePrefix(row.nonce)}`
    let patch
    if (r.outcome === 'reversed' || r.outcome === 'not_billable') {
      patch = { reversal_status: r.outcome, reversed_at: now.toISOString(), reversal_next_attempt_at: null }
      console.log('[atlas] reversed', r.outcome, tag)
    } else if (r.outcome === 'invalid') {
      patch = { reversal_status: 'failed_final', last_error: `reversal_atlas_${r.httpStatus}`, reversal_next_attempt_at: null }
      console.warn('[atlas] reversal rejected, not retrying', tag)
    } else if (r.outcome === 'config_error') {
      patch = { reversal_status: 'config_error', last_error: `reversal_atlas_${r.httpStatus}_config`, reversal_next_attempt_at: null }
      await alertOwnerOnce('config_error', [`Atlas answered ${r.httpStatus} to /api/referral/reversed: check PARTNER_CALLBACK_SECRET and ATLAS_BASE_URL.`], { now })
    } else if (attempts >= MAX_ATTEMPTS) {
      patch = { reversal_status: 'failed_final', last_error: `reversal_gave_up_${r.error ?? r.httpStatus}`, reversal_next_attempt_at: null }
      r.outcome = 'gave_up'
      await alertOwnerOnce('reversal_gave_up', [`A refund report to Atlas failed ${attempts} times and was given up (${tag}).`], { now })
    } else {
      patch = { reversal_status: 'pending', last_error: `reversal_retry_${r.error ?? r.httpStatus}`, reversal_next_attempt_at: new Date(now.getTime() + backoffMs(attempts)).toISOString() }
    }
    await sb(`${T}?id=eq.${enc(row.id)}&reversal_status=eq.reversing`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...patch, reversal_attempts: attempts, updated_at: now.toISOString() }),
    })
    return { claimed: true, outcome: r.outcome }
  } catch (e) {
    console.error('[atlas] processReversal failed', e?.message)
    return { claimed: false, outcome: 'error' }
  }
}

// ── nightly cron (api/cron/retention.js) ─────────────────────────────────

/**
 * Releases stale claims, retries due reports and reversals, and (unless a
 * dry run) deletes codes that expired over a day ago. Counts only.
 * `failed` counts NEW terminal problems, which makes the retention job
 * email the owner.
 */
export const DETACHED_RETENTION_DAYS = 180

async function deleteDetached(sb, now, dryRun) {
  const cutoff = enc(new Date(now.getTime() - DETACHED_RETENTION_DAYS * 86400000).toISOString())
  const paths = [
    `${T}?user_id=is.null&reversed_at=lt.${cutoff}`,
    `${T}?user_id=is.null&reversed_at=is.null&reported_at=lt.${cutoff}`,
    `${T}?user_id=is.null&reversed_at=is.null&reported_at=is.null&detached_at=lt.${cutoff}`,
  ]
  let n = 0
  for (const path of paths) {
    if (dryRun) {
      n += (await rows(await sb(`${path}&select=id`), 'atlas detached count')).length
    } else {
      const r = await sb(path, { method: 'DELETE', headers: { Prefer: 'return=representation' } })
      if (r.status === 204) continue
      n += (await rows(r, 'atlas detached delete')).length
    }
  }
  return n
}

// The cron step's own budget, so a hanging Atlas can never eat the shared
// retention function's 300 s (each call also times out after 8 s). Rows not
// reached stay pending for tomorrow.
export const CRON_DEADLINE_MS = 60_000
export const CRON_CALL_TIMEOUT_MS = 8_000

export async function runAtlasCron(sb, {
  now = new Date(), dryRun = false, cfg = atlasConfig(), fetchImpl,
  deadlineMs = CRON_DEADLINE_MS, timeoutMs = CRON_CALL_TIMEOUT_MS, clock = Date.now,
} = {}) {
  if (!cfg.capture) return { skipped: true, failed: 0 }
  const started = clock()
  const outOfTime = () => clock() - started >= deadlineMs
  const out = { reported: 0, retried: 0, reversed: 0, failed_final: 0, config_error: 0, codes_deleted: 0, detached_deleted: 0, deferred: 0, failed: 0 }
  const stale = enc(new Date(now.getTime() - STALE_CLAIM_MS).toISOString())
  const nowIso = enc(now.toISOString())
  const patch = (path, body) => sb(path, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...body, updated_at: now.toISOString() }) })

  // A worker that died mid-call leaves 'reporting'; Atlas is idempotent, so
  // releasing it for a retry is safe — but Atlas MAY have recorded it. One
  // that a refund already touched goes straight to the reversal claim.
  await patch(`${T}?report_status=eq.reporting&updated_at=lt.${stale}&reversal_status=eq.pending`,
    { report_status: 'failed_final', last_error: 'refunded_uncertain', report_maybe_recorded: true, next_attempt_at: null })
  await patch(`${T}?report_status=eq.reporting&updated_at=lt.${stale}`,
    { report_status: 'pending', report_maybe_recorded: true, last_error: 'released_stale_claim' })
  await patch(`${T}?reversal_status=eq.reversing&updated_at=lt.${stale}`, { reversal_status: 'pending' })

  // Rows detached by an account purge keep pseudonymous ids only for the
  // refund/dispute window: deleted 180 days after the reversal, or after
  // the report (or the detach, for one that was never reported).
  out.detached_deleted = await deleteDetached(sb, now, dryRun)

  if (!dryRun) {
    const d = await sb(`/rest/v1/atlas_referral_codes?expires_at=lt.${enc(new Date(now.getTime() - 86400000).toISOString())}`, {
      method: 'DELETE', headers: { Prefer: 'return=minimal,count=exact' },
    })
    const n = Number((d.headers?.get?.('content-range') ?? '').split('/')[1])
    out.codes_deleted = Number.isFinite(n) ? n : 0
  }

  const due = await rows(await sb(
    `${T}?report_status=eq.pending&external_ref=not.is.null&reversal_status=is.null&or=(next_attempt_at.is.null,next_attempt_at.lte.${nowIso})` +
      `&select=id&order=paid_at.asc&limit=50`
  ), 'atlas due')
  const dueRev = await rows(await sb(
    `${T}?reversal_status=eq.pending&report_status=in.(reported,failed_final)` +
      `&or=(reversal_next_attempt_at.is.null,reversal_next_attempt_at.lte.${nowIso})&select=id&limit=50`
  ), 'atlas reversals due')

  if (!cfg.callbacks) {
    if (due.length || dueRev.length) {
      await alertOwnerOnce('callbacks_not_configured', CONFIG_MISSING_LINES, { now })
      out.failed = 1
    }
    return { ...out, waiting: due.length + dueRev.length }
  }

  const deps = { sb, cfg, now, fetchImpl, timeoutMs }
  for (const [i, { id }] of due.entries()) {
    if (outOfTime()) { out.deferred += due.length - i + dueRev.length; return out }
    const r = await processReportRow(id, deps)
    if (!r.claimed) continue
    if (r.outcome === 'recorded' || r.outcome === 'already_redeemed') out.reported++
    else if (r.outcome === 'retry') out.retried++
    else if (r.outcome === 'config_error') { out.config_error++; out.failed++ } else { out.failed_final++; out.failed++ }
  }
  for (const [i, { id }] of dueRev.entries()) {
    if (outOfTime()) { out.deferred += dueRev.length - i; return out }
    const r = await processReversal(id, deps)
    if (!r.claimed) continue
    if (r.outcome === 'reversed' || r.outcome === 'not_billable') out.reversed++
    else if (r.outcome === 'retry') out.retried++
    else { out.failed++ }
  }
  return out
}

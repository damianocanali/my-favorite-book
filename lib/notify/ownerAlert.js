// Operational alerts to the owner (privacy review §4.10 / §7.26): a purge
// or retention job that failed, a class whose sign-in was paused by the
// attack throttle.
//
// To: OWNER_ALERT_EMAIL, falling back to PRINT_OPS_EMAIL. Missing both (or
// Resend not configured) → a logged no-op. Never throws.
//
// NO PII: callers pass counts, job names and opaque ids only — never a
// child's name, an email address or a feeling. The body is plain text.
import { sendEmail } from './email.js'
import { infoOnce } from './log.js'

export function ownerAlertAddress() {
  return process.env.OWNER_ALERT_EMAIL || process.env.PRINT_OPS_EMAIL || null
}

/**
 * @param {{ subject: string, lines: string[], idempotencyKey?: string }} a
 * @returns {Promise<{ok: boolean, skipped?: boolean}>}
 */
export async function sendOwnerAlert({ subject, lines, idempotencyKey }) {
  const to = ownerAlertAddress()
  if (!to) {
    infoOnce('owner-alert', '[owner-alert] OWNER_ALERT_EMAIL/PRINT_OPS_EMAIL not set; skipping')
    return { ok: false, skipped: true }
  }
  try {
    return await sendEmail({
      to,
      subject: `[My Book Lab] ${subject}`,
      text: [...lines, '', 'Details are in the Vercel function logs for this run.'].join('\n'),
      idempotencyKey,
    })
  } catch (e) {
    console.error('[owner-alert] send failed', e?.message)
    return { ok: false }
  }
}

/// Flattens a job's result into "key: value" lines, numbers and booleans
/// only, so a caller can't leak a string by accident.
export function summaryLines(result, prefix = '') {
  const out = []
  for (const [k, v] of Object.entries(result ?? {})) {
    if (typeof v === 'number' || typeof v === 'boolean') out.push(`${prefix}${k}: ${v}`)
    else if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...summaryLines(v, `${prefix}${k}.`))
  }
  return out
}

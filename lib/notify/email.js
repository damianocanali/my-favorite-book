// Email through Resend's REST API (no SDK: Edge-friendly fetch).
// Env: RESEND_API_KEY, EMAIL_FROM ("My Book Lab <hello@mybooklab.app>").
// Missing either → a logged no-op.
import { infoOnce } from './log.js'

const TIMEOUT_MS = 8000

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

/** Never throws. `idempotencyKey` makes a retried cron run send once. */
export async function sendEmail({ to, subject, text, html, idempotencyKey }) {
  if (!emailConfigured()) {
    infoOnce('email', '[notify] email not configured (RESEND_API_KEY/EMAIL_FROM); skipping')
    return { ok: false, skipped: true }
  }
  try {
    const headers = { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
    const payload = { from: process.env.EMAIL_FROM, to: [to], subject, text }
    if (html) payload.html = html
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) console.error('[notify] email rejected:', res.status)
    return { ok: res.ok, status: res.status }
  } catch (e) {
    console.error('[notify] email failed:', e?.message)
    return { ok: false, status: 0 }
  }
}

export const BATCH_MAX = 100

/**
 * Up to 100 emails in one Resend call (POST /emails/batch). Used by the
 * summary cron so a day's emails fit Resend's per-second rate limit and the
 * Edge time budget. Returns {ok} for the whole batch; network errors never
 * throw (an over-size batch is a programming error and does).
 */
export async function sendEmailBatch(messages, { idempotencyKey } = {}) {
  if (messages.length > BATCH_MAX) throw new Error(`batch over ${BATCH_MAX}`)
  if (!emailConfigured()) {
    infoOnce('email', '[notify] email not configured (RESEND_API_KEY/EMAIL_FROM); skipping')
    return { ok: false, skipped: true }
  }
  if (!messages.length) return { ok: true, status: 200 }
  try {
    const headers = { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
    const from = process.env.EMAIL_FROM
    const body = messages.map(({ to, subject, text, html }) => ({ from, to: [to], subject, text, ...(html ? { html } : {}) }))
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) console.error('[notify] email batch rejected:', res.status)
    return { ok: res.ok, status: res.status }
  } catch (e) {
    console.error('[notify] email batch failed:', e?.message)
    return { ok: false, status: 0 }
  }
}

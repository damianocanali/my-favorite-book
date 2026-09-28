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

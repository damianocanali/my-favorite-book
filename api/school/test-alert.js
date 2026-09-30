export const config = { runtime: 'edge' }

// "Send a test alert" (Account → Class notifications, iOS). A teacher whose
// alerts never seem to arrive can prove the path end to end: this sends one
// push to the CALLER's own iOS devices only (the APNs worker looks tokens up
// by the caller's own auth id — there is no parameter to aim it anywhere
// else) and ignores school hours, since the point is to check the device
// now. Rate-limited so it can't be used to buzz a phone repeatedly.
import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireTeacher, json } from '../_school.js'
import { requestApns } from '../../lib/notify/apns.js'

// Per teacher, per hour (checkRateLimit's window).
export const TEST_ALERTS_PER_HOUR = 5

const TEXT = {
  en: { title: 'My Book Lab', body: 'Test alert: urgent alerts will reach this device.' },
  it: { title: 'My Book Lab', body: 'Avviso di prova: gli avvisi urgenti arriveranno su questo dispositivo.' },
}

export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    const t = await requireTeacher(req)
    if (!t.ok) return t.response
    if (!checkRateLimit(`school-test-alert:${t.auth.userId}`, TEST_ALERTS_PER_HOUR).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    const body = (await req.json().catch(() => null)) ?? {}
    const words = TEXT[body.locale === 'it' ? 'it' : 'en']

    const res = await requestApns({
      userId: t.auth.userId,
      title: words.title,
      body: words.body,
      url: '/teacher',
      kind: 'test',
      tag: 'test',
    })
    if (res.skipped) return json(req, 503, { error: 'Alerts are not configured', code: 'not_configured' })
    if (!res.ok) return json(req, 502, { error: 'Could not send', code: 'upstream' })
    return json(req, 200, { sent: res.sent ?? 0 })
  } catch (e) {
    console.error('school/test-alert: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

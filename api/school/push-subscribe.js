export const config = { runtime: 'edge' }

import { handleCors, checkRateLimit } from '../_rateLimit.js'
import { requireTeacher, sb, json } from '../_school.js'
import { vapidPublicKey } from '../../lib/notify/webpush.js'
import { b64uDecode } from '../../lib/notify/jwt.js'

const MAX_ENDPOINT = 1024
// The server POSTs to whatever endpoint is stored here, so only the real
// browser push services are accepted (Chrome/Edge-Chromium/Opera/Samsung →
// FCM, Firefox → Mozilla, Safari → Apple, legacy Edge → WNS). Anything else
// would turn this into a way to make our server call arbitrary URLs.
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']

function validEndpoint(s) {
  if (typeof s !== 'string' || !s || s.length > MAX_ENDPOINT) return false
  let u
  try { u = new URL(s) } catch { return false }
  if (u.protocol !== 'https:' || u.port || u.username || u.password) return false
  const host = u.hostname.toLowerCase()
  return PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
}

function validKey(s, length) {
  if (typeof s !== 'string' || s.length > 200) return false
  try {
    const bytes = b64uDecode(s)
    return bytes.length === length && (length !== 65 || bytes[0] === 4)
  } catch {
    return false
  }
}

// A teacher turns on alerts in this browser (GET → the VAPID key to
// subscribe with; POST → store the subscription; DELETE → forget it).
export default async function handler(req) {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
      return json(req, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
    }
    const t = await requireTeacher(req)
    if (!t.ok) return t.response
    const me = t.auth.userId

    if (req.method === 'GET') {
      if (!checkRateLimit(`school-push-subscribe-read:${me}`, 300).allowed) {
        return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
      }
      return json(req, 200, { vapidPublicKey: vapidPublicKey() })
    }

    if (!checkRateLimit(`school-push-subscribe:${me}`, 60).allowed) {
      return json(req, 429, { error: 'Too many requests', code: 'rate_limited' })
    }
    const body = (await req.json().catch(() => null)) ?? {}
    if (!validEndpoint(body.endpoint)) return json(req, 400, { error: 'Invalid subscription', code: 'bad_request' })

    if (req.method === 'DELETE') {
      const res = await sb(
        `/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(body.endpoint)}&user_id=eq.${encodeURIComponent(me)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) return json(req, 502, { error: 'Could not update', code: 'upstream' })
      return json(req, 200, { ok: true })
    }

    const { p256dh, auth } = body.keys ?? {}
    if (!validKey(p256dh, 65) || !validKey(auth, 16)) {
      return json(req, 400, { error: 'Invalid subscription', code: 'bad_request' })
    }
    // A browser (endpoint) belongs to one teacher: whoever turned alerts on
    // in it last, e.g. on a shared classroom computer. If another user holds
    // it, their row is DELETED first and a fresh row created for the caller
    // — never re-pointed in place — so the upsert below can only ever merge
    // into the caller's own row. If that delete fails, nothing is written.
    const release = await sb(
      `/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(body.endpoint)}&user_id=neq.${encodeURIComponent(me)}`,
      { method: 'DELETE' }
    )
    if (!release.ok) return json(req, 502, { error: 'Could not save', code: 'upstream' })
    const res = await sb('/rest/v1/push_subscriptions?on_conflict=endpoint', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: me, endpoint: body.endpoint, p256dh, auth }),
    })
    if (!res.ok) return json(req, 502, { error: 'Could not save', code: 'upstream' })
    return json(req, 200, { ok: true })
  } catch (e) {
    console.error('school/push-subscribe: unhandled error', e)
    return json(req, 503, { error: 'Service unavailable, try again', code: 'upstream' })
  }
}

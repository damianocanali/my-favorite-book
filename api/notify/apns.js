// Internal: sends an APNs alert to every iOS device of one teacher.
//
// The ONE Node-runtime function in the notifications feature. APNs only
// accepts HTTP/2; Edge `fetch` has no HTTP/2 guarantee and Node's fetch
// (undici) speaks HTTP/1.1 unless told otherwise, so this uses node:http2.
// Edge code reaches it through lib/notify/apns.js requestApns().
//
// Auth: x-notify-secret = HMAC(service-role key, label) — see
// apnsWorkerSecret(). Not reachable by browsers in any useful way.
export const config = { runtime: 'nodejs', maxDuration: 30 }

import { sb, sbEnv, isUuid } from '../_school.js'
import { apnsConfig, apnsJwt, apnsWorkerSecret } from '../../lib/notify/apns.js'
import { sendApnsBatch } from '../../lib/notify/apnsHttp2.js'
import { infoOnce } from '../../lib/notify/log.js'

const MAX_TEXT = 300

const reply = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

const clip = (s) => (typeof s === 'string' ? s.slice(0, MAX_TEXT) : '')

export async function POST(request, deps) {
  const expected = await apnsWorkerSecret().catch(() => null)
  if (!expected || !safeEqual(request.headers.get('x-notify-secret') || '', expected)) {
    return reply(401, { error: 'Unauthorized', code: 'unauthorized' })
  }
  const cfg = apnsConfig()
  if (!cfg) {
    infoOnce('apns-worker', '[notify] APNs not configured; worker skipping')
    return reply(200, { skipped: true })
  }
  if (!sbEnv()) return reply(503, { error: 'Not configured', code: 'not_configured' })

  const input = await request.json().catch(() => null)
  if (!isUuid(input?.userId)) return reply(400, { error: 'Invalid user', code: 'bad_request' })

  try {
    const res = await sb(`/rest/v1/device_tokens?user_id=eq.${input.userId}&select=id,token,env`)
    if (!res.ok) return reply(503, { error: 'Service unavailable', code: 'upstream' })
    const rows = (await res.json().catch(() => [])) || []
    if (!rows.length) return reply(200, { sent: 0, removed: 0 })

    const payload = {
      aps: { alert: { title: clip(input.title), body: clip(input.body) }, sound: 'default' },
      url: clip(input.url),
      kind: clip(input.kind),
    }
    const devices = rows.map((r) => ({ token: r.token, env: r.env || cfg.defaultEnv }))
    const results = await sendApnsBatch(devices, payload, {
      jwt: await apnsJwt(),
      topic: cfg.topic,
      ...(deps?.connect ? { connect: deps.connect } : {}),
    })

    const idOf = new Map(rows.map((r) => [r.token, r.id]))
    const gone = results.filter((r) => r.gone).map((r) => idOf.get(r.token)).filter(isUuid)
    const sent = results.filter((r) => r.ok).map((r) => idOf.get(r.token)).filter(isUuid)
    if (gone.length) {
      await sb(`/rest/v1/device_tokens?id=in.(${gone.join(',')})`, { method: 'DELETE' }).catch(() => null)
    }
    if (sent.length) {
      await sb(`/rest/v1/device_tokens?id=in.(${sent.join(',')})`, {
        method: 'PATCH',
        body: JSON.stringify({ last_used_at: new Date().toISOString() }),
      }).catch(() => null)
    }
    for (const r of results) if (!r.ok && !r.gone) console.error('[notify] APNs send failed:', r.status, r.reason)
    return reply(200, { sent: sent.length, removed: gone.length })
  } catch (e) {
    console.error('[notify] APNs worker error:', e?.message)
    return reply(503, { error: 'Service unavailable', code: 'upstream' })
  }
}

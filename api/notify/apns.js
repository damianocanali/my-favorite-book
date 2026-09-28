// Internal: sends an APNs alert to every iOS device of one teacher.
//
// The ONE Node-runtime function in the notifications feature. APNs only
// accepts HTTP/2; Edge `fetch` has no HTTP/2 guarantee and Node's fetch
// (undici) speaks HTTP/1.1 unless told otherwise, so this uses node:http2.
// Edge code reaches it through lib/notify/apns.js requestApns().
//
// Auth: x-notify-ts + x-notify-sig, an HMAC over the timestamp and the body
// hash under NOTIFY_WORKER_SECRET (see lib/notify/apns.js). Stale (>300 s)
// or tampered requests get 401.
export const config = { runtime: 'nodejs', maxDuration: 30 }

import { sb, sbEnv, isUuid } from '../_school.js'
import { apnsConfig, apnsJwt, verifyWorkerRequest } from '../../lib/notify/apns.js'
import { sendApnsBatch } from '../../lib/notify/apnsHttp2.js'
import { infoOnce } from '../../lib/notify/log.js'

// The caller builds the words (lib/notify/text.js); the worker only caps
// them so a bad request can't push an oversized alert.
const CAPS = { title: 100, body: 300, url: 200, kind: 32, tag: 64 }

const reply = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const clip = (s, n) => (typeof s === 'string' ? s.slice(0, n) : '')

export async function POST(request, deps) {
  const raw = await request.text().catch(() => '')
  const ok = await verifyWorkerRequest(request.headers.get('x-notify-ts'), request.headers.get('x-notify-sig'), raw).catch(() => false)
  if (!ok) return reply(401, { error: 'Unauthorized', code: 'unauthorized' })
  const cfg = apnsConfig()
  if (!cfg) {
    infoOnce('apns-worker', '[notify] APNs not configured; worker skipping')
    return reply(200, { skipped: true })
  }
  if (!sbEnv()) return reply(503, { error: 'Not configured', code: 'not_configured' })

  let input = null
  try { input = JSON.parse(raw) } catch { input = null }
  if (!isUuid(input?.userId)) return reply(400, { error: 'Invalid user', code: 'bad_request' })

  try {
    const res = await sb(`/rest/v1/device_tokens?user_id=eq.${input.userId}&select=id,token,env`)
    if (!res.ok) return reply(503, { error: 'Service unavailable', code: 'upstream' })
    const rows = (await res.json().catch(() => [])) || []
    if (!rows.length) return reply(200, { sent: 0, removed: 0 })

    const payload = {
      aps: { alert: { title: clip(input.title, CAPS.title), body: clip(input.body, CAPS.body) }, sound: 'default' },
      url: clip(input.url, CAPS.url),
      kind: clip(input.kind, CAPS.kind),
    }
    const devices = rows.map((r) => ({ token: r.token, env: r.env || cfg.defaultEnv }))
    const results = await sendApnsBatch(devices, payload, {
      jwt: await apnsJwt(),
      topic: cfg.topic,
      collapseId: clip(input.tag, CAPS.tag) || undefined,
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

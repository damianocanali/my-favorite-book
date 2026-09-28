// The HTTP/2 half of APNs. Node only (node:http2): imported solely by the
// Node-runtime function api/notify/apns.js, never by an Edge function.
import http2 from 'node:http2'

const HOSTS = { production: 'https://api.push.apple.com', sandbox: 'https://api.sandbox.push.apple.com' }
const TIMEOUT_MS = 8000

// 410 Unregistered, or a token APNs says is not a device token (for this
// topic/environment): delete it. Anything else (429, 5xx) is transient.
function isGone(status, reason) {
  return status === 410 || (status === 400 && (reason === 'BadDeviceToken' || reason === 'DeviceTokenNotForTopic'))
}

function sendOne(session, token, body, { jwt, topic, collapseId }) {
  return new Promise((resolve) => {
    let status = 0
    let data = ''
    let done = false
    const finish = (r) => {
      if (done) return
      done = true
      resolve({ token, ...r })
    }
    let stream
    try {
      stream = session.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
        // Same alert twice (e.g. a retry) replaces rather than stacks.
        ...(collapseId ? { 'apns-collapse-id': String(collapseId).slice(0, 64) } : {}),
      })
    } catch (e) {
      return finish({ ok: false, status: 0, gone: false, reason: e?.message })
    }
    stream.setEncoding('utf8')
    stream.setTimeout(TIMEOUT_MS, () => {
      stream.close?.()
      finish({ ok: false, status: 0, gone: false, reason: 'timeout' })
    })
    stream.on('response', (headers) => { status = Number(headers[':status']) })
    stream.on('data', (chunk) => { data += chunk })
    stream.on('end', () => {
      let reason
      try { reason = data ? JSON.parse(data).reason : undefined } catch { reason = undefined }
      finish({ ok: status === 200, status, gone: isGone(status, reason), ...(reason ? { reason } : {}) })
    })
    stream.on('error', (e) => finish({ ok: false, status: 0, gone: false, reason: e?.message }))
    stream.end(JSON.stringify(body))
  })
}

/**
 * Sends one payload to many device tokens ([{token, env}]), one HTTP/2
 * connection per APNs host, requests multiplexed on it. Never throws.
 * `connect` is injectable for tests.
 */
export async function sendApnsBatch(devices, body, { jwt, topic, collapseId, connect = http2.connect }) {
  const byHost = new Map()
  for (const d of devices) {
    const host = HOSTS[d.env] ?? HOSTS.production
    if (!byHost.has(host)) byHost.set(host, [])
    byHost.get(host).push(d.token)
  }
  const results = []
  for (const [host, tokens] of byHost) {
    let session
    try {
      session = connect(host)
      session.on('error', () => {}) // surfaced per stream; never crash the function
    } catch (e) {
      for (const token of tokens) results.push({ token, ok: false, status: 0, gone: false, reason: e?.message })
      continue
    }
    results.push(...(await Promise.all(tokens.map((t) => sendOne(session, t, body, { jwt, topic, collapseId })))))
    try { session.close() } catch { /* already gone */ }
  }
  return results
}

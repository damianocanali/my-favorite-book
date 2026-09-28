// Email (Resend), APNs (token auth, HTTP/2 via a Node worker) and the
// message text every channel sends.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { generateKeyPairSync, verify as nodeVerify } from 'node:crypto'
import { b64uDecode } from '../lib/notify/jwt.js'

const FEELINGS = ['happy', 'proud', 'tired', 'worried', 'angry', 'sad', 'felice', 'triste', 'arrabbiat', 'preoccupat', 'stanc', 'orgoglios']
const NEEDS = ['break', 'quiet', 'keep_going', 'keep going', 'pausa']

const { privateKey: P8_KEY, publicKey: P8_PUB } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const P8 = P8_KEY.export({ type: 'pkcs8', format: 'pem' })
const APNS_ENV = { APNS_KEY_ID: 'KEYID12345', APNS_TEAM_ID: 'TEAMID1234', APNS_KEY_P8: P8, APNS_TOPIC: 'app.mybooklab.ios' }

function setApnsEnv(on = true) {
  for (const [k, v] of Object.entries(APNS_ENV)) {
    if (on) process.env[k] = v
    else delete process.env[k]
  }
}

beforeEach(() => {
  vi.resetModules()
  delete process.env.RESEND_API_KEY
  delete process.env.EMAIL_FROM
  setApnsEnv(false)
  delete process.env.APNS_ENV
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.PUBLIC_BASE_URL = 'https://mybooklab.app'
})
afterEach(() => vi.restoreAllMocks())

describe('message text', () => {
  it('urgent help says only who and which class, plus the not-monitored line', async () => {
    const { urgentMessage, DISCLAIMER } = await import('../lib/notify/text.js')
    const m = urgentMessage('help_grownup', { studentName: 'Ann', className: 'Room 5', locale: 'en' })
    expect(m.body).toBe('Ann in Room 5 asked for a grown-up.')
    expect(m.emailText).toContain('Ann in Room 5 asked for a grown-up.')
    expect(m.emailText).toContain(DISCLAIMER.en)
    expect(m.emailHtml).toContain(DISCLAIMER.en)
    expect(DISCLAIMER.en).toBe('My Book Lab passes this message on. It is not monitored and is not an emergency service.')
    expect(m.url).toBe('/teacher')
  })

  it('has Italian text for an Italian class, with the Italian disclaimer', async () => {
    const { urgentMessage, DISCLAIMER } = await import('../lib/notify/text.js')
    const m = urgentMessage('help_grownup', { studentName: 'Ann', className: 'Terza B', locale: 'it' })
    expect(m.body).toContain('Ann')
    expect(m.body).toContain('Terza B')
    expect(m.emailText).toContain(DISCLAIMER.it)
  })

  it('all_handed_in names the class and assignment and deep-links to review', async () => {
    const { urgentMessage } = await import('../lib/notify/text.js')
    const m = urgentMessage('all_handed_in', { className: 'Room 5', assignmentTitle: 'My pet', classroomId: 'c1', assignmentId: 'a1', locale: 'en' })
    expect(m.body).toBe('Everyone in Room 5 has handed in "My pet".')
    expect(m.url).toBe('/teacher/class/c1?review=a1')
  })

  it('escapes names in the HTML email', async () => {
    const { urgentMessage } = await import('../lib/notify/text.js')
    const m = urgentMessage('help_grownup', { studentName: '<b>x</b>', className: 'R&D', locale: 'en' })
    expect(m.emailHtml).not.toContain('<b>x</b>')
    expect(m.emailHtml).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(m.emailHtml).toContain('R&amp;D')
  })

  it.each(['en', 'it'])('never contains a feeling or a need word (%s)', async (locale) => {
    const { urgentMessage } = await import('../lib/notify/text.js')
    for (const kind of ['help_grownup', 'all_handed_in']) {
      const m = urgentMessage(kind, { studentName: 'Ann', className: 'Room 5', assignmentTitle: 'My pet', classroomId: 'c', assignmentId: 'a', locale })
      const all = [m.title, m.body, m.subject, m.emailText, m.emailHtml].join(' ').toLowerCase()
      for (const w of [...FEELINGS, ...NEEDS]) expect(all).not.toContain(w)
    }
  })
})

describe('sendEmail (Resend)', () => {
  it('is a no-op that logs once without RESEND_API_KEY / EMAIL_FROM', async () => {
    globalThis.fetch = vi.fn()
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const { sendEmail, emailConfigured } = await import('../lib/notify/email.js')
    expect(emailConfigured()).toBe(false)
    expect(await sendEmail({ to: 't@x.test', subject: 's', text: 't' })).toMatchObject({ skipped: true })
    expect(await sendEmail({ to: 't@x.test', subject: 's', text: 't' })).toMatchObject({ skipped: true })
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledTimes(1)
  })

  it('POSTs to Resend with the key, from, to, and an idempotency key', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'My Book Lab <hello@mybooklab.app>'
    const calls = []
    globalThis.fetch = vi.fn(async (url, init) => { calls.push({ url, init }); return new Response('{"id":"e1"}') })
    const { sendEmail } = await import('../lib/notify/email.js')
    const r = await sendEmail({ to: 't@x.test', subject: 'Hi', text: 'body', html: '<p>body</p>', idempotencyKey: 'k1' })
    expect(r.ok).toBe(true)
    expect(calls[0].url).toBe('https://api.resend.com/emails')
    expect(calls[0].init.headers.Authorization).toBe('Bearer re_test')
    expect(calls[0].init.headers['Idempotency-Key']).toBe('k1')
    expect(JSON.parse(calls[0].init.body)).toEqual({
      from: 'My Book Lab <hello@mybooklab.app>', to: ['t@x.test'], subject: 'Hi', text: 'body', html: '<p>body</p>',
    })
  })

  it('never throws on a network error', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'x@y.z'
    globalThis.fetch = vi.fn(async () => { throw new Error('offline') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { sendEmail } = await import('../lib/notify/email.js')
    expect(await sendEmail({ to: 't@x.test', subject: 's', text: 't' })).toMatchObject({ ok: false })
  })
})

describe('APNs provider token', () => {
  it('is ES256 with kid=key id, iss=team id, and verifies with the key', async () => {
    setApnsEnv()
    const { apnsJwt } = await import('../lib/notify/apns.js')
    const jwt = await apnsJwt()
    const [h, c, s] = jwt.split('.')
    expect(JSON.parse(new TextDecoder().decode(b64uDecode(h)))).toEqual({ alg: 'ES256', kid: 'KEYID12345' })
    const claims = JSON.parse(new TextDecoder().decode(b64uDecode(c)))
    expect(claims.iss).toBe('TEAMID1234')
    expect(Math.abs(claims.iat - Date.now() / 1000)).toBeLessThan(5)
    expect(nodeVerify('sha256', Buffer.from(`${h}.${c}`), { key: P8_PUB, dsaEncoding: 'ieee-p1363' }, Buffer.from(b64uDecode(s)))).toBe(true)
  })

  it('is reused for ~50 minutes (APNs rejects refreshing more than every 20)', async () => {
    setApnsEnv()
    vi.useFakeTimers()
    try {
      const { apnsJwt } = await import('../lib/notify/apns.js')
      const a = await apnsJwt()
      vi.advanceTimersByTime(30 * 60 * 1000)
      expect(await apnsJwt()).toBe(a)
      vi.advanceTimersByTime(25 * 60 * 1000)
      expect(await apnsJwt()).not.toBe(a)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('requestApns (Edge side: hands off to the Node HTTP/2 worker)', () => {
  it('is a no-op that logs once when the APNs keys are missing', async () => {
    globalThis.fetch = vi.fn()
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const { requestApns } = await import('../lib/notify/apns.js')
    expect(await requestApns({ userId: 'u1', title: 't', body: 'b' })).toMatchObject({ skipped: true })
    await requestApns({ userId: 'u1', title: 't', body: 'b' })
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledTimes(1)
  })

  it('POSTs to /api/notify/apns with a secret derived from the service key (never the key itself)', async () => {
    setApnsEnv()
    const calls = []
    globalThis.fetch = vi.fn(async (url, init) => { calls.push({ url, init }); return new Response('{"sent":1}') })
    const { requestApns, apnsWorkerSecret } = await import('../lib/notify/apns.js')
    await requestApns({ userId: 'u1', title: 'My Book Lab', body: 'Ann in Room 5 asked for a grown-up.', url: '/teacher', kind: 'help_grownup' })
    expect(calls[0].url).toBe('https://mybooklab.app/api/notify/apns')
    const secret = calls[0].init.headers['x-notify-secret']
    expect(secret).toBe(await apnsWorkerSecret())
    expect(secret).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(calls[0].init)).not.toContain('service')
    expect(JSON.parse(calls[0].init.body)).toEqual({ userId: 'u1', title: 'My Book Lab', body: 'Ann in Room 5 asked for a grown-up.', url: '/teacher', kind: 'help_grownup' })
  })
})

// A fake node:http2 session: each request answers with the status the test
// assigns to its token.
function fakeConnect(statusByToken, seen) {
  return vi.fn((origin) => {
    const session = new EventEmitter()
    session.close = vi.fn()
    session.request = (headers) => {
      const token = headers[':path'].split('/').pop()
      seen.push({ origin, headers })
      const stream = new EventEmitter()
      stream.setEncoding = () => {}
      stream.setTimeout = () => {}
      stream.end = (body) => {
        seen.at(-1).body = JSON.parse(body)
        queueMicrotask(() => {
          const [status, reason] = statusByToken[token] ?? [200]
          stream.emit('response', { ':status': status })
          if (reason) stream.emit('data', JSON.stringify({ reason }))
          stream.emit('end')
        })
      }
      return stream
    }
    return session
  })
}

describe('sendApnsBatch (node:http2)', () => {
  it('sends to the right host per token env with the APNs headers, and flags dead tokens', async () => {
    const { sendApnsBatch } = await import('../lib/notify/apnsHttp2.js')
    const seen = []
    const connect = fakeConnect({ dead: [410, 'Unregistered'], bad: [400, 'BadDeviceToken'], busy: [429, 'TooManyRequests'] }, seen)
    const results = await sendApnsBatch(
      [{ token: 'good', env: 'production' }, { token: 'dead', env: 'production' }, { token: 'bad', env: 'sandbox' }, { token: 'busy', env: 'production' }],
      { aps: { alert: { title: 't', body: 'b' } } },
      { jwt: 'JWT', topic: 'app.mybooklab.ios', connect }
    )
    expect(connect).toHaveBeenCalledWith('https://api.push.apple.com')
    expect(connect).toHaveBeenCalledWith('https://api.sandbox.push.apple.com')
    const h = seen.find((s) => s.headers[':path'] === '/3/device/good').headers
    expect(h).toMatchObject({ ':method': 'POST', authorization: 'bearer JWT', 'apns-topic': 'app.mybooklab.ios', 'apns-push-type': 'alert', 'apns-priority': '10' })
    expect(Object.fromEntries(results.map((r) => [r.token, r.gone]))).toEqual({ good: false, dead: true, bad: true, busy: false })
    expect(results.find((r) => r.token === 'good').ok).toBe(true)
  })

  it('a session error resolves every request as failed instead of throwing', async () => {
    const { sendApnsBatch } = await import('../lib/notify/apnsHttp2.js')
    const connect = vi.fn(() => {
      const session = new EventEmitter()
      session.close = () => {}
      session.request = () => {
        const stream = new EventEmitter()
        stream.setEncoding = () => {}
        stream.setTimeout = () => {}
        stream.end = () => queueMicrotask(() => stream.emit('error', new Error('GOAWAY')))
        return stream
      }
      return session
    })
    const results = await sendApnsBatch([{ token: 't1', env: 'production' }], {}, { jwt: 'J', topic: 'x', connect })
    expect(results).toEqual([{ token: 't1', ok: false, status: 0, gone: false, reason: 'GOAWAY' }])
  })
})

describe('POST /api/notify/apns (Node runtime worker)', () => {
  const load = async () => (await import('../api/notify/apns.js'))
  const call = (headers = {}, body = { userId: '6f1c1b1e-0000-4000-8000-000000000009', title: 'My Book Lab', body: 'Ann in Room 5 asked for a grown-up.', url: '/teacher', kind: 'help_grownup' }) =>
    new Request('https://mybooklab.app/api/notify/apns', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

  it('runs on the Node runtime (HTTP/2 is not available from Edge fetch)', async () => {
    expect((await load()).config.runtime).toBe('nodejs')
  })

  it('401s without the derived secret', async () => {
    setApnsEnv()
    globalThis.fetch = vi.fn()
    const mod = await load()
    expect((await mod.POST(call())).status).toBe(401)
    expect((await mod.POST(call({ 'x-notify-secret': 'nope' }))).status).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('sends to the user\'s tokens and deletes the dead ones', async () => {
    setApnsEnv()
    const log = []
    globalThis.fetch = vi.fn(async (url, init = {}) => {
      log.push({ url: String(url), method: init.method || 'GET' })
      if (String(url).includes('/rest/v1/device_tokens') && (init.method || 'GET') === 'GET') {
        return new Response(JSON.stringify([
          { id: '6f1c1b1e-0000-4000-8000-0000000000e1', token: 'good', env: 'production' },
          { id: '6f1c1b1e-0000-4000-8000-0000000000e2', token: 'dead', env: 'production' },
        ]))
      }
      return new Response('[]')
    })
    const seen = []
    const mod = await load()
    const { apnsWorkerSecret } = await import('../lib/notify/apns.js')
    const res = await mod.POST(call({ 'x-notify-secret': await apnsWorkerSecret() }), { connect: fakeConnect({ dead: [410, 'Unregistered'] }, seen) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 1, removed: 1 })
    expect(log[0].url).toContain('user_id=eq.6f1c1b1e-0000-4000-8000-000000000009')
    const del = log.find((l) => l.method === 'DELETE')
    expect(del.url).toContain('/rest/v1/device_tokens?id=in.(6f1c1b1e-0000-4000-8000-0000000000e2)')
    expect(seen[0].body).toEqual({ aps: { alert: { title: 'My Book Lab', body: 'Ann in Room 5 asked for a grown-up.' }, sound: 'default' }, url: '/teacher', kind: 'help_grownup' })
  })

  it('is a 200 no-op when APNs is not configured', async () => {
    const { apnsWorkerSecret } = await import('../lib/notify/apns.js')
    vi.spyOn(console, 'info').mockImplementation(() => {})
    globalThis.fetch = vi.fn()
    const res = await (await load()).POST(call({ 'x-notify-secret': await apnsWorkerSecret() }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ skipped: true })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('400s a bad user id', async () => {
    setApnsEnv()
    const { apnsWorkerSecret } = await import('../lib/notify/apns.js')
    globalThis.fetch = vi.fn()
    const res = await (await load()).POST(call({ 'x-notify-secret': await apnsWorkerSecret() }, { userId: 'x' }))
    expect(res.status).toBe(400)
  })
})

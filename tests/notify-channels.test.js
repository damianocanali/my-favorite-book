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
  for (const k of ['NOTIFY_WORKER_SECRET', 'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) delete process.env[k]
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

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

describe('sendEmailBatch (Resend batch, for the daily summary)', () => {
  it('POSTs up to 100 emails in one call with an idempotency key', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'My Book Lab <hello@mybooklab.app>'
    const calls = []
    globalThis.fetch = vi.fn(async (url, init) => { calls.push({ url, init }); return new Response('{"data":[]}') })
    const { sendEmailBatch } = await import('../lib/notify/email.js')
    const r = await sendEmailBatch([{ to: 'a@x.test', subject: 's', text: 't' }, { to: 'b@x.test', subject: 's', text: 't', html: '<p>t</p>' }], { idempotencyKey: 'k' })
    expect(r.ok).toBe(true)
    expect(calls[0].url).toBe('https://api.resend.com/emails/batch')
    expect(calls[0].init.headers['Idempotency-Key']).toBe('k')
    expect(JSON.parse(calls[0].init.body)).toEqual([
      { from: 'My Book Lab <hello@mybooklab.app>', to: ['a@x.test'], subject: 's', text: 't' },
      { from: 'My Book Lab <hello@mybooklab.app>', to: ['b@x.test'], subject: 's', text: 't', html: '<p>t</p>' },
    ])
  })

  it('refuses more than 100 and is a no-op without keys', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    globalThis.fetch = vi.fn()
    const { sendEmailBatch } = await import('../lib/notify/email.js')
    expect(await sendEmailBatch([{ to: 'a', subject: 's', text: 't' }])).toMatchObject({ skipped: true })
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'x@y.z'
    await expect(sendEmailBatch(Array(101).fill({ to: 'a', subject: 's', text: 't' }))).rejects.toThrow()
    expect(globalThis.fetch).not.toHaveBeenCalled()
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

  it('POSTs to /api/notify/apns signed with HMAC(secret, ts + "." + sha256(body)), never sending the secret', async () => {
    setApnsEnv()
    process.env.NOTIFY_WORKER_SECRET = 'worker-secret'
    const calls = []
    globalThis.fetch = vi.fn(async (url, init) => { calls.push({ url, init }); return new Response('{"sent":1}') })
    const { requestApns, verifyWorkerRequest } = await import('../lib/notify/apns.js')
    await requestApns({ userId: 'u1', title: 'My Book Lab', body: 'Ann in Room 5 asked for a grown-up.', url: '/teacher', kind: 'help_grownup', tag: 'help_grownup:h1' })
    expect(calls[0].url).toBe('https://mybooklab.app/api/notify/apns')
    const h = calls[0].init.headers
    expect(h['x-notify-ts']).toMatch(/^\d+$/)
    expect(h['x-notify-sig']).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(calls[0].init)).not.toContain('worker-secret')
    expect(JSON.stringify(calls[0].init)).not.toContain('service')
    expect(await verifyWorkerRequest(h['x-notify-ts'], h['x-notify-sig'], calls[0].init.body)).toBe(true)
    // A changed body no longer verifies.
    expect(await verifyWorkerRequest(h['x-notify-ts'], h['x-notify-sig'], calls[0].init.body.replace('Ann', 'Bob'))).toBe(false)
    expect(JSON.parse(calls[0].init.body)).toEqual({ userId: 'u1', title: 'My Book Lab', body: 'Ann in Room 5 asked for a grown-up.', url: '/teacher', kind: 'help_grownup', tag: 'help_grownup:h1' })
  })

  it('falls back to a key derived from the service-role key when NOTIFY_WORKER_SECRET is unset', async () => {
    const { workerSecret } = await import('../lib/notify/apns.js')
    const derived = await workerSecret()
    expect(derived).toMatch(/^[0-9a-f]{64}$/)
    expect(derived).not.toContain('service')
    process.env.NOTIFY_WORKER_SECRET = 'worker-secret'
    expect(await workerSecret()).toBe('worker-secret')
  })

  it('rejects a signature older (or newer) than 300 s', async () => {
    process.env.NOTIFY_WORKER_SECRET = 'worker-secret'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'))
    const { signWorkerRequest, verifyWorkerRequest } = await import('../lib/notify/apns.js')
    const h = await signWorkerRequest('{"a":1}')
    expect(await verifyWorkerRequest(h['x-notify-ts'], h['x-notify-sig'], '{"a":1}')).toBe(true)
    vi.setSystemTime(new Date('2026-09-27T12:05:01Z'))
    expect(await verifyWorkerRequest(h['x-notify-ts'], h['x-notify-sig'], '{"a":1}')).toBe(false)
    vi.setSystemTime(new Date('2026-09-27T11:54:59Z'))
    expect(await verifyWorkerRequest(h['x-notify-ts'], h['x-notify-sig'], '{"a":1}')).toBe(false)
  })

  it.each([
    [{ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'mybooklab.app', VERCEL_URL: 'x-123.vercel.app' }, null, 'https://mybooklab.app'],
    [{ VERCEL_ENV: 'production', VERCEL_URL: 'x-123.vercel.app' }, 'https://www.mybooklab.app', 'https://www.mybooklab.app'],
    [{ VERCEL_ENV: 'preview', VERCEL_PROJECT_PRODUCTION_URL: 'mybooklab.app', VERCEL_URL: 'x-123.vercel.app' }, 'https://mybooklab.app', 'https://x-123.vercel.app'],
    [{}, 'https://local.test/', 'https://local.test'],
  ])('worker URL for %o (PUBLIC_BASE_URL=%s) is %s — previews never call production', async (env, base, expected) => {
    setApnsEnv()
    Object.assign(process.env, env)
    if (base) process.env.PUBLIC_BASE_URL = base
    else delete process.env.PUBLIC_BASE_URL
    const calls = []
    globalThis.fetch = vi.fn(async (url) => { calls.push(String(url)); return new Response('{}') })
    const { requestApns } = await import('../lib/notify/apns.js')
    await requestApns({ userId: 'u1', title: 't', body: 'b' })
    expect(calls[0]).toBe(`${expected}/api/notify/apns`)
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
      { jwt: 'JWT', topic: 'app.mybooklab.ios', connect, collapseId: 'help_grownup:h1' }
    )
    expect(connect).toHaveBeenCalledWith('https://api.push.apple.com')
    expect(connect).toHaveBeenCalledWith('https://api.sandbox.push.apple.com')
    const h = seen.find((s) => s.headers[':path'] === '/3/device/good').headers
    expect(h).toMatchObject({ ':method': 'POST', authorization: 'bearer JWT', 'apns-topic': 'app.mybooklab.ios', 'apns-push-type': 'alert', 'apns-priority': '10', 'apns-collapse-id': 'help_grownup:h1' })
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
  const BODY = { userId: '6f1c1b1e-0000-4000-8000-000000000009', title: 'My Book Lab', body: 'Ann in Room 5 asked for a grown-up.', url: '/teacher', kind: 'help_grownup', tag: 'help_grownup:h1' }
  const call = (headers = {}, body = BODY) =>
    new Request('https://mybooklab.app/api/notify/apns', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const signed = async (body = BODY) => {
    const { signWorkerRequest } = await import('../lib/notify/apns.js')
    return call(await signWorkerRequest(JSON.stringify(body)), body)
  }
  function tokensFetch(log) {
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
  }

  it('runs on the Node runtime (HTTP/2 is not available from Edge fetch)', async () => {
    expect((await load()).config.runtime).toBe('nodejs')
  })

  it('401s unsigned, badly signed, stale, or body-tampered requests', async () => {
    setApnsEnv()
    process.env.NOTIFY_WORKER_SECRET = 'worker-secret'
    globalThis.fetch = vi.fn()
    const mod = await load()
    const { signWorkerRequest } = await import('../lib/notify/apns.js')
    expect((await mod.POST(call())).status).toBe(401)
    expect((await mod.POST(call({ 'x-notify-ts': String(Math.floor(Date.now() / 1000)), 'x-notify-sig': 'f'.repeat(64) }))).status).toBe(401)
    const h = await signWorkerRequest(JSON.stringify(BODY))
    expect((await mod.POST(call(h, { ...BODY, userId: '6f1c1b1e-0000-4000-8000-000000000008' }))).status).toBe(401)
    const stale = { ...h, 'x-notify-ts': String(Number(h['x-notify-ts']) - 301) }
    expect((await mod.POST(call(stale))).status).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('a request signed with the derived key is refused once NOTIFY_WORKER_SECRET is set', async () => {
    setApnsEnv()
    const { signWorkerRequest } = await import('../lib/notify/apns.js')
    const h = await signWorkerRequest(JSON.stringify(BODY)) // derived key
    process.env.NOTIFY_WORKER_SECRET = 'worker-secret'
    globalThis.fetch = vi.fn()
    expect((await (await load()).POST(call(h))).status).toBe(401)
  })

  it('sends to the user\'s tokens (collapse id = tag, capped text) and deletes the dead ones', async () => {
    setApnsEnv()
    const log = []
    tokensFetch(log)
    const seen = []
    const mod = await load()
    const long = { ...BODY, title: 'T'.repeat(500), body: 'B'.repeat(5000) }
    const res = await mod.POST(await signed(long), { connect: fakeConnect({ dead: [410, 'Unregistered'] }, seen) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 1, removed: 1 })
    expect(log[0].url).toContain('user_id=eq.6f1c1b1e-0000-4000-8000-000000000009')
    const del = log.find((l) => l.method === 'DELETE')
    expect(del.url).toContain('/rest/v1/device_tokens?id=in.(6f1c1b1e-0000-4000-8000-0000000000e2)')
    expect(seen[0].headers['apns-collapse-id']).toBe('help_grownup:h1')
    expect(seen[0].body.aps.alert.title.length).toBeLessThanOrEqual(100)
    expect(seen[0].body.aps.alert.body.length).toBeLessThanOrEqual(300)
    expect(seen[0].body).toMatchObject({ aps: { sound: 'default' }, url: '/teacher', kind: 'help_grownup' })
  })

  it('is a 200 no-op when APNs is not configured', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    globalThis.fetch = vi.fn()
    const res = await (await load()).POST(await signed())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ skipped: true })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('400s a bad user id', async () => {
    setApnsEnv()
    globalThis.fetch = vi.fn()
    const res = await (await load()).POST(await signed({ ...BODY, userId: 'x' }))
    expect(res.status).toBe(400)
  })
})

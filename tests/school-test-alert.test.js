// "Send a test alert": teacher-only, the caller's own devices only (the
// worker is asked for the caller's auth id and nothing else), no school-hours
// gate, rate-limited, and honest about how many devices it reached.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { TEACHER, STUDENT_USER, setEnv, mockSupabase } from './school-mock.js'

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const APNS_ENV = {
  APNS_KEY_ID: 'KEYID12345', APNS_TEAM_ID: 'TEAMID1234',
  APNS_KEY_P8: privateKey.export({ type: 'pkcs8', format: 'pem' }), APNS_TOPIC: 'app.mybooklab.ios',
}

beforeEach(() => {
  vi.resetModules()
  setEnv()
  Object.assign(process.env, APNS_ENV)
  process.env.PUBLIC_BASE_URL = 'https://mybooklab.app'
  process.env.NOTIFY_WORKER_SECRET = 'worker-secret'
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  for (const k of [...Object.keys(APNS_ENV), 'PUBLIC_BASE_URL', 'NOTIFY_WORKER_SECRET']) delete process.env[k]
  vi.restoreAllMocks()
})

const load = async () => (await import('../api/school/test-alert.js')).default
const call = (method = 'POST', body = {}) =>
  new Request('https://app.test/api/school/test-alert', {
    method,
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  })
const worker = (reply) => ({ method: 'POST', match: '/api/notify/apns', reply })

describe('POST /api/school/test-alert', () => {
  it('asks the APNs worker to alert the caller\'s own devices and returns how many it reached', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [worker({ body: { sent: 2, removed: 0 } })] })
    const res = await (await load())(call())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 2 })
    const hop = log.filter((l) => l.url.endsWith('/api/notify/apns'))
    expect(hop).toHaveLength(1)
    expect(hop[0].body.userId).toBe(TEACHER.id)
    expect(hop[0].body.kind).toBe('test')
    expect(hop[0].headers['x-notify-sig']).toMatch(/^[0-9a-f]{64}$/)
  })

  it('ignores anything in the body that tries to aim it at someone else', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [worker({ body: { sent: 1 } })] })
    await (await load())(call('POST', { userId: '6f1c1b1e-0000-4000-8000-00000000beef', user_id: 'x' }))
    expect(log.find((l) => l.url.endsWith('/api/notify/apns')).body.userId).toBe(TEACHER.id)
  })

  it('is not gated on school hours (no classroom lookup at all)', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [worker({ body: { sent: 1 } })] })
    await (await load())(call())
    expect(log.some((l) => l.url.includes('/rest/v1/classrooms'))).toBe(false)
  })

  it('speaks Italian when asked', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [worker({ body: { sent: 1 } })] })
    await (await load())(call('POST', { locale: 'it' }))
    expect(log.find((l) => l.url.endsWith('/api/notify/apns')).body.body).toMatch(/Avviso di prova/)
  })

  it('reports 0 when the teacher has no registered device', async () => {
    mockSupabase({ user: TEACHER, routes: [worker({ body: { sent: 0, removed: 0 } })] })
    expect(await (await (await load())(call())).json()).toEqual({ sent: 0 })
  })

  it('allows 5 an hour, then 429s without calling the worker', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [worker({ body: { sent: 1 } })] })
    const handler = await load()
    for (let i = 0; i < 5; i++) expect((await handler(call())).status).toBe(200)
    const res = await handler(call())
    expect(res.status).toBe(429)
    expect((await res.json()).code).toBe('rate_limited')
    expect(log.filter((l) => l.url.endsWith('/api/notify/apns'))).toHaveLength(5)
  })

  it('503 not_configured when APNs keys are missing', async () => {
    for (const k of Object.keys(APNS_ENV)) delete process.env[k]
    const log = mockSupabase({ user: TEACHER, routes: [] })
    const res = await (await load())(call())
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('not_configured')
    expect(log.some((l) => l.url.endsWith('/api/notify/apns'))).toBe(false)
  })

  it('502 upstream when the worker fails', async () => {
    mockSupabase({ user: TEACHER, routes: [worker({ status: 503, body: { code: 'upstream' } })] })
    const res = await (await load())(call())
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('upstream')
  })

  it('403s a class (student) account', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [worker({ body: { sent: 1 } })] })
    expect((await (await load())(call())).status).toBe(403)
    expect(log.some((l) => l.url.endsWith('/api/notify/apns'))).toBe(false)
  })

  it('405 for GET', async () => {
    mockSupabase({ user: TEACHER, routes: [] })
    expect((await (await load())(call('GET'))).status).toBe(405)
  })
})

// Review §7 item 10: moderation fails CLOSED for student accounts (503
// moderation_unavailable) and stays fail-open (logged) for adults.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { moderatePrompt } from '../api/_aiGuard.js'

vi.mock('../api/_auth.js', () => ({
  verifyJwt: vi.fn(async () => ({ ok: true, userId: 'u1', appMetadata: {} })),
}))
vi.mock('../api/_appAttest.js', () => ({
  classifyAttestation: vi.fn(async () => ({ attested: true })),
  hourlyLimitFor: (_a, n) => n,
}))
vi.mock('../api/_rateLimit.js', async (importOriginal) => ({
  ...(await importOriginal()),
  checkRateLimit: () => ({ allowed: true, remaining: 99 }),
}))

const req = new Request('https://app.test/x')
const origEnv = { ...process.env }
let moderation
let calls

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'openai'
  process.env.ANTHROPIC_API_KEY = 'anthropic'
  calls = []
  moderation = async () => new Response('down', { status: 500 })
  globalThis.fetch = vi.fn(async (url, init) => {
    const u = String(url)
    calls.push(u)
    if (u.includes('moderations')) return moderation(url, init)
    if (u.includes('api.anthropic.com')) return new Response(JSON.stringify({ content: [{ text: 'ok' }], usage: {} }))
    return new Response(null, { status: 201 })
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { process.env = { ...origEnv }; vi.restoreAllMocks() })

describe('moderatePrompt failClosed', () => {
  it('provider error: adults allowed, students get 503 moderation_unavailable', async () => {
    expect(await moderatePrompt('hello', req)).toBeNull()
    const res = await moderatePrompt('hello', req, { failClosed: true })
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('moderation_unavailable')
  })
  it('missing key: students refused, adults allowed', async () => {
    delete process.env.OPENAI_API_KEY
    expect(await moderatePrompt('hello', req)).toBeNull()
    expect((await moderatePrompt('hello', req, { failClosed: true })).status).toBe(503)
    expect(calls).toHaveLength(0)
  })
  it('network error / unreadable body: students refused', async () => {
    moderation = async () => { throw new Error('ECONNRESET') }
    expect((await moderatePrompt('hello', req, { failClosed: true })).status).toBe(503)
    moderation = async () => new Response('not json')
    expect((await moderatePrompt('hello', req, { failClosed: true })).status).toBe(503)
    expect(await moderatePrompt('hello', req)).toBeNull()
  })
  it('a working, unflagged check allows students; flagged is still 400 unkind', async () => {
    moderation = async () => new Response(JSON.stringify({ results: [{ flagged: false }] }))
    expect(await moderatePrompt('hello', req, { failClosed: true })).toBeNull()
    moderation = async () => new Response(JSON.stringify({ results: [{ flagged: true }] }))
    const res = await moderatePrompt('hello', req, { failClosed: true })
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('unkind')
  })
})

describe('story-buddy wires failClosed to the student role', () => {
  const post = async () => {
    const { default: handler } = await import('../api/story-buddy.js')
    return handler(new Request('https://app.test/api/story-buddy', {
      method: 'POST',
      headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'help me with my dragon story' }),
    }))
  }
  it('student: 503 and Anthropic is never called', async () => {
    const { verifyJwt } = await import('../api/_auth.js')
    verifyJwt.mockResolvedValueOnce({ ok: true, userId: 'u1', appMetadata: { role: 'student', student_id: 's1' } })
    const res = await post()
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('moderation_unavailable')
    expect(calls.some((u) => u.includes('anthropic'))).toBe(false)
  })
  it('adult: fails open and gets a reply', async () => {
    const res = await post()
    expect(res.status).toBe(200)
    expect(calls.some((u) => u.includes('anthropic'))).toBe(true)
  })
})

// Review §7 items 12–13: IPs are hashed with their own IP_HASH_KEY (falling
// back to the pepper with a warning), and nothing sent to Upstash carries a
// raw IP or user id.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { hashIp, ipHashKey, hashWithIpKey } from '../lib/school/crypto.js'

const origEnv = { ...process.env }
afterEach(() => { process.env = { ...origEnv }; vi.restoreAllMocks() })

describe('ipHashKey', () => {
  it('prefers IP_HASH_KEY over the pepper', () => {
    expect(ipHashKey({ IP_HASH_KEY: 'ipk', STUDENT_SECRET_PEPPER: 'pep' })).toBe('ipk')
  })
  it('falls back to the pepper (warning once) so prod keeps working', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(ipHashKey({ STUDENT_SECRET_PEPPER: 'pep' })).toBe('pep')
    expect(ipHashKey({ STUDENT_SECRET_PEPPER: 'pep' })).toBe('pep')
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1)
  })
  it('null with neither key', async () => {
    expect(ipHashKey({})).toBeNull()
    expect(await hashWithIpKey('x', {})).toBeNull()
  })
  it('the two keys give different hashes', async () => {
    expect(await hashIp('ipk', '1.2.3.4')).not.toBe(await hashIp('pep', '1.2.3.4'))
  })
})

describe('hashedClientIp', () => {
  it('never returns the raw address', async () => {
    process.env.IP_HASH_KEY = 'ipk'
    const { hashedClientIp } = await import('../api/_rateLimit.js')
    const req = new Request('https://x.test', { headers: { 'x-real-ip': '203.0.113.9' } })
    const h = await hashedClientIp(req)
    expect(h).toBe(await hashIp('ipk', '203.0.113.9'))
    expect(h).not.toContain('203.0.113.9')
  })
})

describe('sign-in stores the IP hashed with IP_HASH_KEY, not the pepper', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    process.env.STUDENT_SECRET_PEPPER = 'pep'
    process.env.IP_HASH_KEY = 'ipk'
  })
  it('p_ip_hash = HMAC(IP_HASH_KEY)', async () => {
    const { PICTURE_IDS } = await import('../lib/school/pictures.js')
    const sent = []
    globalThis.fetch = vi.fn(async (url, init = {}) => {
      const u = String(url)
      if (init.body) sent.push({ u, body: JSON.parse(init.body) })
      if (u.includes('/rest/v1/classrooms')) {
        return new Response(JSON.stringify([{ id: 'c1', name: 'R', locale: 'en', sign_in_open: true, class_licenses: [{ status: 'active', expires_at: '2999-01-01' }] }]))
      }
      if (u.includes('/rest/v1/class_students')) return new Response(JSON.stringify([{ id: 's1', auth_user_id: 'a1', secret_hash: 'x' }]))
      if (u.includes('school_begin_attempt')) return new Response(JSON.stringify({ state: 'not_found' }))
      return new Response('[]')
    })
    const { default: handler } = await import('../api/school/sign-in.js')
    await handler(new Request('https://app.test/api/school/sign-in', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': '198.51.100.7' },
      body: JSON.stringify({ code: 'ABC234', studentId: '6f1c1b1e-0000-4000-8000-000000000002', pictures: PICTURE_IDS.slice(0, 3) }),
    }))
    const begin = sent.find((c) => c.u.includes('school_begin_attempt'))
    expect(begin.body.p_ip_hash).toBe(await hashIp('ipk', '198.51.100.7'))
    expect(begin.body.p_ip_hash).not.toBe(await hashIp('pep', '198.51.100.7'))
  })
})

describe('Upstash keys are hashed and registered with waitUntil', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test'
    process.env.UPSTASH_REDIS_REST_TOKEN = 't'
    process.env.IP_HASH_KEY = 'ipk'
  })
  it('sends rl:h:<hmac>, never the raw key, and hands the promise to ctx.waitUntil', async () => {
    const bodies = []
    globalThis.fetch = vi.fn(async (_url, init) => {
      bodies.push(init.body)
      return new Response(JSON.stringify([{ result: 1 }, { result: 1 }]))
    })
    const { checkRateLimit } = await import('../api/_rateLimit.js')
    const waited = []
    const r = checkRateLimit('school-sign-in:203.0.113.9', 5, { waitUntil: (p) => waited.push(p) })
    expect(r.allowed).toBe(true)
    expect(waited).toHaveLength(1)
    await waited[0]
    const sentKey = JSON.parse(bodies[0])[0][1]
    expect(sentKey).toBe(`rl:h:${await hashWithIpKey('school-sign-in:203.0.113.9', { IP_HASH_KEY: 'ipk' })}`)
    expect(bodies[0]).not.toContain('203.0.113.9')
  })
})

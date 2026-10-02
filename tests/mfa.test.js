// Review §7 item 15: optional TOTP "2-step sign-in" for teachers on web.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanCode, needsSecondStep, verifiedTotp, startEnroll, verifyCode, disable } from '../src/lib/mfa.js'
import { jwtClaim } from '../api/_auth.js'

function fakeSb({ factors = [], aal = { currentLevel: 'aal1', nextLevel: 'aal1' }, verifyError = null } = {}) {
  const calls = []
  const mfa = {
    listFactors: vi.fn(async () => ({ data: { all: factors, totp: factors.filter((f) => f.factor_type === 'totp') }, error: null })),
    getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: aal, error: null })),
    enroll: vi.fn(async (a) => { calls.push(['enroll', a]); return { data: { id: 'new', totp: { qr_code: 'data:image/svg+xml;utf8,<svg/>', secret: 'ABC' } }, error: null } }),
    challengeAndVerify: vi.fn(async (a) => { calls.push(['verify', a]); return { error: verifyError } }),
    unenroll: vi.fn(async (a) => { calls.push(['unenroll', a]); return { error: null } }),
  }
  return { auth: { mfa }, calls }
}

describe('lib/mfa', () => {
  it('cleanCode accepts spaced/dashed 6 digits only', () => {
    expect(cleanCode('123 456')).toBe('123456')
    expect(cleanCode('123-456')).toBe('123456')
    expect(cleanCode('12345')).toBeNull()
    expect(cleanCode('1234567')).toBeNull()
  })
  it('needsSecondStep only when the account is at aal1 but could be aal2', async () => {
    expect(await needsSecondStep(fakeSb({ aal: { currentLevel: 'aal1', nextLevel: 'aal2' } }))).toBe(true)
    expect(await needsSecondStep(fakeSb({ aal: { currentLevel: 'aal2', nextLevel: 'aal2' } }))).toBe(false)
    expect(await needsSecondStep(fakeSb())).toBe(false)
  })
  it('verifiedTotp ignores unverified factors', async () => {
    const sb = fakeSb({ factors: [{ id: 'u', factor_type: 'totp', status: 'unverified' }, { id: 'v', factor_type: 'totp', status: 'verified' }] })
    expect((await verifiedTotp(sb)).id).toBe('v')
    expect(await verifiedTotp(fakeSb())).toBeNull()
  })
  it('startEnroll clears an abandoned setup first and returns the QR', async () => {
    const sb = fakeSb({ factors: [{ id: 'old', factor_type: 'totp', status: 'unverified' }] })
    const r = await startEnroll(sb)
    expect(sb.calls[0]).toEqual(['unenroll', { factorId: 'old' }])
    expect(sb.calls[1][0]).toBe('enroll')
    expect(r).toEqual({ factorId: 'new', qr: 'data:image/svg+xml;utf8,<svg/>', secret: 'ABC' })
  })
  it('verifyCode rejects malformed codes without a network call; maps a wrong one', async () => {
    const sb = fakeSb({ verifyError: { message: 'invalid' } })
    await expect(verifyCode(sb, 'f', '12')).rejects.toMatchObject({ code: 'bad_code' })
    expect(sb.auth.mfa.challengeAndVerify).not.toHaveBeenCalled()
    await expect(verifyCode(sb, 'f', '123456')).rejects.toMatchObject({ code: 'wrong_code' })
  })
  it('disable needs a valid current code before unenrolling', async () => {
    const bad = fakeSb({ verifyError: { message: 'x' } })
    await expect(disable(bad, 'f', '123456')).rejects.toBeTruthy()
    expect(bad.auth.mfa.unenroll).not.toHaveBeenCalled()
    const ok = fakeSb()
    await disable(ok, 'f', '123456')
    expect(ok.calls.map((c) => c[0])).toEqual(['verify', 'unenroll'])
  })
})

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (payload) => `${b64url({ alg: 'HS256' })}.${b64url(payload)}.sig`

describe('server side', () => {
  it('jwtClaim reads aal; garbage is null', () => {
    expect(jwtClaim(jwt({ aal: 'aal2' }), 'aal')).toBe('aal2')
    expect(jwtClaim('nope', 'aal')).toBeNull()
  })

  const origEnv = { ...process.env }
  beforeEach(() => {
    vi.resetModules()
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  })
  afterEach(() => { process.env = { ...origEnv } })

  const teacherCall = async (token, factors) => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ id: 't1', app_metadata: {}, factors })))
    const { requireTeacher } = await import('../api/_school.js')
    return requireTeacher(new Request('https://app.test/x', { headers: { authorization: `Bearer ${token}` } }))
  }
  const verified = [{ id: 'f', status: 'verified', factor_type: 'totp' }]

  it('TEACHER_MFA_ENFORCE=on: an enrolled teacher at aal1 gets 401 mfa_required', async () => {
    process.env.TEACHER_MFA_ENFORCE = 'on'
    const r = await teacherCall(jwt({ aal: 'aal1' }), verified)
    expect(r.ok).toBe(false)
    expect(r.response.status).toBe(401)
    expect((await r.response.json()).code).toBe('mfa_required')
  })
  it('enforced: aal2 passes; a teacher without 2-step passes at aal1', async () => {
    process.env.TEACHER_MFA_ENFORCE = 'on'
    expect((await teacherCall(jwt({ aal: 'aal2' }), verified)).ok).toBe(true)
    expect((await teacherCall(jwt({ aal: 'aal1' }), [])).ok).toBe(true)
  })
  it('not enforced by default (iPad has no code step yet)', async () => {
    delete process.env.TEACHER_MFA_ENFORCE
    expect((await teacherCall(jwt({ aal: 'aal1' }), verified)).ok).toBe(true)
  })
})

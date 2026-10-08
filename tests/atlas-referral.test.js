import { describe, it, expect } from 'vitest'
import { verifyAtlasReferral, normalizeCode, generateCode, CODE_ALPHABET, readCookie, setCookieHeader, atlasConfig, noncePrefix } from '../lib/atlas/referral.js'
import { SECRET, mint, signBody, referenceVerify } from './atlas-helpers.js'

const now = () => Math.floor(Date.now() / 1000)
const b64 = (s) => Buffer.from(s).toString('base64url')

describe('verifyAtlasReferral (Web Crypto) agrees with Atlas\'s Node reference', () => {
  it('accepts a valid token', async () => {
    const { token, payload } = mint()
    expect(await verifyAtlasReferral(token, SECRET)).toEqual(payload)
    expect(referenceVerify(token, SECRET)).toEqual(payload)
  })
  it('rejects a wrong secret / wrong signature', async () => {
    const { token } = mint({}, 'b'.repeat(64))
    expect(await verifyAtlasReferral(token, SECRET)).toBeNull()
    const [body, sig] = mint().token.split('.')
    const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')
    expect(await verifyAtlasReferral(`${body}.${flipped}`, SECRET)).toBeNull()
    expect(referenceVerify(`${body}.${flipped}`, SECRET)).toBeNull()
  })
  it('rejects a tampered body', async () => {
    const { token, payload } = mint()
    const sig = token.split('.')[1]
    const forged = `${b64(JSON.stringify({ ...payload, uid: 'someone-else' }))}.${sig}`
    expect(await verifyAtlasReferral(forged, SECRET)).toBeNull()
    expect(referenceVerify(forged, SECRET)).toBeNull()
  })
  it('expired: rejected, unless ignoreExpiry (refunds)', async () => {
    const { token, payload } = mint({ iat: now() - 40 * 86400, exp: now() - 10 * 86400 })
    expect(await verifyAtlasReferral(token, SECRET)).toBeNull()
    expect(referenceVerify(token, SECRET)).toBeNull()
    expect(await verifyAtlasReferral(token, SECRET, { ignoreExpiry: true })).toEqual(payload)
    expect(referenceVerify(token, SECRET, { ignoreExpiry: true })).toEqual(payload)
  })
  it('rejects p ≠ mybooklab', async () => {
    const { token } = mint({ p: 'otherapp' })
    expect(await verifyAtlasReferral(token, SECRET)).toBeNull()
    expect(referenceVerify(token, SECRET)).toBeNull()
  })
  it.each(['uid', 'n', 'exp'])('rejects a token missing %s', async (k) => {
    const { token } = mint({ [k]: undefined })
    expect(await verifyAtlasReferral(token, SECRET)).toBeNull()
    expect(referenceVerify(token, SECRET)).toBeNull()
  })
  it('rejects malformed tokens', async () => {
    const { token } = mint()
    const cases = [
      'nodot',
      `${token}.extra`,
      signBody('!!!not-base64!!!'),
      signBody(b64('not json at all')),
      signBody(b64('null')),
      '', '.', `${token.split('.')[0]}.`,
    ]
    for (const c of cases) expect(await verifyAtlasReferral(c, SECRET), c).toBeNull()
    expect(await verifyAtlasReferral(null, SECRET)).toBeNull()
    expect(await verifyAtlasReferral(token, '')).toBeNull()
  })
  it('agrees with the reference on a batch of random tokens', async () => {
    for (let i = 0; i < 20; i++) {
      const { token } = mint({ uid: `u${i}`.repeat(i + 1) })
      expect(await verifyAtlasReferral(token, SECRET)).toEqual(referenceVerify(token, SECRET))
    }
  })
})

describe('codes, cookies, config', () => {
  it('generates 8-char codes from the unambiguous alphabet', () => {
    const seen = new Set()
    for (let i = 0; i < 200; i++) {
      const c = generateCode()
      expect(c).toMatch(new RegExp(`^[${CODE_ALPHABET}]{8}$`))
      seen.add(c)
    }
    expect(seen.size).toBe(200)
    for (const bad of ['0', 'O', '1', 'I', 'L', 'U']) expect(CODE_ALPHABET).not.toContain(bad)
  })
  it('normalises user input', () => {
    expect(normalizeCode(' k7m4-q2xp ')).toBe('K7M4Q2XP')
    expect(normalizeCode('K7M4 Q2XP')).toBe('K7M4Q2XP')
    expect(normalizeCode('K7M4-Q2X')).toBeNull()
    expect(normalizeCode('K7M4-Q2XO')).toBeNull()
    expect(normalizeCode(42)).toBeNull()
  })
  it('cookie helpers', () => {
    const req = new Request('https://x', { headers: { cookie: 'a=1; mbl_atlas_ref=abc.def; b=2' } })
    expect(readCookie(req)).toBe('abc.def')
    expect(setCookieHeader('t.s', 99.7)).toBe('mbl_atlas_ref=t.s; Max-Age=99; Path=/; HttpOnly; Secure; SameSite=Lax')
  })
  it('config gates', () => {
    expect(atlasConfig({}).capture).toBe(false)
    expect(atlasConfig({ ATLAS_REFERRAL_SECRET: 'x' })).toMatchObject({ capture: true, callbacks: false })
    expect(atlasConfig({ ATLAS_REFERRAL_SECRET: 'x', PARTNER_CALLBACK_SECRET: 'y', ATLAS_BASE_URL: 'https://a.example/' })).toMatchObject({ callbacks: true, baseUrl: 'https://a.example' })
    expect(noncePrefix('0123456789abcdef')).toBe('012345…')
  })
})

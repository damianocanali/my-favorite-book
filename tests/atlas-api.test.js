// api/referral/{capture,attach,redeem-code} against an in-memory PostgREST.
// fetch is mocked: GoTrue answers with `user`, PostgREST calls go to fakeDb.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fakeDb } from './fake-postgrest.js'
import { SECRET, mint } from './atlas-helpers.js'

const SB = 'https://example.supabase.co'
const FAMILY = { id: '22222222-2222-4222-8222-222222222222', app_metadata: {} }
const OTHER = { id: '33333333-3333-4333-8333-333333333333', app_metadata: {} }
const STUDENT = { id: '44444444-4444-4444-8444-444444444444', app_metadata: { role: 'student' } }
const TEACHER = { id: '66666666-6666-4666-8666-666666666666', app_metadata: {}, user_metadata: { role: 'teacher' } }
const CLASS_OWNER = { id: '77777777-7777-4777-8777-777777777777', app_metadata: {}, user_metadata: { classroom: true } }

let db, user, logs
beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = SB
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.ATLAS_REFERRAL_SECRET = SECRET
  db = fakeDb()
  user = FAMILY
  logs = []
  for (const m of ['log', 'warn', 'error', 'info']) vi.spyOn(console, m).mockImplementation((...a) => logs.push(a.map(String).join(' ')))
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url)
    if (u.endsWith('/auth/v1/user')) {
      return (init.headers?.Authorization === 'Bearer bad') ? new Response('{}', { status: 401 }) : new Response(JSON.stringify(user))
    }
    if (u.startsWith(SB)) return db.sb(u.slice(SB.length), init)
    throw new Error(`unexpected fetch ${u}`)
  })
})
afterEach(() => {
  delete process.env.ATLAS_REFERRAL_SECRET
  vi.restoreAllMocks()
})

const load = async (name) => (await import(`../api/referral/${name}.js`)).default
const post = (name, body, { bearer, cookie } = {}) => new Request(`https://mybooklab.app/api/referral/${name}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body ?? {}),
})
const refRow = (uid = FAMILY.id) => db.t('atlas_referrals').find((r) => r.user_id === uid)
const noSecretsLogged = (t) => {
  const all = logs.join('\n')
  expect(all).not.toContain(SECRET)
  expect(all).not.toContain(t.token)
}

describe('POST /api/referral/capture', () => {
  it('valid token, signed out → httpOnly cookie with the right attributes + a code', async () => {
    const t = mint()
    const res = await (await load('capture'))(post('capture', { ref: t.token }))
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie')
    expect(cookie).toContain(`mbl_atlas_ref=${t.token};`)
    for (const a of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(cookie).toContain(a)
    const maxAge = Number(/Max-Age=(\d+)/.exec(cookie)[1])
    expect(maxAge).toBeGreaterThan(30 * 86400 - 5)
    expect(maxAge).toBeLessThanOrEqual(30 * 86400)
    const { code } = await res.json()
    expect(code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/)
    expect(db.t('atlas_referral_codes')).toHaveLength(1)
    expect(db.t('atlas_referrals')).toHaveLength(0)
    noSecretsLogged(t)
  })
  it('Max-Age never outlives the token', async () => {
    const now = Math.floor(Date.now() / 1000)
    const t = mint({ iat: now - 29 * 86400, exp: now + 3600 })
    const res = await (await load('capture'))(post('capture', { ref: t.token }))
    expect(Number(/Max-Age=(\d+)/.exec(res.headers.get('set-cookie'))[1])).toBeLessThanOrEqual(3600)
  })
  it('the same token reuses its code', async () => {
    const t = mint()
    const h = await load('capture')
    const a = await (await h(post('capture', { ref: t.token }))).json()
    const b = await (await h(post('capture', { ref: t.token }))).json()
    expect(a.code).toBe(b.code)
    expect(db.t('atlas_referral_codes')).toHaveLength(1)
  })
  it.each([
    ['garbage', 'not-a-token'],
    ['forged', mint({}, 'f'.repeat(64)).token],
    ['expired', mint({ iat: 1, exp: 2 }).token],
    ['missing', undefined],
  ])('invalid (%s) → 204, no cookie, nothing stored', async (_n, ref) => {
    const res = await (await load('capture'))(post('capture', { ref }))
    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(db.t('atlas_referral_codes')).toHaveLength(0)
  })
  it('signed in → attaches now, no cookie, no code', async () => {
    const t = mint()
    const res = await (await load('capture'))(post('capture', { ref: t.token }, { bearer: 'jwt' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ attached: true })
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(refRow()).toMatchObject({ token: t.token, nonce: t.payload.n, atlas_uid: 'atlas-user-1', report_status: 'pending' })
    expect(db.t('atlas_referral_codes')).toHaveLength(0)
  })
  it('an invalid session is treated as signed out', async () => {
    const res = await (await load('capture'))(post('capture', { ref: mint().token }, { bearer: 'bad' }))
    expect(res.headers.get('set-cookie')).toContain('mbl_atlas_ref=')
  })
  it('a class (student) account is ignored', async () => {
    user = STUDENT
    const res = await (await load('capture'))(post('capture', { ref: mint().token }, { bearer: 'jwt' }))
    expect(res.status).toBe(204)
    expect(db.t('atlas_referrals')).toHaveLength(0)
  })
  it('feature off (no secret) → 204, no database calls', async () => {
    delete process.env.ATLAS_REFERRAL_SECRET
    const res = await (await load('capture'))(post('capture', { ref: mint().token }))
    expect(res.status).toBe(204)
    expect(db.calls).toHaveLength(0)
  })
  it('rate-limited per (hashed) IP', async () => {
    const h = await load('capture')
    let last
    for (let i = 0; i < 31; i++) last = await h(post('capture', { ref: 'x' }))
    expect(last.status).toBe(429)
  })
})

describe('POST /api/referral/attach', () => {
  const cookieFor = (t) => `other=1; mbl_atlas_ref=${t.token}`
  it('saves the referral and clears the cookie', async () => {
    const t = mint()
    const res = await (await load('attach'))(post('attach', {}, { bearer: 'jwt', cookie: cookieFor(t) }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ attached: true })
    expect(res.headers.get('set-cookie')).toMatch(/^mbl_atlas_ref=; Max-Age=0; Path=\/; HttpOnly; Secure; SameSite=Lax$/)
    expect(refRow().nonce).toBe(t.payload.n)
    noSecretsLogged(t)
  })
  it('no cookie → 204', async () => {
    const res = await (await load('attach'))(post('attach', {}, { bearer: 'jwt' }))
    expect(res.status).toBe(204)
  })
  it('requires auth', async () => {
    const res = await (await load('attach'))(post('attach', {}, { cookie: cookieFor(mint()) }))
    expect(res.status).toBe(401)
  })
  it('students → 403', async () => {
    user = STUDENT
    const res = await (await load('attach'))(post('attach', {}, { bearer: 'jwt', cookie: cookieFor(mint()) }))
    expect(res.status).toBe(403)
  })
  it('an invalid cookie is cleared and ignored', async () => {
    const res = await (await load('attach'))(post('attach', {}, { bearer: 'jwt', cookie: 'mbl_atlas_ref=junk.junk' }))
    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(db.t('atlas_referrals')).toHaveLength(0)
  })
  it('a newer valid token replaces an unreported one', async () => {
    const now = Math.floor(Date.now() / 1000)
    const old = mint({ iat: now - 86400, exp: now + 29 * 86400 })
    const fresh = mint()
    const h = await load('attach')
    await h(post('attach', {}, { bearer: 'jwt', cookie: cookieFor(old) }))
    await h(post('attach', {}, { bearer: 'jwt', cookie: cookieFor(fresh) }))
    expect(db.t('atlas_referrals')).toHaveLength(1)
    expect(refRow().nonce).toBe(fresh.payload.n)
    // …but an older token never replaces a newer one
    await h(post('attach', {}, { bearer: 'jwt', cookie: cookieFor(old) }))
    expect(refRow().nonce).toBe(fresh.payload.n)
  })
  it.each([
    [{ report_status: 'reported', reported_at: '2026-10-01T00:00:00Z' }],
    [{ report_status: 'reporting' }],
    [{ report_status: 'failed_final' }],
    [{ external_ref: 'sub_1' }],
  ])('never overwrites a locked row %j', async (state) => {
    const first = mint({ iat: Math.floor(Date.now() / 1000) - 100 })
    const h = await load('attach')
    await h(post('attach', {}, { bearer: 'jwt', cookie: cookieFor(first) }))
    Object.assign(refRow(), state)
    const res = await h(post('attach', {}, { bearer: 'jwt', cookie: cookieFor(mint()) }))
    expect(await res.json()).toEqual({ attached: false })
    expect(refRow().nonce).toBe(first.payload.n)
  })
  it('a token another account already holds is not attached twice', async () => {
    const t = mint()
    const h = await load('attach')
    await h(post('attach', {}, { bearer: 'jwt', cookie: cookieFor(t) }))
    user = OTHER
    const res = await h(post('attach', {}, { bearer: 'jwt', cookie: cookieFor(t) }))
    expect(await res.json()).toEqual({ attached: false })
    expect(refRow(OTHER.id)).toBeUndefined()
  })
})

describe('POST /api/referral/redeem-code', () => {
  async function codeFor(t) {
    const res = await (await load('capture'))(post('capture', { ref: t.token }))
    return (await res.json()).code
  }
  it('attaches the code\'s token; single-use', async () => {
    const t = mint()
    const code = await codeFor(t)
    const h = await load('redeem-code')
    const res = await h(post('redeem-code', { code: code.toLowerCase().replace('-', ' ') }, { bearer: 'jwt' }))
    expect(res.status).toBe(200)
    expect(refRow()).toMatchObject({ nonce: t.payload.n, token: t.token })
    expect(db.t('atlas_referral_codes')[0]).toMatchObject({ redeemed_by: FAMILY.id })
    user = OTHER
    const again = await h(post('redeem-code', { code }, { bearer: 'jwt' }))
    expect(again.status).toBe(400)
    expect((await again.json()).code).toBe('invalid_code')
    expect(refRow(OTHER.id)).toBeUndefined()
    noSecretsLogged(t)
  })
  it('unknown, expired and malformed codes all answer the same invalid_code', async () => {
    const t = mint()
    const code = await codeFor(t)
    db.t('atlas_referral_codes')[0].expires_at = new Date(Date.now() - 1000).toISOString()
    const h = await load('redeem-code')
    const bodies = []
    for (const c of [code, 'ZZZZ-ZZZZ', 'nope', null]) {
      const res = await h(post('redeem-code', { code: c }, { bearer: 'jwt' }))
      expect(res.status).toBe(400)
      bodies.push(await res.json())
    }
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1)
    expect(db.t('atlas_referrals')).toHaveLength(0)
  })
  it('already_referred when the account\'s referral was reported', async () => {
    const h = await load('redeem-code')
    await h(post('redeem-code', { code: await codeFor(mint({ iat: Math.floor(Date.now() / 1000) - 50 })) }, { bearer: 'jwt' }))
    Object.assign(refRow(), { report_status: 'reported', reported_at: new Date().toISOString(), external_ref: 'sub_1' })
    const code2 = await codeFor(mint())
    const res = await h(post('redeem-code', { code: code2 }, { bearer: 'jwt' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('already_referred')
    expect(db.t('atlas_referral_codes').find((c) => c.code === code2.replace('-', '')).redeemed_at).toBeNull()
  })
  it('rate-limited per account (10/hour)', async () => {
    const h = await load('redeem-code')
    let last
    for (let i = 0; i < 11; i++) last = await h(post('redeem-code', { code: 'ZZZZ-ZZZZ' }, { bearer: 'jwt' }))
    expect(last.status).toBe(429)
  })
  it('students → 403; no auth → 401', async () => {
    const h = await load('redeem-code')
    expect((await h(post('redeem-code', { code: 'ZZZZ-ZZZZ' }))).status).toBe(401)
    user = STUDENT
    expect((await h(post('redeem-code', { code: 'ZZZZ-ZZZZ' }, { bearer: 'jwt' }))).status).toBe(403)
  })
})

describe('teacher accounts are excluded server-side (M6)', () => {
  it.each([['role teacher', TEACHER], ['class owner', CLASS_OWNER]])('%s: capture no-op, attach skipped (cookie kept), redeem 403', async (_n, who) => {
    user = who
    const t = mint()
    const cap = await (await load('capture'))(post('capture', { ref: t.token }, { bearer: 'jwt' }))
    expect(cap.status).toBe(204)
    const att = await (await load('attach'))(post('attach', {}, { bearer: 'jwt', cookie: `mbl_atlas_ref=${t.token}` }))
    expect(att.status).toBe(200)
    expect(await att.json()).toEqual({ skipped: 'teacher' })
    expect(att.headers.get('set-cookie')).toBeNull()
    const red = await (await load('redeem-code'))(post('redeem-code', { code: 'ZZZZ-ZZZZ' }, { bearer: 'jwt' }))
    expect(red.status).toBe(403)
    expect((await red.json()).code).toBe('family_only')
    expect(db.t('atlas_referrals')).toHaveLength(0)
  })
})

describe('redeem-code honesty (M7)', () => {
  it('an account already holding a NEWER token: already_referred, code given back, not consumed', async () => {
    const now = Math.floor(Date.now() / 1000)
    const older = mint({ iat: now - 3600 })
    const code = (await (await (await load('capture'))(post('capture', { ref: older.token }))).json()).code
    await (await load('capture'))(post('capture', { ref: mint({ iat: now }).token }, { bearer: 'jwt' })) // attaches the newer one
    const res = await (await load('redeem-code'))(post('redeem-code', { code }, { bearer: 'jwt' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('already_referred')
    expect(db.t('atlas_referral_codes').find((c) => c.nonce === older.payload.n)).toMatchObject({ redeemed_at: null, redeemed_by: null })
  })
})

// Stripe and RevenueCat webhooks end to end with Atlas reporting: an
// in-memory PostgREST, mocked Stripe and a mocked Atlas. No real network.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { fakeDb } from './fake-postgrest.js'
import { SECRET, mint } from './atlas-helpers.js'
import { attachReferral } from '../lib/atlas/store.js'

const SB = 'https://example.supabase.co'
const ATLAS = 'https://atlas.example'
const CB = 'partner-callback-secret-NEVER-LOG'
const USER = '55555555-5555-4555-8555-555555555555'
const WHSEC = 'whsec_test_atlas'
const RCSEC = 'rc-secret'
const reply = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status })

let db, atlasCalls, atlasReply, stripeObjects, logs, token
beforeEach(async () => {
  vi.resetModules()
  Object.assign(process.env, {
    SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'service', STRIPE_WEBHOOK_SECRET: WHSEC, REVENUECAT_WEBHOOK_SECRET: RCSEC,
    ATLAS_REFERRAL_SECRET: SECRET, PARTNER_CALLBACK_SECRET: CB, ATLAS_BASE_URL: ATLAS,
  })
  db = fakeDb()
  atlasCalls = []
  atlasReply = (path) => reply(200, { status: path.endsWith('/redeemed') ? 'recorded' : 'reversed' })
  stripeObjects = {}
  logs = []
  for (const m of ['log', 'warn', 'error', 'info']) vi.spyOn(console, m).mockImplementation((...a) => logs.push(a.map(String).join(' ')))
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url)
    if (u.startsWith(SB)) return db.sb(u.slice(SB.length), init)
    if (u.startsWith(ATLAS)) {
      const path = u.slice(ATLAS.length)
      atlasCalls.push({ path, headers: init.headers, body: JSON.parse(init.body) })
      return atlasReply(path)
    }
    if (u.startsWith('https://api.stripe.com/v1/')) {
      const key = u.slice('https://api.stripe.com/v1/'.length).split('?')[0]
      return stripeObjects[key] ? reply(200, stripeObjects[key]) : reply(404, {})
    }
    throw new Error(`unexpected fetch ${u}`)
  })
  token = mint({ iat: Math.floor(Date.now() / 1000) - 60 })
  await attachReferral(db.sb, USER, token.token, token.payload)
})
afterEach(() => {
  for (const k of ['ATLAS_REFERRAL_SECRET', 'PARTNER_CALLBACK_SECRET', 'ATLAS_BASE_URL', 'REVENUECAT_WEBHOOK_SECRET', 'ATLAS_REPORT_TEST_PAYMENTS']) delete process.env[k]
  vi.restoreAllMocks()
})

let seq = 0
function stripeReq(type, object, extra = {}) {
  const body = JSON.stringify({ id: `evt_${++seq}`, type, livemode: true, data: { object }, ...extra })
  const t = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', WHSEC).update(`${t}.${body}`).digest('hex')
  return new Request('https://mybooklab.app/api/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${sig}` }, body })
}
const stripeHook = async (type, object, extra) => (await import('../api/stripe-webhook.js')).default(stripeReq(type, object, extra))
const rcHook = async (ev) => (await import('../api/revenuecat-webhook.js')).default(new Request('https://mybooklab.app/api/revenuecat-webhook', {
  method: 'POST', headers: { authorization: `Bearer ${RCSEC}` },
  body: JSON.stringify({ event: { id: `rc_${++seq}`, app_user_id: USER, product_id: 'com.myfavoritebook.app.family.monthly', environment: 'PRODUCTION', original_transaction_id: 'otx_1', transaction_id: 'tx_1', ...ev } }),
}))

const session = (over = {}) => ({ id: 'cs_1', object: 'checkout.session', mode: 'subscription', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1', invoice: 'in_1', metadata: { user_id: USER, plan: 'family' }, ...over })
const invoice = (over = {}) => ({ id: 'in_1', object: 'invoice', amount_paid: 999, billing_reason: 'subscription_create', customer: 'cus_1', parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_1', metadata: { user_id: USER, plan: 'family' } } }, lines: { data: [{ period: { start: Math.floor(Date.now() / 1000), end: Math.floor(Date.now() / 1000) + 2592000 } }] }, ...over })
const redeemed = () => atlasCalls.filter((c) => c.path === '/api/referral/redeemed')
const reversed = () => atlasCalls.filter((c) => c.path === '/api/referral/reversed')
const row = () => db.t('atlas_referrals')[0]

describe('Stripe webhook → Atlas', () => {
  it('first paid family checkout reports once; replays and the matching invoice.paid do not', async () => {
    expect((await stripeHook('checkout.session.completed', session())).status).toBe(200)
    expect((await stripeHook('checkout.session.completed', session())).status).toBe(200)
    expect((await stripeHook('invoice.paid', invoice())).status).toBe(200)
    expect(redeemed()).toHaveLength(1)
    expect(redeemed()[0].body).toEqual({ token: token.token, externalRef: 'sub_1', feeCents: 100 })
    expect(redeemed()[0].headers.Authorization).toBe(`Bearer ${CB}`)
    expect(row()).toMatchObject({ report_status: 'reported', external_ref: 'sub_1', payment_ref: 'in_1' })
  })
  it('invoice.paid first (before checkout.session.completed) also reports once', async () => {
    await stripeHook('invoice.paid', invoice())
    await stripeHook('checkout.session.completed', session())
    expect(redeemed()).toHaveLength(1)
  })
  it('a trial (no payment) does not report; the trial converting does', async () => {
    await stripeHook('checkout.session.completed', session({ payment_status: 'no_payment_required', invoice: 'in_0' }))
    await stripeHook('invoice.paid', invoice({ id: 'in_0', amount_paid: 0 }))
    expect(redeemed()).toHaveLength(0)
    const trialEnd = Math.floor(Date.now() / 1000)
    stripeObjects['subscriptions/sub_1'] = { id: 'sub_1', created: trialEnd - 14 * 86400 + 600 > token.payload.iat ? trialEnd - 10 : trialEnd, trial_end: trialEnd, metadata: { user_id: USER, plan: 'family' }, items: { data: [] } }
    await stripeHook('invoice.paid', invoice({ id: 'in_2', billing_reason: 'subscription_cycle', lines: { data: [{ period: { start: trialEnd, end: trialEnd + 2592000 } }] } }))
    expect(redeemed()).toHaveLength(1)
    expect(row().payment_ref).toBe('in_2')
  })
  it('an ordinary renewal (no trial) is not a first payment', async () => {
    stripeObjects['subscriptions/sub_1'] = { id: 'sub_1', created: 1, trial_end: null, metadata: { user_id: USER, plan: 'family' }, items: { data: [] } }
    await stripeHook('invoice.paid', invoice({ billing_reason: 'subscription_cycle' }))
    expect(redeemed()).toHaveLength(0)
  })
  it('teacher plan and coin packs never report', async () => {
    await stripeHook('checkout.session.completed', session({ metadata: { user_id: USER, plan: 'teacher' } }))
    await stripeHook('checkout.session.completed', session({ mode: 'payment', metadata: { user_id: USER, type: 'coin_pack', coins: '50' } }))
    expect(redeemed()).toHaveLength(0)
  })
  it('cancellation calls nothing', async () => {
    await stripeHook('checkout.session.completed', session())
    atlasCalls.length = 0
    await stripeHook('customer.subscription.deleted', { id: 'sub_1', customer: 'cus_1', metadata: { user_id: USER, plan: 'family' } })
    expect(atlasCalls).toHaveLength(0)
  })
  it('a refund of the first invoice calls /reversed once (replayed)', async () => {
    await stripeHook('checkout.session.completed', session())
    stripeObjects['invoices/in_1'] = invoice()
    await stripeHook('charge.refunded', { id: 'ch_1', invoice: 'in_1', amount: 999, amount_refunded: 999, refunded: true })
    await stripeHook('charge.refunded', { id: 'ch_1', invoice: 'in_1', amount: 999, amount_refunded: 999, refunded: true })
    expect(reversed()).toHaveLength(1)
    expect(reversed()[0].body).toEqual({ token: token.token, reason: 'refunded', keepAccess: false })
  })
  it('basil-shaped charge (no invoice field) is mapped through invoice_payments', async () => {
    await stripeHook('checkout.session.completed', session())
    stripeObjects['invoice_payments'] = { data: [{ invoice: 'in_1' }] }
    stripeObjects['invoices/in_1'] = invoice()
    await stripeHook('charge.refunded', { id: 'ch_1', payment_intent: 'pi_1', amount: 999, amount_refunded: 300 })
    expect(reversed()).toHaveLength(1) // partial refunds are reported too
  })
  it('a refund of a later invoice does nothing', async () => {
    await stripeHook('checkout.session.completed', session())
    stripeObjects['invoices/in_9'] = invoice({ id: 'in_9', billing_reason: 'subscription_cycle' })
    await stripeHook('charge.refunded', { id: 'ch_9', invoice: 'in_9' })
    expect(reversed()).toHaveLength(0)
  })
  it('test-mode events are ignored', async () => {
    await stripeHook('checkout.session.completed', session(), { livemode: false })
    expect(redeemed()).toHaveLength(0)
  })
  it('Atlas down → webhook still 200, row left pending for the cron', async () => {
    atlasReply = () => { throw new TypeError('fetch failed') }
    expect((await stripeHook('checkout.session.completed', session())).status).toBe(200)
    expect(row()).toMatchObject({ report_status: 'pending', external_ref: 'sub_1' })
    expect(row().next_attempt_at).toBeTruthy()
  })
  it('missing env → no Atlas calls, no referral reads, checkout still syncs', async () => {
    for (const k of ['ATLAS_REFERRAL_SECRET', 'PARTNER_CALLBACK_SECRET', 'ATLAS_BASE_URL']) delete process.env[k]
    db.calls.length = 0
    expect((await stripeHook('checkout.session.completed', session())).status).toBe(200)
    expect(atlasCalls).toHaveLength(0)
    expect(db.calls.some((c) => c.name === 'atlas_referrals')).toBe(false)
    expect(db.calls.some((c) => c.name === 'subscriptions' && c.method === 'POST')).toBe(true)
  })
  it('secrets and tokens never appear in logs', async () => {
    for (const r of [() => reply(503), () => reply(401, {}), () => reply(400, {})]) {
      atlasReply = r
      Object.assign(row(), { report_status: 'pending', external_ref: null, next_attempt_at: null })
      await stripeHook('checkout.session.completed', session())
    }
    const all = logs.join('\n')
    for (const s of [CB, SECRET, token.token, token.token.split('.')[1], token.payload.n]) expect(all).not.toContain(s)
  })
})

describe('RevenueCat webhook → Atlas', () => {
  it('INITIAL_PURCHASE NORMAL reports once (replayed), externalRef = original_transaction_id', async () => {
    await rcHook({ type: 'INITIAL_PURCHASE', period_type: 'NORMAL' })
    await rcHook({ type: 'INITIAL_PURCHASE', period_type: 'NORMAL' })
    await rcHook({ type: 'RENEWAL', period_type: 'NORMAL', transaction_id: 'tx_2' })
    expect(redeemed()).toHaveLength(1)
    expect(redeemed()[0].body).toEqual({ token: token.token, externalRef: 'otx_1', feeCents: 100 })
  })
  it('a trial does not report; its conversion does', async () => {
    await rcHook({ type: 'INITIAL_PURCHASE', period_type: 'TRIAL' })
    expect(redeemed()).toHaveLength(0)
    await rcHook({ type: 'RENEWAL', period_type: 'NORMAL', is_trial_conversion: true, transaction_id: 'tx_2' })
    expect(redeemed()).toHaveLength(1)
  })
  it('a plain renewal is not a first payment', async () => {
    await rcHook({ type: 'RENEWAL', period_type: 'NORMAL', is_trial_conversion: false })
    expect(redeemed()).toHaveLength(0)
  })
  it('sandbox and teacher products never report', async () => {
    await rcHook({ type: 'INITIAL_PURCHASE', period_type: 'NORMAL', environment: 'SANDBOX' })
    await rcHook({ type: 'INITIAL_PURCHASE', period_type: 'NORMAL', product_id: 'com.myfavoritebook.app.teacher.monthly' })
    expect(redeemed()).toHaveLength(0)
  })
  it('cancellation (unsubscribe) calls nothing; a CUSTOMER_SUPPORT refund reverses once', async () => {
    await rcHook({ type: 'INITIAL_PURCHASE', period_type: 'NORMAL' })
    atlasCalls.length = 0
    await rcHook({ type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' })
    expect(atlasCalls).toHaveLength(0)
    await rcHook({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' })
    await rcHook({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' })
    expect(reversed()).toHaveLength(1)
  })
  it('Atlas failing never fails the RC webhook', async () => {
    atlasReply = () => reply(500)
    const res = await rcHook({ type: 'INITIAL_PURCHASE', period_type: 'NORMAL' })
    expect(res.status).toBe(200)
  })
})

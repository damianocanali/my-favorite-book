// Callbacks client (exact request shape, every response row) and the
// reporting state machine (claim → call → status), against an in-memory
// PostgREST and a mocked fetch. No real network.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fakeDb } from './fake-postgrest.js'
import { reportRedeemed, reportReversed } from '../lib/atlas/callbacks.js'
import { recordFirstPayment, processReport, recordRefund, runAtlasCron, MAX_ATTEMPTS, _resetAlertsForTests } from '../lib/atlas/report.js'
import { attachReferral } from '../lib/atlas/store.js'
import { SECRET, mint } from './atlas-helpers.js'

const CB = 'cb-secret-DO-NOT-LOG'
const cfg = { secret: SECRET, capture: true, callbacks: true, callbackSecret: CB, baseUrl: 'https://atlas.example' }
const USER = '11111111-1111-4111-8111-111111111111'
const reply = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status })

let db, atlas, logs
beforeEach(async () => {
  _resetAlertsForTests()
  db = fakeDb()
  atlas = vi.fn(async () => reply(200, { status: 'recorded' }))
  logs = []
  for (const m of ['log', 'warn', 'error', 'info']) vi.spyOn(console, m).mockImplementation((...a) => logs.push(a.map(String).join(' ')))
})
afterEach(() => vi.restoreAllMocks())

const deps = (extra = {}) => ({ sb: db.sb, cfg, fetchImpl: atlas, ...extra })
async function referred(over = {}) {
  const t = mint(over)
  await attachReferral(db.sb, USER, t.token, t.payload)
  return t
}
const row = () => db.t('atlas_referrals')[0]

describe('callbacks client', () => {
  it('sends the exact /redeemed request', async () => {
    const f = vi.fn(async () => reply(200, { status: 'recorded' }))
    const r = await reportRedeemed({ token: 'tok.sig', externalRef: 'sub_1' }, cfg, { fetchImpl: f })
    expect(r.outcome).toBe('recorded')
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://atlas.example/api/referral/redeemed')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Authorization: `Bearer ${CB}`, 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ token: 'tok.sig', externalRef: 'sub_1', feeCents: 100 })
  })
  it('sends the exact /reversed request', async () => {
    const f = vi.fn(async () => reply(200, { status: 'reversed' }))
    const r = await reportReversed({ token: 'tok.sig', reason: 'refunded' }, cfg, { fetchImpl: f })
    expect(r.outcome).toBe('reversed')
    expect(f.mock.calls[0][0]).toBe('https://atlas.example/api/referral/reversed')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ token: 'tok.sig', reason: 'refunded', keepAccess: false })
  })
  it.each([
    [200, { status: 'recorded' }, 'recorded'],
    [200, { status: 'already_redeemed' }, 'already_redeemed'],
    [200, { status: 'weird' }, 'retry'],
    [400, { error: 'expired' }, 'invalid'],
    [401, { error: 'no' }, 'config_error'],
    [500, null, 'retry'],
    [503, null, 'retry'],
  ])('/redeemed %s %j → %s', async (status, body, outcome) => {
    expect((await reportRedeemed({ token: 't', externalRef: 'x' }, cfg, { fetchImpl: async () => reply(status, body ?? undefined) })).outcome).toBe(outcome)
  })
  it.each([
    [200, { status: 'reversed' }, 'reversed'],
    [200, { status: 'not_billable' }, 'not_billable'],
    [400, {}, 'invalid'], [401, {}, 'config_error'], [502, null, 'retry'],
  ])('/reversed %s %j → %s', async (status, body, outcome) => {
    expect((await reportReversed({ token: 't' }, cfg, { fetchImpl: async () => reply(status, body ?? undefined) })).outcome).toBe(outcome)
  })
  it('network error / timeout → retry, never throws', async () => {
    const r = await reportRedeemed({ token: 't', externalRef: 'x' }, cfg, { fetchImpl: async () => { throw new TypeError('fetch failed') } })
    expect(r.outcome).toBe('retry')
  })
})

describe('reporting', () => {
  it('no referral row → no call', async () => {
    const r = await recordFirstPayment({ userId: USER, externalRef: 'sub_1' }, deps())
    expect(r.result).toBe('no_referral')
    expect(atlas).not.toHaveBeenCalled()
  })
  it('records, claims and reports once; replays do not call again', async () => {
    await referred()
    for (let i = 0; i < 3; i++) {
      const r = await recordFirstPayment({ userId: USER, externalRef: 'sub_1', paymentRef: 'in_1' }, deps())
      await r.deferred
    }
    expect(atlas).toHaveBeenCalledTimes(1)
    expect(row()).toMatchObject({ report_status: 'reported', reported_status: 'recorded', external_ref: 'sub_1', payment_ref: 'in_1', report_attempts: 1 })
    expect(row().reported_at).toBeTruthy()
  })
  it('concurrent claims → exactly one call', async () => {
    await referred()
    await recordFirstPayment({ userId: USER, externalRef: 'sub_1' }, { ...deps(), cfg: { ...cfg, callbacks: false } })
    await Promise.all(Array.from({ length: 5 }, () => processReport(USER, deps())))
    expect(atlas).toHaveBeenCalledTimes(1)
  })
  it('a second, different payment keeps the first external ref', async () => {
    await referred()
    await (await recordFirstPayment({ userId: USER, externalRef: 'sub_1' }, deps())).deferred
    await recordFirstPayment({ userId: USER, externalRef: 'sub_2' }, deps())
    expect(row().external_ref).toBe('sub_1')
    expect(atlas).toHaveBeenCalledTimes(1)
  })
  it('already_redeemed is final', async () => {
    atlas.mockImplementation(async () => reply(200, { status: 'already_redeemed' }))
    await referred()
    await (await recordFirstPayment({ userId: USER, externalRef: 'sub_1' }, deps())).deferred
    expect(row()).toMatchObject({ report_status: 'reported', reported_status: 'already_redeemed' })
  })
  it('400 → failed_final, no retry', async () => {
    atlas.mockImplementation(async () => reply(400, { error: 'expired' }))
    await referred()
    await (await recordFirstPayment({ userId: USER, externalRef: 'sub_1' }, deps())).deferred
    expect(row().report_status).toBe('failed_final')
    expect(row().last_error.length).toBeLessThanOrEqual(300)
    await processReport(USER, deps({ now: new Date(Date.now() + 86400000) }))
    expect(atlas).toHaveBeenCalledTimes(1)
  })
  it('401 → config_error, owner alerted, no retry', async () => {
    atlas.mockImplementation(async () => reply(401, {}))
    await referred()
    await (await recordFirstPayment({ userId: USER, externalRef: 'sub_1' }, deps())).deferred
    expect(row().report_status).toBe('config_error')
    await processReport(USER, deps({ now: new Date(Date.now() + 86400000) }))
    expect(atlas).toHaveBeenCalledTimes(1)
  })
  it('5xx → pending with backoff, retried by the cron, gives up after MAX_ATTEMPTS', async () => {
    atlas.mockImplementation(async () => reply(503))
    await referred()
    const t0 = Date.now()
    await (await recordFirstPayment({ userId: USER, externalRef: 'sub_1' }, deps({ now: new Date(t0) }))).deferred
    expect(row().report_status).toBe('pending')
    expect(Date.parse(row().next_attempt_at) - t0).toBe(60000)
    // not due yet → the cron does nothing
    await runAtlasCron(db.sb, { now: new Date(t0 + 1000), cfg, fetchImpl: atlas })
    expect(atlas).toHaveBeenCalledTimes(1)
    let t = t0
    for (let i = 2; i <= MAX_ATTEMPTS; i++) {
      t = Date.parse(row().next_attempt_at)
      await runAtlasCron(db.sb, { now: new Date(t), cfg, fetchImpl: atlas })
    }
    expect(atlas).toHaveBeenCalledTimes(MAX_ATTEMPTS)
    expect(row().report_status).toBe('failed_final')
    await runAtlasCron(db.sb, { now: new Date(t + 30 * 86400000), cfg, fetchImpl: atlas })
    expect(atlas).toHaveBeenCalledTimes(MAX_ATTEMPTS)
  })
  it('cron reports a payment recorded while callbacks were unconfigured', async () => {
    await referred()
    const r = await recordFirstPayment({ userId: USER, externalRef: 'sub_1' }, { ...deps(), cfg: { ...cfg, callbacks: false } })
    expect(r.result).toBe('recorded_no_config')
    expect(atlas).not.toHaveBeenCalled()
    const out = await runAtlasCron(db.sb, { cfg, fetchImpl: atlas })
    expect(out.reported).toBe(1)
    expect(atlas).toHaveBeenCalledTimes(1)
  })
  it('cron releases a stale reporting claim', async () => {
    await referred()
    await recordFirstPayment({ userId: USER, externalRef: 'sub_1' }, { ...deps(), cfg: { ...cfg, callbacks: false } })
    Object.assign(row(), { report_status: 'reporting', updated_at: new Date(Date.now() - 3600000).toISOString() })
    await runAtlasCron(db.sb, { cfg, fetchImpl: atlas })
    expect(row().report_status).toBe('reported')
  })
  it('precheck false (not the first paid payment) → nothing recorded', async () => {
    await referred()
    const r = await recordFirstPayment({ userId: USER, externalRef: 'sub_1', precheck: () => false }, deps())
    expect(r.result).toBe('not_first_payment')
    expect(row().external_ref).toBeNull()
  })
  it('missing env → no database or network calls at all', async () => {
    const sb = vi.fn()
    const off = { secret: null, capture: false, callbacks: false }
    expect((await recordFirstPayment({ userId: USER, externalRef: 'x' }, { sb, cfg: off, fetchImpl: atlas })).result).toBe('off')
    expect((await recordRefund({ externalRef: 'x' }, { sb, cfg: off, fetchImpl: atlas })).result).toBe('off')
    expect((await runAtlasCron(sb, { cfg: off, fetchImpl: atlas })).skipped).toBe(true)
    expect(sb).not.toHaveBeenCalled()
    expect(atlas).not.toHaveBeenCalled()
  })
  it('a database outage never throws', async () => {
    const sb = async () => { throw new Error('down') }
    expect((await recordFirstPayment({ userId: USER, externalRef: 'x' }, { sb, cfg, fetchImpl: atlas })).result).toBe('error')
    expect((await recordRefund({ externalRef: 'x' }, { sb, cfg, fetchImpl: atlas })).result).toBe('error')
  })
})

describe('refunds', () => {
  async function reportedReferral() {
    await referred()
    await (await recordFirstPayment({ userId: USER, externalRef: 'sub_1', paymentRef: 'in_1' }, deps())).deferred
    atlas.mockClear()
    atlas.mockImplementation(async () => reply(200, { status: 'reversed' }))
  }
  it('refund of the first payment → /reversed once', async () => {
    await reportedReferral()
    for (let i = 0; i < 3; i++) await (await recordRefund({ externalRef: 'sub_1', paymentRef: 'in_1' }, deps())).deferred
    expect(atlas).toHaveBeenCalledTimes(1)
    expect(atlas.mock.calls[0][0]).toBe('https://atlas.example/api/referral/reversed')
    expect(JSON.parse(atlas.mock.calls[0][1].body)).toMatchObject({ reason: 'refunded', keepAccess: false })
    expect(row()).toMatchObject({ reversal_status: 'reversed' })
  })
  it('not_billable is final', async () => {
    await reportedReferral()
    atlas.mockImplementation(async () => reply(200, { status: 'not_billable' }))
    await (await recordRefund({ externalRef: 'sub_1' }, deps())).deferred
    expect(row().reversal_status).toBe('not_billable')
  })
  it('refund of a LATER payment → nothing', async () => {
    await reportedReferral()
    const r = await recordRefund({ externalRef: 'sub_1', paymentRef: 'in_9' }, deps())
    expect(r.result).toBe('not_first_payment')
    expect(atlas).not.toHaveBeenCalled()
  })
  it('refunded before it was reported → report cancelled, nothing sent', async () => {
    await referred()
    await recordFirstPayment({ userId: USER, externalRef: 'sub_1' }, { ...deps(), cfg: { ...cfg, callbacks: false } })
    const r = await recordRefund({ externalRef: 'sub_1' }, deps())
    expect(r.result).toBe('report_cancelled')
    await runAtlasCron(db.sb, { cfg, fetchImpl: atlas })
    expect(atlas).not.toHaveBeenCalled()
    expect(row().report_status).toBe('failed_final')
  })
  it('reversal 5xx → retried by the cron', async () => {
    await reportedReferral()
    atlas.mockImplementation(async () => reply(500))
    await (await recordRefund({ externalRef: 'sub_1' }, deps())).deferred
    expect(row().reversal_status).toBe('pending')
    atlas.mockImplementation(async () => reply(200, { status: 'reversed' }))
    await runAtlasCron(db.sb, { now: new Date(Date.now() + 3600000), cfg, fetchImpl: atlas })
    expect(row().reversal_status).toBe('reversed')
    expect(atlas).toHaveBeenCalledTimes(2)
  })
})

describe('secrets never reach the logs', () => {
  it('across every outcome', async () => {
    const t = await referred()
    for (const [s, b] of [[503], [401, {}], [400, {}]]) {
      atlas.mockImplementation(async () => reply(s, b))
      Object.assign(row(), { report_status: 'pending', external_ref: null, next_attempt_at: null })
      await (await recordFirstPayment({ userId: USER, externalRef: 'sub_1' }, deps())).deferred
    }
    const all = logs.join('\n')
    expect(logs.length).toBeGreaterThan(0)
    expect(all).not.toContain(CB)
    expect(all).not.toContain(SECRET)
    expect(all).not.toContain(t.token)
    expect(all).not.toContain(t.token.split('.')[1])
    expect(all).not.toContain(t.payload.n) // only a prefix
  })
})

// Stage 4: the school Stripe webhook end to end against an in-memory
// database — idempotency, ordering by period, and EVERY test required by
// docs/superpowers/notes/stage4-license-terms.md:
//   * a renewal into a new paid period moves starts_at and a new class
//     print request is then allowed;
//   * entering/leaving grace, a late payment for the current period, a
//     replayed webhook and an out-of-order older event leave starts_at alone
//     and a second request in the same term is refused (already_requested);
//   * a trial is never printable; a trial converting to paid starts the
//     first paid term, which can print once.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fakeDb } from './fake-postgrest.js'
import { handleSchoolStripeEvent } from '../lib/school/billingWebhook.js'
import { canPrintClass } from '../lib/school/writingYear.js'

const CLASS = '6f1c1b1e-0000-4000-8000-000000000001'
const CLASS2 = '6f1c1b1e-0000-4000-8000-000000000002'
const TEACHER = 'teacher-1'
const SUB = 'sub_class_1'
const PLAN_SUB = 'sub_plan_1'
const s = (iso) => Date.parse(iso) / 1000
// Periods around "now" (2026-10) so the licenses are live in real time.
const P1 = [s('2026-09-01T00:00:00Z'), s('2027-09-01T00:00:00Z')]
const P2 = [s('2027-09-01T00:00:00Z'), s('2028-09-01T00:00:00Z')]
const isoS = (t) => new Date(t * 1000).toISOString()
const origEnv = { ...process.env }

let db
let stripeSubs
const stripe = vi.fn(async (path, opts = {}) => {
  const method = opts.method ?? 'GET'
  if (path === 'refunds' && method === 'POST') return { ok: true, status: 200, data: { id: 're_1' } }
  const id = path.split('/')[1]
  if (method === 'DELETE') return stripeSubs[id] ? { ok: true, status: 200, data: { id, status: 'canceled' } } : { ok: false, status: 404, data: {} }
  return stripeSubs[id] ? { ok: true, status: 200, data: stripeSubs[id] } : { ok: false, status: 404, data: {} }
})

let evSeq = 0
const ev = (type, object, created = 1_790_000_000 + evSeq) => ({ id: `evt_${++evSeq}`, type, created, data: { object } })
const classMd = { type: 'class_license', owner_user_id: TEACHER, classroom_id: CLASS, school_name: 'Lincoln Elementary', dpa_version: 'NDPA-2.1', dpa_accepted_at: '2026-10-02T10:00:00Z' }

function subscription({ id = SUB, period = P1, quantity = 22, price = 'price_f', metadata = classMd, status = 'active', cape = false } = {}) {
  // 2025 ("basil") shape: periods on the item.
  return { id, object: 'subscription', status, customer: 'cus_1', cancel_at_period_end: cape, metadata, items: { data: [{ quantity, price: { id: price }, current_period_start: period[0], current_period_end: period[1] }] } }
}
function invoice({ sub = SUB, period = P1, quantity = 22, reason = 'subscription_cycle', metadata = classMd, collection = 'charge_automatically', due = null, oldShape = false } = {}) {
  const line = { period: { start: period[0], end: period[1] }, quantity, price: { id: 'price_f' } }
  const base = { id: `in_${evSeq}`, object: 'invoice', customer: 'cus_1', billing_reason: reason, collection_method: collection, due_date: due, lines: { data: [line] } }
  return oldShape
    ? { ...base, subscription: sub, subscription_details: { metadata } }
    : { ...base, parent: { type: 'subscription_details', subscription_details: { subscription: sub, metadata } } }
}
const checkout = (metadata = classMd, sub = SUB) => ({ id: 'cs_1', object: 'checkout.session', mode: 'subscription', payment_status: 'paid', customer: 'cus_1', subscription: sub, metadata })

const license = () => db.t('class_licenses').find((l) => l.classroom_id === CLASS)
const run = (event) => handleSchoolStripeEvent(event, { sb: db.sb, stripe })

/// Mirrors school_create_class_print (024): a paid (active/grace/comped),
/// unexpired license; one live request per (license_id, term_start).
function requestPrint(classroomId = CLASS, children = 10) {
  const lic = db.t('class_licenses').find((l) => l.classroom_id === classroomId)
  if (!canPrintClass(lic)) return 'license_not_printable'
  if (children > lic.seats) return 'too_many_children'
  const reqs = db.t('class_print_requests')
  if (reqs.some((r) => r.license_id === lic.id && r.term_start === lic.starts_at && r.status !== 'canceled')) return 'already_requested'
  reqs.push({ license_id: lic.id, term_start: lic.starts_at, status: 'requested' })
  return 'ok'
}

beforeEach(() => {
  process.env.STRIPE_PRICE_SEAT = 'price_s'
  process.env.STRIPE_PRICE_SEAT_FOUNDING = 'price_f'
  process.env.STRIPE_PRICE_SCHOOL_SEAT = 'price_p'
  delete process.env.OWNER_ALERT_EMAIL
  delete process.env.PRINT_OPS_EMAIL
  stripeSubs = { [SUB]: subscription() }
  stripe.mockClear()
  db = fakeDb({
    classrooms: [{ id: CLASS, owner_user_id: TEACHER, name: 'Room 5' }, { id: CLASS2, owner_user_id: TEACHER, name: 'Room 6' }],
    class_licenses: [{
      id: 'lic-1', owner_user_id: TEACHER, classroom_id: CLASS, origin: 'trial', status: 'trial', seats: 35,
      image_allowance: 300, images_used: 120, starts_at: '2026-09-20T00:00:00.000Z', expires_at: '2026-10-20T00:00:00.000Z',
      stripe_period_start: null, stripe_subscription_id: null, stripe_customer_id: null, stripe_event_at: null,
      pending_seats: null, cancel_at_period_end: false, school_plan_id: null, billing_method: null, needs_review: false, review_reason: null, updated_at: 'v0',
    }],
    class_print_requests: [],
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => { process.env = { ...origEnv }; vi.restoreAllMocks() })

async function buyClass() {
  const r = await run(ev('checkout.session.completed', checkout()))
  expect(r).toEqual({ handled: true, status: 200 })
}

describe('class purchase (card)', () => {
  it('a trial is never printable; converting to paid starts the first paid term, which prints once', async () => {
    expect(requestPrint()).toBe('license_not_printable')
    await buyClass()
    const lic = license()
    expect(lic).toMatchObject({
      status: 'active', starts_at: isoS(P1[0]), stripe_period_start: isoS(P1[0]), expires_at: isoS(P1[1]),
      seats: 22, image_allowance: 6600, images_used: 0, stripe_subscription_id: SUB, stripe_customer_id: 'cus_1',
      billing_method: 'card', price_tier: 'founding', dpa_version: 'NDPA-2.1', dpa_accepted_by: TEACHER, school_name: 'Lincoln Elementary',
    })
    expect(requestPrint()).toBe('ok')
    expect(requestPrint()).toBe('already_requested')
  })

  it('the first invoice.paid after checkout is the same term: no second print', async () => {
    await buyClass()
    const before = license().starts_at
    requestPrint()
    expect((await run(ev('invoice.paid', invoice({ reason: 'subscription_create' })))).status).toBe(200)
    expect(license().starts_at).toBe(before)
    expect(requestPrint()).toBe('already_requested')
  })

  it('invoice.paid may arrive BEFORE checkout.session.completed; the result is the same', async () => {
    await run(ev('invoice.paid', invoice({ reason: 'subscription_create' })))
    expect(license()).toMatchObject({ status: 'active', starts_at: isoS(P1[0]), stripe_subscription_id: SUB, seats: 22 })
    await buyClass()
    expect(license().starts_at).toBe(isoS(P1[0]))
  })

  it('reads old-API invoices (invoice.subscription) too', async () => {
    await run(ev('invoice.paid', invoice({ reason: 'subscription_create', oldShape: true })))
    expect(license().status).toBe('active')
  })

  it('seats come from Stripe, never from metadata the browser could touch', async () => {
    await run(ev('checkout.session.completed', checkout({ ...classMd, seats: '35', quantity: '35' })))
    expect(license().seats).toBe(22)
    expect(stripe).toHaveBeenCalledWith(`subscriptions/${SUB}`)
  })

  it('a class that is not the buyer\'s is never touched', async () => {
    await run(ev('checkout.session.completed', checkout({ ...classMd, owner_user_id: 'someone-else' })))
    expect(license().status).toBe('trial')
  })

  it('creates the license when the class has none', async () => {
    stripeSubs[SUB] = subscription({ metadata: { ...classMd, classroom_id: CLASS2 } })
    await run(ev('checkout.session.completed', checkout({ ...classMd, classroom_id: CLASS2 })))
    const lic = db.t('class_licenses').find((l) => l.classroom_id === CLASS2)
    expect(lic).toMatchObject({ status: 'active', seats: 22, starts_at: isoS(P1[0]), image_allowance: 6600 })
    expect(requestPrint(CLASS2)).toBe('ok')
  })
})

describe('renewals and the term rule', () => {
  beforeEach(async () => { await buyClass(); expect(requestPrint()).toBe('ok') })

  it('a renewal into a new paid period moves starts_at forward and a new print is then allowed', async () => {
    await run(ev('invoice.paid', invoice({ period: P2, quantity: 22 })))
    expect(license()).toMatchObject({ status: 'active', starts_at: isoS(P2[0]), expires_at: isoS(P2[1]), images_used: 0 })
    expect(requestPrint()).toBe('ok')
    expect(requestPrint()).toBe('already_requested')
  })

  it('entering grace does not move starts_at; the same term still refuses a second print', async () => {
    const start = license().starts_at
    await run(ev('invoice.payment_failed', invoice({ period: P2 })))
    expect(license()).toMatchObject({ status: 'grace', starts_at: start })
    expect(Date.parse(license().expires_at)).toBe(P2[0] * 1000 + 14 * 86400000)
    expect(requestPrint()).toBe('already_requested')
  })

  it('leaving grace without a new paid period (a late payment for the current period) does not move starts_at', async () => {
    const start = license().starts_at
    // An out-of-order failure for the period already paid can't open grace…
    await run(ev('invoice.payment_failed', invoice({ period: P1 })))
    expect(license().status).toBe('active')
    // …so force the state: grace on the current term, then the late payment.
    Object.assign(license(), { status: 'grace' })
    await run(ev('invoice.paid', invoice({ period: P1 })))
    expect(license()).toMatchObject({ status: 'active', starts_at: start })
    expect(requestPrint()).toBe('already_requested')
  })

  it('a late payment for the current period changes status/expiry only', async () => {
    const start = license().starts_at
    await run(ev('invoice.paid', invoice({ period: P1, reason: 'subscription_cycle' })))
    expect(license().starts_at).toBe(start)
    expect(requestPrint()).toBe('already_requested')
  })

  it('the same webhook replayed is a no-op (ledger) — even a renewal', async () => {
    const renewal = ev('invoice.paid', invoice({ period: P2 }))
    await run(renewal)
    expect(requestPrint()).toBe('ok')
    const writes = db.calls.filter((c) => c.method === 'PATCH').length
    expect(await run(renewal)).toEqual({ handled: true, status: 200, duplicate: true })
    expect(db.calls.filter((c) => c.method === 'PATCH').length).toBe(writes)
    expect(license().starts_at).toBe(isoS(P2[0]))
    expect(requestPrint()).toBe('already_requested')
  })

  it('the same invoice under a NEW event id (Stripe resend) is still a no-op for starts_at', async () => {
    await run(ev('invoice.paid', invoice({ period: P2 })))
    requestPrint()
    await run(ev('invoice.paid', invoice({ period: P2 })))
    expect(license().starts_at).toBe(isoS(P2[0]))
    expect(requestPrint()).toBe('already_requested')
  })

  it('an out-of-order older event never moves starts_at back', async () => {
    await run(ev('invoice.paid', invoice({ period: P2 })))
    requestPrint()
    await run(ev('invoice.paid', invoice({ period: P1 })))
    await run(ev('invoice.payment_failed', invoice({ period: P1 })))
    expect(license()).toMatchObject({ status: 'active', starts_at: isoS(P2[0]) })
    expect(requestPrint()).toBe('already_requested')
  })

  it('a failed renewal later paid starts THAT term once (the renewal was never paid before)', async () => {
    await run(ev('invoice.payment_failed', invoice({ period: P2 })))
    expect(license().status).toBe('grace')
    await run(ev('invoice.paid', invoice({ period: P2 })))
    expect(license()).toMatchObject({ status: 'active', starts_at: isoS(P2[0]) })
    expect(requestPrint()).toBe('ok')
    expect(requestPrint()).toBe('already_requested')
  })

  it('seat changes and cancel-at-period-end never move starts_at', async () => {
    const start = license().starts_at
    // Seats added through the app: our row first (paid in full), then Stripe.
    Object.assign(license(), { seats: 30, image_allowance: 9000 })
    await run(ev('customer.subscription.updated', subscription({ quantity: 30 }), 1_800_000_000))
    expect(license()).toMatchObject({ seats: 30, image_allowance: 9000, starts_at: start, needs_review: false })
    await run(ev('customer.subscription.updated', subscription({ quantity: 20, cape: true }), 1_800_000_100))
    expect(license()).toMatchObject({ seats: 30, pending_seats: 20, cancel_at_period_end: true, starts_at: start })
    // An older update arriving late is ignored.
    await run(ev('customer.subscription.updated', subscription({ quantity: 35 }), 1_800_000_050))
    expect(license().seats).toBe(30)
    expect(license().needs_review).toBe(false)
    // The reduction lands with the renewal.
    await run(ev('invoice.paid', invoice({ period: P2, quantity: 20 })))
    expect(license()).toMatchObject({ seats: 20, pending_seats: null, image_allowance: 6000 })
    expect(requestPrint()).toBe('ok')
  })

  it('a proration invoice (mid-term seat increase) is not a new term', async () => {
    await run(ev('invoice.paid', invoice({ period: [s('2027-01-10T00:00:00Z'), P1[1]], reason: 'subscription_update', quantity: 30 })))
    expect(license().starts_at).toBe(isoS(P1[0]))
    expect(requestPrint()).toBe('already_requested')
  })

  it('deleted → canceled, starts_at kept', async () => {
    await run(ev('customer.subscription.deleted', subscription({ status: 'canceled' })))
    expect(license()).toMatchObject({ status: 'canceled', starts_at: isoS(P1[0]) })
  })
})

describe('idempotency failures', () => {
  it('a failed apply releases the claim and answers 500, so Stripe retries', async () => {
    const realSb = db.sb
    let fail = true
    const flaky = async (path, init = {}) => {
      if (fail && init.method === 'PATCH' && path.includes('class_licenses')) return new Response('{}', { status: 500 })
      return realSb(path, init)
    }
    const event = ev('checkout.session.completed', checkout())
    expect(await handleSchoolStripeEvent(event, { sb: flaky, stripe })).toEqual({ handled: true, status: 500 })
    expect(db.t('stripe_school_events')).toHaveLength(0)
    fail = false
    expect(await handleSchoolStripeEvent(event, { sb: flaky, stripe })).toEqual({ handled: true, status: 200 })
    expect(license().status).toBe('active')
  })

  it('a concurrent write is retried from a fresh read (compare-and-swap on updated_at)', async () => {
    await buyClass()
    const realSb = db.sb
    let raced = false
    const racing = async (path, init = {}) => {
      if (!raced && init.method === 'PATCH' && path.includes('class_licenses?id=eq.')) {
        raced = true
        Object.assign(license(), { images_used: 77, updated_at: 'someone-else' }) // a picture was spent meanwhile
      }
      return realSb(path, init)
    }
    await handleSchoolStripeEvent(ev('invoice.paid', invoice({ period: P2 })), { sb: racing, stripe })
    expect(license()).toMatchObject({ starts_at: isoS(P2[0]), images_used: 0 })
  })

  it('a consumer event is not a school event', async () => {
    db.t('subscriptions').push({ user_id: 'u', stripe_subscription_id: 'sub_family' })
    const r = await run(ev('customer.subscription.updated', { id: 'sub_family', metadata: { user_id: 'u', plan: 'family' }, items: { data: [] } }))
    expect(r).toEqual({ handled: false })
    expect(await run(ev('checkout.session.completed', { metadata: { type: 'coin_pack' } }))).toEqual({ handled: false })
    expect(await run(ev('payment_intent.succeeded', { metadata: { type: 'print_order' } }))).toEqual({ handled: false })
  })
})

describe('school plan', () => {
  const planMd = { type: 'school_plan', owner_user_id: TEACHER, school_name: 'Lincoln District', dpa_version: 'NDPA-2.1', dpa_accepted_at: '2026-10-02T10:00:00Z' }
  const plan = () => db.t('school_plans')[0]
  const block = () => db.t('class_licenses').find((l) => l.school_plan_id === plan().id)

  beforeEach(() => {
    // Invoice-billed plan, inserted by api/school/checkout.js: usable for 30
    // days while the invoice is open, a block already given to a class.
    db.t('school_plans').push({
      id: 'plan-1', owner_user_id: TEACHER, school_name: 'Lincoln District', status: 'pending_payment', billing_method: 'invoice',
      seats: 200, pending_seats: null, price_tier: 'school', starts_at: '2026-10-02T00:00:00.000Z', expires_at: '2026-11-01T00:00:00.000Z',
      stripe_customer_id: 'cus_1', stripe_subscription_id: PLAN_SUB, stripe_price_id: 'price_p', stripe_period_start: null,
      stripe_event_at: null, cancel_at_period_end: false, needs_review: false, updated_at: 'p0',
    })
    Object.assign(license(), { school_plan_id: 'plan-1', status: 'pending_payment', seats: 25, image_allowance: 7500, images_used: 40, starts_at: '2026-10-02T00:00:00.000Z', expires_at: '2026-11-01T00:00:00.000Z' })
  })

  it('pending_payment is usable but never printable', () => {
    expect(requestPrint()).toBe('license_not_printable')
  })

  it('the invoice paid starts the plan term and every block mirrors it (print once per class)', async () => {
    await run(ev('invoice.paid', invoice({ sub: PLAN_SUB, period: P1, quantity: 200, reason: 'subscription_create', metadata: planMd, collection: 'send_invoice' })))
    expect(plan()).toMatchObject({ status: 'active', starts_at: isoS(P1[0]), expires_at: isoS(P1[1]), seats: 200 })
    expect(block()).toMatchObject({ status: 'active', starts_at: isoS(P1[0]), expires_at: isoS(P1[1]), seats: 25, images_used: 0 })
    expect(requestPrint()).toBe('ok')
    expect(requestPrint()).toBe('already_requested')
  })

  it('a plan renewal moves every block to the new term; a replay or older event does not', async () => {
    await run(ev('invoice.paid', invoice({ sub: PLAN_SUB, period: P1, quantity: 200, reason: 'subscription_create', metadata: planMd })))
    requestPrint()
    const renewal = ev('invoice.paid', invoice({ sub: PLAN_SUB, period: P2, quantity: 200, metadata: planMd }))
    await run(renewal)
    expect(block().starts_at).toBe(isoS(P2[0]))
    expect(requestPrint()).toBe('ok')
    await run(renewal)
    await run(ev('invoice.paid', invoice({ sub: PLAN_SUB, period: P1, quantity: 200, metadata: planMd })))
    expect(block().starts_at).toBe(isoS(P2[0]))
    expect(requestPrint()).toBe('already_requested')
  })

  it('grace on the plan reaches every block; starts_at stays', async () => {
    await run(ev('invoice.paid', invoice({ sub: PLAN_SUB, period: P1, quantity: 200, reason: 'subscription_create', metadata: planMd })))
    requestPrint()
    await run(ev('invoice.payment_failed', invoice({ sub: PLAN_SUB, period: P2, quantity: 200, metadata: planMd })))
    expect(plan().status).toBe('grace')
    expect(block()).toMatchObject({ status: 'grace', starts_at: isoS(P1[0]) })
    expect(requestPrint()).toBe('already_requested')
  })

  it('an open renewal invoice keeps the plan usable until its due date', async () => {
    await run(ev('invoice.paid', invoice({ sub: PLAN_SUB, period: P1, quantity: 200, reason: 'subscription_create', metadata: planMd })))
    const due = P2[0] + 30 * 86400
    await run(ev('invoice.finalized', invoice({ sub: PLAN_SUB, period: P2, quantity: 200, metadata: planMd, collection: 'send_invoice', due })))
    expect(plan()).toMatchObject({ status: 'active', starts_at: isoS(P1[0]), expires_at: isoS(due) })
    expect(block().expires_at).toBe(isoS(due))
  })

  it('a card plan is created from OUR metadata on checkout', async () => {
    db.tables.school_plans = []
    stripeSubs.sub_plan_2 = subscription({ id: 'sub_plan_2', quantity: 180, price: 'price_p', metadata: planMd })
    await run(ev('checkout.session.completed', checkout(planMd, 'sub_plan_2')))
    expect(plan()).toMatchObject({ status: 'active', seats: 180, school_name: 'Lincoln District', billing_method: 'card', price_tier: 'school', starts_at: isoS(P1[0]), dpa_version: 'NDPA-2.1', dpa_accepted_by: TEACHER })
  })
})

describe('api/stripe-webhook.js routes school events first', () => {
  async function signed(body, secret) {
    const t = Math.floor(Date.now() / 1000)
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`))
    return `t=${t},v1=${[...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')}`
  }

  it('a class-license checkout never reaches the consumer subscriptions upsert', async () => {
    vi.resetModules()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    process.env.SUPABASE_URL = 'https://db'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    const urls = []
    globalThis.fetch = vi.fn(async (url, init = {}) => {
      const u = String(url)
      urls.push(`${init.method || 'GET'} ${u}`)
      if (u.startsWith('https://api.stripe.com/')) return new Response(JSON.stringify(stripeSubs[SUB]))
      return db.sb(u.replace('https://db', ''), init)
    })
    const { default: handler } = await import('../api/stripe-webhook.js')
    const body = JSON.stringify(ev('checkout.session.completed', checkout()))
    const res = await handler(new Request('https://app.test/api/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': await signed(body, 'whsec_test') }, body }))
    expect(res.status).toBe(200)
    expect(urls.some((u) => u.includes('/rest/v1/subscriptions'))).toBe(false)
    expect(license().status).toBe('active')
  })
})

describe('the print key is the license term', () => {
  it('writing-year.js keys a live request on (license id, starts_at), and 024 enforces it', () => {
    const api = readFileSync('api/school/writing-year.js', 'utf8')
    expect(api).toMatch(/license_id=eq\.\$\{license\.id\}&term_start=eq\.\$\{encodeURIComponent\(license\.starts_at\)\}/)
    const sql = readFileSync('supabase-migrations/024_writing_year.sql', 'utf8')
    expect(sql).toMatch(/on public\.class_print_requests \(license_id, term_start\) where status <> 'canceled'/)
  })
  it('nothing in the billing code sets starts_at from the clock', () => {
    const src = readFileSync('lib/school/billingState.js', 'utf8') + readFileSync('lib/school/billingWebhook.js', 'utf8')
    expect(src).not.toMatch(/starts_at:\s*new Date\(\)/)
    expect(src).not.toMatch(/starts_at:\s*now/)
  })
})

describe('a class leaving a school plan', () => {
  it('buying a class on its own after its plan block ended detaches it from the plan', async () => {
    Object.assign(license(), { school_plan_id: 'plan-old', status: 'lapsed', stripe_subscription_id: 'sub_plan_old', stripe_period_start: '2025-09-01T00:00:00.000Z', starts_at: '2025-09-01T00:00:00.000Z' })
    await buyClass()
    expect(license()).toMatchObject({ school_plan_id: null, stripe_subscription_id: SUB, status: 'active', starts_at: isoS(P1[0]), billing_method: 'card' })
  })
})

describe('round 1 review fixes', () => {
  describe('I10: the ledger survives a crash mid-apply', () => {
    it('a claim never marked processed is taken over after 5 minutes; a fresh one answers 500 (retry later)', async () => {
      const event = ev('checkout.session.completed', checkout())
      // A delivery that claimed the event and was killed before applying it.
      db.t('stripe_school_events').push({ event_id: event.id, type: event.type, received_at: new Date(Date.now() - 60_000).toISOString(), processed_at: null })
      expect(await run(event)).toEqual({ handled: true, status: 500, busy: true })
      expect(license().status).toBe('trial')
      // Six minutes on, Stripe's retry takes the claim over and applies it.
      db.t('stripe_school_events')[0].received_at = new Date(Date.now() - 6 * 60_000).toISOString()
      expect(await run(event)).toEqual({ handled: true, status: 200 })
      expect(license().status).toBe('active')
      expect(db.t('stripe_school_events')[0].processed_at).toBeTruthy()
      // Now processed: a further delivery is a no-op.
      expect(await run(event)).toEqual({ handled: true, status: 200, duplicate: true })
    })
  })

  describe('I11: a second subscription for one class is canceled and refunded', () => {
    it('the newer subscription is canceled now, its payment refunded, the license untouched and flagged', async () => {
      await buyClass()
      const before = { ...license() }
      stripeSubs.sub_dup = { ...subscription({ id: 'sub_dup' }), latest_invoice: { id: 'in_dup', payment_intent: 'pi_dup' } }
      await run(ev('checkout.session.completed', checkout(classMd, 'sub_dup')))
      expect(stripe).toHaveBeenCalledWith('subscriptions/sub_dup', expect.objectContaining({ method: 'DELETE' }))
      expect(stripe).toHaveBeenCalledWith('refunds', expect.objectContaining({ method: 'POST', params: { payment_intent: 'pi_dup', reason: 'duplicate' } }))
      expect(license()).toMatchObject({ stripe_subscription_id: SUB, starts_at: before.starts_at, seats: before.seats, needs_review: true })
      expect(license().review_reason).toContain('sub_dup')
    })

    it('reads the 2025 invoice payments shape for the refund', async () => {
      await buyClass()
      stripeSubs.sub_dup2 = { ...subscription({ id: 'sub_dup2' }), latest_invoice: { id: 'in_2', payments: { data: [{ payment: { payment_intent: 'pi_new' } }] } } }
      await run(ev('checkout.session.completed', checkout(classMd, 'sub_dup2')))
      expect(stripe).toHaveBeenCalledWith('refunds', expect.objectContaining({ params: { payment_intent: 'pi_new', reason: 'duplicate' } }))
    })
  })

  describe('I12: out-of-range quantities are not mirrored', () => {
    it('a portal increase above the paid seats is flagged, seats unchanged', async () => {
      await buyClass()
      await run(ev('customer.subscription.updated', subscription({ quantity: 40 }), 1_800_000_000))
      expect(license()).toMatchObject({ seats: 22, needs_review: true })
    })
    it('a reduction below the children enrolled is flagged, not made pending', async () => {
      await buyClass()
      for (let i = 0; i < 18; i++) db.t('class_students').push({ id: `kid-${i}`, classroom_id: CLASS, status: 'active' })
      await run(ev('customer.subscription.updated', subscription({ quantity: 15 }), 1_800_000_000))
      expect(license()).toMatchObject({ seats: 22, pending_seats: null, needs_review: true })
    })
  })

  describe('I4: the print never exceeds paid seats', () => {
    it('more children than seats must be left out first', async () => {
      await buyClass() // 22 seats
      expect(requestPrint(CLASS, 30)).toBe('too_many_children')
      expect(requestPrint(CLASS, 22)).toBe('ok')
    })
    it('the SQL print RPC enforces it under the lock, and grace ends at expires_at (I9)', () => {
      const sql = readFileSync('supabase-migrations/034_school_billing.sql', 'utf8')
      const fn = sql.slice(sql.indexOf('create or replace function public.school_create_class_print'))
      expect(fn).toMatch(/select id, status, starts_at, expires_at, seats into lic from class_licenses where classroom_id = p_classroom_id for share/)
      expect(fn).toMatch(/if n > lic\.seats then raise exception 'too_many_children'/)
      expect(fn).toMatch(/lic\.status not in \('active','grace','comped'\) or lic\.expires_at <= now\(\)/)
      const bump = sql.slice(sql.indexOf('create or replace function public.school_bump_image'), sql.indexOf('create or replace function public.school_create_class_print'))
      expect(bump).toMatch(/if lic\.expires_at <= now\(\) then return false/)
      expect(bump).not.toMatch(/status <> 'grace'/)
    })
  })
})

describe('C1/I6: school-plan blocks', () => {
  const planMd = { type: 'school_plan', plan_id: 'plan-9', owner_user_id: 'admin-1', school_name: 'Lincoln District' }
  const plan = () => db.t('school_plans').find((p) => p.id === 'plan-9')
  const block = () => db.t('class_licenses').find((l) => l.school_plan_id === 'plan-9')
  beforeEach(() => {
    // An owner-approved invoice plan; its subscription id is not on the row yet.
    db.t('school_plans').push({
      id: 'plan-9', owner_user_id: 'admin-1', school_name: 'Lincoln District', status: 'pending_payment', billing_method: 'invoice',
      seats: 200, pending_seats: null, price_tier: 'school', starts_at: '2026-10-02T00:00:00.000Z', expires_at: '2026-11-01T00:00:00.000Z',
      stripe_customer_id: 'cus_admin', stripe_subscription_id: null, stripe_period_start: null, stripe_event_at: null,
      cancel_at_period_end: false, needs_review: false, updated_at: 'p0',
    })
    // A colleague's class holds a block (as school_plan_assign writes it: no Stripe ids).
    Object.assign(license(), { owner_user_id: 'colleague-1', school_plan_id: 'plan-9', status: 'pending_payment', seats: 25, image_allowance: 1250, images_used: 3, starts_at: '2026-10-02T00:00:00.000Z', expires_at: '2026-11-01T00:00:00.000Z' })
  })

  it('the paid invoice finds the plan by plan_id, links it, and blocks get 300/seat but never the Stripe ids', async () => {
    await run(ev('invoice.paid', invoice({ sub: 'sub_inv', period: P1, quantity: 200, reason: 'subscription_create', metadata: planMd, collection: 'send_invoice' })))
    expect(plan()).toMatchObject({ status: 'active', stripe_subscription_id: 'sub_inv', starts_at: isoS(P1[0]) })
    expect(block()).toMatchObject({ status: 'active', image_allowance: 7500, images_used: 0, starts_at: isoS(P1[0]), stripe_customer_id: null, stripe_subscription_id: null })
    expect(db.t('school_plans')).toHaveLength(1)
  })

  it('while unpaid, blocks hold 50 pictures per seat', async () => {
    db.t('school_plans')[0].stripe_subscription_id = 'sub_inv'
    Object.assign(license(), { image_allowance: 7500 })
    await run(ev('invoice.finalized', invoice({ sub: 'sub_inv', period: P1, quantity: 200, reason: 'subscription_create', metadata: planMd, collection: 'send_invoice', due: P1[0] + 30 * 86400 })))
    expect(block().image_allowance).toBe(1250)
  })

  it('a second card plan for the same admin is canceled and refunded', async () => {
    stripeSubs.sub_card2 = { ...subscription({ id: 'sub_card2', quantity: 180, price: 'price_p', metadata: { type: 'school_plan', owner_user_id: 'admin-1', school_name: 'X' } }), latest_invoice: { payment_intent: 'pi_c2' } }
    await run(ev('checkout.session.completed', checkout({ type: 'school_plan', owner_user_id: 'admin-1', school_name: 'X' }, 'sub_card2')))
    expect(db.t('school_plans')).toHaveLength(1)
    expect(stripe).toHaveBeenCalledWith('subscriptions/sub_card2', expect.objectContaining({ method: 'DELETE' }))
  })
})

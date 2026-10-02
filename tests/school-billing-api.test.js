// Stage 4: purchase, seat changes, plan & billing, school plan admin.
// Stripe is a mock (deps.stripe); nothing here calls a real API.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const URL_ = 'https://example.supabase.co'
const CLASS_ID = '6f1c1b1e-0000-4000-8000-000000000001'
const PLAN_ID = '6f1c1b1e-0000-4000-8000-0000000000f1'
const OFFER_ID = '6f1c1b1e-0000-4000-8000-0000000000f2'
const VERIFIED = { id: 'teacher-1', email: 'pat@lincoln.edu', email_confirmed_at: 'x', app_metadata: { teacher_verified_at: '2026-09-01T00:00:00Z', teacher_verified_by: 'domain' } }
const UNVERIFIED = { id: 'teacher-1', email: 'pat@gmail.com', email_confirmed_at: 'x', app_metadata: {} }
const origEnv = { ...process.env }

let log
let routes
let user
let stripeCalls
let stripeReplies

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.STRIPE_PRICE_SEAT = 'price_s'
  process.env.STRIPE_PRICE_SEAT_FOUNDING = 'price_f'
  process.env.STRIPE_PRICE_SCHOOL_SEAT = 'price_p'
  process.env.PUBLIC_BASE_URL = 'https://mybooklab.app'
  log = []
  routes = []
  user = VERIFIED
  stripeCalls = []
  stripeReplies = {}
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url)
    const method = init.method || 'GET'
    let body
    if (typeof init.body === 'string') { try { body = JSON.parse(init.body) } catch { body = init.body } }
    log.push({ method, u, body })
    if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(user))
    if (u.startsWith('https://api.stripe.com')) throw new Error('real Stripe must never be called')
    for (const r of routes) if (r.method === method && u.includes(r.match)) {
      const out = typeof r.reply === 'function' ? r.reply(log.at(-1)) : r.reply
      return new Response(JSON.stringify(out.body ?? []), { status: out.status ?? 200 })
    }
    return new Response('[]')
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { process.env = { ...origEnv }; vi.restoreAllMocks() })

const mockStripe = async (path, opts = {}) => {
  stripeCalls.push({ path, ...opts })
  const key = `${opts.method ?? 'GET'} ${path.split('?')[0]}`
  const r = stripeReplies[key] ?? stripeReplies[path.split('/')[0]]
  return r ? (typeof r === 'function' ? r(opts) : r) : { ok: true, status: 200, data: {} }
}

async function load(name) {
  const mod = await import(`../api/school/${name}.js`)
  mod.deps.stripe = mockStripe
  return mod.default
}

const call = (path, { method = 'POST', body, query = '' } = {}) =>
  new Request(`https://app.test/api/school/${path}${query}`, {
    method,
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json', origin: 'https://mybooklab.app' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

const classRoute = (license) => ({ method: 'GET', match: '/rest/v1/classrooms?id=eq.', reply: { body: [{ id: CLASS_ID, name: 'Room 5', archived_at: null, class_licenses: license }] } })
const students = (n) => ({ method: 'GET', match: '/rest/v1/class_students?classroom_id=eq.', reply: { body: Array.from({ length: n }, (_, i) => ({ id: `s${i}` })) } })
const buyClass = (extra = {}) => ({ kind: 'class', classId: CLASS_ID, seats: 22, school_name: 'Lincoln Elementary', dpa_accept: true, ...extra })

describe('POST /api/school/checkout — class', () => {
  it('unverified teachers cannot buy', async () => {
    user = UNVERIFIED
    const handler = await load('checkout')
    const res = await handler(call('checkout', { body: buyClass() }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('teacher_unverified')
    expect(stripeCalls).toHaveLength(0)
  })

  it('opens Checkout at the founding price, quantity = seats, metadata from the server', async () => {
    routes.push(classRoute({ status: 'trial', school_plan_id: null }), students(18))
    stripeReplies['POST customers'] = { ok: true, data: { id: 'cus_new' } }
    stripeReplies['POST checkout/sessions'] = { ok: true, data: { url: 'https://checkout.stripe.com/c/pay/cs_1' } }
    const handler = await load('checkout')
    const res = await handler(call('checkout', { body: buyClass({ price: 'price_cheap', unit_amount: 1 }) }))
    expect(res.status).toBe(200)
    expect((await res.json()).url).toContain('checkout.stripe.com')
    const cust = stripeCalls.find((c) => c.path === 'customers')
    // Data minimisation: the buyer's email, the school name, our id. Nothing else.
    expect(cust.params).toEqual({ email: 'pat@lincoln.edu', name: 'Lincoln Elementary', metadata: { owner_user_id: 'teacher-1', kind: 'school' } })
    const s = stripeCalls.find((c) => c.path === 'checkout/sessions').params
    expect(s.mode).toBe('subscription')
    expect(s.line_items).toEqual([{ price: 'price_f', quantity: 22 }]) // the client's price is ignored
    expect(s.metadata).toMatchObject({ type: 'class_license', owner_user_id: 'teacher-1', classroom_id: CLASS_ID, school_name: 'Lincoln Elementary', dpa_version: 'SDPC-NDPA-2.1' })
    expect(s.subscription_data.metadata).toEqual(s.metadata)
    expect(s.success_url).toBe(`https://mybooklab.app/teacher/class/${CLASS_ID}?billing=success`)
  })

  it('after the founding window, the standard price', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-09-01T00:00:00Z'))
    routes.push(classRoute(null), students(0))
    stripeReplies['POST customers'] = { ok: true, data: { id: 'cus_new' } }
    stripeReplies['POST checkout/sessions'] = { ok: true, data: { url: 'https://checkout.stripe.com/x' } }
    const handler = await load('checkout')
    await handler(call('checkout', { body: buyClass() }))
    vi.useRealTimers()
    expect(stripeCalls.find((c) => c.path === 'checkout/sessions').params.line_items[0].price).toBe('price_s')
  })

  it.each([
    [{ seats: 9 }, 'below_minimum'],
    [{ seats: 36 }, 'above_maximum'],
    [{ dpa_accept: false }, 'dpa_required'],
    [{ school_name: '  ' }, 'school_name_required'],
  ])('refuses %o', async (extra, code) => {
    routes.push(classRoute(null), students(0))
    const handler = await load('checkout')
    const res = await handler(call('checkout', { body: buyClass(extra) }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe(code)
  })

  it('never fewer seats than students enrolled', async () => {
    routes.push(classRoute(null), students(25))
    const handler = await load('checkout')
    const res = await handler(call('checkout', { body: buyClass({ seats: 20 }) }))
    expect(await res.json()).toMatchObject({ code: 'below_enrolled', min: 25 })
  })

  it('a class with a live paid license is not bought twice', async () => {
    routes.push(classRoute({ status: 'active', school_plan_id: null }))
    const handler = await load('checkout')
    const res = await handler(call('checkout', { body: buyClass() }))
    expect(res.status).toBe(409)
  })

  it('503 when the Stripe Price env var is missing', async () => {
    delete process.env.STRIPE_PRICE_SEAT_FOUNDING
    routes.push(classRoute(null), students(0))
    const handler = await load('checkout')
    const res = await handler(call('checkout', { body: buyClass() }))
    expect(res.status).toBe(503)
  })
})

describe('POST /api/school/checkout — school plan', () => {
  const buySchool = (extra = {}) => ({ kind: 'school', seats: 200, school_name: 'Lincoln District', dpa_accept: true, billing: 'invoice', ...extra })

  it('at least 150 seats', async () => {
    const handler = await load('checkout')
    const res = await handler(call('checkout', { body: buySchool({ seats: 149 }) }))
    expect((await res.json()).code).toBe('below_minimum')
  })

  it('invoice: a send_invoice subscription (net 30) and a pending_payment plan usable until the due date', async () => {
    routes.push({ method: 'POST', match: '/rest/v1/school_plans', reply: (c) => ({ status: 201, body: [{ id: PLAN_ID, ...c.body }] }) })
    stripeReplies['POST customers'] = { ok: true, data: { id: 'cus_s' } }
    stripeReplies['POST subscriptions'] = { ok: true, data: { id: 'sub_p', customer: 'cus_s', items: { data: [{ quantity: 200, price: { id: 'price_p' } }] } } }
    const handler = await load('checkout')
    const res = await handler(call('checkout', { body: buySchool({ request_id: '6f1c1b1e-0000-4000-8000-0000000000aa' }) }))
    expect(res.status).toBe(201)
    const sub = stripeCalls.find((c) => c.path === 'subscriptions')
    expect(sub.params).toMatchObject({ customer: 'cus_s', items: [{ price: 'price_p', quantity: 200 }], collection_method: 'send_invoice', days_until_due: 30 })
    expect(sub.idempotencyKey).toBe('school-plan-teacher-1-6f1c1b1e-0000-4000-8000-0000000000aa')
    const ins = log.find((l) => l.method === 'POST' && l.u.includes('/rest/v1/school_plans')).body
    expect(ins).toMatchObject({ status: 'pending_payment', billing_method: 'invoice', seats: 200, stripe_subscription_id: 'sub_p', dpa_version: 'SDPC-NDPA-2.1', dpa_accepted_by: 'teacher-1' })
    const days = (Date.parse(ins.expires_at) - Date.parse(ins.starts_at)) / 86400000
    expect(days).toBe(30)
  })

  it('card: Checkout at the school price', async () => {
    stripeReplies['POST customers'] = { ok: true, data: { id: 'cus_s' } }
    stripeReplies['POST checkout/sessions'] = { ok: true, data: { url: 'https://checkout.stripe.com/x' } }
    const handler = await load('checkout')
    const res = await handler(call('checkout', { body: buySchool({ billing: 'card', seats: 180 }) }))
    expect(res.status).toBe(200)
    const s = stripeCalls.find((c) => c.path === 'checkout/sessions').params
    expect(s.line_items).toEqual([{ price: 'price_p', quantity: 180 }])
    expect(s.metadata.type).toBe('school_plan')
  })

  it('one live plan per school admin', async () => {
    routes.push({ method: 'GET', match: '/rest/v1/school_plans?owner_user_id', reply: { body: [{ id: PLAN_ID }] } })
    const handler = await load('checkout')
    const res = await handler(call('checkout', { body: buySchool() }))
    expect(res.status).toBe(409)
  })
})

const cardLicense = { id: 'lic-1', owner_user_id: 'teacher-1', status: 'active', seats: 25, pending_seats: null, expires_at: '2027-09-01T00:00:00Z', billing_method: 'card', school_plan_id: null, image_allowance: 7500, images_used: 10, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', updated_at: 'v' }
const ownerRoute = { method: 'GET', match: '/rest/v1/classrooms?id=eq.', reply: { body: [{ id: CLASS_ID, name: 'Room 5' }] } }
const licenseRoute = (lic) => ({ method: 'GET', match: '/rest/v1/class_licenses?classroom_id=eq.', reply: { body: lic ? [lic] : [] } })

describe('/api/school/billing — plan & billing for a class', () => {
  it('GET: status and seats, and never a price', async () => {
    routes.push(ownerRoute, licenseRoute(cardLicense), students(18))
    const handler = await load('billing')
    const res = await handler(call('billing', { method: 'GET', query: `?classId=${CLASS_ID}` }))
    const out = await res.json()
    expect(out).toMatchObject({ students: 18, license: { status: 'active', seats: 25, expires_at: '2027-09-01T00:00:00Z' }, can_manage_billing: true })
    expect(JSON.stringify(out)).not.toMatch(/price|cents|amount|\$/i)
  })

  it('more seats: prorated now via Stripe, then mirrored (300 pictures each)', async () => {
    routes.push(ownerRoute, licenseRoute(cardLicense), students(18), { method: 'PATCH', match: '/rest/v1/class_licenses?id=eq.lic-1', reply: (c) => ({ body: [{ ...cardLicense, ...c.body }] }) })
    stripeReplies['GET subscriptions/sub_1'] = { ok: true, data: { collection_method: 'charge_automatically', items: { data: [{ id: 'si_1', quantity: 25 }] } } }
    stripeReplies['POST subscriptions/sub_1'] = { ok: true, data: { items: { data: [{ quantity: 30 }] } } }
    const handler = await load('billing')
    const res = await handler(call('billing', { body: { classId: CLASS_ID, action: 'seats', seats: 30 } }))
    expect(res.status).toBe(200)
    const upd = stripeCalls.find((c) => c.method === 'POST' && c.path === 'subscriptions/sub_1').params
    expect(upd).toEqual({ items: [{ id: 'si_1', quantity: 30 }], proration_behavior: 'always_invoice', payment_behavior: 'pending_if_incomplete' })
    const patch = log.find((l) => l.method === 'PATCH').body
    expect(patch).toMatchObject({ seats: 30, image_allowance: 9000, pending_seats: null })
  })

  it('a declined proration leaves the seats alone', async () => {
    routes.push(ownerRoute, licenseRoute(cardLicense), students(18))
    stripeReplies['GET subscriptions/sub_1'] = { ok: true, data: { items: { data: [{ id: 'si_1', quantity: 25 }] } } }
    stripeReplies['POST subscriptions/sub_1'] = { ok: true, data: { pending_update: { subscription_items: [] }, items: { data: [{ quantity: 25 }] } } }
    const handler = await load('billing')
    const res = await handler(call('billing', { body: { classId: CLASS_ID, action: 'seats', seats: 30 } }))
    expect(res.status).toBe(402)
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })

  it('fewer seats wait for the renewal (no refund), and never go below enrolled', async () => {
    routes.push(ownerRoute, licenseRoute(cardLicense), students(18), { method: 'PATCH', match: '/rest/v1/class_licenses?id=eq.lic-1', reply: (c) => ({ body: [{ ...cardLicense, ...c.body }] }) })
    stripeReplies['GET subscriptions/sub_1'] = { ok: true, data: { items: { data: [{ id: 'si_1', quantity: 25 }] } } }
    stripeReplies['POST subscriptions/sub_1'] = { ok: true, data: { items: { data: [{ quantity: 20 }] } } }
    const handler = await load('billing')
    let res = await handler(call('billing', { body: { classId: CLASS_ID, action: 'seats', seats: 17 } }))
    expect(await res.json()).toMatchObject({ code: 'below_enrolled', min: 18 })
    res = await handler(call('billing', { body: { classId: CLASS_ID, action: 'seats', seats: 20 } }))
    expect(res.status).toBe(200)
    expect(stripeCalls.find((c) => c.method === 'POST').params.proration_behavior).toBe('none')
    const patch = log.find((l) => l.method === 'PATCH').body
    expect(patch.pending_seats).toBe(20)
    expect(patch.seats).toBeUndefined()
  })

  it('a school-plan block is resized by the school admin, not here; unverified can\'t change seats', async () => {
    routes.push(ownerRoute, licenseRoute({ ...cardLicense, school_plan_id: PLAN_ID }), { method: 'GET', match: '/rest/v1/school_plans?id=eq.', reply: { body: [{ id: PLAN_ID, owner_user_id: 'admin-9' }] } })
    const handler = await load('billing')
    let res = await handler(call('billing', { body: { classId: CLASS_ID, action: 'seats', seats: 30 } }))
    expect((await res.json()).code).toBe('managed_by_school_plan')
    // …and the portal belongs to the payer (the school admin).
    res = await handler(call('billing', { body: { classId: CLASS_ID, action: 'portal' } }))
    expect(res.status).toBe(403)
    user = UNVERIFIED
    res = await handler(call('billing', { body: { classId: CLASS_ID, action: 'seats', seats: 30 } }))
    expect((await res.json()).code).toBe('teacher_unverified')
  })

  it('portal + invoices for the payer', async () => {
    routes.push(ownerRoute, licenseRoute(cardLicense))
    stripeReplies['POST billing_portal/sessions'] = { ok: true, data: { url: 'https://billing.stripe.com/p/1' } }
    stripeReplies.invoices = { ok: true, data: { data: [{ id: 'in_1', number: 'A-1', status: 'paid', amount_due: 41800, amount_paid: 41800, currency: 'usd', created: 1790000000, hosted_invoice_url: 'https://invoice.stripe.com/i/1', customer_email: 'x@y', lines: {} }] } }
    const handler = await load('billing')
    const portal = await (await handler(call('billing', { body: { classId: CLASS_ID, action: 'portal' } }))).json()
    expect(portal.url).toBe('https://billing.stripe.com/p/1')
    expect(stripeCalls.find((c) => c.path === 'billing_portal/sessions').params).toEqual({ customer: 'cus_1', return_url: `https://mybooklab.app/teacher/class/${CLASS_ID}` })
    const inv = await (await handler(call('billing', { method: 'GET', query: `?classId=${CLASS_ID}&invoices=1` }))).json()
    expect(inv.invoices[0]).toMatchObject({ number: 'A-1', status: 'paid', hosted_invoice_url: 'https://invoice.stripe.com/i/1' })
    expect(inv.invoices[0].customer_email).toBeUndefined()
  })

  it('accepting a seat offer for my class assigns the block atomically (RPC), as the class owner', async () => {
    routes.push(
      { method: 'GET', match: '/rest/v1/school_seat_offers?id=eq.', reply: { body: [{ id: OFFER_ID, plan_id: PLAN_ID, classroom_id: CLASS_ID, seats: 24, classrooms: { owner_user_id: 'teacher-1' } }] } },
      { method: 'POST', match: '/rest/v1/rpc/school_plan_assign', reply: { body: { ok: true, license_id: 'lic-9' } } },
    )
    const handler = await load('billing')
    const res = await handler(call('billing', { body: { action: 'offer_accept', offerId: OFFER_ID } }))
    expect(res.status).toBe(200)
    expect(log.find((l) => l.u.includes('school_plan_assign')).body).toEqual({ p_plan_id: PLAN_ID, p_classroom_id: CLASS_ID, p_seats: 24, p_owner: 'teacher-1' })
    expect(log.find((l) => l.method === 'PATCH').body.status).toBe('accepted')
  })

  it('someone else\'s offer is not found', async () => {
    routes.push({ method: 'GET', match: '/rest/v1/school_seat_offers?id=eq.', reply: { body: [{ id: OFFER_ID, plan_id: PLAN_ID, classroom_id: CLASS_ID, seats: 24, classrooms: { owner_user_id: 'other' } }] } })
    const handler = await load('billing')
    const res = await handler(call('billing', { body: { action: 'offer_accept', offerId: OFFER_ID } }))
    expect(res.status).toBe(404)
  })
})

describe('/api/school/plan — school admin', () => {
  const planRow = { id: PLAN_ID, owner_user_id: 'teacher-1', school_name: 'Lincoln District', status: 'active', seats: 200, pending_seats: null, stripe_customer_id: 'cus_s', stripe_subscription_id: 'sub_p' }
  const planRoute = { method: 'GET', match: '/rest/v1/school_plans?id=eq.', reply: { body: [planRow] } }

  it('assign a block to my own class via the RPC; plan_full surfaces as 409', async () => {
    routes.push(planRoute, { method: 'GET', match: '/rest/v1/classrooms?id=eq.', reply: { body: [{ id: CLASS_ID }] } },
      { method: 'POST', match: '/rest/v1/rpc/school_plan_assign', reply: { body: { error: 'plan_full', available: 5 } } })
    const handler = await load('plan')
    const res = await handler(call('plan', { body: { action: 'assign', planId: PLAN_ID, classId: CLASS_ID, seats: 25 } }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'plan_full', available: 5 })
  })

  it('offer seats to a colleague by class code: nothing moves until they accept', async () => {
    routes.push(planRoute,
      { method: 'GET', match: '/rest/v1/classrooms?code=eq.ABC234', reply: { body: [{ id: CLASS_ID, owner_user_id: 'colleague' }] } },
      { method: 'POST', match: '/rest/v1/school_seat_offers', reply: (c) => ({ status: 201, body: [{ id: OFFER_ID, ...c.body }] }) })
    const handler = await load('plan')
    const res = await handler(call('plan', { body: { action: 'offer', planId: PLAN_ID, code: 'abc234', seats: 28 } }))
    expect(res.status).toBe(201)
    expect(log.some((l) => l.u.includes('school_plan_assign'))).toBe(false)
    expect(log.find((l) => l.method === 'POST' && l.u.includes('school_seat_offers')).body).toEqual({ plan_id: PLAN_ID, classroom_id: CLASS_ID, seats: 28, created_by: 'teacher-1' })
  })

  it('plan seats: at least 150 and never below the seats given out', async () => {
    routes.push(planRoute, { method: 'GET', match: '/rest/v1/class_licenses?school_plan_id=eq.', reply: { body: [{ seats: 35 }, { seats: 35 }, { seats: 35 }, { seats: 35 }, { seats: 30 }] } })
    const handler = await load('plan')
    let res = await handler(call('plan', { body: { action: 'seats', planId: PLAN_ID, seats: 140 } }))
    expect((await res.json()).code).toBe('below_minimum')
    routes.unshift({ method: 'GET', match: '/rest/v1/class_licenses?school_plan_id=eq.', reply: { body: Array.from({ length: 6 }, () => ({ seats: 30 })) } })
    res = await handler(call('plan', { body: { action: 'seats', planId: PLAN_ID, seats: 170 } }))
    expect(await res.json()).toMatchObject({ code: 'below_enrolled', min: 180 })
  })

  it('a colleague\'s class name is not shown to the admin', async () => {
    routes.push({ method: 'GET', match: '/rest/v1/school_plans?owner_user_id', reply: { body: [planRow] } },
      { method: 'GET', match: '/rest/v1/class_licenses?school_plan_id=eq.', reply: { body: [{ classroom_id: CLASS_ID, seats: 20, classrooms: { name: 'Mrs Lee 3B', owner_user_id: 'colleague' } }] } })
    const handler = await load('plan')
    const out = await (await handler(call('plan', { method: 'GET' }))).json()
    expect(out.plans[0]).toMatchObject({ used: 20, blocks: [{ classroom_id: null, class_name: null, seats: 20, mine: false }] })
    expect(out.plans[0].stripe_customer_id).toBeUndefined()
  })
})

describe('migration 034: seat-block RPC', () => {
  const sql = readFileSync('supabase-migrations/034_school_billing.sql', 'utf8')
  const fn = sql.slice(sql.indexOf('create or replace function public.school_plan_assign'), sql.indexOf('revoke all on function public.school_plan_assign'))
  it('locks the plan, never oversells, never below enrolled, never steals a live license', () => {
    expect(fn).toMatch(/from school_plans where id = p_plan_id for update/)
    expect(fn).toMatch(/used \+ p_seats > pl\.seats/)
    expect(fn).toMatch(/enrolled > p_seats/)
    expect(fn).toMatch(/lic\.status not in \('trial','lapsed','canceled'\)/)
    expect(fn).toMatch(/image_allowance = 300 \* p_seats/)
    expect(fn).toMatch(/has_lic := found/) // captured before the SELECT INTO that resets FOUND
  })
  it('is service-role only; pictures still count pending_payment as usable', () => {
    expect(sql).toMatch(/revoke all on function public\.school_plan_assign\(uuid, uuid, int, uuid\) from public, anon, authenticated/)
    expect(sql).toMatch(/lic\.status not in \('trial','pending_payment','active','grace','comped'\)/)
  })
})

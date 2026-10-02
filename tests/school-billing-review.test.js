// Stage 4 review round 1: C1/I1 (blocks never reach the school admin's
// billing), I3 (plan reductions under the lock), I6 (owner approval of
// invoice plans, unpaid limits), I8 (grandfather backfill), M15 (purge
// aborts on a failed billing read), and the verification decision email.
// Stripe is mocked; nothing calls a real API.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { purgeUser } from '../lib/deleteUser.js'

const URL_ = 'https://example.supabase.co'
const OWNER = '11111111-1111-4111-8111-111111111111'
const COLLEAGUE = '22222222-2222-4222-8222-222222222222'
const ADMIN = '33333333-3333-4333-8333-333333333333'
const PLAN_ID = '6f1c1b1e-0000-4000-8000-0000000000f1'
const CLASS_ID = '6f1c1b1e-0000-4000-8000-000000000001'
const REQ_ID = '6f1c1b1e-0000-4000-8000-0000000000e1'
const origEnv = { ...process.env }

let log
let routes
let user
let stripeCalls
let stripeReplies
const mockStripe = async (path, opts = {}) => {
  stripeCalls.push({ path, ...opts })
  const r = stripeReplies[`${opts.method ?? 'GET'} ${path}`]
  return r ?? { ok: true, status: 200, data: {} }
}

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.OWNER_USER_ID = OWNER
  process.env.STRIPE_PRICE_SEAT = 'price_s'
  process.env.STRIPE_PRICE_SEAT_FOUNDING = 'price_f'
  process.env.STRIPE_PRICE_SCHOOL_SEAT = 'price_p'
  process.env.RESEND_API_KEY = 're_x'
  process.env.EMAIL_FROM = 'My Book Lab <hello@mybooklab.app>'
  log = []
  routes = []
  stripeCalls = []
  stripeReplies = {}
  user = { id: ADMIN, email: 'admin@lincoln.edu', email_confirmed_at: 'x', app_metadata: { teacher_verified_at: 'x', teacher_verified_by: 'domain' } }
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url)
    const method = init.method || 'GET'
    let body
    if (typeof init.body === 'string') { try { body = JSON.parse(init.body) } catch { body = init.body } }
    log.push({ method, u, body })
    if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(init.headers.Authorization === 'Bearer owner' ? { id: OWNER, app_metadata: {} } : user))
    for (const r of routes) if (r.method === method && u.includes(r.match)) return r.reply(log.at(-1))
    if (method === 'POST' && u.includes('/rest/v1/admin_access_log')) return new Response(null, { status: 201 })
    if (u.includes('api.resend.com')) return new Response('{}')
    if (u.startsWith('https://api.stripe.com')) return new Response('{}')
    if (method === 'POST' && u.includes('/rest/v1/deletion_log')) return new Response(JSON.stringify([{ id: 1 }]), { status: 201 })
    return new Response('[]')
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => { process.env = { ...origEnv }; vi.restoreAllMocks() })

const call = (path, { method = 'POST', body, who = 'teacher', query = '' } = {}) =>
  new Request(`https://app.test/api/${path}${query}`, {
    method,
    headers: { authorization: `Bearer ${who}`, 'content-type': 'application/json', origin: 'https://mybooklab.app' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
const ok = (body, status = 200) => () => new Response(JSON.stringify(body), { status })

describe('C1/I1: a colleague with a seat block never reaches the school admin\'s billing', () => {
  // As the database could hold it if a block ever carried the plan's
  // Customer: every lookup must still refuse it.
  const leakyLicenses = (c) => ok(c.u.includes('school_plan_id=is.null') ? [] : [{ stripe_customer_id: 'cus_admin' }])()

  it('deleting the colleague\'s account never deletes the admin\'s Stripe Customer', async () => {
    routes.push({ method: 'GET', match: '/rest/v1/class_licenses?owner_user_id', reply: leakyLicenses })
    await purgeUser(COLLEAGUE, { supabaseUrl: URL_, serviceKey: 'service', stripeSecretKey: 'sk_test_x' })
    expect(log.some((l) => l.method === 'DELETE' && l.u.includes('api.stripe.com/v1/customers/cus_admin'))).toBe(false)
    expect(log.find((l) => l.u.includes('/rest/v1/class_licenses?owner_user_id') && l.method === 'GET').u).toContain('school_plan_id=is.null')
  })

  it('the colleague buying a class of their own gets their OWN Customer, never the admin\'s', async () => {
    user = { id: COLLEAGUE, email: 'lee@lincoln.edu', email_confirmed_at: 'x', app_metadata: { teacher_verified_at: 'x' } }
    routes.push(
      { method: 'GET', match: '/rest/v1/classrooms?id=eq.', reply: ok([{ id: CLASS_ID, archived_at: null, class_licenses: null }]) },
      { method: 'GET', match: '/rest/v1/class_licenses?owner_user_id', reply: leakyLicenses },
    )
    stripeReplies['POST customers'] = { ok: true, data: { id: 'cus_lee' } }
    stripeReplies['POST checkout/sessions'] = { ok: true, data: { url: 'https://checkout.stripe.com/x' } }
    const mod = await import('../api/school/checkout.js')
    mod.deps.stripe = mockStripe
    const res = await mod.default(call('school/checkout', { body: { kind: 'class', classId: CLASS_ID, seats: 20, school_name: 'Lincoln', dpa_accept: true } }))
    expect(res.status).toBe(200)
    const session = stripeCalls.find((c) => c.path === 'checkout/sessions' && c.method === 'POST')
    expect(session.params.customer).toBe('cus_lee')
  })

  it('the schema: blocks hold no subscription id, so deleting a plan can\'t collide (I1)', () => {
    const sql = readFileSync('supabase-migrations/034_school_billing.sql', 'utf8')
    expect(sql).toMatch(/create unique index if not exists class_licenses_subscription_uniq\s+on public\.class_licenses \(stripe_subscription_id\) where stripe_subscription_id is not null;/)
    const mirror = readFileSync('lib/school/billingState.js', 'utf8')
    const fn = mirror.slice(mirror.indexOf('export function mirrorFromPlan'), mirror.indexOf('// ── Seat changes'))
    expect(fn).not.toMatch(/stripe_customer_id|stripe_subscription_id/)
  })
})

describe('M15: a failed billing read aborts the purge (retried tomorrow)', () => {
  it('no auth delete when the school-customer lookup fails', async () => {
    routes.push({ method: 'GET', match: '/rest/v1/school_plans?owner_user_id', reply: ok({ message: 'boom' }, 500) })
    const result = await purgeUser(COLLEAGUE, { supabaseUrl: URL_, serviceKey: 'service', stripeSecretKey: 'sk_test_x' })
    expect(result.ok).toBe(false)
    expect(log.some((l) => l.method === 'DELETE' && l.u.includes('/auth/v1/admin/users/'))).toBe(false)
  })
})

describe('I3/I6: school plan seats', () => {
  const plan = { id: PLAN_ID, owner_user_id: ADMIN, school_name: 'Lincoln', status: 'active', seats: 300, pending_seats: null, price_tier: 'school', stripe_customer_id: 'cus_admin', stripe_subscription_id: 'sub_p' }
  async function load() {
    const mod = await import('../api/school/plan.js')
    mod.deps.stripe = mockStripe
    return mod.default
  }

  it('a reduction is checked and recorded by the locked RPC before Stripe changes', async () => {
    routes.push(
      { method: 'GET', match: '/rest/v1/school_plans?id=eq.', reply: ok([plan]) },
      { method: 'GET', match: '/rest/v1/class_licenses?school_plan_id=eq.', reply: ok([{ seats: 100 }, { seats: 50 }]) },
      { method: 'POST', match: '/rest/v1/rpc/school_plan_reserve_decrease', reply: ok({ ok: true, used: 150 }) },
    )
    stripeReplies['GET subscriptions/sub_p'] = { ok: true, data: { customer: 'cus_admin', items: { data: [{ id: 'si_p', quantity: 300 }] } } }
    stripeReplies['POST subscriptions/sub_p'] = { ok: true, data: { items: { data: [{ quantity: 150 }] } } }
    const handler = await load()
    const res = await handler(call('school/plan', { body: { action: 'seats', planId: PLAN_ID, seats: 150 } }))
    expect(res.status).toBe(200)
    const iRpc = log.findIndex((l) => l.u.includes('school_plan_reserve_decrease'))
    expect(log[iRpc].body).toEqual({ p_plan_id: PLAN_ID, p_seats: 150 })
    expect(stripeCalls.find((c) => c.method === 'POST').params).toEqual({ items: [{ id: 'si_p', quantity: 150 }], proration_behavior: 'none' })
  })

  it('the RPC refusing (a parallel assignment took the seats) changes nothing in Stripe', async () => {
    routes.push(
      { method: 'GET', match: '/rest/v1/school_plans?id=eq.', reply: ok([plan]) },
      { method: 'GET', match: '/rest/v1/class_licenses?school_plan_id=eq.', reply: ok([{ seats: 150 }]) },
      { method: 'POST', match: '/rest/v1/rpc/school_plan_reserve_decrease', reply: ok({ error: 'below_enrolled', used: 180 }) },
    )
    stripeReplies['GET subscriptions/sub_p'] = { ok: true, data: { items: { data: [{ id: 'si_p', quantity: 300 }] } } }
    const handler = await load()
    const res = await handler(call('school/plan', { body: { action: 'seats', planId: PLAN_ID, seats: 160 } }))
    expect(await res.json()).toMatchObject({ code: 'below_enrolled', min: 180 })
    expect(stripeCalls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('no seat increases while the invoice is unpaid (I6)', async () => {
    routes.push(
      { method: 'GET', match: '/rest/v1/school_plans?id=eq.', reply: ok([{ ...plan, status: 'pending_payment' }]) },
      { method: 'GET', match: '/rest/v1/class_licenses?school_plan_id=eq.', reply: ok([]) },
    )
    const handler = await load()
    const res = await handler(call('school/plan', { body: { action: 'seats', planId: PLAN_ID, seats: 400 } }))
    expect(await res.json()).toMatchObject({ code: 'plan_unpaid' })
    expect(stripeCalls).toHaveLength(0)
  })

  it('a paid plan increase charges the full yearly price of the added seats', async () => {
    routes.push(
      { method: 'GET', match: '/rest/v1/school_plans?id=eq.', reply: ok([plan]) },
      { method: 'GET', match: '/rest/v1/class_licenses?school_plan_id=eq.', reply: ok([]) },
    )
    stripeReplies['GET subscriptions/sub_p'] = { ok: true, data: { customer: 'cus_admin', collection_method: 'send_invoice', items: { data: [{ id: 'si_p', quantity: 300 }] } } }
    stripeReplies['POST invoiceitems'] = { ok: true, data: { id: 'ii' } }
    stripeReplies['POST invoices'] = { ok: true, data: { id: 'in_x' } }
    stripeReplies['POST invoices/in_x/finalize'] = { ok: true, data: {} }
    stripeReplies['POST invoices/in_x/send'] = { ok: true, data: {} }
    const handler = await load()
    const res = await handler(call('school/plan', { body: { action: 'seats', planId: PLAN_ID, seats: 320 } }))
    expect(await res.json()).toMatchObject({ ok: true, mode: 'increase', invoiced: true })
    expect(stripeCalls.find((c) => c.path === 'invoiceitems').params.amount).toBe(20 * 1700)
    expect(stripeCalls.find((c) => c.path === 'invoices').params).toMatchObject({ collection_method: 'send_invoice', days_until_due: 30 })
  })
})

describe('I6: owner approval of invoice plans (/api/admin/school-plans)', () => {
  const waiting = { id: PLAN_ID, owner_user_id: ADMIN, school_name: 'Lincoln', seats: 200, price_tier: 'school', status: 'pending_approval', created_at: 'then', dpa_version: 'SDPC-NDPA-2.1', dpa_accepted_at: 'then' }
  async function load() {
    const mod = await import('../api/admin/school-plans.js')
    mod.deps.stripe = mockStripe
    return mod.default
  }

  it('is owner-only', async () => {
    const handler = await load()
    expect((await handler(call('admin/school-plans', { method: 'GET' }))).status).toBe(403)
  })

  it('approve: log first (required), then the net-30 invoice subscription, then the plan becomes pending_payment', async () => {
    routes.push(
      { method: 'GET', match: '/rest/v1/school_plans?id=eq.', reply: ok([waiting]) },
      { method: 'GET', match: `/auth/v1/admin/users/${ADMIN}`, reply: ok({ id: ADMIN, email: 'admin@lincoln.edu' }) },
    )
    stripeReplies['POST customers'] = { ok: true, data: { id: 'cus_admin' } }
    stripeReplies['POST subscriptions'] = { ok: true, data: { id: 'sub_inv', items: { data: [{ quantity: 200 }] } } }
    const handler = await load()
    const res = await handler(call('admin/school-plans', { body: { id: PLAN_ID, decision: 'approve', reason: 'Called the school' }, who: 'owner' }))
    expect(res.status).toBe(200)
    const sub = stripeCalls.find((c) => c.path === 'subscriptions')
    expect(sub.params).toMatchObject({ customer: 'cus_admin', items: [{ price: 'price_p', quantity: 200 }], collection_method: 'send_invoice', days_until_due: 30, metadata: { type: 'school_plan', plan_id: PLAN_ID } })
    expect(sub.idempotencyKey).toBe(`school-plan-approve-${PLAN_ID}`)
    const iLog = log.findIndex((l) => l.u.includes('/rest/v1/admin_access_log'))
    const iPatch = log.findIndex((l) => l.method === 'PATCH' && l.u.includes('/rest/v1/school_plans'))
    expect(iLog).toBeLessThan(iPatch)
    expect(log[iPatch].body).toMatchObject({ status: 'pending_payment', stripe_subscription_id: 'sub_inv', approved_by: OWNER })
    expect(log[iPatch].u).toContain('status=eq.pending_approval')
  })

  it('decline needs a reason; nothing goes to Stripe; no log → no change', async () => {
    routes.push({ method: 'GET', match: '/rest/v1/school_plans?id=eq.', reply: ok([waiting]) })
    const handler = await load()
    expect((await handler(call('admin/school-plans', { body: { id: PLAN_ID, decision: 'decline' }, who: 'owner' }))).status).toBe(400)
    const res = await handler(call('admin/school-plans', { body: { id: PLAN_ID, decision: 'decline', reason: 'Not a school' }, who: 'owner' }))
    expect(res.status).toBe(200)
    expect(stripeCalls).toHaveLength(0)
    expect(log.find((l) => l.method === 'PATCH').body).toMatchObject({ status: 'declined', decline_reason: 'Not a school' })

    log.length = 0
    routes.unshift({ method: 'POST', match: '/rest/v1/admin_access_log', reply: ok({}, 500) })
    const blocked = await handler(call('admin/school-plans', { body: { id: PLAN_ID, decision: 'approve', reason: 'x' }, who: 'owner' }))
    expect(blocked.status).toBe(503)
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })

  it('the migration allows one open unpaid plan per teacher', () => {
    const sql = readFileSync('supabase-migrations/034_school_billing.sql', 'utf8')
    expect(sql).toMatch(/create unique index if not exists school_plans_one_unpaid\s+on public\.school_plans \(owner_user_id\) where status in \('pending_approval','pending_payment'\)/)
  })
})

describe('verification decision email (EN/IT by the request\'s locale)', () => {
  const pending = { id: REQ_ID, user_id: COLLEAGUE, email_domain: 'gmail.com', school_name: null, locale: 'it', status: 'pending', created_at: 'then' }
  it('approve emails the teacher in Italian; decline includes the reason', async () => {
    routes.push(
      { method: 'GET', match: '/rest/v1/teacher_verification_requests?id=eq.', reply: ok([pending]) },
      { method: 'GET', match: `/auth/v1/admin/users/${COLLEAGUE}`, reply: ok({ id: COLLEAGUE, email: 'lee@gmail.com' }) },
    )
    const { default: handler } = await import('../api/admin/teacher-verifications.js')
    const res = await handler(call('admin/teacher-verifications', { body: { id: REQ_ID, decision: 'approve', reason: 'ok' }, who: 'owner' }))
    expect(await res.json()).toMatchObject({ ok: true, emailed: true })
    const mail = log.find((l) => l.u.includes('api.resend.com'))
    expect(mail.body.to).toEqual(['lee@gmail.com'])
    expect(mail.body.subject).toBe('Abbiamo verificato che insegni')

    const { verificationDecisionEmail } = await import('../lib/school/teacherVerification.js')
    const en = verificationDecisionEmail('decline', 'en', 'Please use your school email')
    expect(en.subject).toBe("We couldn't confirm you as a teacher")
    expect(en.text).toContain('Please use your school email')
  })
})

describe('I8: the grandfather backfill', () => {
  const sql = readFileSync('supabase-migrations/034_school_billing.sql', 'utf8')
  const where = sql.slice(sql.indexOf('update auth.users u'), sql.indexOf('-- ── 2. School plans'))

  // The WHERE clause, re-run in JS over a fixture (no Postgres here): the
  // regexes below pin the SQL to exactly this logic.
  function backfill({ users, licenses, classrooms, students }) {
    return users.filter((u) =>
      !(u.app_metadata?.teacher_verified_at) &&
      u.app_metadata?.role !== 'student' &&
      (licenses.some((l) => l.owner_user_id === u.id) ||
        classrooms.some((c) => c.owner_user_id === u.id && students.some((s) => s.classroom_id === c.id)))
    ).map((u) => u.id)
  }

  it('the SQL is exactly: license owners, or owners of a class with class accounts; never students; never twice', () => {
    expect(where).toMatch(/coalesce\(u\.raw_app_meta_data->>'teacher_verified_at', ''\) = ''/)
    expect(where).toMatch(/coalesce\(u\.raw_app_meta_data->>'role', ''\) <> 'student'/)
    expect(where).toMatch(/exists \(select 1 from public\.class_licenses l where l\.owner_user_id = u\.id\)/)
    expect(where).toMatch(/exists \(select 1 from public\.classrooms c\s+where c\.owner_user_id = u\.id\s+and exists \(select 1 from public\.class_students s where s\.classroom_id = c\.id\)\)/)
    // A legacy code-only classroom alone is not enough any more.
    expect(where).not.toMatch(/exists \(select 1 from public\.classrooms c where c\.owner_user_id = u\.id\)\s*\n?\s*or/)
  })

  it('re-run over a fixture: the owner, a licensed teacher and a class-account teacher; not a legacy-only parent or a student', () => {
    const fixture = {
      users: [
        { id: 'owner', app_metadata: {} },
        { id: 'licensed', app_metadata: {} },
        { id: 'roster', app_metadata: {} },
        { id: 'legacy-parent', app_metadata: {} },
        { id: 'kid', app_metadata: { role: 'student' } },
        { id: 'already', app_metadata: { teacher_verified_at: 'x' } },
      ],
      licenses: [{ owner_user_id: 'owner' }, { owner_user_id: 'licensed' }, { owner_user_id: 'kid' }, { owner_user_id: 'already' }],
      classrooms: [{ id: 'c1', owner_user_id: 'roster' }, { id: 'c2', owner_user_id: 'legacy-parent' }],
      students: [{ classroom_id: 'c1' }],
    }
    expect(backfill(fixture)).toEqual(['owner', 'licensed', 'roster'])
  })
})

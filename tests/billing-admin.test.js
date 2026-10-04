// Owner feedback round 5: who sees plans & pricing in the teacher area,
// the neutral status line everyone else gets, and the owner's /admin
// toggle (api/admin/billing-admins.js).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { isBillingAdmin, billingWho } from '../lib/school/billingAdmin.js'
import { neutralPlanStatus } from '../src/components/school/planStatus.js'

const OWNER = '11111111-1111-4111-8111-111111111111'
const T1 = '22222222-2222-4222-8222-222222222222'

describe('isBillingAdmin', () => {
  it('the owner, always', () => {
    expect(isBillingAdmin({ userId: OWNER, appMetadata: {} }, OWNER)).toBe(true)
  })
  it('a user with app_metadata.billing_admin === true', () => {
    expect(isBillingAdmin({ userId: T1, appMetadata: { billing_admin: true } }, OWNER)).toBe(true)
  })
  it('nobody else — not a truthy string, not user_metadata, not signed out', () => {
    expect(isBillingAdmin({ userId: T1, appMetadata: {} }, OWNER)).toBe(false)
    expect(isBillingAdmin({ userId: T1, appMetadata: { billing_admin: 'true' } }, OWNER)).toBe(false)
    expect(isBillingAdmin(billingWho({ id: T1, user_metadata: { billing_admin: true } }), OWNER)).toBe(false)
    expect(isBillingAdmin(billingWho(null), OWNER)).toBe(false)
    expect(isBillingAdmin({ userId: T1, appMetadata: {} }, undefined)).toBe(false)
  })
  it('billingWho reads a supabase user', () => {
    expect(isBillingAdmin(billingWho({ id: T1, app_metadata: { billing_admin: true } }), OWNER)).toBe(true)
  })
})

describe('neutralPlanStatus', () => {
  const now = new Date('2026-10-04T12:00:00Z')
  it('a live trial: days left', () => {
    expect(neutralPlanStatus({ status: 'trial', expires_at: '2026-10-27T12:00:00Z' }, now)).toEqual({ key: 'trial', count: 23 })
  })
  it('an active plan: until when', () => {
    expect(neutralPlanStatus({ status: 'active', expires_at: '2027-09-01T00:00:00Z' }, now)).toEqual({ key: 'active_until', date: '2027-09-01T00:00:00Z' })
    expect(neutralPlanStatus({ status: 'comped', expires_at: '2027-09-01T00:00:00Z' }, now).key).toBe('active_until')
  })
  it('anything that needs renewing: ask your school', () => {
    for (const l of [null, { status: 'trial', expires_at: '2026-10-01T00:00:00Z' }, { status: 'grace', expires_at: '2026-10-10T00:00:00Z' },
      { status: 'lapsed', expires_at: '2026-09-01T00:00:00Z' }, { status: 'canceled', expires_at: '2026-09-01T00:00:00Z' }]) {
      expect(neutralPlanStatus(l, now)).toEqual({ key: 'ask_school' })
    }
  })
})

describe('teacher UI never offers a purchase to a non-billing-admin', () => {
  const section = readFileSync('src/components/school/PlanBillingSection.jsx', 'utf8')
  const status = section.slice(section.indexOf('function PlanStatus('), section.indexOf('export default function PlanBillingSection'))
  it('the neutral PlanStatus shows no price, no buy, no seat change, no school plan link', () => {
    expect(status).not.toMatch(/formatMoney|quote|buy|action: 'seats'|\/teacher\/school|\/pricing|\/schools/)
  })
  it("the payer's portal + invoices show only when the server says can_manage_billing, with nothing to buy", () => {
    expect(status).toMatch(/\{data\.can_manage_billing && <PayerTools /)
    const payer = section.slice(section.indexOf('function PayerTools('), section.indexOf('function PlanStatus('))
    expect(payer).not.toMatch(/quote|buy|seats|\/teacher\/school|\/pricing|\/schools/)
    expect(section).toMatch(/if \(res\.data\?\.can_manage_billing\) \{/)
  })
  it('PlanBillingSection shows the full section only when the server says billing_admin', () => {
    expect(section).toMatch(/if \(!data\.billing_admin\) \{\s*return <PlanStatus/)
  })
  it('the school plan link and route are billing-admin only', () => {
    expect(readFileSync('src/pages/TeacherPage.jsx', 'utf8')).toMatch(/\{billingAdmin && \(\s*<p className="text-right mb-3">\s*<Link to="\/teacher\/school"/)
    expect(readFileSync('src/App.jsx', 'utf8')).toMatch(/<BillingAdminRoute>\s*<TeacherSchoolPlanPage \/>/)
  })
  it('teacher-facing copy no longer sends teachers to buy seats', () => {
    for (const lang of ['en', 'it']) {
      const school = JSON.parse(readFileSync(`src/i18n/locales/${lang}/school.json`, 'utf8'))
      const t = school.teacher
      const lines = [t.create.trial_used_up, t.license.coming_soon, t.errors.license_required, t.errors.over_seats,
        t.add_students.license_blocked, t.verify.body, school.writing_year.teacher.over_seats, school.writing_year.teacher.print_needs_license]
      for (const line of lines) expect(line).not.toMatch(/Plan & billing|Piano e pagamenti|buy|acquist|paid|pagamento/i)
    }
  })
})

describe('teacher verification email', () => {
  it('no longer invites the teacher to buy seats (EN/IT)', async () => {
    const { verificationDecisionEmail } = await import('../lib/school/teacherVerification.js')
    for (const locale of ['en', 'it']) {
      const m = verificationDecisionEmail('approve', locale)
      expect(m.text).not.toMatch(/buy|acquist|seats|posti/i)
    }
  })
})

describe('/api/admin/billing-admins', () => {
  const URL_ = 'https://example.supabase.co'
  const origEnv = { ...process.env }
  let log
  let caller
  let logOk
  let target

  beforeEach(() => {
    vi.resetModules()
    process.env.SUPABASE_URL = URL_
    process.env.SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    process.env.OWNER_USER_ID = OWNER
    log = []
    caller = { id: OWNER, app_metadata: {} }
    logOk = true
    target = { id: T1, app_metadata: { teacher_verified_at: 'x' } }
    globalThis.fetch = vi.fn(async (url, init = {}) => {
      const u = String(url)
      const method = init.method || 'GET'
      let body
      if (typeof init.body === 'string') { try { body = JSON.parse(init.body) } catch { body = init.body } }
      log.push({ method, u, body })
      if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(caller))
      if (u.includes('/rest/v1/admin_access_log')) return new Response('', { status: logOk ? 201 : 500 })
      if (u.includes(`/auth/v1/admin/users/${T1}`)) return new Response(JSON.stringify(method === 'PUT' ? { ...target, app_metadata: { ...target.app_metadata, ...body.app_metadata } } : target))
      return new Response('{}', { status: 404 })
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => { process.env = { ...origEnv }; vi.restoreAllMocks() })

  const req = (init = {}, q = '') => new Request(`https://app.test/api/admin/billing-admins${q}`, {
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json', origin: 'https://mybooklab.app' }, ...init,
  })
  const load = async () => (await import('../api/admin/billing-admins.js')).default

  it('is owner-only', async () => {
    caller = { id: T1, app_metadata: { billing_admin: true } }
    const handler = await load()
    const res = await handler(req({ method: 'POST', body: JSON.stringify({ userId: T1, billing_admin: true }) }))
    expect(res.status).toBe(403)
    expect(log.some((l) => l.method === 'PUT')).toBe(false)
  })

  it('grant: logs first (required), then writes ONLY app_metadata.billing_admin', async () => {
    const handler = await load()
    const res = await handler(req({ method: 'POST', body: JSON.stringify({ userId: T1, billing_admin: true, reason: 'Principal, Lincoln' }) }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, user_id: T1, billing_admin: true })
    const logIdx = log.findIndex((l) => l.u.includes('admin_access_log'))
    const putIdx = log.findIndex((l) => l.method === 'PUT')
    expect(logIdx).toBeGreaterThan(-1)
    expect(putIdx).toBeGreaterThan(logIdx)
    expect(log[logIdx].body).toMatchObject({ action: 'billing_admin.grant', target_id: T1 })
    expect(log[putIdx].body).toEqual({ app_metadata: { billing_admin: true } })
  })

  it('no log, no change', async () => {
    logOk = false
    const handler = await load()
    const res = await handler(req({ method: 'POST', body: JSON.stringify({ userId: T1, billing_admin: false }) }))
    expect(res.status).toBe(503)
    expect(log.some((l) => l.method === 'PUT')).toBe(false)
  })

  it('refuses a non-boolean flag and a bad id', async () => {
    const handler = await load()
    expect((await handler(req({ method: 'POST', body: JSON.stringify({ userId: T1, billing_admin: 'yes' }) }))).status).toBe(400)
    expect((await handler(req({ method: 'POST', body: JSON.stringify({ userId: 'nope', billing_admin: true }) }))).status).toBe(400)
  })

  it('GET reads the flags for up to 50 ids', async () => {
    target = { id: T1, app_metadata: { billing_admin: true } }
    const handler = await load()
    const res = await handler(req({}, `?ids=${T1}`))
    expect(await res.json()).toEqual({ flags: { [T1]: true } })
  })
})

// Follow-up: billing admins and the owner, who see the full Plan & billing
// section, get the wording that points there — never "ask your school".
describe('role-aware copy', async () => {
  const { errorKeyFor } = await import('../src/components/school/teacherErrors.js')
  const { forBillingRole } = await import('../src/components/school/billingCopy.js')
  const KEYS = [
    ['teacher', 'create', 'trial_used_up'], ['teacher', 'license', 'coming_soon'], ['teacher', 'errors', 'license_required'],
    ['teacher', 'errors', 'over_seats'], ['teacher', 'add_students', 'license_blocked'],
    ['writing_year', 'teacher', 'over_seats'], ['writing_year', 'teacher', 'print_needs_license'],
  ]
  const get = (o, p) => p.reduce((x, k) => x?.[k], o)

  it('every neutral line has a billing-admin twin in EN and IT, and only the twin mentions Plan & billing', () => {
    for (const lang of ['en', 'it']) {
      const school = JSON.parse(readFileSync(`src/i18n/locales/${lang}/school.json`, 'utf8'))
      for (const p of KEYS) {
        const neutral = get(school, p)
        const admin = get(school, [...p.slice(0, -1), `${p.at(-1)}_billing_admin`])
        expect(admin, `${lang} ${p.join('.')}_billing_admin`).toBeTruthy()
        expect(neutral).not.toMatch(/Plan & billing|Piano e pagamenti/)
        if (p.at(-1) !== 'print_needs_license') expect(admin).toMatch(/Plan & billing|Piano e pagamenti/)
        expect(admin).not.toMatch(/ask your school|chiedi alla tua scuola/i)
      }
    }
  })

  it('error codes pick the twin for a billing admin only', () => {
    expect(errorKeyFor('license_required', { billingAdmin: true })).toBe('license_required_billing_admin')
    expect(errorKeyFor('over_seats', { billingAdmin: true })).toBe('over_seats_billing_admin')
    expect(errorKeyFor('license_required')).toBe('license_required')
    expect(errorKeyFor('class_archived', { billingAdmin: true })).toBe('class_archived')
    expect(forBillingRole('school:x', true)).toBe('school:x_billing_admin')
    expect(forBillingRole('school:x', false)).toBe('school:x')
  })

  it('every place that shows one of these lines goes through the role switch', () => {
    const uses = {
      'src/components/school/LicenseBadge.jsx': 'school:teacher.license.coming_soon',
      'src/components/school/AddStudents.jsx': 'school:teacher.add_students.license_blocked',
      'src/components/school/ClassPrintFlow.jsx': 'school:writing_year.teacher.print_needs_license',
      'src/pages/TeacherPage.jsx': 'school:teacher.create.trial_used_up',
    }
    for (const [file, key] of Object.entries(uses)) {
      const src = readFileSync(file, 'utf8')
      expect(src, file).toContain(`forBillingRole('${key}', billingAdmin)`)
      expect(src, file).not.toContain(`t('${key}'`)
    }
    expect(readFileSync('src/components/school/ClassPrintFlow.jsx', 'utf8')).toContain("forBillingRole('school:writing_year.teacher.over_seats', billingAdmin)")
    for (const file of ['src/components/school/AddStudents.jsx', 'src/pages/TeacherClassPage.jsx', 'src/components/school/RosterTable.jsx']) {
      const src = readFileSync(file, 'utf8')
      const calls = src.match(/teacherErrorText\([^)]*\)/g) ?? []
      for (const c of calls) expect(c, file).toMatch(/billingAdmin/)
    }
  })
})

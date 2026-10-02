// Stage 4 part 1: teacher verification — domain matching, gating, the
// request + owner alert, and the owner's approve/decline queue.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { isSchoolDomain, isSchoolEmail, emailDomain, allowlistFromEnv, verificationState } from '../lib/school/teacherVerification.js'

const URL_ = 'https://example.supabase.co'
const OWNER = '11111111-1111-4111-8111-111111111111'
const CLASS_ID = '6f1c1b1e-0000-4000-8000-000000000001'
const REQ_ID = '6f1c1b1e-0000-4000-8000-0000000000e1'
const origEnv = { ...process.env }

describe('school email domains', () => {
  it.each([
    'teacher@lincoln.edu',
    'a.b@mail.harvard.edu',
    'ms.rossi@lausd.k12.ca.us',
    'x@school.district.k12.mn.us',
    'head@greenfield.sch.uk',
    'guru@sman1.sch.id',
    'T@LINCOLN.EDU',
  ])('accepts %s', (email) => {
    expect(isSchoolEmail(email, [])).toBe(true)
  })

  it.each([
    'a@edu.evil.com',
    'a@myschool.edu.attacker.com',
    'a@edu',
    'a@evil-edu.com',
    'a@k12.ca.us', // the state's own domain, not a school
    'a@k12.ca.us.evil.com',
    'a@school.k12.california.us',
    'a@sch.uk', // bare second level
    'a@school.sch.attacker.com',
    'a@school.sch.com',
    'a@gmail.com',
    'a@school.edu.',
    'a@',
    '@school.edu',
    'not-an-email',
    '',
    null,
  ])('refuses %s', (email) => {
    expect(isSchoolEmail(email, [])).toBe(false)
  })

  it('SCHOOL_EMAIL_DOMAINS matches whole labels from the right, never a lookalike', () => {
    const list = allowlistFromEnv(' @district.org, .scuola.it, bad domain, ')
    expect(list).toEqual(['district.org', 'scuola.it'])
    expect(isSchoolDomain('district.org', list)).toBe(true)
    expect(isSchoolDomain('mail.district.org', list)).toBe(true)
    expect(isSchoolDomain('notdistrict.org', list)).toBe(false)
    expect(isSchoolDomain('district.org.evil.com', list)).toBe(false)
    expect(isSchoolDomain('icmilano.scuola.it', list)).toBe(true)
  })

  it('reads the env allowlist by default', () => {
    process.env.SCHOOL_EMAIL_DOMAINS = 'academy.example'
    expect(isSchoolEmail('t@academy.example')).toBe(true)
    delete process.env.SCHOOL_EMAIL_DOMAINS
    expect(isSchoolEmail('t@academy.example')).toBe(false)
  })

  it('emailDomain lower-cases and rejects junk', () => {
    expect(emailDomain('Ann@Lincoln.EDU')).toBe('lincoln.edu')
    expect(emailDomain('a@b@c.edu')).toBe('c.edu')
    expect(emailDomain('a@c..edu')).toBe(null)
  })
})

describe('verificationState', () => {
  it('trusts app_metadata, then the owner, then a CONFIRMED school email', () => {
    expect(verificationState({ appMetadata: { teacher_verified_at: 'x', teacher_verified_by: 'domain' } }).verified).toBe(true)
    expect(verificationState({ userId: OWNER, appMetadata: {} }, { ownerId: OWNER }).verified).toBe(true)
    expect(verificationState({ userId: 'u', email: 't@lincoln.edu', emailConfirmed: true, appMetadata: {} }, { allowlist: [] }))
      .toEqual({ verified: false, domainEligible: true })
    // Unconfirmed: the domain proves nothing yet.
    expect(verificationState({ userId: 'u', email: 't@lincoln.edu', emailConfirmed: false, appMetadata: {} }, { allowlist: [] }))
      .toEqual({ verified: false, domainEligible: false })
    // user_metadata is user-editable and never counts.
    expect(verificationState({ userId: 'u', email: 't@gmail.com', emailConfirmed: true, appMetadata: {}, userMetadata: { teacher_verified_at: 'x' } }, { allowlist: [] }).verified).toBe(false)
  })
})

// ── API ────────────────────────────────────────────────────────────────
let log
let routes
let user
beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.OWNER_USER_ID = OWNER
  process.env.RESEND_API_KEY = 're_test'
  process.env.EMAIL_FROM = 'My Book Lab <hello@mybooklab.app>'
  process.env.OWNER_ALERT_EMAIL = 'owner@mybooklab.app'
  delete process.env.SCHOOL_EMAIL_DOMAINS
  log = []
  routes = []
  user = { id: 'teacher-9', email: 'pat@gmail.com', email_confirmed_at: '2026-09-01T00:00:00Z', app_metadata: {} }
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url)
    const method = init.method || 'GET'
    let body
    if (typeof init.body === 'string') { try { body = JSON.parse(init.body) } catch { body = init.body } }
    log.push({ method, u, body })
    if (u.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify(init.headers.Authorization === 'Bearer owner' ? { id: OWNER, app_metadata: {} } : user))
    }
    for (const r of routes) if (r.method === method && u.includes(r.match)) return r.reply(log.at(-1))
    if (method === 'POST' && u.includes('/rest/v1/admin_access_log')) return new Response(null, { status: 201 })
    if (u.includes('api.resend.com')) return new Response('{}')
    if (method === 'PUT' && u.includes('/auth/v1/admin/users/')) return new Response('{}')
    return new Response('[]')
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => { process.env = { ...origEnv }; vi.restoreAllMocks() })

const call = (path, { method = 'GET', body, who = 'teacher' } = {}) =>
  new Request(`https://app.test/api/${path}`, {
    method,
    headers: { authorization: `Bearer ${who}`, 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

describe('gating: unverified teachers', () => {
  it('cannot create a class (no trial starts)', async () => {
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('school/classes', { method: 'POST', body: { name: 'Room 5' } }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('teacher_unverified')
    expect(log.some((l) => l.method === 'POST' && l.u.includes('/rest/v1/classrooms'))).toBe(false)
    expect(log.some((l) => l.u.includes('/rest/v1/class_licenses'))).toBe(false)
  })

  it('cannot add students to a class they own (e.g. an unverified owner the backfill missed)', async () => {
    process.env.STUDENT_SECRET_PEPPER = 'p'.repeat(32)
    routes.push({ method: 'GET', match: '/rest/v1/classrooms?id=eq.', reply: () => new Response(JSON.stringify([{ id: CLASS_ID, name: 'Room 5' }])) })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('school/students', { method: 'POST', body: { classId: CLASS_ID, students: [{ name: 'Ann' }] } }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('teacher_unverified')
    expect(log.some((l) => l.u.includes('/auth/v1/admin/users') && l.method === 'POST')).toBe(false)
  })

  it('can still list classes, and sees verification.verified = false', async () => {
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('school/classes'))
    expect(res.status).toBe(200)
    expect((await res.json()).verification).toEqual({ verified: false })
  })

  it('a confirmed school-domain email is verified on the spot and recorded in app_metadata', async () => {
    user = { ...user, email: 'pat@lincoln.edu' }
    routes.push({ method: 'POST', match: '/rest/v1/classrooms', reply: () => new Response(JSON.stringify([{ id: CLASS_ID }]), { status: 201 }) })
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('school/classes', { method: 'POST', body: { name: 'Room 5' } }))
    expect(res.status).toBe(201)
    const put = log.find((l) => l.method === 'PUT' && l.u.includes('/auth/v1/admin/users/teacher-9'))
    expect(put.body.app_metadata.teacher_verified_by).toBe('domain')
    expect(put.body.app_metadata.teacher_verified_at).toBeTruthy()
    // Only the two keys: a stale copy of the whole object must never be sent.
    expect(Object.keys(put.body.app_metadata).sort()).toEqual(['teacher_verified_at', 'teacher_verified_by'])
  })

  it('an UNCONFIRMED school-domain email is not enough', async () => {
    user = { ...user, email: 'pat@lincoln.edu', email_confirmed_at: null }
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('school/classes', { method: 'POST', body: { name: 'Room 5' } }))
    expect(res.status).toBe(403)
  })

  it('the owner is always verified (their own class keeps working)', async () => {
    routes.push({ method: 'POST', match: '/rest/v1/classrooms', reply: () => new Response(JSON.stringify([{ id: CLASS_ID }]), { status: 201 }) })
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('school/classes', { method: 'POST', body: { name: 'Room 5' }, who: 'owner' }))
    expect(res.status).toBe(201)
  })
})

describe('POST /api/school/verification', () => {
  it('creates one pending request and alerts the owner with the domain + user id only', async () => {
    routes.push({ method: 'POST', match: '/rest/v1/teacher_verification_requests', reply: () => new Response(JSON.stringify([{ id: REQ_ID, status: 'pending', created_at: 'now' }]), { status: 201 }) })
    const { default: handler } = await import('../api/school/verification.js')
    const res = await handler(call('school/verification', { method: 'POST', body: { school_name: 'Lincoln Elementary' } }))
    expect(res.status).toBe(201)
    const out = await res.json()
    expect(out.verified).toBe(false)
    expect(out.request.status).toBe('pending')
    const ins = log.find((l) => l.method === 'POST' && l.u.includes('teacher_verification_requests'))
    expect(ins.body).toEqual({ user_id: 'teacher-9', email_domain: 'gmail.com', school_name: 'Lincoln Elementary' })
    const mail = log.find((l) => l.u.includes('api.resend.com'))
    expect(mail.body.to).toEqual(['owner@mybooklab.app'])
    expect(mail.body.text).toContain('gmail.com')
    expect(mail.body.text).toContain('teacher-9')
    expect(mail.body.text).not.toContain('pat@')
    expect(mail.body.text).not.toContain('Lincoln Elementary')
  })

  it('returns the existing pending request instead of a second one', async () => {
    routes.push({ method: 'GET', match: '/rest/v1/teacher_verification_requests', reply: () => new Response(JSON.stringify([{ id: REQ_ID, status: 'pending', created_at: 'then' }])) })
    const { default: handler } = await import('../api/school/verification.js')
    const res = await handler(call('school/verification', { method: 'POST', body: {} }))
    expect(res.status).toBe(200)
    expect(log.some((l) => l.method === 'POST' && l.u.includes('teacher_verification_requests'))).toBe(false)
    expect(log.some((l) => l.u.includes('api.resend.com'))).toBe(false)
  })

  it('GET shows a decline reason to the teacher', async () => {
    routes.push({ method: 'GET', match: '/rest/v1/teacher_verification_requests', reply: () => new Response(JSON.stringify([{ id: REQ_ID, status: 'declined', created_at: 'then', decline_reason: 'Please use your school email' }])) })
    const { default: handler } = await import('../api/school/verification.js')
    const out = await (await handler(call('school/verification'))).json()
    expect(out.request).toEqual({ status: 'declined', created_at: 'then', decline_reason: 'Please use your school email' })
  })
})

describe('owner queue /api/admin/teacher-verifications', () => {
  const pending = { id: REQ_ID, user_id: 'teacher-9', email_domain: 'gmail.com', school_name: null, status: 'pending', created_at: 'then' }

  it('is owner-only', async () => {
    const { default: handler } = await import('../api/admin/teacher-verifications.js')
    const res = await handler(call('admin/teacher-verifications'))
    expect(res.status).toBe(403)
  })

  it('approve: logs first (required), then writes app_metadata with the owner id, then closes the row', async () => {
    routes.push({ method: 'GET', match: '/rest/v1/teacher_verification_requests?id=eq.', reply: () => new Response(JSON.stringify([pending])) })
    const { default: handler } = await import('../api/admin/teacher-verifications.js')
    const res = await handler(call('admin/teacher-verifications', { method: 'POST', body: { id: REQ_ID, decision: 'approve', reason: 'Checked the school site' }, who: 'owner' }))
    expect(res.status).toBe(200)
    const iLog = log.findIndex((l) => l.u.includes('/rest/v1/admin_access_log'))
    const iPut = log.findIndex((l) => l.method === 'PUT' && l.u.includes('/auth/v1/admin/users/teacher-9'))
    const iPatch = log.findIndex((l) => l.method === 'PATCH' && l.u.includes('teacher_verification_requests'))
    expect(iLog).toBeGreaterThan(-1)
    expect(iLog).toBeLessThan(iPut)
    expect(iPut).toBeLessThan(iPatch)
    expect(log[iLog].body.action).toBe('teacher_verification.approve')
    expect(log[iPut].body.app_metadata.teacher_verified_by).toBe(OWNER)
    expect(log[iPatch].body.status).toBe('approved')
    expect(log[iPatch].u).toContain('status=eq.pending')
  })

  it('decline needs a reason and never touches app_metadata', async () => {
    routes.push({ method: 'GET', match: '/rest/v1/teacher_verification_requests?id=eq.', reply: () => new Response(JSON.stringify([pending])) })
    const { default: handler } = await import('../api/admin/teacher-verifications.js')
    let res = await handler(call('admin/teacher-verifications', { method: 'POST', body: { id: REQ_ID, decision: 'decline' }, who: 'owner' }))
    expect(res.status).toBe(400)
    res = await handler(call('admin/teacher-verifications', { method: 'POST', body: { id: REQ_ID, decision: 'decline', reason: 'Not a school' }, who: 'owner' }))
    expect(res.status).toBe(200)
    expect(log.some((l) => l.method === 'PUT' && l.u.includes('/auth/v1/admin/users'))).toBe(false)
    const patch = log.find((l) => l.method === 'PATCH')
    expect(patch.body).toMatchObject({ status: 'declined', decline_reason: 'Not a school', decided_by: OWNER })
  })

  it('no access-log row → nothing changes', async () => {
    routes.push({ method: 'GET', match: '/rest/v1/teacher_verification_requests?id=eq.', reply: () => new Response(JSON.stringify([pending])) })
    routes.push({ method: 'POST', match: '/rest/v1/admin_access_log', reply: () => new Response('{}', { status: 500 }) })
    const { default: handler } = await import('../api/admin/teacher-verifications.js')
    const res = await handler(call('admin/teacher-verifications', { method: 'POST', body: { id: REQ_ID, decision: 'approve', reason: 'ok' }, who: 'owner' }))
    expect(res.status).toBe(503)
    expect(log.some((l) => l.method === 'PUT' || l.method === 'PATCH')).toBe(false)
  })

  it('a decided request cannot be decided again', async () => {
    routes.push({ method: 'GET', match: '/rest/v1/teacher_verification_requests?id=eq.', reply: () => new Response(JSON.stringify([{ ...pending, status: 'approved' }])) })
    const { default: handler } = await import('../api/admin/teacher-verifications.js')
    const res = await handler(call('admin/teacher-verifications', { method: 'POST', body: { id: REQ_ID, decision: 'decline', reason: 'x' }, who: 'owner' }))
    expect(res.status).toBe(409)
  })
})

describe('migration 034: verification table + grandfathering', () => {
  const sql = readFileSync('supabase-migrations/034_school_billing.sql', 'utf8')
  it('locks the new tables to the service role', () => {
    for (const t of ['teacher_verification_requests', 'school_plans', 'school_seat_offers', 'stripe_school_events']) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`))
      expect(sql).toMatch(new RegExp(`revoke all on public\\.${t} from anon, authenticated`))
    }
    expect(sql).not.toMatch(/create policy/i)
  })
  it('grandfathers every current class/license owner, never students, without overwriting', () => {
    expect(sql).toMatch(/update auth\.users u/)
    expect(sql).toMatch(/'teacher_verified_by', 'grandfathered'/)
    expect(sql).toMatch(/coalesce\(u\.raw_app_meta_data->>'role', ''\) <> 'student'/)
    expect(sql).toMatch(/coalesce\(u\.raw_app_meta_data->>'teacher_verified_at', ''\) = ''/)
    expect(sql).toMatch(/public\.classrooms c where c\.owner_user_id = u\.id/)
    expect(sql).toMatch(/public\.class_licenses l where l\.owner_user_id = u\.id/)
  })
  it('stores only the email DOMAIN on a request', () => {
    const table = sql.slice(sql.indexOf('create table if not exists public.teacher_verification_requests'), sql.indexOf('create unique index if not exists teacher_verification_one_pending'))
    expect(table).toMatch(/email_domain text not null/)
    expect(table).not.toMatch(/\bemail text\b/)
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PICTURE_IDS } from '../lib/school/pictures.js'
import { hashPictureSecret } from '../lib/school/crypto.js'

const URL_ = 'https://example.supabase.co'
const TEACHER = { id: 'teacher-1', app_metadata: {} }
const CLASS_ID = '6f1c1b1e-0000-4000-8000-000000000001'
const STUDENT_ID = '6f1c1b1e-0000-4000-8000-000000000002'
const PEPPER = 'test-pepper-value'

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.STUDENT_SECRET_PEPPER = PEPPER
})

// Copied from tests/school-classes.test.js (Task 4).
// Logs every fetch call ({ method, url, body }) and answers with the first
// matching route ({ method, match, reply }); reply may be a plain
// { status, body } or a function of the just-logged call, for stateful
// (e.g. retry-then-succeed) behaviour.
function mockSupabase({ user, routes }) {
  const log = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url), method = init.method || 'GET'
    log.push({ method, url: u, body: init.body ? JSON.parse(init.body) : undefined })
    if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(user))
    for (const r of routes) {
      if (r.method === method && u.includes(r.match)) {
        const next = typeof r.reply === 'function' ? r.reply(log.at(-1)) : r.reply
        return new Response(JSON.stringify(next.body ?? []), { status: next.status ?? 200 })
      }
    }
    return new Response('[]')
  })
  return log
}

function call(method, body, query = '') {
  return new Request(`https://app.test/api/school/students${query}`, {
    method,
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const classroomRow = {
  id: CLASS_ID, code: 'ABC234', name: 'Room 5', locale: 'en', sign_in_open: false,
  timezone: 'America/New_York', school_hours: {}, archived_at: null,
}
const classroomRoute = { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [classroomRow] } }

const usableLicense = { status: 'trial', expires_at: '2099-01-01T00:00:00.000Z', seats: 35 }
const licenseRoute = (license) => ({ method: 'GET', match: '/rest/v1/class_licenses', reply: { body: [license] } })
const activeStudentsRoute = (rows) => ({ method: 'GET', match: 'status=eq.active', reply: { body: rows } })

// A full DB row, including columns that must never leave the API — used to
// prove the handler strips them via an allowlist, not by hoping the query
// string was honoured.
const fullStudentRow = (overrides = {}) => ({
  id: STUDENT_ID, display_name: 'Kid', avatar_emoji: '🦊', status: 'active',
  locked_until: null, hard_locked: false, last_sign_in_at: null, created_at: '2026-01-01T00:00:00.000Z',
  auth_user_id: 'auth-kid-1', secret_hash: 'deadbeef', secret_version: 1, classroom_id: CLASS_ID,
  failed_attempts: 0, removed_at: null,
  ...overrides,
})

describe('GET /api/school/students', () => {
  it('never selects secret_hash', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        { method: 'GET', match: '/rest/v1/class_students', reply: { body: [fullStudentRow()] } },
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('GET', undefined, `?classId=${CLASS_ID}`))
    expect(res.status).toBe(200)
    const listCall = log.find((l) => l.method === 'GET' && l.url.includes('/rest/v1/class_students'))
    expect(listCall.url).not.toContain('secret_hash')
  })

  it('never contains secret_hash or auth_user_id in the response body', async () => {
    mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        { method: 'GET', match: '/rest/v1/class_students', reply: { body: [fullStudentRow()] } },
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('GET', undefined, `?classId=${CLASS_ID}`))
    expect(res.status).toBe(200)
    const bodyText = JSON.stringify(await res.json())
    expect(bodyText).not.toContain('secret_hash')
    expect(bodyText).not.toContain('auth_user_id')
  })
})

describe('POST /api/school/students', () => {
  it('returns 503 not_configured when STUDENT_SECRET_PEPPER is missing', async () => {
    delete process.env.STUDENT_SECRET_PEPPER
    mockSupabase({ user: TEACHER, routes: [classroomRoute] })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('POST', { classId: CLASS_ID, students: [{ name: 'A' }] }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('not_configured')
  })

  it('returns 403 license_required for an expired trial license, creating no auth user', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        licenseRoute({ status: 'trial', expires_at: '2020-01-01T00:00:00.000Z', seats: 35 }),
        activeStudentsRoute([]),
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('POST', { classId: CLASS_ID, students: [{ name: 'A' }] }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('license_required')
    expect(log.filter((l) => l.method === 'POST' && l.url.includes('/auth/v1/admin/users'))).toHaveLength(0)
  })

  it('returns 503 upstream (not an empty class) when the active-students list query fails, creating no auth user', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        licenseRoute(usableLicense),
        { method: 'GET', match: 'status=eq.active', reply: { status: 500, body: { message: 'list failed' } } },
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('POST', { classId: CLASS_ID, students: [{ name: 'A' }] }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    expect(log.filter((l) => l.method === 'POST' && l.url.includes('/auth/v1/admin/users'))).toHaveLength(0)
    errSpy.mockRestore()
  })

  it('returns 409 seats_full for 3 new names against 34 active students and 35 seats, creating no auth user', async () => {
    const existing = Array.from({ length: 34 }, (_, i) => ({
      id: `existing-${i}`, display_name: `Existing ${i}`, avatar_emoji: '🦊',
    }))
    const log = mockSupabase({
      user: TEACHER,
      routes: [classroomRoute, licenseRoute(usableLicense), activeStudentsRoute(existing)],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('POST', { classId: CLASS_ID, students: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('seats_full')
    expect(log.filter((l) => l.method === 'POST' && l.url.includes('/auth/v1/admin/users'))).toHaveLength(0)
  })

  it('creates Maya R and Leo, skips duplicate "maya r", and posts well-formed auth users', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        licenseRoute(usableLicense),
        activeStudentsRoute([]),
        {
          method: 'POST', match: '/auth/v1/admin/users',
          reply: () => ({ status: 201, body: { id: `auth-${log2Count()}` } }),
        },
        { method: 'POST', match: '/rest/v1/class_students', reply: { status: 201, body: [] } },
        { method: 'PUT', match: '/auth/v1/admin/users/', reply: { status: 200, body: {} } },
      ],
    })
    // Helper to give each created auth user a distinct id, based on how many
    // create calls have happened so far (closes over `log`).
    function log2Count() {
      return log.filter((l) => l.method === 'POST' && l.url === `${URL_}/auth/v1/admin/users`).length
    }

    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('POST', { classId: CLASS_ID, students: [{ name: 'Maya R' }, { name: 'maya r' }, { name: 'Leo' }] }))
    expect(res.status).toBe(201)
    const body = await res.json()

    const maya = body.created.find((c) => c.display_name === 'Maya R')
    const leo = body.created.find((c) => c.display_name === 'Leo')
    expect(maya).toBeDefined()
    expect(leo).toBeDefined()
    expect(body.created).toHaveLength(2)
    expect(maya.pictures).toHaveLength(3)
    expect(maya.pictures.every((p) => PICTURE_IDS.includes(p))).toBe(true)
    expect(leo.pictures).toHaveLength(3)
    expect(leo.pictures.every((p) => PICTURE_IDS.includes(p))).toBe(true)

    expect(body.skipped).toEqual([{ name: 'maya r', code: 'duplicate_name' }])

    const authCreateCalls = log.filter((l) => l.method === 'POST' && l.url === `${URL_}/auth/v1/admin/users`)
    expect(authCreateCalls).toHaveLength(2)
    for (const c of authCreateCalls) {
      expect(c.body.app_metadata.role).toBe('student')
      expect(c.body.email).toMatch(/@students\.mybooklab\.invalid$/)
      expect(c.body.email_confirm).toBe(true)
      expect(c.body.email.toLowerCase()).not.toContain('maya')
      expect(c.body.email.toLowerCase()).not.toContain('leo')
    }
  })

  it('stores secret_hash equal to hashPictureSecret(pepper, insertedId, returnedPictures)', async () => {
    let authCounter = 0
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        licenseRoute(usableLicense),
        activeStudentsRoute([]),
        { method: 'POST', match: '/auth/v1/admin/users', reply: () => ({ status: 201, body: { id: `auth-hash-${++authCounter}` } }) },
        { method: 'POST', match: '/rest/v1/class_students', reply: { status: 201, body: [] } },
        { method: 'PUT', match: '/auth/v1/admin/users/', reply: { status: 200, body: {} } },
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('POST', { classId: CLASS_ID, students: [{ name: 'Sam' }] }))
    expect(res.status).toBe(201)
    const body = await res.json()
    const created = body.created[0]

    const insertCall = log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/class_students'))
    expect(insertCall.body.id).toBe(created.id)
    const expectedHash = await hashPictureSecret(PEPPER, created.id, created.pictures)
    expect(insertCall.body.secret_hash).toBe(expectedHash)
  })

  it('deletes the auth user and skips with create_failed when the class_students insert fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        licenseRoute(usableLicense),
        activeStudentsRoute([]),
        { method: 'POST', match: '/auth/v1/admin/users', reply: { status: 201, body: { id: 'auth-del-1' } } },
        { method: 'POST', match: '/rest/v1/class_students', reply: { status: 500, body: { message: 'insert failed' } } },
        { method: 'DELETE', match: '/auth/v1/admin/users/auth-del-1', reply: { status: 200, body: {} } },
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('POST', { classId: CLASS_ID, students: [{ name: 'Fail Kid' }] }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.created).toHaveLength(0)
    expect(body.skipped).toEqual([{ name: 'Fail Kid', code: 'create_failed' }])

    const createIdx = log.findIndex((l) => l.method === 'POST' && l.url.includes('/auth/v1/admin/users'))
    const deleteIdx = log.findIndex((l) => l.method === 'DELETE' && l.url.includes('/auth/v1/admin/users/auth-del-1'))
    expect(deleteIdx).toBeGreaterThan(createIdx)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('still returns the second created student when the first insert fails AND its compensating delete also rejects', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let authCount = 0
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        licenseRoute(usableLicense),
        activeStudentsRoute([]),
        { method: 'POST', match: '/auth/v1/admin/users', reply: () => ({ status: 201, body: { id: `auth-comp-${++authCount}` } }) },
        {
          method: 'POST',
          match: '/rest/v1/class_students',
          reply: (last) => (last.body.auth_user_id === 'auth-comp-1' ? { status: 500, body: { message: 'insert failed' } } : { status: 201, body: [] }),
        },
        { method: 'PUT', match: '/auth/v1/admin/users/', reply: { status: 200, body: {} } },
        { method: 'DELETE', match: '/auth/v1/admin/users/auth-comp-1', reply: () => { throw new Error('compensating delete rejected') } },
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('POST', { classId: CLASS_ID, students: [{ name: 'First Fail' }, { name: 'Second Good' }] }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.created).toHaveLength(1)
    expect(body.created[0].display_name).toBe('Second Good')
    expect(body.skipped).toEqual([{ name: 'First Fail', code: 'create_failed' }])
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})

describe('PATCH /api/school/students', () => {
  it('returns 404 student_not_found for a student from another class', async () => {
    mockSupabase({
      user: TEACHER,
      routes: [classroomRoute, { method: 'GET', match: '/rest/v1/class_students', reply: { body: [] } }],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('PATCH', { classId: CLASS_ID, id: STUDENT_ID, action: 'unlock' }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('student_not_found')
  })

  it('remove returns 502 upstream and never bans or signs out when the row update fails', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        { method: 'GET', match: '/rest/v1/class_students', reply: { body: [fullStudentRow()] } },
        { method: 'PATCH', match: '/rest/v1/class_students?id=eq.', reply: { status: 500, body: { message: 'update failed' } } },
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('PATCH', { classId: CLASS_ID, id: STUDENT_ID, action: 'remove' }))
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('upstream')
    expect(log.filter((l) => l.method === 'PUT' && l.url.includes('/auth/v1/admin/users/auth-kid-1'))).toHaveLength(0)
    expect(log.filter((l) => l.method === 'POST' && l.url.includes('/rest/v1/rpc/school_sign_out_user'))).toHaveLength(0)
  })

  it('remove sends the ban PUT with ban_duration 876000h and calls the sign-out RPC, without leaking secret_hash/auth_user_id', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        { method: 'GET', match: '/rest/v1/class_students', reply: { body: [fullStudentRow()] } },
        { method: 'PATCH', match: '/rest/v1/class_students?id=eq.', reply: { status: 200, body: [fullStudentRow({ status: 'removed' })] } },
        { method: 'PUT', match: '/auth/v1/admin/users/auth-kid-1', reply: { status: 200, body: {} } },
        { method: 'POST', match: '/rest/v1/rpc/school_sign_out_user', reply: { status: 200, body: {} } },
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('PATCH', { classId: CLASS_ID, id: STUDENT_ID, action: 'remove' }))
    expect(res.status).toBe(200)
    const bodyText = JSON.stringify(await res.json())
    expect(bodyText).not.toContain('secret_hash')
    expect(bodyText).not.toContain('auth_user_id')

    const banCall = log.find((l) => l.method === 'PUT' && l.url.includes('/auth/v1/admin/users/auth-kid-1'))
    expect(banCall.body.ban_duration).toBe('876000h')
    const rpcCall = log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/rpc/school_sign_out_user'))
    expect(rpcCall.body.p_user_id).toBe('auth-kid-1')
  })

  it('reset_secret returns 3 pictures and patches hard_locked:false, failed_attempts:0, without leaking secret_hash/auth_user_id', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        { method: 'GET', match: '/rest/v1/class_students', reply: { body: [fullStudentRow({ hard_locked: true, failed_attempts: 4 })] } },
        { method: 'PATCH', match: '/rest/v1/class_students?id=eq.', reply: { status: 200, body: [fullStudentRow({ hard_locked: false, failed_attempts: 0 })] } },
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('PATCH', { classId: CLASS_ID, id: STUDENT_ID, action: 'reset_secret' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pictures).toHaveLength(3)
    expect(body.pictures.every((p) => PICTURE_IDS.includes(p))).toBe(true)
    expect(JSON.stringify(body)).not.toContain('secret_hash')
    expect(JSON.stringify(body)).not.toContain('auth_user_id')

    const patchCall = log.find((l) => l.method === 'PATCH' && l.url.includes('/rest/v1/class_students?id=eq.'))
    expect(patchCall.body.hard_locked).toBe(false)
    expect(patchCall.body.failed_attempts).toBe(0)
    expect(patchCall.body.locked_until).toBeNull()
    expect(typeof patchCall.body.secret_hash).toBe('string')
  })

  it('sign_out does not send an empty-body PATCH, re-selecting the row instead after the RPC', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        { method: 'GET', match: '/rest/v1/class_students', reply: { body: [fullStudentRow()] } },
        { method: 'POST', match: '/rest/v1/rpc/school_sign_out_user', reply: { status: 200, body: {} } },
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('PATCH', { classId: CLASS_ID, id: STUDENT_ID, action: 'sign_out' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.student.id).toBe(STUDENT_ID)
    expect(JSON.stringify(body)).not.toContain('secret_hash')
    expect(JSON.stringify(body)).not.toContain('auth_user_id')

    expect(log.filter((l) => l.method === 'PATCH' && l.url.includes('/rest/v1/class_students'))).toHaveLength(0)
    const rpcCall = log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/rpc/school_sign_out_user'))
    expect(rpcCall.body.p_user_id).toBe('auth-kid-1')
    const getCalls = log.filter((l) => l.method === 'GET' && l.url.includes('/rest/v1/class_students'))
    expect(getCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('restore returns 409 seats_full when there is no free seat, sending no PATCH or PUT', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        { method: 'GET', match: `id=eq.${STUDENT_ID}`, reply: { body: [fullStudentRow({ status: 'removed' })] } },
        licenseRoute({ status: 'trial', expires_at: '2099-01-01T00:00:00.000Z', seats: 2 }),
        activeStudentsRoute([{ id: 'a1', display_name: 'A', avatar_emoji: '🐼' }, { id: 'a2', display_name: 'B', avatar_emoji: '🐨' }]),
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('PATCH', { classId: CLASS_ID, id: STUDENT_ID, action: 'restore' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('seats_full')
    expect(log.filter((l) => l.method === 'PATCH' && l.url.includes('/rest/v1/class_students'))).toHaveLength(0)
    expect(log.filter((l) => l.method === 'PUT' && l.url.includes('/auth/v1/admin/users/'))).toHaveLength(0)
  })

  it('restore succeeds with a free seat, sending PUT ban_duration none', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        { method: 'GET', match: `id=eq.${STUDENT_ID}`, reply: { body: [fullStudentRow({ status: 'removed' })] } },
        licenseRoute({ status: 'trial', expires_at: '2099-01-01T00:00:00.000Z', seats: 35 }),
        activeStudentsRoute([]),
        { method: 'PATCH', match: '/rest/v1/class_students?id=eq.', reply: { status: 200, body: [fullStudentRow({ status: 'active' })] } },
        { method: 'PUT', match: '/auth/v1/admin/users/auth-kid-1', reply: { status: 200, body: {} } },
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('PATCH', { classId: CLASS_ID, id: STUDENT_ID, action: 'restore' }))
    expect(res.status).toBe(200)
    const putCall = log.find((l) => l.method === 'PUT' && l.url.includes('/auth/v1/admin/users/auth-kid-1'))
    expect(putCall.body.ban_duration).toBe('none')
  })

  it('restore returns 502 upstream and never unbans when the row update fails', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        { method: 'GET', match: `id=eq.${STUDENT_ID}`, reply: { body: [fullStudentRow({ status: 'removed' })] } },
        licenseRoute({ status: 'trial', expires_at: '2099-01-01T00:00:00.000Z', seats: 35 }),
        activeStudentsRoute([]),
        { method: 'PATCH', match: '/rest/v1/class_students?id=eq.', reply: { status: 500, body: { message: 'update failed' } } },
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('PATCH', { classId: CLASS_ID, id: STUDENT_ID, action: 'restore' }))
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('upstream')
    expect(log.filter((l) => l.method === 'PUT' && l.url.includes('/auth/v1/admin/users/'))).toHaveLength(0)
  })

  it('rename to an existing active student\'s name returns 409 duplicate_name', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        { method: 'GET', match: `id=eq.${STUDENT_ID}`, reply: { body: [fullStudentRow()] } },
        activeStudentsRoute([{ id: 'other-1', display_name: 'Existing Name', avatar_emoji: '🐼' }]),
      ],
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('PATCH', { classId: CLASS_ID, id: STUDENT_ID, action: 'rename', name: 'existing name' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('duplicate_name')
    expect(log.filter((l) => l.method === 'PATCH' && l.url.includes('/rest/v1/class_students'))).toHaveLength(0)
  })
})

describe('unhandled errors', () => {
  it('returns 503 upstream when an unexpected error is thrown mid-request', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    globalThis.fetch = vi.fn(async (url, init = {}) => {
      const u = String(url), method = init.method || 'GET'
      if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(TEACHER))
      if (method === 'GET' && u.includes('/rest/v1/classrooms')) return new Response(JSON.stringify([classroomRow]))
      if (method === 'GET' && u.includes('/rest/v1/class_students')) return new Response(JSON.stringify([fullStudentRow()]))
      if (method === 'PATCH' && u.includes('/rest/v1/class_students?id=eq.')) throw new Error('network down')
      return new Response('[]')
    })
    const { default: handler } = await import('../api/school/students.js')
    const res = await handler(call('PATCH', { classId: CLASS_ID, id: STUDENT_ID, action: 'unlock' }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })
})

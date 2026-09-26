import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PICTURE_IDS } from '../lib/school/pictures.js'
import { hashPictureSecret } from '../lib/school/crypto.js'

const URL_ = 'https://example.supabase.co'
const CLASS_ID = '6f1c1b1e-0000-4000-8000-000000000001'
const STUDENT_ID = '6f1c1b1e-0000-4000-8000-000000000002'
const OTHER_STUDENT_ID = '6f1c1b1e-0000-4000-8000-000000000003'
const PEPPER = 'test-pepper-value'
const CODE = 'ABC234'
const RIGHT_PICTURES = PICTURE_IDS.slice(0, 3)
const WRONG_PICTURES = PICTURE_IDS.slice(1, 4)

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.STUDENT_SECRET_PEPPER = PEPPER
})

// Copied from tests/school-classes.test.js (Task 4), extended to also log
// request headers — needed here to assert generate_link uses the service
// key and verify uses the anon apikey.
function mockSupabase({ user, routes }) {
  const log = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url), method = init.method || 'GET'
    log.push({ method, url: u, body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers || {} })
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

function rosterCall(code) {
  return new Request(`https://app.test/api/school/roster?code=${encodeURIComponent(code ?? '')}`, { method: 'GET' })
}

function signInCall(body) {
  return new Request('https://app.test/api/school/sign-in', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const usableLicense = { status: 'trial', expires_at: '2099-01-01T00:00:00.000Z' }
const expiredLicense = { status: 'trial', expires_at: '2020-01-01T00:00:00.000Z' }

function classroomRow(overrides = {}) {
  return {
    id: CLASS_ID, name: 'Room 5', locale: 'en', sign_in_open: true, sign_in_paused_until: null,
    class_licenses: usableLicense,
    ...overrides,
  }
}
const classroomRoute = (row) => ({ method: 'GET', match: '/rest/v1/classrooms', reply: { body: [row] } })

describe('mintStudentSession', () => {
  it('reads hashed_token from the top level and posts to /auth/v1/verify with the anon apikey', async () => {
    const log = mockSupabase({
      user: null,
      routes: [
        { method: 'POST', match: '/auth/v1/admin/generate_link', reply: { status: 200, body: { hashed_token: 'th-top' } } },
        {
          method: 'POST', match: '/auth/v1/verify',
          reply: { status: 200, body: { access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, expires_at: 1234 } },
        },
      ],
    })
    const { mintStudentSession } = await import('../lib/school/session.js')
    const session = await mintStudentSession({ url: URL_, serviceKey: 'service', anonKey: 'anon', email: 'kid@students.mybooklab.invalid' })
    expect(session).toEqual({ access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600, expires_at: 1234 })

    const verifyCall = log.find((l) => l.url.includes('/auth/v1/verify'))
    expect(verifyCall.body).toEqual({ type: 'magiclink', token_hash: 'th-top' })
    expect(verifyCall.headers.apikey).toBe('anon')
    expect(verifyCall.headers.Authorization).toBeUndefined()
  })

  it('reads hashed_token from properties.hashed_token when there is no top-level field', async () => {
    const log = mockSupabase({
      user: null,
      routes: [
        { method: 'POST', match: '/auth/v1/admin/generate_link', reply: { status: 200, body: { properties: { hashed_token: 'th-nested' } } } },
        {
          method: 'POST', match: '/auth/v1/verify',
          reply: { status: 200, body: { access_token: 'at-2', refresh_token: 'rt-2', expires_in: 3600, expires_at: 5678 } },
        },
      ],
    })
    const { mintStudentSession } = await import('../lib/school/session.js')
    const session = await mintStudentSession({ url: URL_, serviceKey: 'service', anonKey: 'anon', email: 'kid@students.mybooklab.invalid' })
    expect(session).toEqual({ access_token: 'at-2', refresh_token: 'rt-2', expires_in: 3600, expires_at: 5678 })
    const verifyCall = log.find((l) => l.url.includes('/auth/v1/verify'))
    expect(verifyCall.body).toEqual({ type: 'magiclink', token_hash: 'th-nested' })
  })

  it('returns null when generate_link fails, never calling verify', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = mockSupabase({
      user: null,
      routes: [{ method: 'POST', match: '/auth/v1/admin/generate_link', reply: { status: 500, body: { message: 'nope' } } }],
    })
    const { mintStudentSession } = await import('../lib/school/session.js')
    const session = await mintStudentSession({ url: URL_, serviceKey: 'service', anonKey: 'anon', email: 'kid@students.mybooklab.invalid' })
    expect(session).toBeNull()
    expect(log.filter((l) => l.url.includes('/auth/v1/verify'))).toHaveLength(0)
    errSpy.mockRestore()
  })
})

describe('GET /api/school/roster', () => {
  it('returns tiles only, and the class_students query selects only id,display_name,avatar_emoji', async () => {
    const log = mockSupabase({
      user: null,
      routes: [
        classroomRoute(classroomRow()),
        { method: 'GET', match: '/rest/v1/class_students', reply: { body: [{ id: STUDENT_ID, display_name: 'Kid', avatar_emoji: '🦊' }] } },
      ],
    })
    const { default: handler } = await import('../api/school/roster.js')
    const res = await handler(rosterCall(CODE))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.classroom).toEqual({ id: CLASS_ID, name: 'Room 5', locale: 'en' })
    expect(Object.keys(body.students[0])).toEqual(['id', 'display_name', 'avatar_emoji'])

    const studentsCall = log.find((l) => l.method === 'GET' && l.url.includes('/rest/v1/class_students'))
    expect(studentsCall.url).toContain('select=id,display_name,avatar_emoji')
  })

  it('returns 423 sign_in_closed when sign_in_open is false', async () => {
    mockSupabase({ user: null, routes: [classroomRoute(classroomRow({ sign_in_open: false }))] })
    const { default: handler } = await import('../api/school/roster.js')
    const res = await handler(rosterCall(CODE))
    expect(res.status).toBe(423)
    expect((await res.json()).code).toBe('sign_in_closed')
  })

  it('returns 423 class_resting for an expired trial license', async () => {
    mockSupabase({ user: null, routes: [classroomRoute(classroomRow({ class_licenses: expiredLicense }))] })
    const { default: handler } = await import('../api/school/roster.js')
    const res = await handler(rosterCall(CODE))
    expect(res.status).toBe(423)
    expect((await res.json()).code).toBe('class_resting')
  })

  it('returns 503 upstream (not 404) when the classrooms lookup fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({
      user: null,
      routes: [{ method: 'GET', match: '/rest/v1/classrooms', reply: { status: 500, body: { message: 'down' } } }],
    })
    const { default: handler } = await import('../api/school/roster.js')
    const res = await handler(rosterCall(CODE))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })

  it('returns 503 upstream when the class_students lookup fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({
      user: null,
      routes: [
        classroomRoute(classroomRow()),
        { method: 'GET', match: '/rest/v1/class_students', reply: { status: 500, body: { message: 'down' } } },
      ],
    })
    const { default: handler } = await import('../api/school/roster.js')
    const res = await handler(rosterCall(CODE))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })
})

describe('POST /api/school/sign-in', () => {
  async function studentRow(pictures, overrides = {}) {
    return {
      id: STUDENT_ID, auth_user_id: 'auth-kid-1',
      secret_hash: await hashPictureSecret(PEPPER, STUDENT_ID, pictures),
      ...overrides,
    }
  }
  const studentsRoute = (row) => ({ method: 'GET', match: '/rest/v1/class_students', reply: { body: [row] } })
  const stateRoute = (state) => ({ method: 'POST', match: '/rest/v1/rpc/school_sign_in_state', reply: { status: 200, body: state } })
  const recordRoute = (state) => ({ method: 'POST', match: '/rest/v1/rpc/school_record_attempt', reply: { status: 200, body: state } })

  it('signs in with the right pictures: records p_ok:true, mints a session, 200 with tokens', async () => {
    const row = await studentRow(RIGHT_PICTURES)
    const log = mockSupabase({
      user: null,
      routes: [
        classroomRoute(classroomRow()),
        studentsRoute(row),
        stateRoute('ok'),
        recordRoute('ok'),
        { method: 'GET', match: '/auth/v1/admin/users/auth-kid-1', reply: { status: 200, body: { email: 's-kid@students.mybooklab.invalid' } } },
        { method: 'POST', match: '/auth/v1/admin/generate_link', reply: { status: 200, body: { hashed_token: 'th-1' } } },
        {
          method: 'POST', match: '/auth/v1/verify',
          reply: { status: 200, body: { access_token: 'at-ok', refresh_token: 'rt-ok', expires_in: 3600, expires_at: 999 } },
        },
      ],
    })
    const { default: handler } = await import('../api/school/sign-in.js')
    const res = await handler(signInCall({ code: CODE, studentId: STUDENT_ID, pictures: RIGHT_PICTURES }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ access_token: 'at-ok', refresh_token: 'rt-ok', expires_in: 3600, expires_at: 999 })

    const recordCall = log.find((l) => l.url.includes('/rest/v1/rpc/school_record_attempt'))
    expect(recordCall.body).toMatchObject({ p_ok: true, p_classroom_id: CLASS_ID, p_student_id: STUDENT_ID })

    const recordIdx = log.findIndex((l) => l.url.includes('/rest/v1/rpc/school_record_attempt'))
    const genIdx = log.findIndex((l) => l.url.includes('/auth/v1/admin/generate_link'))
    const verifyIdx = log.findIndex((l) => l.url.includes('/auth/v1/verify'))
    expect(recordIdx).toBeGreaterThanOrEqual(0)
    expect(genIdx).toBeGreaterThan(recordIdx)
    expect(verifyIdx).toBeGreaterThan(genIdx)
  })

  it('rejects wrong pictures: records p_ok:false, 401 wrong_pictures, never calls generate_link', async () => {
    const row = await studentRow(RIGHT_PICTURES)
    const log = mockSupabase({
      user: null,
      routes: [classroomRoute(classroomRow()), studentsRoute(row), stateRoute('ok'), recordRoute('ok')],
    })
    const { default: handler } = await import('../api/school/sign-in.js')
    const res = await handler(signInCall({ code: CODE, studentId: STUDENT_ID, pictures: WRONG_PICTURES }))
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('wrong_pictures')

    const recordCall = log.find((l) => l.url.includes('/rest/v1/rpc/school_record_attempt'))
    expect(recordCall.body.p_ok).toBe(false)
    expect(log.filter((l) => l.url.includes('/auth/v1/admin/generate_link'))).toHaveLength(0)
  })

  it('returns 423 locked with no hash comparison when the sign-in state is already locked', async () => {
    const row = await studentRow(RIGHT_PICTURES)
    const log = mockSupabase({
      user: null,
      routes: [classroomRoute(classroomRow()), studentsRoute(row), stateRoute('locked')],
    })
    const { default: handler } = await import('../api/school/sign-in.js')
    const res = await handler(signInCall({ code: CODE, studentId: STUDENT_ID, pictures: RIGHT_PICTURES }))
    expect(res.status).toBe(423)
    expect((await res.json()).code).toBe('locked')
    expect(log.filter((l) => l.url.includes('/rest/v1/rpc/school_record_attempt'))).toHaveLength(0)
  })

  it('returns 429 too_many when the sign-in state is ip_blocked', async () => {
    const row = await studentRow(RIGHT_PICTURES)
    mockSupabase({
      user: null,
      routes: [classroomRoute(classroomRow()), studentsRoute(row), stateRoute('ip_blocked')],
    })
    const { default: handler } = await import('../api/school/sign-in.js')
    const res = await handler(signInCall({ code: CODE, studentId: STUDENT_ID, pictures: RIGHT_PICTURES }))
    expect(res.status).toBe(429)
    expect((await res.json()).code).toBe('too_many')
  })

  it('returns 423 locked on the 5th wrong try, when school_record_attempt reports locked', async () => {
    const row = await studentRow(RIGHT_PICTURES)
    mockSupabase({
      user: null,
      routes: [classroomRoute(classroomRow()), studentsRoute(row), stateRoute('ok'), recordRoute('locked')],
    })
    const { default: handler } = await import('../api/school/sign-in.js')
    const res = await handler(signInCall({ code: CODE, studentId: STUDENT_ID, pictures: WRONG_PICTURES }))
    expect(res.status).toBe(423)
    expect((await res.json()).code).toBe('locked')
  })

  it('returns 404 student_not_found for a student id from another class, filtering by classroom_id', async () => {
    const log = mockSupabase({
      user: null,
      routes: [classroomRoute(classroomRow()), { method: 'GET', match: '/rest/v1/class_students', reply: { body: [] } }],
    })
    const { default: handler } = await import('../api/school/sign-in.js')
    const res = await handler(signInCall({ code: CODE, studentId: OTHER_STUDENT_ID, pictures: RIGHT_PICTURES }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('student_not_found')
    const studentsCall = log.find((l) => l.method === 'GET' && l.url.includes('/rest/v1/class_students'))
    expect(studentsCall.url).toContain(`classroom_id=eq.${CLASS_ID}`)
  })

  it('returns 503 upstream, comparing nothing, when school_sign_in_state errors', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const row = await studentRow(RIGHT_PICTURES)
    const log = mockSupabase({
      user: null,
      routes: [
        classroomRoute(classroomRow()),
        studentsRoute(row),
        { method: 'POST', match: '/rest/v1/rpc/school_sign_in_state', reply: { status: 500, body: { message: 'down' } } },
      ],
    })
    const { default: handler } = await import('../api/school/sign-in.js')
    const res = await handler(signInCall({ code: CODE, studentId: STUDENT_ID, pictures: RIGHT_PICTURES }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    expect(log.filter((l) => l.url.includes('/rest/v1/rpc/school_record_attempt'))).toHaveLength(0)
    expect(log.filter((l) => l.url.includes('/auth/v1/admin/generate_link'))).toHaveLength(0)
    errSpy.mockRestore()
  })

  it('returns 503 upstream when the class_students lookup fails, never calling the state RPC', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = mockSupabase({
      user: null,
      routes: [
        classroomRoute(classroomRow()),
        { method: 'GET', match: '/rest/v1/class_students', reply: { status: 500, body: { message: 'down' } } },
      ],
    })
    const { default: handler } = await import('../api/school/sign-in.js')
    const res = await handler(signInCall({ code: CODE, studentId: STUDENT_ID, pictures: RIGHT_PICTURES }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    expect(log.filter((l) => l.url.includes('/rest/v1/rpc/school_sign_in_state'))).toHaveLength(0)
    errSpy.mockRestore()
  })

  it('returns 400 bad_request for a malformed body (bad studentId, wrong picture count)', async () => {
    mockSupabase({ user: null, routes: [] })
    const { default: handler } = await import('../api/school/sign-in.js')
    const res = await handler(signInCall({ code: CODE, studentId: 'not-a-uuid', pictures: ['cat'] }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_request')
  })
})

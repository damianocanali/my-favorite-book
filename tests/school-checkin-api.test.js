import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DEFAULT_SCHOOL_HOURS } from '../lib/school/hours.js'

const URL_ = 'https://example.supabase.co'
const CLASS_ID = 'c1'
const STUDENT_ID = 's1'
const OWNER_USER_ID = 'teacher-1'

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
})

afterEach(() => {
  vi.useRealTimers()
})

// Same shape as tests/school-students.test.js / school-guards.test.js: logs
// every fetch call and answers with the first matching route. reply may be a
// plain { status, body } or a function of the just-logged call (or of
// nothing), for stateful behaviour across successive calls in one test.
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

const STUDENT_USER = { id: 'kid-auth-1', app_metadata: { role: 'student' } }
const TEACHER_USER = { id: 'teacher-auth-1', app_metadata: {} }

function studentRow(overrides = {}) {
  return {
    id: STUDENT_ID,
    classroom_id: CLASS_ID,
    display_name: 'Maya R',
    classrooms: {
      id: CLASS_ID,
      name: '3B',
      timezone: 'America/New_York',
      school_hours: DEFAULT_SCHOOL_HOURS,
      owner_user_id: OWNER_USER_ID,
    },
    ...overrides,
  }
}
const studentsRoute = (row = studentRow()) => ({ method: 'GET', match: '/rest/v1/class_students', reply: { body: [row] } })

function checkinCall(body) {
  return new Request('https://app.test/api/school/checkin', {
    method: 'POST',
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function helpCall(method, body, query = '') {
  return new Request(`https://app.test/api/school/help${query}`, {
    method,
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/school/checkin', () => {
  it('returns 403 not_a_student for a non-student JWT', async () => {
    mockSupabase({ user: TEACHER_USER, routes: [] })
    const { default: handler } = await import('../api/school/checkin.js')
    const res = await handler(checkinCall({ feeling: 'happy' }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('not_a_student')
  })

  it('stores exactly { classroom_id, student_id, feeling, need }, dropping any extra field like note', async () => {
    const log = mockSupabase({
      user: STUDENT_USER,
      routes: [studentsRoute(), { method: 'POST', match: '/rest/v1/class_checkins', reply: { status: 201, body: [] } }],
    })
    const { default: handler } = await import('../api/school/checkin.js')
    const res = await handler(checkinCall({ feeling: 'angry', need: 'grownup', note: 'secret' }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })

    const insertCall = log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/class_checkins'))
    expect(insertCall.body).toEqual({ classroom_id: CLASS_ID, student_id: STUDENT_ID, feeling: 'angry', need: 'grownup' })
  })

  it('returns 400 bad_request for an out-of-vocabulary feeling', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentsRoute()] })
    const { default: handler } = await import('../api/school/checkin.js')
    const res = await handler(checkinCall({ feeling: 'furious' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_request')
  })

  it('returns 400 bad_request for an out-of-vocabulary need', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentsRoute()] })
    const { default: handler } = await import('../api/school/checkin.js')
    const res = await handler(checkinCall({ feeling: 'happy', need: 'a_pony' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_request')
  })

  it('returns 400 bad_request for a JSON null body, not a crash', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentsRoute()] })
    const { default: handler } = await import('../api/school/checkin.js')
    const res = await handler(checkinCall(null))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_request')
  })

  it('returns 429 rate_limited after 30 check-ins in the window', async () => {
    mockSupabase({
      user: STUDENT_USER,
      routes: [studentsRoute(), { method: 'POST', match: '/rest/v1/class_checkins', reply: { status: 201, body: [] } }],
    })
    const { default: handler } = await import('../api/school/checkin.js')
    let last
    for (let i = 0; i < 31; i++) {
      last = await handler(checkinCall({ feeling: 'happy' }))
    }
    expect(last.status).toBe(429)
    expect((await last.json()).code).toBe('rate_limited')
  })

  it('returns 503 upstream when an unexpected error is thrown mid-request', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({
      user: STUDENT_USER,
      routes: [
        studentsRoute(),
        { method: 'POST', match: '/rest/v1/class_checkins', reply: () => { throw new Error('network down') } },
      ],
    })
    const { default: handler } = await import('../api/school/checkin.js')
    const res = await handler(checkinCall({ feeling: 'happy' }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })
})

describe('POST /api/school/help', () => {
  it('with no open row: inserts with in_hours computed, returning the new id (true in hours, false out of hours)', async () => {
    vi.useFakeTimers()

    vi.setSystemTime(new Date('2026-09-29T14:00:00Z'))
    let log = mockSupabase({
      user: STUDENT_USER,
      routes: [
        studentsRoute(),
        { method: 'GET', match: '/rest/v1/class_help_requests', reply: { status: 200, body: [] } },
        { method: 'POST', match: '/rest/v1/class_help_requests', reply: { status: 201, body: [{ id: 'help-1' }] } },
      ],
    })
    let { default: handler } = await import('../api/school/help.js')
    let res = await handler(helpCall('POST', { kind: 'grownup' }))
    expect(res.status).toBe(200)
    let body = await res.json()
    expect(body).toEqual({ id: 'help-1', in_hours: true })
    const insertCall = log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/class_help_requests'))
    expect(insertCall.body).toEqual({ classroom_id: CLASS_ID, student_id: STUDENT_ID, kind: 'grownup', in_hours: true })

    vi.resetModules()
    vi.setSystemTime(new Date('2026-09-29T23:00:00Z'))
    log = mockSupabase({
      user: STUDENT_USER,
      routes: [
        studentsRoute(),
        { method: 'GET', match: '/rest/v1/class_help_requests', reply: { status: 200, body: [] } },
        { method: 'POST', match: '/rest/v1/class_help_requests', reply: { status: 201, body: [{ id: 'help-2' }] } },
      ],
    })
    ;({ default: handler } = await import('../api/school/help.js'))
    res = await handler(helpCall('POST', { kind: 'grownup' }))
    body = await res.json()
    expect(body).toEqual({ id: 'help-2', in_hours: false })
  })

  it('twice within 15 min: the second call PATCHes the same id with asks:2, sending no second insert', async () => {
    let created = null
    const log = mockSupabase({
      user: STUDENT_USER,
      routes: [
        studentsRoute(),
        { method: 'GET', match: '/rest/v1/class_help_requests', reply: () => ({ status: 200, body: created ? [created] : [] }) },
        {
          method: 'POST', match: '/rest/v1/class_help_requests',
          reply: () => { created = { id: 'help-1', asks: 1 }; return { status: 201, body: [created] } },
        },
        { method: 'PATCH', match: '/rest/v1/class_help_requests?id=eq.help-1', reply: { status: 200, body: [] } },
      ],
    })
    const { default: handler } = await import('../api/school/help.js')

    const first = await handler(helpCall('POST', { kind: 'book' }))
    expect(first.status).toBe(200)
    expect((await first.json()).id).toBe('help-1')

    const second = await handler(helpCall('POST', { kind: 'book' }))
    expect(second.status).toBe(200)
    expect((await second.json()).id).toBe('help-1')

    const patchCall = log.find((l) => l.method === 'PATCH')
    expect(patchCall.body.asks).toBe(2)
    expect(typeof patchCall.body.updated_at).toBe('string')
    expect(log.filter((l) => l.method === 'POST' && l.url.includes('/rest/v1/class_help_requests'))).toHaveLength(1)
  })

  it('returns 400 bad_request for an out-of-vocabulary kind', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentsRoute()] })
    const { default: handler } = await import('../api/school/help.js')
    const res = await handler(helpCall('POST', { kind: 'imaginary_friend' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_request')
  })

  it('returns 400 bad_request for a JSON null body, not a crash', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentsRoute()] })
    const { default: handler } = await import('../api/school/help.js')
    const res = await handler(helpCall('POST', null))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_request')
  })

  it('returns 429 rate_limited after 20 help asks in the window', async () => {
    mockSupabase({
      user: STUDENT_USER,
      routes: [
        studentsRoute(),
        { method: 'GET', match: '/rest/v1/class_help_requests', reply: { status: 200, body: [] } },
        { method: 'POST', match: '/rest/v1/class_help_requests', reply: { status: 201, body: [{ id: 'help-x' }] } },
      ],
    })
    const { default: handler } = await import('../api/school/help.js')
    let last
    for (let i = 0; i < 21; i++) {
      last = await handler(helpCall('POST', { kind: 'book' }))
    }
    expect(last.status).toBe(429)
    expect((await last.json()).code).toBe('rate_limited')
  })

  it('returns 503 upstream (not "no open request") when the dedup lookup fails with a 500', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = mockSupabase({
      user: STUDENT_USER,
      routes: [
        studentsRoute(),
        { method: 'GET', match: '/rest/v1/class_help_requests', reply: { status: 500, body: { message: 'down' } } },
      ],
    })
    const { default: handler } = await import('../api/school/help.js')
    const res = await handler(helpCall('POST', { kind: 'book' }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    expect(log.filter((l) => l.method === 'POST' && l.url.includes('/rest/v1/class_help_requests'))).toHaveLength(0)
    errSpy.mockRestore()
  })

  it('returns 502 upstream (does not silently succeed) when the dedup PATCH fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({
      user: STUDENT_USER,
      routes: [
        studentsRoute(),
        { method: 'GET', match: '/rest/v1/class_help_requests', reply: { status: 200, body: [{ id: 'help-1', asks: 1 }] } },
        { method: 'PATCH', match: '/rest/v1/class_help_requests?id=eq.help-1', reply: { status: 500, body: { message: 'down' } } },
      ],
    })
    const { default: handler } = await import('../api/school/help.js')
    const res = await handler(helpCall('POST', { kind: 'book' }))
    expect(res.status).toBe(502)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })
})

describe('GET /api/school/help', () => {
  const HELP_ID = '11111111-1111-4111-8111-111111111111'

  it("returns 404 for another student's row (the query filters student_id=eq.s1)", async () => {
    const log = mockSupabase({
      user: STUDENT_USER,
      routes: [
        studentsRoute(),
        { method: 'GET', match: '/rest/v1/class_help_requests', reply: { status: 200, body: [] } },
      ],
    })
    const { default: handler } = await import('../api/school/help.js')
    const res = await handler(helpCall('GET', undefined, `?id=${HELP_ID}`))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('not_found')
    const lookupCall = log.find((l) => l.method === 'GET' && l.url.includes('/rest/v1/class_help_requests'))
    expect(lookupCall.url).toContain(`student_id=eq.${STUDENT_ID}`)
  })

  it('returns { seen: true, teacher_name } when seen, reading the owning teacher display name', async () => {
    mockSupabase({
      user: STUDENT_USER,
      routes: [
        studentsRoute(),
        { method: 'GET', match: '/rest/v1/class_help_requests', reply: { status: 200, body: [{ seen_at: '2026-09-29T14:05:00Z' }] } },
        { method: 'GET', match: `/auth/v1/admin/users/${OWNER_USER_ID}`, reply: { status: 200, body: { user_metadata: { display_name: 'Ms. Rivera' } } } },
      ],
    })
    const { default: handler } = await import('../api/school/help.js')
    const res = await handler(helpCall('GET', undefined, `?id=${HELP_ID}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ seen: true, teacher_name: 'Ms. Rivera' })
  })

  it('returns 400 bad_request for a non-uuid id', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentsRoute()] })
    const { default: handler } = await import('../api/school/help.js')
    const res = await handler(helpCall('GET', undefined, '?id=not-a-uuid'))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_request')
  })

  it('returns 503 upstream (not 404) when the row lookup fails with a 500', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({
      user: STUDENT_USER,
      routes: [
        studentsRoute(),
        { method: 'GET', match: '/rest/v1/class_help_requests', reply: { status: 500, body: { message: 'down' } } },
      ],
    })
    const { default: handler } = await import('../api/school/help.js')
    const res = await handler(helpCall('GET', undefined, `?id=${HELP_ID}`))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })
})

describe('check-ins switch (review §7.28)', () => {
  it('refuses a check-in when the class turned them off, storing nothing', async () => {
    const row = studentRow()
    row.classrooms = { ...row.classrooms, checkins_enabled: false }
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentsRoute(row)] })
    const { default: handler } = await import('../api/school/checkin.js')
    const res = await handler(checkinCall({ feeling: 'happy' }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('checkins_off')
    expect(log.some((l) => l.method === 'POST' && l.url.includes('/rest/v1/class_checkins'))).toBe(false)
  })

  it('reads the switch with the student lookup', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentsRoute(), { method: 'POST', match: '/rest/v1/class_checkins', reply: { status: 201, body: {} } }] })
    const { default: handler } = await import('../api/school/checkin.js')
    expect((await handler(checkinCall({ feeling: 'happy' }))).status).toBe(201)
    expect(log.find((l) => l.url.includes('/rest/v1/class_students')).url).toContain('checkins_enabled')
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'

const URL_ = 'https://example.supabase.co'
const TEACHER = { id: 'teacher-1', app_metadata: {} }
const STUDENT = { id: 'student-1', app_metadata: { role: 'student' } }
const CLASS_ID = '6f1c1b1e-0000-4000-8000-000000000001'

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
})

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

function call(method, body) {
  return new Request('https://app.test/api/school/classes', {
    method,
    headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const licenseRow = {
  id: 'lic-1', status: 'trial', origin: 'trial', expires_at: '2026-10-26T00:00:00.000Z',
  seats: 35, image_allowance: 300, images_used: 0,
}
const baseClassRow = {
  id: 'class-1', code: 'ABC234', name: 'Room 5', locale: 'en', sign_in_open: false,
  timezone: 'America/New_York', school_hours: { 1: ['08:00', '15:30'] }, created_at: '2026-01-01T00:00:00.000Z',
}

describe('GET /api/school/classes', () => {
  it('returns only the caller\'s classes, mapping counts and a license embedded as an object', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [{
        method: 'GET', match: '/rest/v1/classrooms',
        reply: { body: [{ ...baseClassRow, class_licenses: licenseRow, class_students: [{ count: 7 }] }] },
      }],
    })
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('GET'))
    expect(res.status).toBe(200)
    const { classes } = await res.json()
    expect(classes).toHaveLength(1)
    expect(classes[0].student_count).toBe(7)
    expect(classes[0].license).toEqual(licenseRow)

    const listCall = log.find((l) => l.method === 'GET' && l.url.includes('/rest/v1/classrooms'))
    expect(listCall.url).toContain('owner_user_id=eq.teacher-1')
    expect(listCall.url).toContain('archived_at=is.null')
  })

  it('maps a license embedded as a one-element array the same way', async () => {
    mockSupabase({
      user: TEACHER,
      routes: [{
        method: 'GET', match: '/rest/v1/classrooms',
        reply: { body: [{ ...baseClassRow, class_licenses: [licenseRow], class_students: [{ count: 2 }] }] },
      }],
    })
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('GET'))
    const { classes } = await res.json()
    expect(classes[0].license).toEqual(licenseRow)
    expect(classes[0].student_count).toBe(2)
  })

  it('returns 503 upstream when fetch rejects', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url)
      if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(TEACHER))
      if (u.includes('/rest/v1/classrooms')) throw new Error('network down')
      return new Response('[]')
    })
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('GET'))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })
})

describe('POST /api/school/classes', () => {
  it('rejects a student JWT with 403', async () => {
    mockSupabase({ user: STUDENT, routes: [] })
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('POST', { name: 'Room 5' }))
    expect(res.status).toBe(403)
  })

  it('creates a class then a trial license with the exact required fields', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        { method: 'POST', match: '/rest/v1/classrooms', reply: { status: 201, body: [{ ...baseClassRow, id: 'new-class-1' }] } },
        { method: 'GET', match: '/rest/v1/class_licenses', reply: { body: [] } },
        { method: 'POST', match: '/rest/v1/class_licenses', reply: { status: 201, body: [licenseRow] } },
        { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [{ ...baseClassRow, id: 'new-class-1', class_licenses: licenseRow, class_students: [{ count: 0 }] }] } },
      ],
    })
    const before = Date.now()
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('POST', { name: 'Room 5' }))
    expect(res.status).toBe(201)
    const { class: created, trial_used_up } = await res.json()
    expect(trial_used_up).toBeUndefined()
    expect(created.id).toBe('new-class-1')

    const licenseInsert = log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/class_licenses'))
    expect(licenseInsert.body).toMatchObject({
      origin: 'trial', status: 'trial', image_allowance: 300, seats: 35, classroom_id: 'new-class-1',
    })
    const expiresMs = new Date(licenseInsert.body.expires_at).getTime()
    const expectedMs = before + 30 * 86_400_000
    expect(Math.abs(expiresMs - expectedMs)).toBeLessThan(60_000)
  })

  it('skips the trial license and reports trial_used_up when the teacher already has 3 trial licenses', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        { method: 'POST', match: '/rest/v1/classrooms', reply: { status: 201, body: [{ ...baseClassRow, id: 'new-class-2' }] } },
        { method: 'GET', match: '/rest/v1/class_licenses', reply: { body: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } },
        { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [{ ...baseClassRow, id: 'new-class-2', class_licenses: null, class_students: [{ count: 0 }] }] } },
      ],
    })
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('POST', { name: 'Room 6' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.trial_used_up).toBe(true)
    expect(body.class.license).toBeNull()
    const licenseInsert = log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/class_licenses'))
    expect(licenseInsert).toBeUndefined()
  })

  it('retries the class code on a 409 from the classrooms insert and succeeds on the second try', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        {
          method: 'POST', match: '/rest/v1/classrooms',
          reply: (last) => {
            const attempts = log.filter((l) => l.method === 'POST' && l.url.includes('/rest/v1/classrooms')).length
            return attempts === 1 ? { status: 409, body: { message: 'duplicate code' } } : { status: 201, body: [{ ...baseClassRow, id: 'new-class-3' }] }
          },
        },
      ],
    })
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('POST', { name: 'Room 7' }))
    expect(res.status).toBe(201)

    const classroomInserts = log.filter((l) => l.method === 'POST' && l.url.includes('/rest/v1/classrooms') && !l.url.includes('class_licenses'))
    expect(classroomInserts).toHaveLength(2)
    expect(classroomInserts[0].body.code).not.toBe(classroomInserts[1].body.code)
  })

  it('rejects an unknown time zone with 400 bad_timezone and inserts nothing', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [] })
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('POST', { name: 'Room 5', timezone: 'Mars/Olympus' }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_timezone')
    expect(log.filter((l) => l.method === 'POST').length).toBe(0)
  })

  it('still returns 201 with license:null when the trial license insert fails, logging the error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({
      user: TEACHER,
      routes: [
        { method: 'POST', match: '/rest/v1/classrooms', reply: { status: 201, body: [{ ...baseClassRow, id: 'new-class-9' }] } },
        { method: 'GET', match: '/rest/v1/class_licenses', reply: { body: [] } },
        { method: 'POST', match: '/rest/v1/class_licenses', reply: { status: 500, body: { message: 'insert failed' } } },
        { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [{ ...baseClassRow, id: 'new-class-9', class_licenses: null, class_students: [{ count: 0 }] }] } },
      ],
    })
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('POST', { name: 'Room 9' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.class.license).toBeNull()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('returns 429 rate_limited once the hourly cap is exceeded', async () => {
    mockSupabase({
      user: TEACHER,
      routes: [
        { method: 'POST', match: '/rest/v1/classrooms', reply: { status: 201, body: [{ ...baseClassRow, id: 'rl-class' }] } },
        // 3 existing trials so no license insert is attempted on any of the 60 allowed calls.
        { method: 'GET', match: '/rest/v1/class_licenses', reply: { body: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } },
        { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [{ ...baseClassRow, id: 'rl-class', class_licenses: null, class_students: [{ count: 0 }] }] } },
      ],
    })
    const { default: handler } = await import('../api/school/classes.js')
    let last
    for (let i = 0; i < 61; i++) {
      last = await handler(call('POST', { name: `Room ${i}` }))
    }
    expect(last.status).toBe(429)
    expect((await last.json()).code).toBe('rate_limited')
  })
})

describe('CORS preflight', () => {
  it('OPTIONS on the classes handler allows PATCH', async () => {
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(new Request('https://app.test/api/school/classes', { method: 'OPTIONS' }))
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PATCH')
  })
})

describe('PATCH /api/school/classes', () => {
  it('returns 404 class_not_found for a class the caller does not own, without sending a PATCH', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [{ method: 'GET', match: 'owner_user_id=eq.', reply: { body: [] } }],
    })
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('PATCH', { id: CLASS_ID, name: 'New name' }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('class_not_found')
    expect(log.filter((l) => l.method === 'PATCH').length).toBe(0)
  })

  it('rotate_code:true sends a PATCH with a fresh 6-char code and retries on 409', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        { method: 'GET', match: 'owner_user_id=eq.', reply: { body: [{ id: CLASS_ID, code: 'OLDCOD', name: 'Room 5', locale: 'en', sign_in_open: false, timezone: 'America/New_York', school_hours: {}, archived_at: null }] } },
        {
          method: 'PATCH', match: '/rest/v1/classrooms?id=eq.',
          reply: (last) => {
            const attempts = log.filter((l) => l.method === 'PATCH' && l.url.includes('/rest/v1/classrooms?id=eq.')).length
            return attempts === 1 ? { status: 409, body: {} } : { status: 200, body: [] }
          },
        },
        { method: 'GET', match: 'class_students.status=eq.active', reply: { body: [{ ...baseClassRow, id: CLASS_ID, code: 'NEWCOD', class_licenses: null, class_students: [{ count: 0 }] }] } },
      ],
    })
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('PATCH', { id: CLASS_ID, rotate_code: true }))
    expect(res.status).toBe(200)

    const patches = log.filter((l) => l.method === 'PATCH' && l.url.includes('/rest/v1/classrooms?id=eq.'))
    expect(patches).toHaveLength(2)
    expect(patches[0].body.code).toMatch(/^[A-Z0-9]{6}$/)
    expect(patches[1].body.code).toMatch(/^[A-Z0-9]{6}$/)
    expect(patches[0].body.code).not.toBe(patches[1].body.code)
  })

  it('rejects invalid school_hours with 400 bad_hours', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        { method: 'GET', match: 'owner_user_id=eq.', reply: { body: [{ id: CLASS_ID, code: 'OLDCOD', name: 'Room 5', locale: 'en', sign_in_open: false, timezone: 'America/New_York', school_hours: {}, archived_at: null }] } },
      ],
    })
    const { default: handler } = await import('../api/school/classes.js')
    const res = await handler(call('PATCH', { id: CLASS_ID, school_hours: { 1: ['15:00', '08:00'] } }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_hours')
    expect(log.filter((l) => l.method === 'PATCH').length).toBe(0)
  })
})

describe('firstOf', () => {
  it('passes an embedded object straight through', async () => {
    const { firstOf } = await import('../api/school/classes.js')
    expect(firstOf({ id: 'lic-1' })).toEqual({ id: 'lic-1' })
  })
  it('unwraps a one-element array', async () => {
    const { firstOf } = await import('../api/school/classes.js')
    expect(firstOf([{ id: 'lic-1' }])).toEqual({ id: 'lic-1' })
  })
  it('treats an empty array and null/undefined as absent', async () => {
    const { firstOf } = await import('../api/school/classes.js')
    expect(firstOf([])).toBeNull()
    expect(firstOf(null)).toBeNull()
    expect(firstOf(undefined)).toBeNull()
  })
})

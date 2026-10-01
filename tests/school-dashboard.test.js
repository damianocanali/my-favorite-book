import { describe, it, expect, beforeEach, vi } from 'vitest'

const URL_ = 'https://example.supabase.co'
const TEACHER = { id: 'teacher-1', app_metadata: {} }
const STUDENT_JWT = { id: 'student-auth-1', app_metadata: { role: 'student' } }
const CLASS_ID = '6f1c1b1e-0000-4000-8000-000000000001'
const OTHER_CLASS_ID = '6f1c1b1e-0000-4000-8000-000000000099'
const S1_ID = '6f1c1b1e-0000-4000-8000-000000000002'
const S2_ID = '6f1c1b1e-0000-4000-8000-000000000003'

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-27T12:00:00.000Z'))
})

// Copied from tests/school-students.test.js.
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

function call(query) {
  return new Request(`https://app.test/api/school/dashboard${query}`, {
    headers: { authorization: 'Bearer jwt' },
  })
}

const classroomRow = {
  id: CLASS_ID, code: 'ABC234', name: 'Room 5', locale: 'en', sign_in_open: false,
  timezone: 'America/New_York', school_hours: {}, archived_at: null,
}
const classroomRoute = { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [classroomRow] } }
const noClassRoute = { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [] } }

const licenseRow = { status: 'trial', expires_at: '2099-01-01T00:00:00.000Z', image_allowance: 300, images_used: 42 }
const licenseRoute = (body = [licenseRow]) => ({ method: 'GET', match: '/rest/v1/class_licenses', reply: { body } })

const studentsFixture = [
  {
    id: S1_ID, display_name: 'Ann', avatar_emoji: '🦊', status: 'active',
    locked_until: null, hard_locked: false, last_sign_in_at: '2026-09-27T09:00:00.000Z',
    images_day: '2026-09-27', images_today: 5, auth_user_id: 'auth-ann',
  },
  {
    id: S2_ID, display_name: 'Ben', avatar_emoji: '🐨', status: 'active',
    locked_until: null, hard_locked: true, last_sign_in_at: '2026-09-10T09:00:00.000Z',
    images_day: '2026-09-10', images_today: 7, auth_user_id: 'auth-ben',
  },
]
const studentsRoute = (rows = studentsFixture) => ({ method: 'GET', match: 'status=eq.active', reply: { body: rows } })

const booksFixture = [
  { user_id: 'auth-ann', updated_at: '2026-09-25T00:00:00.000Z' }, // within 7d
  { user_id: 'auth-ann', updated_at: '2026-08-01T00:00:00.000Z' }, // outside 7d
  { user_id: 'auth-ben', updated_at: '2026-09-24T00:00:00.000Z' }, // within 7d
]
const booksRoute = (rows = booksFixture) => ({ method: 'GET', match: '/rest/v1/user_books', reply: { body: rows } })

const checkinsFixture = [
  { student_id: S1_ID, feeling: 'happy', need: null, created_at: '2026-09-26T00:00:00.000Z' },
  { student_id: S1_ID, feeling: 'tired', need: 'break', created_at: '2026-09-25T00:00:00.000Z' },
  { student_id: S2_ID, feeling: 'worried', need: 'grownup', created_at: '2026-09-24T00:00:00.000Z' },
]
const checkinsRoute = (rows = checkinsFixture) => ({ method: 'GET', match: '/rest/v1/class_checkins', reply: { body: rows } })

const helpFixture = [
  { id: 'h-book', student_id: S1_ID, classroom_id: CLASS_ID, kind: 'book', asks: 1, in_hours: true, created_at: '2026-09-27T11:00:00.000Z', updated_at: '2026-09-27T11:00:00.000Z', class_students: { display_name: 'Ann' } },
  { id: 'h-grownup-old', student_id: S2_ID, classroom_id: CLASS_ID, kind: 'grownup', asks: 1, in_hours: true, created_at: '2026-09-27T09:00:00.000Z', updated_at: '2026-09-27T09:00:00.000Z', class_students: { display_name: 'Ben' } },
  { id: 'h-grownup-new', student_id: S1_ID, classroom_id: CLASS_ID, kind: 'grownup', asks: 2, in_hours: true, created_at: '2026-09-27T10:00:00.000Z', updated_at: '2026-09-27T10:00:00.000Z', class_students: { display_name: 'Ann' } },
]
const helpRoute = (rows = helpFixture) => ({ method: 'GET', match: '/rest/v1/class_help_requests', reply: { body: rows } })

const A1 = '6f1c1b1e-0000-4000-8000-0000000000b1'
const A2 = '6f1c1b1e-0000-4000-8000-0000000000b2'
const assignmentsFixture = [
  { id: A2, title: 'Space', status: 'published', due_at: '2026-09-26T00:00:00.000Z' },
  { id: A1, title: 'My pet', status: 'closed', due_at: null },
]
const assignmentsRoute = (rows = assignmentsFixture) => ({ method: 'GET', match: '/rest/v1/assignments', reply: { body: rows } })
const subsFixture = [
  { assignment_id: A2, student_id: S1_ID, submitted_at: '2026-09-27T09:00:00.000Z' }, // after due -> late
  { assignment_id: A1, student_id: S1_ID, submitted_at: '2026-09-20T00:00:00.000Z' },
  { assignment_id: A1, student_id: S2_ID, submitted_at: '2026-09-21T00:00:00.000Z' },
]
const subsRoute = (rows = subsFixture) => ({ method: 'GET', match: '/rest/v1/class_submissions', reply: { body: rows } })

const avatarRoute = (rows = [{ user_id: 'auth-ann', avatar_url: 'https://cdn.test/ann.png' }]) =>
  ({ method: 'GET', match: '/rest/v1/user_inventory', reply: { body: rows } })

function fullRoutes(overrides = {}) {
  return [
    overrides.classroom ?? classroomRoute,
    overrides.license ?? licenseRoute(),
    overrides.students ?? studentsRoute(),
    overrides.books ?? booksRoute(),
    overrides.checkins ?? checkinsRoute(),
    overrides.help ?? helpRoute(),
    overrides.avatar ?? avatarRoute(),
    overrides.assignments ?? assignmentsRoute(),
    overrides.subs ?? subsRoute(),
  ]
}

describe('GET /api/school/dashboard?classId= (class owner view)', () => {
  it('returns 404 class_not_found for a non-owner, making no data queries', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [noClassRoute] })
    const { default: handler } = await import('../api/school/dashboard.js')
    const res = await handler(call(`?classId=${CLASS_ID}`))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('class_not_found')
    expect(log.filter((l) => l.url.includes('class_licenses'))).toHaveLength(0)
    expect(log.filter((l) => l.url.includes('class_students'))).toHaveLength(0)
  })

  it('returns 403 for a student JWT', async () => {
    mockSupabase({ user: STUDENT_JWT, routes: fullRoutes() })
    const { default: handler } = await import('../api/school/dashboard.js')
    const res = await handler(call(`?classId=${CLASS_ID}`))
    expect(res.status).toBe(403)
  })

  it('aggregates counts, latest edit, inactive flag, and resets images_today for a stale images_day', async () => {
    mockSupabase({ user: TEACHER, routes: fullRoutes() })
    const { default: handler } = await import('../api/school/dashboard.js')
    const res = await handler(call(`?classId=${CLASS_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.class).toEqual({
      id: CLASS_ID, name: 'Room 5', code: 'ABC234',
      license: { status: 'trial', expires_at: '2099-01-01T00:00:00.000Z', image_allowance: 300, images_used: 42 },
      student_count: 2,
    })
    expect(body.summary).toEqual({
      active_this_week: 1, // only Ann signed in within 7 days
      total_students: 2,
      books_total: 3,
      books_edited_this_week: 2,
      images_used: 42,
      image_allowance: 300,
    })

    const ann = body.students.find((s) => s.id === S1_ID)
    const ben = body.students.find((s) => s.id === S2_ID)
    expect(ann.books_count).toBe(2)
    expect(ann.last_book_edited_at).toBe('2026-09-25T00:00:00.000Z')
    expect(ann.images_today).toBe(5) // images_day is today
    expect(ann.inactive_7d).toBe(false)
    expect(ann.avatar_url).toBe('https://cdn.test/ann.png')
    expect(ann.checkins_7d[0]).toEqual({ feeling: 'happy', need: null, created_at: '2026-09-26T00:00:00.000Z' })
    expect(ann.checkins_7d).toHaveLength(2)

    expect(ben.books_count).toBe(1)
    expect(ben.last_book_edited_at).toBe('2026-09-24T00:00:00.000Z')
    expect(ben.images_today).toBe(0) // images_day (2026-09-10) is stale
    expect(ben.inactive_7d).toBe(true)
    expect(ben.locked).toBe(true) // hard_locked
    expect(ben).not.toHaveProperty('avatar_url')
  })

  it('adds the newest published/closed assignments and a per-student status map, one query each', async () => {
    const log = mockSupabase({ user: TEACHER, routes: fullRoutes() })
    const { default: handler } = await import('../api/school/dashboard.js')
    const body = await (await handler(call(`?classId=${CLASS_ID}`))).json()
    expect(body.assignments).toEqual([
      { id: A2, title: 'Space', status: 'published', due_at: '2026-09-26T00:00:00.000Z' },
      { id: A1, title: 'My pet', status: 'closed', due_at: null },
    ])
    const ann = body.students.find((s) => s.id === S1_ID)
    const ben = body.students.find((s) => s.id === S2_ID)
    expect(ann.assignments).toEqual({ [A2]: 'late', [A1]: 'handed_in' })
    expect(ben.assignments).toEqual({ [A2]: 'not_started', [A1]: 'handed_in' })

    const aCalls = log.filter((l) => l.url.includes('/rest/v1/assignments'))
    expect(aCalls).toHaveLength(1)
    expect(aCalls[0].url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(aCalls[0].url).toContain('status=in.(published,closed)')
    expect(aCalls[0].url).toContain('order=created_at.desc')
    expect(aCalls[0].url).toContain('limit=5')
    const sCalls = log.filter((l) => l.url.includes('/rest/v1/class_submissions'))
    expect(sCalls).toHaveLength(1)
    expect(sCalls[0].url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(sCalls[0].url).toContain(`assignment_id=in.(${A2},${A1})`)
  })

  it('a hand-in sent back to revise reads "revising" — its own state, never "not_started"', async () => {
    const log = mockSupabase({ user: TEACHER, routes: fullRoutes({ subs: subsRoute([
      { assignment_id: A2, student_id: S1_ID, submitted_at: '2026-09-25T09:00:00.000Z', returned_at: '2026-09-26T09:00:00.000Z' },
      { assignment_id: A1, student_id: S1_ID, submitted_at: '2026-09-20T00:00:00.000Z', returned_at: null },
    ]) }) })
    const { default: handler } = await import('../api/school/dashboard.js')
    const body = await (await handler(call(`?classId=${CLASS_ID}`))).json()
    expect(body.students.find((s) => s.id === S1_ID).assignments).toEqual({ [A2]: 'revising', [A1]: 'handed_in' })
    expect(log.find((l) => l.url.includes('/rest/v1/class_submissions')).url).toContain('returned_at')
  })

  it('skips the submissions query when the class has no visible assignments', async () => {
    const log = mockSupabase({ user: TEACHER, routes: fullRoutes({ assignments: assignmentsRoute([]) }) })
    const { default: handler } = await import('../api/school/dashboard.js')
    const body = await (await handler(call(`?classId=${CLASS_ID}`))).json()
    expect(body.assignments).toEqual([])
    expect(body.students[0].assignments).toEqual({})
    expect(log.some((l) => l.url.includes('/rest/v1/class_submissions'))).toBe(false)
  })

  it('never selects book_data from user_books', async () => {
    const log = mockSupabase({ user: TEACHER, routes: fullRoutes() })
    const { default: handler } = await import('../api/school/dashboard.js')
    await handler(call(`?classId=${CLASS_ID}`))
    const booksCall = log.find((l) => l.url.includes('/rest/v1/user_books'))
    expect(booksCall.url).not.toContain('book_data')
    expect(booksCall.url).toContain('select=user_id,updated_at')
  })

  it('never leaks auth_user_id in the response', async () => {
    mockSupabase({ user: TEACHER, routes: fullRoutes() })
    const { default: handler } = await import('../api/school/dashboard.js')
    const res = await handler(call(`?classId=${CLASS_ID}`))
    expect(JSON.stringify(await res.json())).not.toContain('auth_user_id')
  })

  it('orders help grownup-first, then newest, and omits classroom_id/class_name for the class view', async () => {
    mockSupabase({ user: TEACHER, routes: fullRoutes() })
    const { default: handler } = await import('../api/school/dashboard.js')
    const res = await handler(call(`?classId=${CLASS_ID}`))
    const body = await res.json()
    expect(body.help.map((h) => h.id)).toEqual(['h-grownup-new', 'h-grownup-old', 'h-book'])
    expect(body.help[0]).toEqual({
      id: 'h-grownup-new', student_id: S1_ID, display_name: 'Ann', kind: 'grownup',
      asks: 2, in_hours: true, created_at: '2026-09-27T10:00:00.000Z', updated_at: '2026-09-27T10:00:00.000Z',
    })
    expect(body.help[0]).not.toHaveProperty('classroom_id')
    expect(body.help[0]).not.toHaveProperty('class_name')
  })

  it('fails open on avatars: a broken user_inventory lookup still returns 200 with no avatar_url', async () => {
    mockSupabase({ user: TEACHER, routes: fullRoutes({ avatar: { method: 'GET', match: '/rest/v1/user_inventory', reply: { status: 500, body: {} } } }) })
    const { default: handler } = await import('../api/school/dashboard.js')
    const res = await handler(call(`?classId=${CLASS_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.students.every((s) => !('avatar_url' in s))).toBe(true)
  })

  it.each([
    ['license', 'class_licenses'],
    ['students', 'class_students'],
    ['books', 'user_books'],
    ['checkins', 'class_checkins'],
    ['help', 'class_help_requests'],
    ['assignments', '/rest/v1/assignments'],
    ['subs', '/rest/v1/class_submissions'],
  ])('fails closed (503, not an empty/partial dashboard) when the %s lookup errors', async (key, match) => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({ user: TEACHER, routes: fullRoutes({ [key]: { method: 'GET', match, reply: { status: 500, body: {} } } }) })
    const { default: handler } = await import('../api/school/dashboard.js')
    const res = await handler(call(`?classId=${CLASS_ID}`))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })
})

describe('GET /api/school/dashboard (no classId — cross-class "needs you now")', () => {
  function call2() {
    return new Request('https://app.test/api/school/dashboard', { headers: { authorization: 'Bearer jwt' } })
  }

  it('returns 403 for a student JWT', async () => {
    mockSupabase({ user: STUDENT_JWT, routes: [] })
    const { default: handler } = await import('../api/school/dashboard.js')
    const res = await handler(call2())
    expect(res.status).toBe(403)
  })

  it('returns classes and no help query when the teacher has no non-archived classes', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [{ method: 'GET', match: '/rest/v1/classrooms', reply: { body: [] } }] })
    const { default: handler } = await import('../api/school/dashboard.js')
    const res = await handler(call2())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ classes: [], help: [] })
    expect(log.filter((l) => l.url.includes('class_help_requests'))).toHaveLength(0)
  })

  it('scopes the classrooms query to owner + non-archived, and builds the help query from server-read class ids', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [{ id: CLASS_ID, name: 'Room 5' }, { id: OTHER_CLASS_ID, name: 'Room 6' }] } },
        helpRoute([
          { id: 'h1', student_id: S1_ID, classroom_id: CLASS_ID, kind: 'grownup', asks: 1, in_hours: true, created_at: '2026-09-27T09:00:00.000Z', updated_at: '2026-09-27T09:00:00.000Z', class_students: { display_name: 'Ann' } },
          { id: 'h2', student_id: S2_ID, classroom_id: OTHER_CLASS_ID, kind: 'book', asks: 1, in_hours: true, created_at: '2026-09-27T10:00:00.000Z', updated_at: '2026-09-27T10:00:00.000Z', class_students: { display_name: 'Ben' } },
        ]),
      ],
    })
    const { default: handler } = await import('../api/school/dashboard.js')
    const res = await handler(call2())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.classes).toEqual([{ id: CLASS_ID, name: 'Room 5' }, { id: OTHER_CLASS_ID, name: 'Room 6' }])
    // grownup first even though it is not the newest
    expect(body.help.map((h) => h.id)).toEqual(['h1', 'h2'])
    expect(body.help[0]).toMatchObject({ classroom_id: CLASS_ID, class_name: 'Room 5' })
    expect(body.help[1]).toMatchObject({ classroom_id: OTHER_CLASS_ID, class_name: 'Room 6' })

    const classroomsCall = log.find((l) => l.url.includes('/rest/v1/classrooms'))
    expect(classroomsCall.url).toContain(`owner_user_id=eq.${TEACHER.id}`)
    expect(classroomsCall.url).toContain('archived_at=is.null')
    const helpCall = log.find((l) => l.url.includes('/rest/v1/class_help_requests'))
    expect(helpCall.url).toContain(`in.(${CLASS_ID},${OTHER_CLASS_ID})`)
  })

  it('fails closed (503) when the classrooms lookup errors', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({ user: TEACHER, routes: [{ method: 'GET', match: '/rest/v1/classrooms', reply: { status: 500, body: {} } }] })
    const { default: handler } = await import('../api/school/dashboard.js')
    const res = await handler(call2())
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })

  it('fails closed (503) when the cross-class help lookup errors', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({
      user: TEACHER,
      routes: [
        { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [{ id: CLASS_ID, name: 'Room 5' }] } },
        { method: 'GET', match: '/rest/v1/class_help_requests', reply: { status: 500, body: {} } },
      ],
    })
    const { default: handler } = await import('../api/school/dashboard.js')
    const res = await handler(call2())
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })
})

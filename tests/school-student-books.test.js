import { describe, it, expect, beforeEach, vi } from 'vitest'

const URL_ = 'https://example.supabase.co'
const TEACHER = { id: 'teacher-1', app_metadata: {} }
const STUDENT_JWT = { id: 'student-auth-1', app_metadata: { role: 'student' } }
const CLASS_ID = '6f1c1b1e-0000-4000-8000-000000000001'
const STUDENT_ID = '6f1c1b1e-0000-4000-8000-000000000002'
const AUTH_USER_ID = 'auth-kid-1'

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
})

// Copied from tests/school-students.test.js.
// Logs every fetch call ({ method, url, body }) and answers with the first
// matching route ({ method, match, reply }); reply may be a plain
// { status, body } or a function of the just-logged call.
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
  return new Request(`https://app.test/api/school/student-books${query}`, {
    headers: { authorization: 'Bearer jwt' },
  })
}

const classroomRow = {
  id: CLASS_ID, code: 'ABC234', name: 'Room 5', locale: 'en', sign_in_open: false,
  timezone: 'America/New_York', school_hours: {}, archived_at: null,
}
const classroomRoute = { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [classroomRow] } }

const studentRow = (overrides = {}) => ({
  id: STUDENT_ID, display_name: 'Kid', avatar_emoji: '🦊', status: 'active',
  classroom_id: CLASS_ID, auth_user_id: AUTH_USER_ID,
  ...overrides,
})
const studentRoute = (rows) => ({ method: 'GET', match: '/rest/v1/class_students', reply: { body: rows } })

describe('GET /api/school/student-books — class ownership', () => {
  it('returns 404 class_not_found for a non-owner, without querying class_students or user_books', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [{ method: 'GET', match: '/rest/v1/classrooms', reply: { body: [] } }],
    })
    const { default: handler } = await import('../api/school/student-books.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('class_not_found')
    expect(log.filter((l) => l.url.includes('/rest/v1/class_students'))).toHaveLength(0)
    expect(log.filter((l) => l.url.includes('/rest/v1/user_books'))).toHaveLength(0)
  })

  it('returns 403 student_forbidden for a student JWT', async () => {
    mockSupabase({ user: STUDENT_JWT, routes: [classroomRoute, studentRoute([studentRow()])] })
    const { default: handler } = await import('../api/school/student-books.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('student_forbidden')
  })
})

describe('GET /api/school/student-books — student scoping', () => {
  it('returns 404 student_not_found for a student belonging to another class', async () => {
    mockSupabase({
      user: TEACHER,
      routes: [classroomRoute, studentRoute([])], // classroom_id filter excludes it — same as "doesn't exist"
    })
    const { default: handler } = await import('../api/school/student-books.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('student_not_found')
  })

  it('includes removed students — the teacher may still review their work', async () => {
    mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        studentRoute([studentRow({ status: 'removed' })]),
        { method: 'GET', match: '/rest/v1/user_books', reply: { body: [] } },
      ],
    })
    const { default: handler } = await import('../api/school/student-books.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(200)
  })

  it('returns 503 upstream (not 404) when the class_students lookup fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({
      user: TEACHER,
      routes: [classroomRoute, { method: 'GET', match: '/rest/v1/class_students', reply: { status: 500, body: { message: 'down' } } }],
    })
    const { default: handler } = await import('../api/school/student-books.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })
})

describe('GET /api/school/student-books — list', () => {
  it('filters user_books by the student auth_user_id, never a client-sent id, and never selects book_data in full', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        studentRoute([studentRow()]),
        { method: 'GET', match: '/rest/v1/user_books', reply: { body: [] } },
      ],
    })
    const { default: handler } = await import('../api/school/student-books.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}&userId=someone-elses-id`))
    expect(res.status).toBe(200)
    const listCall = log.find((l) => l.url.includes('/rest/v1/user_books'))
    expect(listCall.url).toContain(`user_id=eq.${AUTH_USER_ID}`)
    expect(listCall.url).not.toContain('someone-elses-id')

    const select = new URL(listCall.url).searchParams.get('select')
    const fields = select.split(',')
    expect(fields).not.toContain('*')
    expect(fields).not.toContain('book_data')
  })

  it('returns the student summary and books newest first, with data: URI and non-http covers collapsed to null', async () => {
    mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        studentRoute([studentRow()]),
        {
          method: 'GET', match: '/rest/v1/user_books',
          reply: {
            body: [
              { book_id: 'b1', title: 'Newest', updated_at: '2026-02-01T00:00:00.000Z', cover: 'https://cdn.test/b1.png' },
              { book_id: 'b2', title: 'Has data URI', updated_at: '2026-01-01T00:00:00.000Z', cover: 'data:image/png;base64,AAAA' },
              { book_id: 'b3', title: 'Saved locally only', updated_at: '2025-12-01T00:00:00.000Z', cover: '[saved-locally]' },
              { book_id: 'b4', title: 'No cover', updated_at: '2025-11-01T00:00:00.000Z', cover: null },
            ],
          },
        },
      ],
    })
    const { default: handler } = await import('../api/school/student-books.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.student).toEqual({ id: STUDENT_ID, display_name: 'Kid', avatar_emoji: '🦊' })
    expect(body.books).toEqual([
      { book_id: 'b1', title: 'Newest', updated_at: '2026-02-01T00:00:00.000Z', cover: 'https://cdn.test/b1.png' },
      { book_id: 'b2', title: 'Has data URI', updated_at: '2026-01-01T00:00:00.000Z', cover: null },
      { book_id: 'b3', title: 'Saved locally only', updated_at: '2025-12-01T00:00:00.000Z', cover: null },
      { book_id: 'b4', title: 'No cover', updated_at: '2025-11-01T00:00:00.000Z', cover: null },
    ])
  })

  it('never leaks auth_user_id in the response', async () => {
    mockSupabase({
      user: TEACHER,
      routes: [classroomRoute, studentRoute([studentRow()]), { method: 'GET', match: '/rest/v1/user_books', reply: { body: [] } }],
    })
    const { default: handler } = await import('../api/school/student-books.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(JSON.stringify(await res.json())).not.toContain('auth_user_id')
  })

  it('returns 503 upstream (not an empty list) when the user_books list query fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        studentRoute([studentRow()]),
        { method: 'GET', match: '/rest/v1/user_books', reply: { status: 500, body: { message: 'down' } } },
      ],
    })
    const { default: handler } = await import('../api/school/student-books.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })
})

describe('GET /api/school/student-books — single book', () => {
  it('returns the full book_data for that book, scoped to the student auth_user_id', async () => {
    const book_data = { id: 'b1', title: 'Newest', pages: [{ id: 'p1', text: 'Once upon a time' }] }
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        classroomRoute,
        studentRoute([studentRow()]),
        { method: 'GET', match: '/rest/v1/user_books', reply: { body: [{ book_data }] } },
      ],
    })
    const { default: handler } = await import('../api/school/student-books.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}&bookId=b1`))
    expect(res.status).toBe(200)
    expect((await res.json()).book).toEqual(book_data)
    const bookCall = log.find((l) => l.url.includes('/rest/v1/user_books'))
    expect(bookCall.url).toContain(`user_id=eq.${AUTH_USER_ID}`)
    expect(bookCall.url).toContain('book_id=eq.b1')
  })

  it('returns 404 book_not_found when the book does not exist for that student', async () => {
    mockSupabase({
      user: TEACHER,
      routes: [classroomRoute, studentRoute([studentRow()]), { method: 'GET', match: '/rest/v1/user_books', reply: { body: [] } }],
    })
    const { default: handler } = await import('../api/school/student-books.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}&bookId=missing`))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('book_not_found')
  })

  it('returns 400 bad_request for a bookId longer than 128 characters', async () => {
    mockSupabase({ user: TEACHER, routes: [classroomRoute, studentRoute([studentRow()])] })
    const { default: handler } = await import('../api/school/student-books.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}&bookId=${'x'.repeat(129)}`))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_request')
  })
})

describe('GET /api/school/student-books — rate limit', () => {
  it('returns 429 rate_limited once the hourly cap (300) is exceeded', async () => {
    mockSupabase({
      user: TEACHER,
      routes: [classroomRoute, studentRoute([studentRow()]), { method: 'GET', match: '/rest/v1/user_books', reply: { body: [] } }],
    })
    const { default: handler } = await import('../api/school/student-books.js')
    let last
    for (let i = 0; i < 301; i++) {
      last = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    }
    expect(last.status).toBe(429)
    expect((await last.json()).code).toBe('rate_limited')
  })
})

describe('unhandled errors', () => {
  it('returns 503 upstream when an unexpected error is thrown mid-request', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url)
      if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(TEACHER))
      if (u.includes('/rest/v1/classrooms')) return new Response(JSON.stringify([classroomRow]))
      if (u.includes('/rest/v1/class_students')) throw new Error('network down')
      return new Response('[]')
    })
    const { default: handler } = await import('../api/school/student-books.js')
    const res = await handler(call(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('upstream')
    errSpy.mockRestore()
  })
})

// Legacy (pre-schools) class endpoints: api/classroom.js (teacher create +
// public read) and api/classroom-submit.js (anonymous/parent hand-in).
// Task 9 hardens the class code generator (CSPRNG, not Math.random) and
// makes classroom-submit aware of the new auth-carrying submitters, without
// breaking the anonymous path these endpoints were built for.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const URL_ = 'https://example.supabase.co'
const TEACHER = { id: 'teacher-1', app_metadata: {} }
const STUDENT = { id: 'student-1', app_metadata: { role: 'student' } }

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
})

/// Logs every fetch call ({ method, url, body }) and answers with the first
/// matching route ({ method, match, reply }); reply may be a plain
/// { status, body } or a function of the just-logged call, for stateful
/// (e.g. retry-then-succeed) behaviour. `/auth/v1/user` (verifyJwt) answers
/// with `user` at `authStatus` (default 200) regardless of routes.
function mockSupabase({ authStatus = 200, user, routes }) {
  const log = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url)
    const method = init.method || 'GET'
    const body = init.body ? JSON.parse(init.body) : undefined
    log.push({ method, url: u, body })
    if (u.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify(user ?? {}), { status: authStatus })
    }
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

describe('api/classroom.js', () => {
  it('no longer uses Math.random for class codes', () => {
    const path = fileURLToPath(new URL('../api/classroom.js', import.meta.url))
    const source = fs.readFileSync(path, 'utf8')
    expect(source).not.toContain('Math.random')
  })

  function classroomCall(method, body) {
    return new Request('https://app.test/api/classroom', {
      method,
      headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  it('POST is retired (410, pointer to the new flow) and creates nothing — Stage 4 review I8', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [] })
    const { default: handler } = await import('../api/classroom.js')
    const res = await handler(classroomCall('POST', { name: 'Room 5' }))
    expect(res.status).toBe(410)
    expect(await res.json()).toMatchObject({ code: 'gone', use: '/api/school/classes' })
    expect(log.some((l) => l.method === 'POST' && l.url.includes('/rest/v1/classrooms'))).toBe(false)
  })
})

describe('api/classroom-submit.js', () => {
  const BOOK = { title: 'My Book', pages: [] }

  function submitCall({ token } = {}) {
    return new Request('https://app.test/api/classroom-submit', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ code: 'ABC234', book: BOOK }),
    })
  }

  it('stores user_id when the JWT belongs to a teacher or parent', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [{ code: 'ABC234' }] } },
        { method: 'POST', match: '/rest/v1/submissions', reply: { status: 201, body: [{ id: 'sub-1' }] } },
      ],
    })
    const { default: handler } = await import('../api/classroom-submit.js')
    const res = await handler(submitCall({ token: 'jwt' }))
    expect(res.status).toBe(201)
    const insert = log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/submissions'))
    expect(insert.body.user_id).toBe(TEACHER.id)
  })

  it('omits user_id for an anonymous submit with no JWT', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [
        { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [{ code: 'ABC234' }] } },
        { method: 'POST', match: '/rest/v1/submissions', reply: { status: 201, body: [{ id: 'sub-2' }] } },
      ],
    })
    const { default: handler } = await import('../api/classroom-submit.js')
    const res = await handler(submitCall())
    expect(res.status).toBe(201)
    const insert = log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/submissions'))
    expect(insert.body.user_id).toBeUndefined()
    // No Authorization header means verifyJwt must short-circuit locally —
    // it must never call out to /auth/v1/user for an anonymous request.
    expect(log.some((l) => l.url.endsWith('/auth/v1/user'))).toBe(false)
  })

  it('treats an invalid/expired JWT as anonymous rather than blocking the submit', async () => {
    mockSupabase({
      authStatus: 401,
      user: {},
      routes: [
        { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [{ code: 'ABC234' }] } },
        { method: 'POST', match: '/rest/v1/submissions', reply: { status: 201, body: [{ id: 'sub-3' }] } },
      ],
    })
    const { default: handler } = await import('../api/classroom-submit.js')
    const res = await handler(submitCall({ token: 'garbage' }))
    expect(res.status).toBe(201)
  })

  it('rejects a student JWT with 403 use_hand_in', async () => {
    const log = mockSupabase({ user: STUDENT, routes: [] })
    const { default: handler } = await import('../api/classroom-submit.js')
    const res = await handler(submitCall({ token: 'jwt' }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('use_hand_in')
    // A rejected student submit must never reach the submissions table.
    expect(log.some((l) => l.method === 'POST' && l.url.includes('/rest/v1/submissions'))).toBe(false)
  })
})

describe('api/classroom-submit.js sunset (review §7.22)', () => {
  const call = (token) => new Request('https://app.test/api/classroom-submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ code: 'ABC234', book: { title: 'B', pages: [] } }),
  })
  const routes = [
    { method: 'GET', match: '/rest/v1/classrooms', reply: { body: [{ code: 'ABC234' }] } },
    { method: 'POST', match: '/rest/v1/submissions', reply: { status: 201, body: [{ id: 'sub-1' }] } },
  ]
  afterEach(() => { delete process.env.LEGACY_SUBMIT_SUNSET })

  it('refuses an anonymous submit after the sunset, without writing', async () => {
    process.env.LEGACY_SUBMIT_SUNSET = '2020-01-01T00:00:00Z'
    const log = mockSupabase({ authStatus: 401, user: {}, routes })
    const { default: handler } = await import('../api/classroom-submit.js')
    const res = await handler(call())
    expect(res.status).toBe(410)
    expect((await res.json()).code).toBe('sign_in_required')
    expect(log.some((l) => l.method === 'POST' && l.url.includes('/rest/v1/submissions'))).toBe(false)
  })

  it('still accepts a signed-in parent after the sunset', async () => {
    process.env.LEGACY_SUBMIT_SUNSET = '2020-01-01T00:00:00Z'
    mockSupabase({ user: TEACHER, routes })
    const { default: handler } = await import('../api/classroom-submit.js')
    expect((await handler(call('jwt'))).status).toBe(201)
  })

  it('accepts an anonymous submit before the sunset', async () => {
    process.env.LEGACY_SUBMIT_SUNSET = '2999-01-01T00:00:00Z'
    mockSupabase({ authStatus: 401, user: {}, routes })
    const { default: handler } = await import('../api/classroom-submit.js')
    expect((await handler(call())).status).toBe(201)
  })
})

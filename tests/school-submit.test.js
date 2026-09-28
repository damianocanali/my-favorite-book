import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  TEACHER, STUDENT_USER, CLASS_ID, STUDENT_ID, ASSIGN_ID, SUB_ID,
  setEnv, mockSupabase, studentSelfRoute, req, err500,
} from './school-mock.js'

beforeEach(() => {
  vi.resetModules()
  setEnv()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-27T12:00:00.000Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const load = async () => (await import('../api/school/submit.js')).default
const PNG = 'data:image/png;base64,AAAA'

const assignmentRoute = (over = {}) => ({
  method: 'GET', match: '/rest/v1/assignments',
  reply: { body: [{ id: ASSIGN_ID, status: 'published', due_at: '2026-09-30T00:00:00.000Z', allow_late: true, ...over }] },
})
const bookRoute = (bookData = { title: 'Moon', coverImage: PNG, pages: [{ text: 'hi', illustrationData: 'https://cdn.test/a.png' }] }) => ({
  method: 'GET', match: '/rest/v1/user_books', reply: { body: [{ title: 'Moon', book_data: bookData }] },
})
const rpcRoute = (version = 1, submitted_at = '2026-09-27T12:00:00.000Z') => ({
  method: 'POST', match: '/rest/v1/rpc/school_submit', reply: { body: { id: SUB_ID, version, submitted_at } },
})
const routes = (over = {}) => [
  studentSelfRoute,
  over.assignment ?? assignmentRoute(),
  over.book ?? bookRoute(),
  over.rpc ?? rpcRoute(),
]
const submit = (body = { assignmentId: ASSIGN_ID, bookId: 'book-1' }) => req('submit', { method: 'POST', body })

describe('POST /api/school/submit', () => {
  it('hands in the student\'s own book, snapshotted, via the atomic upsert RPC', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: routes() })
    const res = await (await load())(submit())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: SUB_ID, version: 1, submitted_at: '2026-09-27T12:00:00.000Z', late: false })

    const a = log.find((l) => l.url.includes('/rest/v1/assignments'))
    expect(a.url).toContain(`id=eq.${ASSIGN_ID}`)
    expect(a.url).toContain(`classroom_id=eq.${CLASS_ID}`)

    // The book is read from the database by the caller's OWN auth id.
    const b = log.find((l) => l.url.includes('/rest/v1/user_books'))
    expect(b.url).toContain(`user_id=eq.${STUDENT_USER.id}`)
    expect(b.url).toContain('book_id=eq.book-1')

    const rpc = log.find((l) => l.url.includes('school_submit'))
    expect(rpc.body).toEqual({
      p_classroom_id: CLASS_ID, p_assignment_id: ASSIGN_ID, p_student_id: STUDENT_ID, p_user_id: STUDENT_USER.id,
      p_book_id: 'book-1', p_book_title: 'Moon',
      p_book_snapshot: { title: 'Moon', coverImage: null, pages: [{ text: 'hi', illustrationData: 'https://cdn.test/a.png' }] },
    })
  })

  it('ignores a client-sent book body and user id', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: routes() })
    await (await load())(submit({ assignmentId: ASSIGN_ID, bookId: 'book-1', book: { title: 'HACK' }, userId: 'someone-else', studentId: 'x' }))
    const rpc = log.find((l) => l.url.includes('school_submit'))
    expect(rpc.body.p_book_snapshot.title).toBe('Moon')
    expect(rpc.body.p_user_id).toBe(STUDENT_USER.id)
    expect(rpc.body.p_student_id).toBe(STUDENT_ID)
    expect(log.find((l) => l.url.includes('/rest/v1/user_books')).url).not.toContain('someone-else')
  })

  it('returns the bumped version on a resubmission', async () => {
    mockSupabase({ user: STUDENT_USER, routes: routes({ rpc: rpcRoute(3) }) })
    const body = await (await (await load())(submit())).json()
    expect(body.version).toBe(3)
  })

  it('marks a hand-in after the due date as late when late work is allowed', async () => {
    mockSupabase({ user: STUDENT_USER, routes: routes({ assignment: assignmentRoute({ due_at: '2026-09-26T00:00:00.000Z' }) }) })
    const res = await (await load())(submit())
    expect(res.status).toBe(200)
    expect((await res.json()).late).toBe(true)
  })

  it('409 assignment_closed for a closed assignment, without handing in', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: routes({ assignment: assignmentRoute({ status: 'closed' }) }) })
    const res = await (await load())(submit())
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('assignment_closed')
    expect(log.some((l) => l.url.includes('school_submit'))).toBe(false)
  })

  it('409 past_due after the due date when late work is not allowed', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: routes({ assignment: assignmentRoute({ due_at: '2026-09-26T00:00:00.000Z', allow_late: false }) }) })
    const res = await (await load())(submit())
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('past_due')
    expect(log.some((l) => l.url.includes('school_submit'))).toBe(false)
  })

  it('404 assignment_not_found for a draft (students cannot see drafts)', async () => {
    mockSupabase({ user: STUDENT_USER, routes: routes({ assignment: assignmentRoute({ status: 'draft' }) }) })
    const res = await (await load())(submit())
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('assignment_not_found')
  })

  it('404 assignment_not_found for another class\'s assignment', async () => {
    mockSupabase({ user: STUDENT_USER, routes: routes({ assignment: { method: 'GET', match: '/rest/v1/assignments', reply: { body: [] } } }) })
    const res = await (await load())(submit())
    expect(res.status).toBe(404)
  })

  it('404 book_not_found when the book is not the student\'s', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: routes({ book: { method: 'GET', match: '/rest/v1/user_books', reply: { body: [] } } }) })
    const res = await (await load())(submit())
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('book_not_found')
    expect(log.some((l) => l.url.includes('school_submit'))).toBe(false)
  })

  it('413 book_too_large when the snapshot is over budget', async () => {
    mockSupabase({ user: STUDENT_USER, routes: routes({ book: bookRoute({ pages: [{ text: 'x'.repeat(250_000) }] }) }) })
    const res = await (await load())(submit())
    expect(res.status).toBe(413)
    expect((await res.json()).code).toBe('book_too_large')
  })

  it.each([
    ['bad assignmentId', { assignmentId: 'nope', bookId: 'b' }],
    ['missing bookId', { assignmentId: ASSIGN_ID }],
    ['overlong bookId', { assignmentId: ASSIGN_ID, bookId: 'x'.repeat(129) }],
  ])('400 bad_request for %s', async (_, body) => {
    mockSupabase({ user: STUDENT_USER, routes: routes() })
    const res = await (await load())(submit(body))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_request')
  })

  it('403s a teacher', async () => {
    mockSupabase({ user: TEACHER, routes: routes() })
    const res = await (await load())(submit())
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('not_a_student')
  })

  it('405 for GET', async () => {
    mockSupabase({ user: STUDENT_USER, routes: routes() })
    const res = await (await load())(req('submit'))
    expect(res.status).toBe(405)
  })

  it.each([['assignment', '/rest/v1/assignments'], ['book', '/rest/v1/user_books']])(
    'fails closed (503, nothing written) when the %s read errors', async (key, match) => {
      const log = mockSupabase({ user: STUDENT_USER, routes: routes({ [key]: err500('GET', match) }) })
      const res = await (await load())(submit())
      expect(res.status).toBe(503)
      expect(log.some((l) => l.url.includes('school_submit'))).toBe(false)
    })

  it('502 when the upsert fails', async () => {
    mockSupabase({ user: STUDENT_USER, routes: routes({ rpc: err500('POST', '/rest/v1/rpc/school_submit') }) })
    const res = await (await load())(submit())
    expect(res.status).toBe(502)
  })

  it('never returns auth ids', async () => {
    mockSupabase({ user: STUDENT_USER, routes: routes() })
    const text = JSON.stringify(await (await (await load())(submit())).json())
    expect(text).not.toContain('auth_user_id')
    expect(text).not.toContain(STUDENT_USER.id)
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  TEACHER, STUDENT_USER, CLASS_ID, STUDENT_ID, STUDENT2_ID, ASSIGN_ID, SUB_ID, FEEDBACK_ID,
  setEnv, mockSupabase, ownerRoute, notOwnerRoute, studentSelfRoute, req, err500,
} from './school-mock.js'

beforeEach(() => {
  vi.resetModules()
  setEnv()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

const load = async () => (await import('../api/school/submissions.js')).default
const SNAP = { title: 'Moon', pages: [{ text: 'hi' }] }
const feedbackRows = [
  { id: FEEDBACK_ID, comment: 'Lovely!', sticker: 'star', created_at: '2026-09-27T10:00:00.000Z', seen_at: null, author_user_id: 'teacher-1' },
]

describe('teacher GET /api/school/submissions?classId=&assignmentId=', () => {
  const routes = (over = {}) => [
    ownerRoute,
    over.assignment ?? { method: 'GET', match: '/rest/v1/assignments', reply: { body: [{ id: ASSIGN_ID, title: 'My pet', status: 'published', due_at: '2026-09-25T00:00:00.000Z', allow_late: true }] } },
    over.students ?? { method: 'GET', match: '/rest/v1/class_students?classroom_id=eq.', reply: { body: [
      { id: STUDENT_ID, display_name: 'Ann', avatar_emoji: '🦊', auth_user_id: 'auth-ann' },
      { id: STUDENT2_ID, display_name: 'Ben', avatar_emoji: '🐨', auth_user_id: 'auth-ben' },
    ] } },
    over.subs ?? { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [
      { id: SUB_ID, student_id: STUDENT_ID, version: 2, submitted_at: '2026-09-26T00:00:00.000Z', book_title: 'Moon', class_students: { display_name: 'Ann', avatar_emoji: '🦊', auth_user_id: 'auth-ann' } },
    ] } },
    over.feedback ?? { method: 'GET', match: '/rest/v1/submission_feedback', reply: { body: [{ submission_id: SUB_ID }, { submission_id: SUB_ID }] } },
  ]
  const q = `?classId=${CLASS_ID}&assignmentId=${ASSIGN_ID}`

  it('lists hand-ins plus students who have not started', async () => {
    const log = mockSupabase({ user: TEACHER, routes: routes() })
    const res = await (await load())(req('submissions', { query: q }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assignment).toEqual({ id: ASSIGN_ID, title: 'My pet', status: 'published', due_at: '2026-09-25T00:00:00.000Z', allow_late: true })
    expect(body.submissions).toEqual([
      { id: SUB_ID, student_id: STUDENT_ID, display_name: 'Ann', avatar_emoji: '🦊', status: 'handed_in', version: 2, submitted_at: '2026-09-26T00:00:00.000Z', late: true, book_title: 'Moon', feedback_count: 2 },
      { id: null, student_id: STUDENT2_ID, display_name: 'Ben', avatar_emoji: '🐨', status: 'not_started', version: null, submitted_at: null, late: false, book_title: null, feedback_count: 0 },
    ])
    const a = log.find((l) => l.url.includes('/rest/v1/assignments'))
    expect(a.url).toContain(`classroom_id=eq.${CLASS_ID}`)
    const s = log.find((l) => l.url.includes('/rest/v1/class_submissions'))
    expect(s.url).toContain(`assignment_id=eq.${ASSIGN_ID}`)
    expect(s.url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(log.filter((l) => l.url.includes('submission_feedback'))).toHaveLength(1)
  })

  it('keeps a removed student\'s hand-in (named from the embed)', async () => {
    mockSupabase({ user: TEACHER, routes: routes({ students: { method: 'GET', match: '/rest/v1/class_students?classroom_id=eq.', reply: { body: [] } } }) })
    const body = await (await (await load())(req('submissions', { query: q }))).json()
    expect(body.submissions).toHaveLength(1)
    expect(body.submissions[0]).toMatchObject({ student_id: STUDENT_ID, display_name: 'Ann', status: 'handed_in' })
  })

  it('404 assignment_not_found for an assignment outside the class', async () => {
    mockSupabase({ user: TEACHER, routes: routes({ assignment: { method: 'GET', match: '/rest/v1/assignments', reply: { body: [] } } }) })
    const res = await (await load())(req('submissions', { query: q }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('assignment_not_found')
  })

  it('404 for another teacher\'s class', async () => {
    mockSupabase({ user: TEACHER, routes: [notOwnerRoute] })
    const res = await (await load())(req('submissions', { query: q }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('class_not_found')
  })

  it('403 for a student', async () => {
    mockSupabase({ user: STUDENT_USER, routes: routes() })
    const res = await (await load())(req('submissions', { query: q }))
    expect(res.status).toBe(403)
  })

  it('400 when neither assignmentId nor id is given', async () => {
    mockSupabase({ user: TEACHER, routes: routes() })
    const res = await (await load())(req('submissions', { query: `?classId=${CLASS_ID}` }))
    expect(res.status).toBe(400)
  })

  it.each([
    ['assignment', '/rest/v1/assignments'], ['students', '/rest/v1/class_students?classroom_id=eq.'],
    ['subs', '/rest/v1/class_submissions'], ['feedback', '/rest/v1/submission_feedback'],
  ])('fails closed (503) when the %s read errors', async (key, match) => {
    mockSupabase({ user: TEACHER, routes: routes({ [key]: err500('GET', match) }) })
    const res = await (await load())(req('submissions', { query: q }))
    expect(res.status).toBe(503)
  })

  it('never returns auth_user_id', async () => {
    mockSupabase({ user: TEACHER, routes: routes() })
    const text = JSON.stringify(await (await (await load())(req('submissions', { query: q }))).json())
    expect(text).not.toContain('auth_user_id')
    expect(text).not.toContain('auth-ann')
  })
})

describe('teacher GET /api/school/submissions?classId=&id=', () => {
  const subRoute = { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [{
    id: SUB_ID, assignment_id: ASSIGN_ID, student_id: STUDENT_ID, version: 1, submitted_at: '2026-09-24T00:00:00.000Z',
    book_id: 'book-1', book_title: 'Moon', book_snapshot: SNAP, user_id: 'auth-ann',
    class_students: { display_name: 'Ann', avatar_emoji: '🦊' }, assignments: { due_at: '2026-09-25T00:00:00.000Z' },
  }] } }
  const fbRoute = { method: 'GET', match: '/rest/v1/submission_feedback', reply: { body: feedbackRows } }
  const q = `?classId=${CLASS_ID}&id=${SUB_ID}`

  it('returns one submission with its snapshot and feedback', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, subRoute, fbRoute] })
    const res = await (await load())(req('submissions', { query: q }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      submission: {
        id: SUB_ID, assignment_id: ASSIGN_ID, student_id: STUDENT_ID, display_name: 'Ann', avatar_emoji: '🦊',
        version: 1, submitted_at: '2026-09-24T00:00:00.000Z', late: false, book_id: 'book-1', book_title: 'Moon', book_snapshot: SNAP,
      },
      feedback: [{ id: FEEDBACK_ID, comment: 'Lovely!', sticker: 'star', created_at: '2026-09-27T10:00:00.000Z', seen_at: null }],
    })
    const s = log.find((l) => l.url.includes('/rest/v1/class_submissions'))
    expect(s.url).toContain(`id=eq.${SUB_ID}`)
    expect(s.url).toContain(`classroom_id=eq.${CLASS_ID}`)
  })

  it('404 submission_not_found for a hand-in in another class', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [] } }, fbRoute] })
    const res = await (await load())(req('submissions', { query: q }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('submission_not_found')
  })

  it('fails closed (503) when the feedback read errors', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, subRoute, err500('GET', '/rest/v1/submission_feedback')] })
    const res = await (await load())(req('submissions', { query: q }))
    expect(res.status).toBe(503)
  })
})

describe('student GET /api/school/submissions?id=', () => {
  const subRoute = { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [{ id: SUB_ID, book_snapshot: SNAP }] } }
  const fbRoute = { method: 'GET', match: '/rest/v1/submission_feedback', reply: { body: feedbackRows } }

  it('returns the student\'s own snapshot and feedback, scoped by student id', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, subRoute, fbRoute] })
    const res = await (await load())(req('submissions', { query: `?id=${SUB_ID}` }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      book_snapshot: SNAP,
      feedback: [{ id: FEEDBACK_ID, comment: 'Lovely!', sticker: 'star', created_at: '2026-09-27T10:00:00.000Z', seen_at: null }],
    })
    const s = log.find((l) => l.url.includes('/rest/v1/class_submissions'))
    expect(s.url).toContain(`id=eq.${SUB_ID}`)
    expect(s.url).toContain(`student_id=eq.${STUDENT_ID}`)
  })

  it('404 for someone else\'s submission', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [] } }, fbRoute] })
    const res = await (await load())(req('submissions', { query: `?id=${SUB_ID}` }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('submission_not_found')
  })

  it('400 for a malformed id', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute] })
    const res = await (await load())(req('submissions', { query: '?id=nope' }))
    expect(res.status).toBe(400)
  })

  it('403 for a teacher without classId', async () => {
    mockSupabase({ user: TEACHER, routes: [] })
    const res = await (await load())(req('submissions', { query: `?id=${SUB_ID}` }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('not_a_student')
  })

  it('fails closed (503) when the submission read errors', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, err500('GET', '/rest/v1/class_submissions'), fbRoute] })
    const res = await (await load())(req('submissions', { query: `?id=${SUB_ID}` }))
    expect(res.status).toBe(503)
  })

  it('never exposes the author id', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, subRoute, fbRoute] })
    const text = JSON.stringify(await (await (await load())(req('submissions', { query: `?id=${SUB_ID}` }))).json())
    expect(text).not.toContain('author_user_id')
    expect(text).not.toContain('auth_user_id')
  })
})

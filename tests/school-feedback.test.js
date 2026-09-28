import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  TEACHER, STUDENT_USER, CLASS_ID, STUDENT_ID, SUB_ID, FEEDBACK_ID,
  setEnv, mockSupabase, ownerRoute, notOwnerRoute, studentSelfRoute, req, err500,
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

const load = async () => (await import('../api/school/feedback.js')).default
const post = (body) => req('feedback', { method: 'POST', body })

describe('teacher POST /api/school/feedback', () => {
  const subRoute = { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [{ id: SUB_ID }] } }
  const insertRoute = {
    method: 'POST', match: '/rest/v1/submission_feedback',
    reply: (call) => ({ body: [{ id: FEEDBACK_ID, created_at: '2026-09-27T12:00:00.000Z', seen_at: null, comment: null, sticker: null, ...call.body }] }),
  }
  const routes = [ownerRoute, subRoute, insertRoute]

  it('creates feedback with a trimmed comment and a sticker, and returns the row', async () => {
    const log = mockSupabase({ user: TEACHER, routes })
    const res = await (await load())(post({ classId: CLASS_ID, submissionId: SUB_ID, comment: '  Great work!  ', sticker: 'rocket' }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      feedback: { id: FEEDBACK_ID, submission_id: SUB_ID, comment: 'Great work!', sticker: 'rocket', created_at: '2026-09-27T12:00:00.000Z', seen_at: null },
    })
    const s = log.find((l) => l.url.includes('/rest/v1/class_submissions'))
    expect(s.url).toContain(`id=eq.${SUB_ID}`)
    expect(s.url).toContain(`classroom_id=eq.${CLASS_ID}`)
    const ins = log.find((l) => l.method === 'POST' && l.url.includes('submission_feedback'))
    expect(ins.body).toEqual({ submission_id: SUB_ID, author_user_id: TEACHER.id, comment: 'Great work!', sticker: 'rocket' })
  })

  it('accepts a sticker alone and a comment alone', async () => {
    mockSupabase({ user: TEACHER, routes })
    expect((await (await load())(post({ classId: CLASS_ID, submissionId: SUB_ID, sticker: 'rainbow' }))).status).toBe(201)
    expect((await (await load())(post({ classId: CLASS_ID, submissionId: SUB_ID, comment: 'Nice' }))).status).toBe(201)
  })

  it.each([
    ['neither comment nor sticker', {}],
    ['a whitespace-only comment and no sticker', { comment: '   ' }],
    ['a comment over 500 chars', { comment: 'x'.repeat(501) }],
    ['an unknown sticker', { sticker: 'skull' }],
    ['a non-string comment', { comment: 42 }],
    ['a malformed submissionId', { submissionId: 'nope', sticker: 'star' }],
  ])('400 bad_request for %s', async (_, fields) => {
    const log = mockSupabase({ user: TEACHER, routes })
    const res = await (await load())(post({ classId: CLASS_ID, submissionId: SUB_ID, ...fields }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('bad_request')
    expect(log.some((l) => l.method === 'POST' && l.url.includes('submission_feedback'))).toBe(false)
  })

  it('404 submission_not_found for a submission in another class', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [] } }, insertRoute] })
    const res = await (await load())(post({ classId: CLASS_ID, submissionId: SUB_ID, sticker: 'star' }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('submission_not_found')
    expect(log.some((l) => l.method === 'POST' && l.url.includes('submission_feedback'))).toBe(false)
  })

  it('404 for another teacher\'s class', async () => {
    mockSupabase({ user: TEACHER, routes: [notOwnerRoute] })
    const res = await (await load())(post({ classId: CLASS_ID, submissionId: SUB_ID, sticker: 'star' }))
    expect(res.status).toBe(404)
  })

  it('403 for a student', async () => {
    mockSupabase({ user: STUDENT_USER, routes })
    const res = await (await load())(post({ classId: CLASS_ID, submissionId: SUB_ID, sticker: 'star' }))
    expect(res.status).toBe(403)
  })

  it('fails closed (503) when the submission lookup errors', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, err500('GET', '/rest/v1/class_submissions'), insertRoute] })
    const res = await (await load())(post({ classId: CLASS_ID, submissionId: SUB_ID, sticker: 'star' }))
    expect(res.status).toBe(503)
    expect(log.some((l) => l.method === 'POST' && l.url.includes('submission_feedback'))).toBe(false)
  })

  it('502 when the insert fails', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, subRoute, err500('POST', '/rest/v1/submission_feedback')] })
    const res = await (await load())(post({ classId: CLASS_ID, submissionId: SUB_ID, sticker: 'star' }))
    expect(res.status).toBe(502)
  })
})

describe('student POST /api/school/feedback {id} (mark seen)', () => {
  const lookup = (studentId = STUDENT_ID) => ({
    method: 'GET', match: '/rest/v1/submission_feedback', reply: { body: [{ id: FEEDBACK_ID, class_submissions: { student_id: studentId } }] },
  })
  const patchRoute = { method: 'PATCH', match: '/rest/v1/submission_feedback', reply: { body: [] } }

  it('marks the student\'s own feedback seen', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, lookup(), patchRoute] })
    const res = await (await load())(post({ id: FEEDBACK_ID }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const p = log.find((l) => l.method === 'PATCH')
    expect(p.url).toContain(`id=eq.${FEEDBACK_ID}`)
    expect(p.url).toContain('seen_at=is.null')
    expect(p.body).toEqual({ seen_at: '2026-09-27T12:00:00.000Z' })
  })

  it('404 for feedback on someone else\'s submission, without writing', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, lookup('another-student'), patchRoute] })
    const res = await (await load())(post({ id: FEEDBACK_ID }))
    expect(res.status).toBe(404)
    expect((await res.json()).code).toBe('not_found')
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })

  it('404 for a malformed or missing id', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, lookup(), patchRoute] })
    expect((await (await load())(post({ id: 'nope' }))).status).toBe(404)
  })

  it('403 not_a_student for a teacher without classId', async () => {
    mockSupabase({ user: TEACHER, routes: [] })
    const res = await (await load())(post({ id: FEEDBACK_ID }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('not_a_student')
  })

  it('fails closed (503) when the lookup errors', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, err500('GET', '/rest/v1/submission_feedback'), patchRoute] })
    const res = await (await load())(post({ id: FEEDBACK_ID }))
    expect(res.status).toBe(503)
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })

  it('405 for GET', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [] })
    expect((await (await load())(req('feedback'))).status).toBe(405)
  })
})

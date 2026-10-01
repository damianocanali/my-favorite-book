// Worksheet assignments through the API (migration 023): create/update
// with a worksheet, the student's list, a worksheet hand-in, and reading
// the answers back — with the auth matrix (a student reads only their own,
// a teacher only their own class's).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  TEACHER, STUDENT_USER, CLASS_ID, STUDENT_ID, ASSIGN_ID, SUB_ID,
  setEnv, mockSupabase, ownerRoute, notOwnerRoute, studentSelfRoute, req,
} from './school-mock.js'
import { boxIds, getTemplate } from '../lib/school/worksheets.js'

beforeEach(() => {
  vi.resetModules()
  setEnv()
  delete process.env.OPENAI_API_KEY
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-27T12:00:00.000Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete process.env.OPENAI_API_KEY
})

const loadAssignments = async () => (await import('../api/school/assignments.js')).default
const loadSubmit = async () => (await import('../api/school/submit.js')).default
const loadSubmissions = async () => (await import('../api/school/submissions.js')).default

const SEQ_PROMPTS = { first: 'First…', next: 'Next…', then: 'Then…', last: 'Last…' }
const SEQ = { templateId: 'sequence', prompts: SEQ_PROMPTS }
const row = (over = {}) => ({
  id: ASSIGN_ID, classroom_id: CLASS_ID, title: 'My morning', prompt: 'My morning', due_at: null, status: 'published',
  allow_late: true, created_at: '2026-09-20T00:00:00.000Z', updated_at: '2026-09-20T00:00:00.000Z',
  kind: 'worksheet', worksheet: SEQ, ...over,
})

describe('teacher POST: a worksheet assignment', () => {
  const insert = { method: 'POST', match: '/rest/v1/assignments', reply: (call) => ({ status: 201, body: [row(call.body)] }) }

  it('stores kind + the cleaned worksheet; the instructions line falls back to the title', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, insert] })
    const res = await (await loadAssignments())(req('assignments', { method: 'POST', body: {
      classId: CLASS_ID, title: ' My morning ', kind: 'worksheet', worksheet: { templateId: 'sequence', prompts: { ...SEQ_PROMPTS, first: ' First… ' } },
    } }))
    expect(res.status).toBe(201)
    const ins = log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/assignments'))
    expect(ins.body).toMatchObject({ title: 'My morning', prompt: 'My morning', kind: 'worksheet', worksheet: SEQ, status: 'draft' })
    expect((await res.json()).assignment).toMatchObject({ kind: 'worksheet', worksheet: SEQ })
  })

  it('keeps the teacher\'s own instructions line when sent', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, insert] })
    await (await loadAssignments())(req('assignments', { method: 'POST', body: { classId: CLASS_ID, title: 'T', prompt: 'Use full sentences.', kind: 'worksheet', worksheet: SEQ } }))
    expect(log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/assignments')).body.prompt).toBe('Use full sentences.')
  })

  it.each([
    ['an unknown kind', { kind: 'poster', worksheet: SEQ }],
    ['a worksheet with no worksheet', { kind: 'worksheet' }],
    ['an unknown template', { kind: 'worksheet', worksheet: { templateId: 'nope', prompts: {} } }],
    ['a missing box prompt', { kind: 'worksheet', worksheet: { templateId: 'sequence', prompts: { first: 'a' } } }],
    ['an unknown box', { kind: 'worksheet', worksheet: { templateId: 'sequence', prompts: { ...SEQ_PROMPTS, x: 'y' } } }],
    ['a prompt over 300', { kind: 'worksheet', worksheet: { templateId: 'sequence', prompts: { ...SEQ_PROMPTS, last: 'x'.repeat(301) } } }],
    ['a book carrying a worksheet', { prompt: 'Write.', worksheet: SEQ }],
  ])('400 for %s, nothing written', async (_, extra) => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, insert] })
    const res = await (await loadAssignments())(req('assignments', { method: 'POST', body: { classId: CLASS_ID, title: 'T', ...extra } }))
    expect(res.status).toBe(400)
    expect(log.some((l) => l.method === 'POST' && l.url.includes('/rest/v1/assignments'))).toBe(false)
  })

  it('a book assignment is unchanged: kind book, no worksheet', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, insert] })
    await (await loadAssignments())(req('assignments', { method: 'POST', body: { classId: CLASS_ID, title: 'T', prompt: 'Write.' } }))
    expect(log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/assignments')).body).toMatchObject({ kind: 'book', worksheet: null })
  })

  it('another teacher\'s class: nothing written', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [notOwnerRoute, insert] })
    const res = await (await loadAssignments())(req('assignments', { method: 'POST', body: { classId: CLASS_ID, title: 'T', kind: 'worksheet', worksheet: SEQ } }))
    expect(res.status).toBeGreaterThanOrEqual(403)
    expect(log.some((l) => l.method === 'POST' && l.url.includes('/rest/v1/assignments'))).toBe(false)
  })
})

describe('teacher PATCH: a worksheet assignment', () => {
  const current = (over) => ({ method: 'GET', match: '/rest/v1/assignments', reply: { body: [row(over)] } })
  const patch = { method: 'PATCH', match: '/rest/v1/assignments', reply: (call) => ({ body: [row(call.body)] }) }
  const send = (body) => req('assignments', { method: 'PATCH', body: { classId: CLASS_ID, id: ASSIGN_ID, ...body } })

  it('rewords prompts any time (hand-ins keep the prompts they answered)', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, current(), patch] })
    const res = await (await loadAssignments())(send({ worksheet: { templateId: 'sequence', prompts: { ...SEQ_PROMPTS, last: 'Finally…' } } }))
    expect(res.status).toBe(200)
    const p = log.find((l) => l.method === 'PATCH')
    expect(p.body.worksheet.prompts.last).toBe('Finally…')
    expect(p.url).not.toContain('status=eq.')
  })

  it('swaps the template only while a draft, guarded on the draft status', async () => {
    let log = mockSupabase({ user: TEACHER, routes: [ownerRoute, current(), patch] })
    const story = { templateId: 'beginning_middle_end', prompts: { beginning: 'a', middle: 'b', end: 'c' } }
    let res = await (await loadAssignments())(send({ worksheet: story }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('template_locked')
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)

    vi.resetModules()
    log = mockSupabase({ user: TEACHER, routes: [ownerRoute, current({ status: 'draft' }), patch] })
    res = await (await loadAssignments())(send({ worksheet: story }))
    expect(res.status).toBe(200)
    expect(log.find((l) => l.method === 'PATCH').url).toContain('status=eq.draft')
  })

  it('never changes kind; a book can\'t take a worksheet', async () => {
    let log = mockSupabase({ user: TEACHER, routes: [ownerRoute, current(), patch] })
    let res = await (await loadAssignments())(send({ kind: 'book', title: 'x' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('kind_locked')
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)

    vi.resetModules()
    log = mockSupabase({ user: TEACHER, routes: [ownerRoute, current({ kind: 'book', worksheet: null }), patch] })
    res = await (await loadAssignments())(send({ worksheet: SEQ }))
    expect(res.status).toBe(400)
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })
})

describe('student GET: the worksheet definition comes with the assignment', () => {
  it('kind and worksheet on each assignment', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [
      studentSelfRoute,
      { method: 'GET', match: '/rest/v1/assignments', reply: { body: [row()] } },
      { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [] } },
    ] })
    const res = await (await loadAssignments())(req('assignments'))
    const body = await res.json()
    expect(body.assignments[0]).toMatchObject({ kind: 'worksheet', worksheet: SEQ })
  })
})

describe('POST /api/school/submit: a worksheet hand-in', () => {
  const assignment = (over) => ({ method: 'GET', match: '/rest/v1/assignments', reply: { body: [row(over)] } })
  const rpc = { method: 'POST', match: '/rest/v1/rpc/school_submit', reply: { body: { id: SUB_ID, version: 1, submitted_at: '2026-09-27T12:00:00.000Z', was_returned: false } } }
  const send = (body) => req('submit', { method: 'POST', body: { assignmentId: ASSIGN_ID, ...body } })

  it('hands in the answers, frozen with the prompts, never reading user_books', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, assignment(), rpc] })
    const res = await (await loadSubmit())(send({ answers: { first: ' Woke up. ', then: 'Ate.', next: '' } }))
    expect(res.status).toBe(200)
    expect(log.some((l) => l.url.includes('/rest/v1/user_books'))).toBe(false)
    const call = log.find((l) => l.url.includes('school_submit'))
    expect(call.body).toEqual({
      p_classroom_id: CLASS_ID, p_assignment_id: ASSIGN_ID, p_student_id: STUDENT_ID, p_user_id: STUDENT_USER.id,
      p_book_id: `worksheet:${ASSIGN_ID}`, p_book_title: 'My morning',
      p_book_snapshot: {
        kind: 'worksheet', templateId: 'sequence',
        boxes: boxIds(getTemplate('sequence')).map((id) => ({ id, prompt: SEQ_PROMPTS[id] })),
        answers: { first: 'Woke up.', then: 'Ate.' },
      },
    })
  })

  it('a worksheet takes answers, a book takes a book (409 wrong_kind); never both (400)', async () => {
    let log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, assignment(), rpc] })
    let res = await (await loadSubmit())(send({ bookId: 'book-1' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('wrong_kind')
    expect(log.some((l) => l.url.includes('school_submit'))).toBe(false)

    vi.resetModules()
    log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, assignment({ kind: 'book', worksheet: null }), rpc] })
    res = await (await loadSubmit())(send({ answers: { first: 'x' } }))
    expect(res.status).toBe(409)
    expect(log.some((l) => l.url.includes('school_submit'))).toBe(false)

    vi.resetModules()
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, assignment(), rpc] })
    res = await (await loadSubmit())(send({ answers: { first: 'x' }, bookId: 'book-1' }))
    expect(res.status).toBe(400)
  })

  it.each([
    ['an unknown box', { nope: 'x' }, 400, 'bad_request'],
    ['nothing written', { first: '  ' }, 400, 'empty_worksheet'],
    ['an answer over 2000', { first: 'x'.repeat(2001) }, 413, 'answer_too_long'],
    ['not an object', 'hello', 400, 'bad_request'],
  ])('refuses %s without handing in', async (_, answers, status, code) => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, assignment(), rpc] })
    const res = await (await loadSubmit())(send({ answers }))
    expect(res.status).toBe(status)
    expect((await res.json()).code).toBe(code)
    expect(log.some((l) => l.url.includes('school_submit'))).toBe(false)
  })

  it('moderates the child\'s text like other child-text paths: flagged → 400 unkind, nothing handed in', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    const log = mockSupabase({ user: STUDENT_USER, routes: [
      studentSelfRoute, assignment(), rpc,
      { method: 'POST', match: 'api.openai.com/v1/moderations', reply: { body: { results: [{ flagged: true }] } } },
    ] })
    const res = await (await loadSubmit())(send({ answers: { first: 'something unkind' } }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('unkind')
    expect(log.find((l) => l.url.includes('moderations')).body.input).toContain('something unkind')
    expect(log.some((l) => l.url.includes('school_submit'))).toBe(false)
  })

  it('the lock-time kind check maps to 409 wrong_kind', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, assignment(),
      { method: 'POST', match: '/rest/v1/rpc/school_submit', reply: { status: 400, body: { code: 'P0001', message: 'wrong_kind' } } }] })
    const res = await (await loadSubmit())(send({ answers: { first: 'x' } }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('wrong_kind')
  })

  it('keeps the assignment rules: closed / past due without late work', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, assignment({ status: 'closed' }), rpc] })
    expect((await (await loadSubmit())(send({ answers: { first: 'x' } }))).status).toBe(409)
    vi.resetModules()
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, assignment({ allow_late: false, due_at: '2026-09-20T00:00:00.000Z' }), rpc] })
    expect((await (await loadSubmit())(send({ answers: { first: 'x' } }))).status).toBe(409)
  })

  it('a teacher can\'t hand in', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [studentSelfRoute, assignment(), rpc] })
    const res = await (await loadSubmit())(send({ answers: { first: 'x' } }))
    expect(res.status).toBe(403)
    expect(log.some((l) => l.url.includes('school_submit'))).toBe(false)
  })
})

describe('GET /api/school/submissions: the answers', () => {
  const SNAP = { kind: 'worksheet', templateId: 'sequence', boxes: [{ id: 'first', prompt: 'First…' }], answers: { first: 'Woke up.' } }
  const subRow = { id: SUB_ID, assignment_id: ASSIGN_ID, student_id: STUDENT_ID, version: 1, submitted_at: '2026-09-27T00:00:00.000Z',
    returned_at: null, book_id: `worksheet:${ASSIGN_ID}`, book_title: 'My morning', book_snapshot: SNAP,
    class_students: { display_name: 'Ann', avatar_emoji: '🦊' }, assignments: { due_at: null }, submission_grades: [] }
  const fb = { method: 'GET', match: '/rest/v1/submission_feedback', reply: { body: [] } }

  it('the teacher of the class sees the answers and the prompts they answered', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [subRow] } }, fb] })
    const res = await (await loadSubmissions())(req('submissions', { query: `?classId=${CLASS_ID}&id=${SUB_ID}` }))
    expect(res.status).toBe(200)
    const { submission } = await res.json()
    expect(submission).toMatchObject({
      kind: 'worksheet', answers: { first: 'Woke up.' },
      worksheet: { templateId: 'sequence', boxes: [{ id: 'first', prompt: 'First…' }], word: null },
    })
    expect(log.find((l) => l.url.includes('/rest/v1/class_submissions')).url).toContain(`classroom_id=eq.${CLASS_ID}`)
  })

  it('another teacher reads nothing', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [notOwnerRoute, { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [subRow] } }, fb] })
    const res = await (await loadSubmissions())(req('submissions', { query: `?classId=${CLASS_ID}&id=${SUB_ID}` }))
    expect(res.status).toBeGreaterThanOrEqual(403)
    expect(log.some((l) => l.url.includes('/rest/v1/class_submissions'))).toBe(false)
  })

  it('a child reads their own answers, scoped by their student id; someone else\'s reads as missing', async () => {
    let log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [subRow] } }, fb] })
    let res = await (await loadSubmissions())(req('submissions', { query: `?id=${SUB_ID}` }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ kind: 'worksheet', answers: { first: 'Woke up.' } })
    expect(log.find((l) => l.url.includes('/rest/v1/class_submissions')).url).toContain(`student_id=eq.${STUDENT_ID}`)

    vi.resetModules()
    log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [] } }, fb] })
    res = await (await loadSubmissions())(req('submissions', { query: `?id=${SUB_ID}` }))
    expect(res.status).toBe(404)
  })

  it('the per-assignment list says it is a worksheet (grading needs nothing else)', async () => {
    mockSupabase({ user: TEACHER, routes: [
      ownerRoute,
      { method: 'GET', match: '/rest/v1/assignments', reply: { body: [row()] } },
      { method: 'GET', match: '/rest/v1/class_students?classroom_id=eq.', reply: { body: [] } },
      { method: 'GET', match: '/rest/v1/class_submissions', reply: { body: [] } },
    ] })
    const res = await (await loadSubmissions())(req('submissions', { query: `?classId=${CLASS_ID}&assignmentId=${ASSIGN_ID}` }))
    expect((await res.json()).assignment).toMatchObject({ kind: 'worksheet', worksheet: SEQ })
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  TEACHER, STUDENT_USER, CLASS_ID, STUDENT_ID, STUDENT2_ID, SUB_ID,
  setEnv, mockSupabase, ownerRoute, notOwnerRoute, studentSelfRoute, classroomRow, req,
} from './school-mock.js'

const ITEM_ID = '6f1c1b1e-0000-4000-8000-0000000000f1'
const ITEM2_ID = '6f1c1b1e-0000-4000-8000-0000000000f2'
const REQ_ID = '6f1c1b1e-0000-4000-8000-0000000000e9'
const T0 = '2026-10-01T12:00:00.000Z'
const FUTURE = '2027-08-01T00:00:00.000Z'

beforeEach(() => {
  vi.resetModules()
  setEnv()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(T0))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const load = async () => (await import('../api/school/writing-year.js')).default
const post = (body) => req('writing-year', { method: 'POST', body })
const get = (query = '') => req('writing-year', { query })
const calls = (log, needle, method) => log.filter((l) => l.url.includes(needle) && (!method || l.method === method))

const ADDRESS = {
  school_name: 'Lincoln Elementary', contact_name: 'Ms Rivera', contact_email: 'rivera@school.org',
  contact_phone: '555 010 0199', address_line1: '1 Main St', city: 'Springfield', state_code: 'IL',
  postal_code: '62701', country_code: 'US',
}
const license = (status, expires_at = FUTURE) => ({ method: 'GET', match: '/rest/v1/class_licenses?', reply: { body: [{ status, expires_at }] } })
const archivedOwner = { method: 'GET', match: '/rest/v1/classrooms?id=eq.', reply: { body: [{ ...classroomRow, archived_at: T0 }] } }
const rpcRoute = (name, reply) => ({ method: 'POST', match: `/rpc/${name}`, reply })
const raised = (message) => ({ status: 400, body: { code: 'P0001', message } })

const STUDENTS = [
  { id: STUDENT_ID, display_name: 'Ann', avatar_emoji: '🦊', auth_user_id: 'kid-auth-1' },
  { id: STUDENT2_ID, display_name: 'Ben', avatar_emoji: '🐢', auth_user_id: 'kid-auth-2' },
]
const studentsRoute = { method: 'GET', match: '/rest/v1/class_students?classroom_id=eq.', reply: { body: STUDENTS } }
// Only Ann has an approved piece.
const piecesRoute = {
  method: 'GET', match: '/rest/v1/writing_year_items?classroom_id=eq.',
  reply: {
    body: [{
      id: ITEM_ID, student_id: STUDENT_ID, kind: 'submission', title: '', position: 1, book_snapshot: null,
      class_submissions: { book_title: 'The Dragon', book_snapshot: { pages: [{ text: 'Once upon a time' }] } },
    }],
  },
}

describe('auth matrix', () => {
  it('a teacher who does not own the class gets 404, for reads and writes', async () => {
    mockSupabase({ user: TEACHER, routes: [notOwnerRoute] })
    const h = await load()
    expect((await h(get(`?classId=${CLASS_ID}`))).status).toBe(404)
    expect((await h(post({ classId: CLASS_ID, action: 'add', submissionId: SUB_ID }))).status).toBe(404)
  })

  it('a student on the teacher route gets 403', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [] })
    const res = await (await load())(post({ classId: CLASS_ID, action: 'add', submissionId: SUB_ID }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('student_forbidden')
  })

  it('a teacher on the student route gets 403 not_a_student', async () => {
    mockSupabase({ user: TEACHER, routes: [] })
    const res = await (await load())(post({ action: 'suggest', submissionId: SUB_ID }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('not_a_student')
  })

  it('unknown actions are 400 on both routes', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute] })
    expect((await (await load())(post({ classId: CLASS_ID, action: 'nope' }))).status).toBe(400)
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute] })
    expect((await (await load())(post({ action: 'note' }))).status).toBe(400)
  })
})

describe('teacher: pieces', () => {
  it('add: the locked RPC, scoped to the class, as the teacher', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rpcRoute('school_wy_add_item', { body: { id: ITEM_ID, position: 3, approved: true, existed: false } })] })
    const res = await (await load())(post({ classId: CLASS_ID, action: 'add', submissionId: SUB_ID }))
    expect(res.status).toBe(201)
    const [call] = calls(log, '/rpc/school_wy_add_item')
    expect(call.body).toMatchObject({
      p_classroom_id: CLASS_ID, p_student_id: null, p_submission_id: SUB_ID, p_added_by: 'teacher', p_max_items: 30, p_max_pending: 5,
    })
  })

  it('add: an ungraded hand-in is refused (409 not_graded); a bad id is 400', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, rpcRoute('school_wy_add_item', raised('not_graded'))] })
    const h = await load()
    const res = await h(post({ classId: CLASS_ID, action: 'add', submissionId: SUB_ID }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('not_graded')
    expect((await h(post({ classId: CLASS_ID, action: 'add', submissionId: 'x' }))).status).toBe(400)
  })

  it('archived class: no writes', async () => {
    const log = mockSupabase({ user: TEACHER, routes: [archivedOwner] })
    const res = await (await load())(post({ classId: CLASS_ID, action: 'add', submissionId: SUB_ID }))
    expect(res.status).toBe(409)
    expect(calls(log, '/rpc/').length).toBe(0)
  })

  it('approve / remove: the piece is looked up in THIS class; another class\'s is 404', async () => {
    const itemRow = { id: ITEM_ID, student_id: STUDENT_ID, kind: 'book', title: 'x', position: 1, approved: false, added_by: 'child_suggested' }
    let log = mockSupabase({
      user: TEACHER,
      routes: [ownerRoute, { method: 'GET', match: '/rest/v1/writing_year_items?id=eq.', reply: { body: [itemRow] } },
        { method: 'PATCH', match: '/rest/v1/writing_year_items?id=eq.', reply: { body: [] } }],
    })
    let res = await (await load())(post({ classId: CLASS_ID, action: 'approve', itemId: ITEM_ID }))
    expect(res.status).toBe(200)
    expect((await res.json()).item.approved).toBe(true)
    expect(calls(log, '/rest/v1/writing_year_items?id=eq.', 'GET')[0].url).toContain(`classroom_id=eq.${CLASS_ID}`)
    expect(calls(log, '/rest/v1/writing_year_items?id=eq.', 'PATCH')[0].url).toContain(`classroom_id=eq.${CLASS_ID}`)

    log = mockSupabase({ user: TEACHER, routes: [ownerRoute, { method: 'GET', match: '/rest/v1/writing_year_items?id=eq.', reply: { body: [] } }] })
    res = await (await load())(post({ classId: CLASS_ID, action: 'remove', itemId: ITEM_ID }))
    expect(res.status).toBe(404)
    expect(calls(log, '/rest/v1/writing_year_items', 'DELETE').length).toBe(0)
  })

  it('reorder: validated, then the RPC; a stale list is 409', async () => {
    let log = mockSupabase({ user: TEACHER, routes: [ownerRoute, rpcRoute('school_wy_reorder', { body: 2 })] })
    let h = await load()
    expect((await h(post({ classId: CLASS_ID, action: 'reorder', studentId: STUDENT_ID, itemIds: [ITEM2_ID, ITEM_ID] }))).status).toBe(200)
    expect(calls(log, '/rpc/school_wy_reorder')[0].body).toEqual({ p_classroom_id: CLASS_ID, p_student_id: STUDENT_ID, p_item_ids: [ITEM2_ID, ITEM_ID] })
    expect((await h(post({ classId: CLASS_ID, action: 'reorder', studentId: STUDENT_ID, itemIds: ['nope'] }))).status).toBe(400)
    expect((await h(post({ classId: CLASS_ID, action: 'reorder', studentId: STUDENT_ID, itemIds: [] }))).status).toBe(400)

    mockSupabase({ user: TEACHER, routes: [ownerRoute, rpcRoute('school_wy_reorder', raised('order_mismatch'))] })
    h = await load()
    const res = await h(post({ classId: CLASS_ID, action: 'reorder', studentId: STUDENT_ID, itemIds: [ITEM_ID] }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('order_mismatch')
  })

  it('note: a child in this class only; length checked; upserted', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [ownerRoute,
        { method: 'GET', match: '/rest/v1/class_students?id=eq.', reply: { body: [{ ...STUDENTS[0], status: 'active' }] } },
        { method: 'POST', match: '/rest/v1/writing_year_meta', reply: (c) => ({ body: [c.body] }) }],
    })
    const h = await load()
    expect((await h(post({ classId: CLASS_ID, action: 'note', studentId: STUDENT_ID, teacherNote: 'x'.repeat(601) }))).status).toBe(400)
    const res = await h(post({ classId: CLASS_ID, action: 'note', studentId: STUDENT_ID, teacherNote: '  Proud of you  ' }))
    expect(res.status).toBe(200)
    expect((await res.json()).meta.teacher_note).toBe('Proud of you')
    expect(calls(log, '/rest/v1/class_students?id=eq.')[0].url).toContain(`classroom_id=eq.${CLASS_ID}`)
    const up = calls(log, '/rest/v1/writing_year_meta', 'POST')[0]
    expect(up.url).toContain('on_conflict=student_id')
    expect(up.body).toMatchObject({ student_id: STUDENT_ID, classroom_id: CLASS_ID, teacher_note: 'Proud of you' })
  })

  it('submission state for the grade panel toggle', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, { method: 'GET', match: '/rest/v1/writing_year_items?submission_id=eq.', reply: { body: [{ id: ITEM_ID, approved: true, added_by: 'teacher' }] } }] })
    const res = await (await load())(get(`?classId=${CLASS_ID}&submissionId=${SUB_ID}`))
    expect(await res.json()).toEqual({ item: { id: ITEM_ID, approved: true, added_by: 'teacher' } })
  })

  it('overview: counts per child, About me done, can_print, requests', async () => {
    mockSupabase({
      user: TEACHER,
      routes: [ownerRoute, studentsRoute,
        { method: 'GET', match: '/rest/v1/writing_year_items?classroom_id=eq.', reply: { body: [{ student_id: STUDENT_ID, approved: true }, { student_id: STUDENT_ID, approved: false }] } },
        { method: 'GET', match: '/rest/v1/writing_year_meta?', reply: { body: [{ student_id: STUDENT_ID, about_favorite: 'Dragons', about_best_sentence: '', about_learned: '', teacher_note: '' }] } },
        { method: 'GET', match: '/rest/v1/class_print_requests?', reply: { body: [] } },
        license('trial')],
    })
    const body = await (await (await load())(get(`?classId=${CLASS_ID}`))).json()
    expect(body.school_year).toBe('2026-27')
    expect(body.can_print).toBe(false)
    expect(body.children[0]).toMatchObject({ student_id: STUDENT_ID, item_count: 1, pending_count: 1, about_me_done: true, has_note: false })
    expect(body.children[1]).toMatchObject({ student_id: STUDENT2_ID, item_count: 0, about_me_done: false })
  })
})

describe('teacher: class print (R1–R3)', () => {
  const printRoutes = (lic, extra = [], expires = FUTURE) => [
    ownerRoute, license(lic, expires),
    { method: 'GET', match: '/rest/v1/class_print_requests?', reply: { body: [] } },
    studentsRoute, piecesRoute,
    { method: 'GET', match: '/rest/v1/writing_year_meta?', reply: { body: [] } },
    { method: 'GET', match: '/rest/v1/user_inventory?', reply: { body: [] } },
    ...extra,
  ]

  it('R1: a trial class cannot print — neutral copy, nothing created', async () => {
    const log = mockSupabase({ user: TEACHER, routes: printRoutes('trial') })
    const res = await (await load())(post({ classId: CLASS_ID, action: 'print', address: ADDRESS }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('print_not_available')
    expect(body.error).not.toMatch(/\$|price|buy|pay/i)
    expect(calls(log, '/rpc/').length).toBe(0)
  })

  it('R1: lapsed/expired is refused too; comped and grace print', async () => {
    mockSupabase({ user: TEACHER, routes: printRoutes('active', [], '2026-01-01T00:00:00Z') })
    expect((await (await load())(post({ classId: CLASS_ID, action: 'print', address: ADDRESS }))).status).toBe(403)
    for (const lic of ['comped', 'grace']) {
      mockSupabase({ user: TEACHER, routes: printRoutes(lic, [rpcRoute('school_create_class_print', { body: { id: REQ_ID, children_count: 1 } })]) })
      expect((await (await load())(post({ classId: CLASS_ID, action: 'print', address: ADDRESS }))).status).toBe(201)
    }
  })

  it('validates the address before anything else is written', async () => {
    const log = mockSupabase({ user: TEACHER, routes: printRoutes('active') })
    const res = await (await load())(post({ classId: CLASS_ID, action: 'print', address: { ...ADDRESS, postal_code: '' } }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'bad_address', field: 'postal_code' })
    expect(calls(log, '/rpc/').length).toBe(0)
  })

  it('creates one request: children with zero pieces are excluded and listed; books frozen', async () => {
    const log = mockSupabase({ user: TEACHER, routes: printRoutes('active', [rpcRoute('school_create_class_print', { body: { id: REQ_ID, children_count: 1 } })]) })
    const res = await (await load())(post({ classId: CLASS_ID, action: 'print', address: ADDRESS }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.included).toEqual([{ student_id: STUDENT_ID, display_name: 'Ann' }])
    expect(body.excluded).toEqual([{ student_id: STUDENT2_ID, display_name: 'Ben' }])
    const [call] = calls(log, '/rpc/school_create_class_print')
    expect(call.body).toMatchObject({ p_classroom_id: CLASS_ID, p_requested_by: TEACHER.id, p_school_year: '2026-27', p_excluded_count: 1 })
    expect(call.body.p_address).toMatchObject({ school_name: 'Lincoln Elementary', country_code: 'US' })
    expect(call.body.p_children).toHaveLength(1)
    expect(call.body.p_children[0].book).toMatchObject({ name: 'Ann', class_name: 'Room 5', year: '2026-27' })
    expect(call.body.p_children[0].book.pieces[0]).toMatchObject({ kind: 'book', title: 'The Dragon' })
  })

  it('R3: a live request for this class/year is refused (fast path and the RPC\'s unique index)', async () => {
    let log = mockSupabase({
      user: TEACHER,
      routes: [ownerRoute, license('active'), { method: 'GET', match: '/rest/v1/class_print_requests?', reply: { body: [{ id: REQ_ID }] } }],
    })
    let res = await (await load())(post({ classId: CLASS_ID, action: 'print', address: ADDRESS }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('already_requested')
    expect(calls(log, '/rest/v1/class_print_requests?')[0].url).toContain('status=neq.canceled')
    expect(calls(log, '/rest/v1/class_print_requests?')[0].url).toContain('school_year=eq.2026-27')

    log = mockSupabase({ user: TEACHER, routes: printRoutes('active', [rpcRoute('school_create_class_print', raised('already_requested'))]) })
    res = await (await load())(post({ classId: CLASS_ID, action: 'print', address: ADDRESS }))
    expect(res.status).toBe(409)
  })

  it('nobody has a piece → 409 no_children, nothing created', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [ownerRoute, license('active'), { method: 'GET', match: '/rest/v1/class_print_requests?', reply: { body: [] } }, studentsRoute],
    })
    const res = await (await load())(post({ classId: CLASS_ID, action: 'print', address: ADDRESS }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('no_children')
    expect(calls(log, '/rpc/').length).toBe(0)
  })

  it('print_summary: who is in and who is not, without writing', async () => {
    const log = mockSupabase({ user: TEACHER, routes: printRoutes('trial') })
    const body = await (await (await load())(post({ classId: CLASS_ID, action: 'print_summary' }))).json()
    expect(body).toMatchObject({ can_print: false, included: [{ display_name: 'Ann' }], excluded: [{ display_name: 'Ben' }] })
    expect(log.filter((l) => l.method !== 'GET').length).toBe(0)
  })

  it('cancel_print: only while still requested', async () => {
    let log = mockSupabase({ user: TEACHER, routes: [ownerRoute, { method: 'PATCH', match: '/rest/v1/class_print_requests?', reply: { body: [{ id: REQ_ID, status: 'canceled' }] } }] })
    expect((await (await load())(post({ classId: CLASS_ID, action: 'cancel_print', requestId: REQ_ID }))).status).toBe(200)
    const url = calls(log, '/rest/v1/class_print_requests?', 'PATCH')[0].url
    expect(url).toContain('status=eq.requested')
    expect(url).toContain(`classroom_id=eq.${CLASS_ID}`)
    log = mockSupabase({ user: TEACHER, routes: [ownerRoute, { method: 'PATCH', match: '/rest/v1/class_print_requests?', reply: { body: [] } }] })
    expect((await (await load())(post({ classId: CLASS_ID, action: 'cancel_print', requestId: REQ_ID }))).status).toBe(409)
  })
})

describe('student', () => {
  it('suggest a hand-in: their own student id, as a suggestion', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, rpcRoute('school_wy_add_item', { body: { id: ITEM_ID, position: 2, approved: false, existed: false } })] })
    const res = await (await load())(post({ action: 'suggest', submissionId: SUB_ID }))
    expect(res.status).toBe(201)
    expect(calls(log, '/rpc/school_wy_add_item')[0].body).toMatchObject({
      p_classroom_id: CLASS_ID, p_student_id: STUDENT_ID, p_submission_id: SUB_ID, p_added_by: 'child_suggested',
    })
  })

  it('suggest a book: read from THEIR OWN user_books and frozen without data URIs', async () => {
    const log = mockSupabase({
      user: STUDENT_USER,
      routes: [studentSelfRoute,
        { method: 'GET', match: '/rest/v1/user_books?', reply: { body: [{ title: 'Space', book_data: { title: 'Space', coverImage: 'data:image/png;base64,AAA', pages: [{ text: 'Hi' }] } }] } },
        rpcRoute('school_wy_add_item', { body: { id: ITEM_ID, position: 1, approved: false, existed: false } })],
    })
    const res = await (await load())(post({ action: 'suggest', bookId: 'book-1' }))
    expect(res.status).toBe(201)
    expect(calls(log, '/rest/v1/user_books?')[0].url).toContain(`user_id=eq.${STUDENT_USER.id}`)
    const call = calls(log, '/rpc/school_wy_add_item')[0].body
    expect(call).toMatchObject({ p_student_id: STUDENT_ID, p_book_id: 'book-1', p_title: 'Space', p_submission_id: null })
    expect(call.p_book_snapshot.coverImage).toBeNull()
  })

  it('suggest: someone else\'s book is 404; too many waiting is 409', async () => {
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, { method: 'GET', match: '/rest/v1/user_books?', reply: { body: [] } }] })
    expect((await (await load())(post({ action: 'suggest', bookId: 'not-mine' }))).status).toBe(404)
    mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, rpcRoute('school_wy_add_item', raised('too_many_pending'))] })
    const res = await (await load())(post({ action: 'suggest', submissionId: SUB_ID }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('too_many_pending')
  })

  it('withdraw: only their own waiting suggestion', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, { method: 'DELETE', match: '/rest/v1/writing_year_items?', reply: { body: [{ id: ITEM_ID }] } }] })
    expect((await (await load())(post({ action: 'withdraw', itemId: ITEM_ID }))).status).toBe(200)
    const url = calls(log, '/rest/v1/writing_year_items?', 'DELETE')[0].url
    expect(url).toContain(`student_id=eq.${STUDENT_ID}`)
    expect(url).toContain('approved=is.false')
  })

  it('about: three short answers, length-checked, upserted for themselves', async () => {
    const log = mockSupabase({ user: STUDENT_USER, routes: [studentSelfRoute, { method: 'POST', match: '/rest/v1/writing_year_meta', reply: (c) => ({ body: [c.body] }) }] })
    const h = await load()
    expect((await h(post({ action: 'about', about_learned: 'x'.repeat(201) }))).status).toBe(400)
    const res = await h(post({ action: 'about', about_favorite: 'Dragons', teacher_note: 'sneaky' }))
    expect(res.status).toBe(200)
    const up = calls(log, '/rest/v1/writing_year_meta', 'POST')[0].body
    expect(up).toMatchObject({ student_id: STUDENT_ID, classroom_id: CLASS_ID, about_favorite: 'Dragons' })
    expect(up).not.toHaveProperty('teacher_note')
  })

  it('view: their own pieces and About me — never the teacher\'s note — and what they can still suggest', async () => {
    const log = mockSupabase({
      user: STUDENT_USER,
      routes: [studentSelfRoute,
        { method: 'GET', match: '/rest/v1/writing_year_items?', reply: { body: [{ id: ITEM_ID, kind: 'submission', submission_id: SUB_ID, title: 'The Dragon', position: 1, approved: true, added_by: 'teacher' }] } },
        { method: 'GET', match: '/rest/v1/writing_year_meta?', reply: { body: [{ about_favorite: 'Dragons', teacher_note: 'Secret note' }] } },
        { method: 'GET', match: '/rest/v1/class_submissions?', reply: { body: [{ id: SUB_ID, book_title: 'The Dragon' }, { id: ITEM2_ID, book_title: 'Poem' }] } },
        { method: 'GET', match: '/rest/v1/user_books?', reply: { body: [{ book_id: 'b1', title: 'Space' }] } }],
    })
    const res = await (await load())(get())
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('Secret note')
    expect(body.items).toHaveLength(1)
    expect(body.suggestable).toEqual([
      { kind: 'submission', submission_id: ITEM2_ID, title: 'Poem' },
      { kind: 'book', book_id: 'b1', title: 'Space' },
    ])
    for (const l of calls(log, '/rest/v1/writing_year_items?')) expect(l.url).toContain(`student_id=eq.${STUDENT_ID}`)
    expect(calls(log, '/rest/v1/class_submissions?')[0].url).toContain(`student_id=eq.${STUDENT_ID}`)
    expect(calls(log, '/rest/v1/user_books?')[0].url).toContain(`user_id=eq.${STUDENT_USER.id}`)
  })
})

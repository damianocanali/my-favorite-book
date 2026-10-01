import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TEACHER, STUDENT_USER, CLASS_ID, STUDENT_ID, setEnv, mockSupabase, ownerRoute, notOwnerRoute } from './school-mock.js'

const render = vi.hoisted(() => vi.fn(async () => Buffer.from('%PDF-1.4 fake')))
vi.mock('../lib/print/pdf-render.js', () => ({ renderHtmlToPdf: render }))

beforeEach(() => {
  vi.resetModules()
  setEnv()
  render.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

const get = (q) => new Request(`https://app.test/api/school/writing-year-pdf${q}`, { headers: { authorization: 'Bearer jwt' } })
const load = async () => (await import('../api/school/writing-year-pdf.js')).GET

describe('GET /api/school/writing-year-pdf', () => {
  it('the class owner gets one child\'s PDF, built from that child\'s approved pieces', async () => {
    const log = mockSupabase({
      user: TEACHER,
      routes: [ownerRoute,
        { method: 'GET', match: '/rest/v1/class_students?id=eq.', reply: { body: [{ id: STUDENT_ID, display_name: 'Lucía', avatar_emoji: '🦊', auth_user_id: 'kid-auth-1' }] } },
        { method: 'GET', match: '/rest/v1/writing_year_items?', reply: { body: [{ student_id: STUDENT_ID, kind: 'book', title: 'Space', position: 1, book_snapshot: { pages: [{ text: 'Zoom' }] } }] } }],
    })
    const res = await (await load())(get(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toContain("filename*=UTF-8''Luc%C3%ADa")
    const { html } = render.mock.calls[0][0]
    expect(html).toContain('Lucía')
    expect(html).toContain('Zoom')
    const items = log.find((l) => l.url.includes('/rest/v1/writing_year_items?'))
    expect(items.url).toContain('approved=is.true')
    expect(items.url).toContain(`student_id=eq.${STUDENT_ID}`)
    expect(log.find((l) => l.url.includes('/rest/v1/class_students?id=eq.')).url).toContain(`classroom_id=eq.${CLASS_ID}`)
  })

  it('not the owner → 404; a student → 403; nothing rendered', async () => {
    mockSupabase({ user: TEACHER, routes: [notOwnerRoute] })
    expect((await (await load())(get(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))).status).toBe(404)
    mockSupabase({ user: STUDENT_USER, routes: [] })
    expect((await (await load())(get(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))).status).toBe(403)
    expect(render).not.toHaveBeenCalled()
  })

  it('a child of another class reads as missing', async () => {
    mockSupabase({ user: TEACHER, routes: [ownerRoute, { method: 'GET', match: '/rest/v1/class_students?id=eq.', reply: { body: [] } }] })
    expect((await (await load())(get(`?classId=${CLASS_ID}&studentId=${STUDENT_ID}`))).status).toBe(404)
    expect(render).not.toHaveBeenCalled()
  })
})

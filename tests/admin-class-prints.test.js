// The owner's review step for class print requests (controller ruling R2).
// Lulu and Chromium are mocked: nothing here can reach a real printer.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TEACHER, CLASS_ID, STUDENT_ID, STUDENT2_ID, setEnv, mockSupabase } from './school-mock.js'

const lulu = vi.hoisted(() => ({
  createPrintJob: vi.fn(),
  getCoverDimensions: vi.fn(),
}))
vi.mock('../lib/print/lulu.js', () => ({
  LuluClient: class {
    createPrintJob(p) { return lulu.createPrintJob(p) }
    getCoverDimensions(q) { return lulu.getCoverDimensions(q) }
  },
}))
vi.mock('../lib/print/pdf-render.js', () => ({
  renderHtmlToPdf: vi.fn(async () => Buffer.from('%PDF-1.4 fake')),
}))

const REQ_ID = '6f1c1b1e-0000-4000-8000-0000000000e9'
const CHILD1 = '6f1c1b1e-0000-4000-8000-0000000000d7'
const CHILD2 = '6f1c1b1e-0000-4000-8000-0000000000d8'
const OWNER = { id: 'owner-1', app_metadata: {} }

beforeEach(() => {
  vi.resetModules()
  setEnv()
  process.env.OWNER_USER_ID = OWNER.id
  lulu.createPrintJob.mockReset()
  lulu.getCoverDimensions.mockReset()
  lulu.getCoverDimensions.mockResolvedValue({ width: '17.4', height: '8.75' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  delete process.env.OWNER_USER_ID
  vi.restoreAllMocks()
})

const load = async () => await import('../api/admin/class-prints.js')
const post = (body) => new Request('https://app.test/api/admin/class-prints', {
  method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify(body),
})
const calls = (log, needle, method) => log.filter((l) => l.url.includes(needle) && (!method || l.method === method))

const requestRow = (over = {}) => ({
  id: REQ_ID, classroom_id: CLASS_ID, school_year: '2026-27', status: 'approved', school_name: 'Lincoln Elementary',
  contact_name: 'Ms Rivera', contact_email: 'rivera@school.org', contact_phone: '5550100199',
  address_line1: '1 Main St', address_line2: null, city: 'Springfield', state_code: 'IL', postal_code: '62701',
  country_code: 'US', children_count: 2, excluded_count: 0, submit_claimed_at: null, lulu_print_job_id: null,
  classrooms: { name: 'Room 5', locale: 'en' }, ...over,
})
const BOOK = { name: 'Ann', class_name: 'Room 5', lang: 'en', year: '2026-27', pieces: [{ kind: 'book', title: 'T', pages: [{ text: 'Hi', image: null }] }], about: {}, teacher_note: '' }
const childRows = (rendered = true) => [
  { id: CHILD1, student_id: STUDENT_ID, display_name: 'Ann', position: 1, book: BOOK, class_students: { auth_user_id: 'kid-auth-1' },
    ...(rendered ? { interior_key: `writing-year/kid-auth-1/${REQ_ID}-interior.pdf`, cover_key: `writing-year/kid-auth-1/${REQ_ID}-cover.pdf`, page_count: 32 } : {}) },
  { id: CHILD2, student_id: STUDENT2_ID, display_name: 'Ben', position: 2, book: { ...BOOK, name: 'Ben' }, class_students: { auth_user_id: 'kid-auth-2' },
    ...(rendered ? { interior_key: `writing-year/kid-auth-2/${REQ_ID}-interior.pdf`, cover_key: `writing-year/kid-auth-2/${REQ_ID}-cover.pdf`, page_count: 32 } : {}) },
]

function routes({ request = requestRow(), children = childRows(), lic = 'active', claim = 'ok' } = {}) {
  return [
    { method: 'GET', match: '/rest/v1/class_print_requests?id=eq.', reply: { body: [request] } },
    { method: 'GET', match: '/rest/v1/class_print_request_children?', reply: { body: children } },
    { method: 'GET', match: '/rest/v1/class_licenses?', reply: { body: [{ status: lic, expires_at: '2099-01-01T00:00:00Z' }] } },
    { method: 'POST', match: '/storage/v1/object/sign/', reply: { body: { signedURL: '/object/sign/print-pdfs/x?token=t' } } },
    { method: 'POST', match: '/storage/v1/object/print-pdfs/', reply: { body: {} } },
    { method: 'PATCH', match: '/rest/v1/class_print_request_children?', reply: { body: [] } },
    {
      method: 'PATCH', match: '/rest/v1/class_print_requests?',
      reply: (c) => {
        if (c.url.includes('submit_claimed_at=is.null')) return { body: claim === 'ok' ? [{ ...request, ...c.body }] : [] }
        return { body: [{ ...request, ...c.body }] }
      },
    },
  ]
}

describe('owner only', () => {
  it('no token 401, someone else 403 — and nothing is read', async () => {
    let log = mockSupabase({ user: TEACHER, routes: routes() })
    const { POST, GET } = await load()
    let res = await POST(post({ id: REQ_ID, action: 'submit' }))
    expect(res.status).toBe(403)
    expect(calls(log, '/rest/v1/').length).toBe(0)
    res = await GET(new Request('https://app.test/api/admin/class-prints'))
    expect(res.status).toBe(401)
    expect(lulu.createPrintJob).not.toHaveBeenCalled()
  })

  it('fails closed without OWNER_USER_ID', async () => {
    delete process.env.OWNER_USER_ID
    mockSupabase({ user: OWNER, routes: routes() })
    const { POST } = await load()
    expect((await POST(post({ id: REQ_ID, action: 'approve' }))).status).toBe(503)
  })
})

describe('approve', () => {
  it('requested → approved, guarded on the current status', async () => {
    const log = mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'requested' }) }) })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'approve' }))
    expect(res.status).toBe(200)
    const [p] = calls(log, '/rest/v1/class_print_requests?', 'PATCH')
    expect(p.url).toContain('status=eq.requested')
    expect(p.body.status).toBe('approved')
  })

  it('R1 again at approval: a trial (or lapsed) class is refused', async () => {
    const log = mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'requested' }), lic: 'trial' }) })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'approve' }))
    expect(res.status).toBe(409)
    expect(calls(log, '/rest/v1/class_print_requests?', 'PATCH').length).toBe(0)
  })
})

describe('render', () => {
  it('renders one child into their own storage folder and records the keys', async () => {
    const log = mockSupabase({ user: OWNER, routes: routes({ children: childRows(false) }) })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'render', childId: CHILD1 }))
    expect(res.status).toBe(200)
    const uploads = calls(log, '/storage/v1/object/print-pdfs/', 'POST').map((l) => l.url.split('/print-pdfs/')[1])
    expect(uploads).toEqual([`writing-year/kid-auth-1/${REQ_ID}-interior.pdf`, `writing-year/kid-auth-1/${REQ_ID}-cover.pdf`])
    expect(lulu.getCoverDimensions).toHaveBeenCalledWith(expect.objectContaining({ pod_package_id: '0850X0850FCSTDPB080CW444MXX' }))
    expect(lulu.createPrintJob).not.toHaveBeenCalled()
    const [p] = calls(log, '/rest/v1/class_print_request_children?', 'PATCH')
    expect(p.body).toMatchObject({ interior_key: uploads[0], cover_key: uploads[1], page_count: 32 })
  })

  it('not before approval', async () => {
    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'requested' }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'render', childId: CHILD1 }))).status).toBe(409)
  })
})

describe('submit', () => {
  it('ONE Lulu print job: a line item per child, one shipping address, softcover', async () => {
    lulu.createPrintJob.mockResolvedValue({ id: 98765, status: { name: 'CREATED' } })
    const log = mockSupabase({ user: OWNER, routes: routes() })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))
    expect(res.status).toBe(200)
    expect(lulu.createPrintJob).toHaveBeenCalledTimes(1)
    const payload = lulu.createPrintJob.mock.calls[0][0]
    expect(payload.external_id).toBe(REQ_ID)
    expect(payload.shipping_address).toMatchObject({ name: 'Ms Rivera', street1: '1 Main St', city: 'Springfield', state_code: 'IL', postcode: '62701', country_code: 'US', phone_number: '5550100199' })
    expect(payload.line_items).toHaveLength(2)
    for (const li of payload.line_items) {
      expect(li).toMatchObject({ quantity: 1, pod_package_id: '0850X0850FCSTDPB080CW444MXX' })
      expect(li.interior.source_url).toMatch(/^https:\/\/example\.supabase\.co\/storage\/v1\/object\/sign\//)
    }
    expect(payload.line_items.map((l) => l.title)).toEqual(['My Writing Year — Ann', 'My Writing Year — Ben'])
    const patches = calls(log, '/rest/v1/class_print_requests?', 'PATCH')
    expect(patches[0].url).toContain('status=eq.approved')
    expect(patches[0].url).toContain('submit_claimed_at=is.null')
    expect(patches.at(-1).body).toMatchObject({ status: 'submitted', lulu_print_job_id: '98765' })
  })

  it('a double click cannot create a second order: the claim is taken → 409, Lulu untouched', async () => {
    const log = mockSupabase({ user: OWNER, routes: routes({ claim: 'taken' }) })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('already_submitting')
    expect(lulu.createPrintJob).not.toHaveBeenCalled()
    expect(calls(log, '/rest/v1/class_print_requests?', 'PATCH')).toHaveLength(1)
  })

  it('already claimed, or already submitted: no Lulu call (idempotent)', async () => {
    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ submit_claimed_at: '2026-10-01T00:00:00Z' }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))).status).toBe(409)
    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'submitted', lulu_print_job_id: '1' }) }) })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))
    expect(res.status).toBe(200)
    expect((await res.json()).idempotent).toBe(true)
    expect(lulu.createPrintJob).not.toHaveBeenCalled()
  })

  it('Lulu fails → status failed with the error (never back to approved)', async () => {
    lulu.createPrintJob.mockRejectedValue(new Error('lulu createPrintJob: 400 bad address'))
    const log = mockSupabase({ user: OWNER, routes: routes() })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))
    expect(res.status).toBe(502)
    const last = calls(log, '/rest/v1/class_print_requests?', 'PATCH').at(-1)
    expect(last.body).toMatchObject({ status: 'failed', error: 'lulu createPrintJob: 400 bad address' })
  })

  it('every child must be rendered first; the license is re-checked', async () => {
    mockSupabase({ user: OWNER, routes: routes({ children: childRows(false) }) })
    let res = await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('not_rendered')
    mockSupabase({ user: OWNER, routes: routes({ lic: 'lapsed' }) })
    res = await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))
    expect(res.status).toBe(409)
    expect(lulu.createPrintJob).not.toHaveBeenCalled()
  })
})

describe('cancel / mark', () => {
  it('cannot cancel mid-submit or after submission', async () => {
    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ submit_claimed_at: '2026-10-01T00:00:00Z' }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'cancel' }))).status).toBe(409)
    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'submitted' }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'cancel' }))).status).toBe(409)
    const log = mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'requested' }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'cancel' }))).status).toBe(200)
    expect(calls(log, '/rest/v1/class_print_requests?', 'PATCH')[0].body.status).toBe('canceled')
  })

  it('mark only moves forward', async () => {
    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'submitted' }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'mark', status: 'shipped' }))).status).toBe(200)
    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'shipped' }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'mark', status: 'in_production' }))).status).toBe(409)
  })
})

describe('Lulu webhook → class print status', () => {
  it('a class print job id advances the request (shipped, with tracking)', async () => {
    process.env.LULU_WEBHOOK_SECRET = 'whsec'
    vi.resetModules()
    const body = JSON.stringify({ data: { id: 98765, status: { name: 'SHIPPED' }, tracking_id: 'TRK', tracking_urls: ['https://track'], carrier_name: 'UPS' } })
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('whsec'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))).toString('hex')
    const log = mockSupabase({
      user: OWNER,
      routes: [
        { method: 'GET', match: '/rest/v1/print_orders?', reply: { body: [] } },
        { method: 'GET', match: '/rest/v1/class_print_requests?lulu_print_job_id=eq.98765', reply: { body: [{ id: REQ_ID, status: 'in_production' }] } },
        { method: 'PATCH', match: '/rest/v1/class_print_requests?', reply: { body: [] } },
      ],
    })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const handler = (await import('../api/webhooks/lulu.js')).default
    const res = await handler(new Request('https://app.test/api/webhooks/lulu', { method: 'POST', headers: { 'lulu-hmac-sha256': sig }, body }))
    expect(res.status).toBe(200)
    const [p] = calls(log, '/rest/v1/class_print_requests?', 'PATCH')
    expect(p.url).toContain('status=eq.in_production')
    expect(p.body).toMatchObject({ status: 'shipped', tracking: { number: 'TRK', url: 'https://track', carrier: 'UPS' } })
    delete process.env.LULU_WEBHOOK_SECRET
  })
})

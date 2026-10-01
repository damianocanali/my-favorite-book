// The owner's review step for class print requests (controller ruling R2).
// Lulu and Chromium are mocked: nothing here can reach a real printer.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TEACHER, CLASS_ID, STUDENT_ID, STUDENT2_ID, setEnv, mockSupabase } from './school-mock.js'

const lulu = vi.hoisted(() => ({
  createPrintJob: vi.fn(),
  getCoverDimensions: vi.fn(),
  getShippingOptions: vi.fn(),
}))
vi.mock('../lib/print/lulu.js', () => ({
  LuluClient: class {
    createPrintJob(p) { return lulu.createPrintJob(p) }
    getCoverDimensions(q) { return lulu.getCoverDimensions(q) }
    getShippingOptions(q) { return lulu.getShippingOptions(q) }
  },
}))
vi.mock('../lib/print/pdf-render.js', () => ({
  renderHtmlToPdf: vi.fn(async () => Buffer.from('%PDF-1.4 fake')),
}))

const REQ_ID = '6f1c1b1e-0000-4000-8000-0000000000e9'
const CHILD1 = '6f1c1b1e-0000-4000-8000-0000000000d7'
const CHILD2 = '6f1c1b1e-0000-4000-8000-0000000000d8'
const OWNER = { id: 'owner-1', app_metadata: {} }
const T = '2026-10-01T00:00:00Z'

beforeEach(() => {
  vi.resetModules()
  setEnv()
  process.env.OWNER_USER_ID = OWNER.id
  delete process.env.PRINT_OPS_EMAIL
  for (const f of Object.values(lulu)) f.mockReset()
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
const getReq = (q = '') => new Request(`https://app.test/api/admin/class-prints${q}`, { headers: { authorization: 'Bearer jwt' } })
const calls = (log, needle, method) => log.filter((l) => l.url.includes(needle) && (!method || l.method === method))
const requestPatches = (log) => calls(log, '/rest/v1/class_print_requests?', 'PATCH')

const requestRow = (over = {}) => ({
  id: REQ_ID, classroom_id: CLASS_ID, school_year: '2026-27', status: 'approved', school_name: 'Lincoln Elementary',
  contact_name: 'Ms Rivera', contact_email: 'rivera@school.org', contact_phone: '5550100199',
  address_line1: '1 Main St', address_line2: null, city: 'Springfield', state_code: 'IL', postal_code: '62701',
  country_code: 'US', children_count: 2, excluded_count: 0, books_frozen_at: T, shipping_level: 'GROUND',
  submit_claimed_at: null, lulu_print_job_id: null, classrooms: { name: 'Room 5', locale: 'en' }, ...over,
})
const BOOK = { name: 'Ann', class_name: 'Room 5', lang: 'en', year: '2026-27', pieces: [{ kind: 'book', title: 'T', pages: [{ text: 'Hi', image: null }] }], about: {}, teacher_note: '' }
const child = (id, name, pos, auth, { rendered = true, status = 'active' } = {}) => ({
  id, student_id: pos === 1 ? STUDENT_ID : STUDENT2_ID, display_name: name, position: pos, book: { ...BOOK, name },
  class_students: { auth_user_id: auth, status },
  ...(rendered ? { interior_key: `writing-year/${auth}/${REQ_ID}-interior.pdf`, cover_key: `writing-year/${auth}/${REQ_ID}-cover.pdf`, page_count: 32, rendered_at: T } : {}),
})
const childRows = (opts = {}) => [child(CHILD1, 'Ann', 1, 'kid-auth-1', opts), child(CHILD2, 'Ben', 2, 'kid-auth-2', opts)]

// patchFail(call) → true to fail that PATCH on class_print_requests.
function routes({ request = requestRow(), children = childRows(), lic = 'active', claim = 'ok', patchFail = () => false } = {}) {
  return [
    { method: 'GET', match: '/rest/v1/class_print_requests?id=eq.', reply: { body: [request] } },
    {
      method: 'GET', match: '/rest/v1/class_print_request_children?',
      reply: (c) => {
        const m = c.url.match(/&id=eq\.([^&]+)/)
        return { body: m ? children.filter((ch) => ch.id === m[1]) : children }
      },
    },
    { method: 'GET', match: '/rest/v1/class_licenses?', reply: { body: [{ status: lic, expires_at: '2099-01-01T00:00:00Z' }] } },
    { method: 'POST', match: '/storage/v1/object/sign/', reply: (c) => ({ body: { signedURL: `/object/sign/print-pdfs/x?token=t&e=${c.body.expiresIn}` } }) },
    { method: 'POST', match: '/storage/v1/object/print-pdfs/', reply: { body: {} } },
    { method: 'PATCH', match: '/rest/v1/class_print_request_children?', reply: { body: [] } },
    {
      method: 'PATCH', match: '/rest/v1/class_print_requests?',
      reply: (c) => {
        if (patchFail(c)) return { status: 500, body: {} }
        if (c.url.includes('submit_claimed_at=is.null') && c.body.submit_claimed_at) return { body: claim === 'ok' ? [{ ...request, ...c.body }] : [] }
        return { body: [{ ...request, ...c.body }] }
      },
    },
  ]
}

describe('owner only', () => {
  it('no token 401, someone else 403 — and nothing is read', async () => {
    const log = mockSupabase({ user: TEACHER, routes: routes() })
    const { POST, GET } = await load()
    const res = await POST(post({ id: REQ_ID, action: 'submit' }))
    expect(res.status).toBe(403)
    expect(calls(log, '/rest/v1/').length).toBe(0)
    expect((await GET(new Request('https://app.test/api/admin/class-prints'))).status).toBe(401)
    expect(lulu.createPrintJob).not.toHaveBeenCalled()
  })

  it('fails closed without OWNER_USER_ID', async () => {
    delete process.env.OWNER_USER_ID
    mockSupabase({ user: OWNER, routes: routes() })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'approve' }))).status).toBe(503)
  })
})

describe('step 1: shipping, approve, render', () => {
  it('shipping options: Lulu asked with the real address and the active children as quantity (read-only)', async () => {
    lulu.getShippingOptions.mockResolvedValue([{ level: 'GROUND', total_cost_incl_tax: '12.00', currency: 'USD' }, { level: 'MAIL' }, { level: 'WEIRD' }])
    const children = [child(CHILD1, 'Ann', 1, 'kid-auth-1'), child(CHILD2, 'Ben', 2, 'kid-auth-2', { status: 'removed' })]
    const log = mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'requested' }), children }) })
    const body = await (await (await load()).POST(post({ id: REQ_ID, action: 'shipping_options' }))).json()
    expect(lulu.getShippingOptions).toHaveBeenCalledWith(expect.objectContaining({ country_code: 'US', state_code: 'IL', postcode: '62701', quantity: '1' }))
    expect(body.options.map((o) => o.level)).toEqual(['GROUND', 'MAIL'])
    expect(body.default).toBe('GROUND')
    expect(requestPatches(log)).toHaveLength(0)
  })

  it('approve: requested → approved with the chosen shipping level; default by country', async () => {
    let log = mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'requested' }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'approve', shippingLevel: 'EXPEDITED' }))).status).toBe(200)
    let [p] = requestPatches(log)
    expect(p.url).toContain('status=eq.requested')
    expect(p.body).toMatchObject({ status: 'approved', shipping_level: 'EXPEDITED' })

    log = mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'requested', country_code: 'IT', state_code: null }) }) })
    await (await load()).POST(post({ id: REQ_ID, action: 'approve' }));
    [p] = requestPatches(log)
    expect(p.body.shipping_level).toBe('PRIORITY_MAIL')

    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'requested' }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'approve', shippingLevel: 'TELEPORT' }))).status).toBe(400)
  })

  it('approve refuses: books not frozen yet; R1 again (trial/lapsed)', async () => {
    let log = mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'requested', books_frozen_at: null }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'approve' }))).status).toBe(409)
    log = mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'requested' }), lic: 'trial' }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'approve' }))).status).toBe(409)
    expect(requestPatches(log)).toHaveLength(0)
  })

  it('render: one child into their own storage folder; records keys; never calls createPrintJob', async () => {
    const log = mockSupabase({ user: OWNER, routes: routes({ children: childRows({ rendered: false }) }) })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'render', childId: CHILD1 }))
    expect(res.status).toBe(200)
    const uploads = calls(log, '/storage/v1/object/print-pdfs/', 'POST').map((l) => l.url.split('/print-pdfs/')[1])
    expect(uploads).toEqual([`writing-year/kid-auth-1/${REQ_ID}-interior.pdf`, `writing-year/kid-auth-1/${REQ_ID}-cover.pdf`])
    expect(lulu.createPrintJob).not.toHaveBeenCalled()
    const [p] = calls(log, '/rest/v1/class_print_request_children?', 'PATCH')
    expect(p.body).toMatchObject({ interior_key: uploads[0], cover_key: uploads[1], page_count: 32 })
    expect(calls(log, '/rest/v1/class_print_request_children?')[0].url).toContain(`&id=eq.${CHILD1}`)
  })

  it('render refuses: already rendered (unless rerender), removed child, before approval, once claimed', async () => {
    const h = async (opts, body = {}) => {
      mockSupabase({ user: OWNER, routes: routes(opts) })
      return (await (await load()).POST(post({ id: REQ_ID, action: 'render', childId: CHILD1, ...body }))).json()
    }
    expect((await h({})).code).toBe('already_rendered')
    expect((await h({}, { rerender: true })).child.rendered).toBe(true)
    expect((await h({ children: childRows({ rendered: false, status: 'removed' }) })).code).toBe('child_removed')
    expect((await h({ request: requestRow({ status: 'requested' }) })).code).toBe('bad_status')
    expect((await h({ request: requestRow({ submit_claimed_at: T }) }, { rerender: true })).code).toBe('bad_status')
  })
})

describe('step 2: review links, estimate, send', () => {
  it('detail: one-hour links for the owner; removed children flagged', async () => {
    const children = [child(CHILD1, 'Ann', 1, 'kid-auth-1'), child(CHILD2, 'Ben', 2, 'kid-auth-2', { status: 'removed' })]
    mockSupabase({ user: OWNER, routes: routes({ children }) })
    const body = await (await (await load()).GET(getReq(`?id=${REQ_ID}`))).json()
    expect(body.children[0].interior_url).toContain('e=3600')
    expect(body.children[1].removed).toBe(true)
    expect(body.active_count).toBe(1)
  })

  it('estimate: books × pages, read-only', async () => {
    const log = mockSupabase({ user: OWNER, routes: routes() })
    const body = await (await (await load()).POST(post({ id: REQ_ID, action: 'estimate' }))).json()
    expect(body).toMatchObject({ books: 2, pages_total: 64, all_rendered: true, shipping_level: 'GROUND' })
    expect(requestPatches(log)).toHaveLength(0)
    expect(lulu.createPrintJob).not.toHaveBeenCalled()
  })

  it('ONE Lulu print job: a line item per child, one address, school on the label, ops email on the job', async () => {
    process.env.PRINT_OPS_EMAIL = 'ops@mybooklab.app'
    lulu.createPrintJob.mockResolvedValue({ id: 98765, status: { name: 'CREATED' } })
    const log = mockSupabase({ user: OWNER, routes: routes() })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))
    expect(res.status).toBe(200)
    expect(lulu.createPrintJob).toHaveBeenCalledTimes(1)
    const payload = lulu.createPrintJob.mock.calls[0][0]
    expect(payload.external_id).toBe(REQ_ID)
    expect(payload.contact_email).toBe('ops@mybooklab.app')
    expect(payload.shipping_level).toBe('GROUND')
    expect(payload.shipping_address).toMatchObject({
      street1: '1 Main St', city: 'Springfield', state_code: 'IL', postcode: '62701', country_code: 'US',
      phone_number: '5550100199', email: 'rivera@school.org',
    })
    expect(payload.shipping_address.name).toContain('Attn Ms Rivera')
    expect(payload.shipping_address.name.length).toBeLessThanOrEqual(35)
    expect(payload.line_items).toHaveLength(2)
    for (const li of payload.line_items) {
      expect(li).toMatchObject({ quantity: 1, pod_package_id: '0850X0850FCSTDPB080CW444MXX' })
      expect(li.interior.source_url).toContain(`e=${60 * 60 * 24 * 7}`) // Lulu's links stay long
    }
    const patches = requestPatches(log)
    expect(patches[0].url).toContain('status=eq.approved')
    expect(patches[0].url).toContain('submit_claimed_at=is.null')
    expect(patches.at(-1).body).toMatchObject({ status: 'submitted', lulu_print_job_id: '98765', children_count: 2 })
  })

  it('removed children are left out at submit and the count is recomputed', async () => {
    lulu.createPrintJob.mockResolvedValue({ id: 1 })
    const children = [child(CHILD1, 'Ann', 1, 'kid-auth-1'), child(CHILD2, 'Ben', 2, 'kid-auth-2', { rendered: false, status: 'removed' })]
    const log = mockSupabase({ user: OWNER, routes: routes({ children }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))).status).toBe(200)
    expect(lulu.createPrintJob.mock.calls[0][0].line_items.map((l) => l.title)).toEqual(['My Writing Year — Ann'])
    expect(requestPatches(log).at(-1).body.children_count).toBe(1)
  })

  it('a double click cannot create a second order: the claim is taken → 409, Lulu untouched', async () => {
    const log = mockSupabase({ user: OWNER, routes: routes({ claim: 'taken' }) })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('already_submitting')
    expect(lulu.createPrintJob).not.toHaveBeenCalled()
    expect(requestPatches(log)).toHaveLength(1)
  })

  it('already claimed, or already submitted: no Lulu call (idempotent)', async () => {
    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ submit_claimed_at: T }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))).status).toBe(409)
    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'submitted', lulu_print_job_id: '1' }) }) })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))
    expect((await res.json()).idempotent).toBe(true)
    expect(lulu.createPrintJob).not.toHaveBeenCalled()
  })

  it('Lulu refuses → failed with the error, claim kept (never back to approved)', async () => {
    lulu.createPrintJob.mockRejectedValue(new Error('lulu createPrintJob: 400 bad address'))
    const log = mockSupabase({ user: OWNER, routes: routes() })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))).status).toBe(502)
    const last = requestPatches(log).at(-1)
    expect(last.body).toMatchObject({ status: 'failed', error: 'lulu createPrintJob: 400 bad address' })
    expect(last.body).not.toHaveProperty('submit_claimed_at')
  })

  it('job created, then the DB write fails: the job id is still recorded as submitted', async () => {
    lulu.createPrintJob.mockResolvedValue({ id: 555, status: { name: 'CREATED' } })
    let n = 0
    // Claim ok; the first "submitted" write fails; the recovery write succeeds.
    const log = mockSupabase({ user: OWNER, routes: routes({ patchFail: (c) => c.body.status === 'submitted' && n++ === 0 }) })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))
    expect(res.status).toBe(200)
    expect((await res.json()).lulu_print_job_id).toBe('555')
    const last = requestPatches(log).at(-1)
    expect(last.body).toMatchObject({ status: 'submitted', lulu_print_job_id: '555' })
    expect(last.body.error).toMatch(/Recorded after a failed write/)
    expect(lulu.createPrintJob).toHaveBeenCalledTimes(1)
    expect(requestPatches(log).some((p) => p.body.status === 'failed')).toBe(false)
  })

  it('job created and every write fails: 502 naming the job id, never "failed", claim left for reconcile', async () => {
    lulu.createPrintJob.mockResolvedValue({ id: 777 })
    const log = mockSupabase({ user: OWNER, routes: routes({ patchFail: (c) => !c.body.submit_claimed_at }) })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ code: 'record_failed', lulu_print_job_id: '777' })
    expect(requestPatches(log).some((p) => p.body.status === 'failed')).toBe(false)
  })

  it('every active child must be rendered first; the license is re-checked', async () => {
    mockSupabase({ user: OWNER, routes: routes({ children: childRows({ rendered: false }) }) })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))
    expect((await res.json()).code).toBe('not_rendered')
    mockSupabase({ user: OWNER, routes: routes({ lic: 'lapsed' }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'submit' }))).status).toBe(409)
    expect(lulu.createPrintJob).not.toHaveBeenCalled()
  })
})

describe('cancel / reconcile / mark', () => {
  it('cancel is refused while a claim exists (Lulu may have it) and after submission', async () => {
    for (const r of [requestRow({ submit_claimed_at: T }), requestRow({ status: 'failed', submit_claimed_at: T }), requestRow({ status: 'submitted' })]) {
      const log = mockSupabase({ user: OWNER, routes: routes({ request: r }) })
      expect((await (await load()).POST(post({ id: REQ_ID, action: 'cancel' }))).status).toBe(409)
      expect(requestPatches(log)).toHaveLength(0)
    }
    const log = mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'requested' }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'cancel' }))).status).toBe(200)
    expect(requestPatches(log)[0].url).toContain('submit_claimed_at=is.null')
  })

  it('reconcile with the Lulu job id: stuck approved+claimed → submitted', async () => {
    const log = mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ submit_claimed_at: T }) }) })
    const res = await (await load()).POST(post({ id: REQ_ID, action: 'reconcile', luluPrintJobId: '4242' }))
    expect(res.status).toBe(200)
    const [p] = requestPatches(log)
    expect(p.url).toContain('submit_claimed_at=not.is.null')
    expect(p.body).toMatchObject({ status: 'submitted', lulu_print_job_id: '4242' })
  })

  it('reconcile "checked Lulu — no order": releases the claim; then cancel works', async () => {
    const log = mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'failed', submit_claimed_at: T }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'reconcile', confirmNoOrder: true }))).status).toBe(200)
    expect(requestPatches(log)[0].body).toEqual(expect.objectContaining({ submit_claimed_at: null }))
    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'failed', submit_claimed_at: null }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'cancel' }))).status).toBe(200)
  })

  it('reconcile needs a claim and an explicit choice', async () => {
    mockSupabase({ user: OWNER, routes: routes() })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'reconcile', confirmNoOrder: true }))).status).toBe(409)
    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ submit_claimed_at: T }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'reconcile' }))).status).toBe(400)
  })

  it('mark only moves forward', async () => {
    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'submitted' }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'mark', status: 'shipped' }))).status).toBe(200)
    mockSupabase({ user: OWNER, routes: routes({ request: requestRow({ status: 'shipped' }) }) })
    expect((await (await load()).POST(post({ id: REQ_ID, action: 'mark', status: 'in_production' }))).status).toBe(409)
  })

  it('labelName keeps the contact and fits the label line', async () => {
    const { labelName } = await load()
    expect(labelName('Lincoln', 'Ms Rivera')).toBe('Lincoln – Attn Ms Rivera')
    const long = labelName('Abraham Lincoln Elementary School of Springfield', 'Ms Rivera')
    expect(long.length).toBeLessThanOrEqual(35)
    expect(long).toMatch(/^Abraham.*… – Attn Ms Rivera$/)
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
    const [p] = requestPatches(log)
    expect(p.url).toContain('status=eq.in_production')
    expect(p.body).toMatchObject({ status: 'shipped', tracking: { number: 'TRK', url: 'https://track', carrier: 'UPS' } })
    delete process.env.LULU_WEBHOOK_SECRET
  })
})

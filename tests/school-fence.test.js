// Every consumer-only endpoint must refuse a class account. A static check,
// because a student JWT is an ordinary authenticated JWT: any endpoint that
// forgets the guard silently accepts it.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

const FENCED = [
  'api/publish-book.js', 'api/unpublish-book.js', 'api/react-book.js', 'api/report-book.js', 'api/create-checkout.js',
  'api/buy-coins.js', 'api/spend-coins.js', 'api/customer-portal.js', 'api/delete-account.js',
  'api/cancel-deletion.js', 'api/classroom.js',
  ...readdirSync('api/print-orders').filter((f) => f.endsWith('.js') && !/ \d+\.js$/.test(f))
    .map((f) => `api/print-orders/${f}`)
    .filter((f) => /verifyJwt|requireUser/.test(readFileSync(f, 'utf8'))),
]

// print-orders/{create,get,list}.js authenticate a real user too, but via a
// local authUser(token) helper that hits /auth/v1/user directly instead of
// verifyJwt/requireUser — so they need their own discovery and their own
// assertion shape: rejectStudent({ appMetadata }, req), not rejectStudent(auth.
const LOCAL_AUTH_FENCED = readdirSync('api/print-orders')
  .filter((f) => f.endsWith('.js') && !/ \d+\.js$/.test(f))
  .map((f) => `api/print-orders/${f}`)
  .filter((f) => /authUser\(/.test(readFileSync(f, 'utf8')))

describe('student fence', () => {
  it.each(FENCED)('%s calls rejectStudent after authenticating', (file) => {
    const src = readFileSync(file, 'utf8')
    expect(src).toMatch(/import \{[^}]*rejectStudent[^}]*\} from '(\.\.?\/)+_school\.js'/)
    expect(src).toMatch(/rejectStudent\(\s*auth/)
  })

  it.each(LOCAL_AUTH_FENCED)('%s (local authUser) refuses students', (file) => {
    const src = readFileSync(file, 'utf8')
    expect(src).toMatch(/import \{[^}]*rejectStudent[^}]*\} from '(\.\.?\/)+_school\.js'/)
    expect(src).toMatch(/rejectStudent\(\s*\{[^}]*appMetadata/)
  })

  it.each(['api/generate-image.js', 'api/generate-avatar.js'])('%s refuses a sourceImage/photo from a student', (file) => {
    const src = readFileSync(file, 'utf8')
    expect(src).toMatch(/sourceImage[\s\S]{0,200}isStudent\(|isStudent\([\s\S]{0,200}sourceImage/)
  })

  it.each(['api/generate-image.js', 'api/generate-avatar.js'])('%s meters students from the class allowance', (file) => {
    expect(readFileSync(file, 'utf8')).toMatch(/enforceStudentImageCap\(/)
  })
})

describe('enforceStudentImageCap', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  })
  const req = new Request('https://app.test/api/generate-image')
  const student = { appMetadata: { role: 'student', student_id: 's1' } }

  it('lets consumers through without calling the RPC', async () => {
    globalThis.fetch = vi.fn()
    const { enforceStudentImageCap } = await import('../api/_school.js')
    expect(await enforceStudentImageCap({ appMetadata: {} }, req)).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
  it('spends from the class and returns null when allowed', async () => {
    globalThis.fetch = vi.fn(async () => new Response('true'))
    const { enforceStudentImageCap } = await import('../api/_school.js')
    expect(await enforceStudentImageCap(student, req)).toBeNull()
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(String(url)).toContain('/rest/v1/rpc/school_bump_image')
    expect(JSON.parse(init.body)).toEqual({ p_student_id: 's1', p_daily_limit: 15 })
  })
  it('429s with a class code when the allowance is used up', async () => {
    globalThis.fetch = vi.fn(async () => new Response('false'))
    const { enforceStudentImageCap } = await import('../api/_school.js')
    const r = await enforceStudentImageCap(student, req)
    expect(r.status).toBe(429)
    expect((await r.json()).code).toBe('class_image_limit')
  })
  it('fails closed when the RPC errors', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 500 }))
    const { enforceStudentImageCap } = await import('../api/_school.js')
    expect((await enforceStudentImageCap(student, req)).status).toBe(503)
  })
})

describe('print-orders local-auth fence (behaviour)', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  })

  it('list.js refuses a student before ever querying print_orders', async () => {
    const calls = []
    globalThis.fetch = vi.fn(async (url) => {
      calls.push(String(url))
      if (String(url).includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'u1', app_metadata: { role: 'student' } }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    const { default: handler } = await import('../api/print-orders/list.js')
    const req = new Request('https://app.test/api/print-orders/list', {
      headers: { authorization: 'Bearer test-token' },
    })
    const res = await handler(req)
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('student_forbidden')
    expect(calls.some((u) => u.includes('/rest/v1/print_orders'))).toBe(false)
    expect(calls.some((u) => u.includes('/rest/v1/user_books'))).toBe(false)
  })
})

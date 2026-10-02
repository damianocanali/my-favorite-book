// Review §7 items 13 + 16: admin_access_log writes from every admin
// endpoint, the owner viewer, and the owner-only bulk picture reset.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const URL_ = 'https://example.supabase.co'
const OWNER = '11111111-1111-4111-8111-111111111111'
const CLASS = '6f1c1b1e-0000-4000-8000-000000000001'
const S1 = '6f1c1b1e-0000-4000-8000-0000000000a1'
const S2 = '6f1c1b1e-0000-4000-8000-0000000000a2'

let log
let routes
const origEnv = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.OWNER_USER_ID = OWNER
  log = []
  routes = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url)
    const method = init.method || 'GET'
    let body
    if (typeof init.body === 'string') { try { body = JSON.parse(init.body) } catch { body = init.body } }
    log.push({ method, u, body, headers: init.headers })
    if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: init.headers.Authorization === 'Bearer owner' ? OWNER : 'someone-else' }))
    for (const r of routes) if (r.method === method && u.includes(r.match)) return r.reply(log.at(-1))
    if (method === 'POST' && u.includes('/rest/v1/admin_access_log')) return new Response(null, { status: 201 })
    return new Response('[]')
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { process.env = { ...origEnv }; vi.restoreAllMocks() })

const auth = (who = 'owner') => ({ authorization: `Bearer ${who}` })
const logRows = () => log.filter((l) => l.method === 'POST' && l.u.includes('/rest/v1/admin_access_log')).map((l) => l.body)

describe('migration 031', () => {
  const sql = readFileSync(new URL('../supabase-migrations/031_admin_access_log.sql', import.meta.url), 'utf8')
  it('creates the table with RLS on, no policies, client grants revoked, no FK on actor', () => {
    expect(sql).toMatch(/create table if not exists public\.admin_access_log/)
    expect(sql).toMatch(/alter table public\.admin_access_log enable row level security/)
    expect(sql).toMatch(/revoke all on public\.admin_access_log from anon, authenticated/)
    expect(sql).not.toMatch(/create policy/i)
    expect(sql).not.toMatch(/actor uuid[^,]*references/)
  })
})

describe('admin endpoints write the access log', () => {
  it('usage.view', async () => {
    const { default: handler } = await import('../api/admin/usage.js')
    const res = await handler(new Request('https://app.test/api/admin/usage?days=7&reason=monthly%20costs', { headers: auth() }))
    expect(res.status).toBe(200)
    expect(logRows()).toEqual([expect.objectContaining({ actor: OWNER, action: 'usage.view', target_table: 'usage_log', reason: 'monthly costs' })])
  })

  it('usage: non-owner is 403 and nothing is logged', async () => {
    const { default: handler } = await import('../api/admin/usage.js')
    const res = await handler(new Request('https://app.test/api/admin/usage', { headers: auth('x') }))
    expect(res.status).toBe(403)
    expect(logRows()).toHaveLength(0)
  })

  it('class-prints list + POST action are logged with ids only', async () => {
    const REQ = '6f1c1b1e-0000-4000-8000-0000000000ff'
    routes.push({ method: 'GET', match: `/rest/v1/class_print_requests?id=eq.${REQ}`, reply: () => new Response(JSON.stringify([{ id: REQ, classroom_id: CLASS, status: 'requested' }])) })
    const { GET, POST } = await import('../api/admin/class-prints.js')
    expect((await GET(new Request('https://app.test/api/admin/class-prints', { headers: auth() }))).status).toBe(200)
    await POST(new Request('https://app.test/api/admin/class-prints', {
      method: 'POST', headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ id: REQ, action: 'nope', reason: 'QA' }),
    }))
    const rows = logRows()
    expect(rows[0]).toMatchObject({ action: 'class_prints.list', actor: OWNER })
    expect(rows[1]).toMatchObject({ action: 'class_prints.nope', target_id: REQ, reason: 'QA', detail: { classroom_id: CLASS } })
  })

  it('a failed log write does not lock the owner out of a read', async () => {
    routes.push({ method: 'POST', match: '/rest/v1/admin_access_log', reply: () => new Response('no table', { status: 404 }) })
    const { default: handler } = await import('../api/admin/usage.js')
    expect((await handler(new Request('https://app.test/api/admin/usage', { headers: auth() }))).status).toBe(200)
  })
})

describe('GET /api/admin/access-log', () => {
  it('owner only; pages by id; logs the view', async () => {
    const rows = Array.from({ length: 2 }, (_, i) => ({ id: 10 - i, action: 'usage.view', at: '2026-10-01T00:00:00Z', detail: {} }))
    routes.push({ method: 'GET', match: '/rest/v1/admin_access_log', reply: () => new Response(JSON.stringify(rows)) })
    const { default: handler } = await import('../api/admin/access-log.js')
    expect((await handler(new Request('https://app.test/api/admin/access-log', { headers: auth('x') }))).status).toBe(403)
    const res = await handler(new Request('https://app.test/api/admin/access-log?limit=2&before=11', { headers: auth() }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ rows, next_before: 9 })
    const read = log.find((l) => l.method === 'GET' && l.u.includes('/rest/v1/admin_access_log'))
    expect(read.u).toContain('id=lt.11')
    expect(read.u).toContain('limit=2')
    expect(logRows().at(-1)).toMatchObject({ action: 'access_log.view' })
  })
})

describe('/api/admin/picture-reset (bulk, pepper rotation)', () => {
  const count = (n) => ({ method: 'HEAD', match: '/rest/v1/class_students', reply: () => new Response(null, { status: 206, headers: { 'content-range': `0-0/${n}` } }) })
  const page = (rows) => ({ method: 'GET', match: '/rest/v1/class_students', reply: () => new Response(JSON.stringify(rows)) })
  const post = async (body, who = 'owner') => {
    const { POST } = await import('../api/admin/picture-reset.js')
    return POST(new Request('https://app.test/api/admin/picture-reset', {
      method: 'POST', headers: { ...auth(who), 'content-type': 'application/json' }, body: JSON.stringify(body),
    }))
  }
  const good = { confirm: 'RESET STUDENT PICTURES', reason: 'pepper rotated', expectedCount: 2 }

  it('GET previews the count and logs it', async () => {
    routes.push(count(2))
    const { GET } = await import('../api/admin/picture-reset.js')
    const res = await GET(new Request('https://app.test/api/admin/picture-reset', { headers: auth() }))
    expect(await res.json()).toMatchObject({ active_students: 2, confirm_phrase: 'RESET STUDENT PICTURES' })
    expect(logRows()[0]).toMatchObject({ action: 'picture_reset.preview' })
  })

  it('refuses non-owners, a missing phrase, a missing reason, and a stale count — changing nothing', async () => {
    routes.push(count(3))
    expect((await post(good, 'x')).status).toBe(403)
    expect((await post({ ...good, confirm: 'reset' })).status).toBe(400)
    expect((await post({ ...good, reason: '  ' })).status).toBe(400)
    const stale = await post(good)
    expect(stale.status).toBe(409)
    expect((await stale.json()).code).toBe('count_changed')
    expect(log.some((l) => l.method === 'PATCH' || l.method === 'PUT')).toBe(false)
  })

  it('no audit row, no reset (fail closed)', async () => {
    routes.push(count(2), { method: 'POST', match: '/rest/v1/admin_access_log', reply: () => new Response('x', { status: 500 }) })
    const res = await post(good)
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('log_unavailable')
    expect(log.some((l) => l.method === 'PATCH' || l.method === 'PUT')).toBe(false)
  })

  it('logs first, then rotates passwords, kills the old secret, signs out — never returns pictures', async () => {
    routes.push(
      count(2),
      page([{ id: S1, auth_user_id: 'a1', secret_version: 1 }, { id: S2, auth_user_id: 'a2', secret_version: 7 }]),
      { method: 'PUT', match: '/auth/v1/admin/users/', reply: () => new Response('{}') },
      { method: 'PATCH', match: '/rest/v1/class_students', reply: () => new Response(null, { status: 204 }) },
      { method: 'POST', match: 'school_sign_out_user', reply: () => new Response('null') },
    )
    const res = await post(good)
    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out).toEqual({ processed: 2, failed: [], next_after: S2, done: true })
    expect(JSON.stringify(out)).not.toMatch(/pictures/)

    const firstLog = log.findIndex((l) => l.u.includes('admin_access_log'))
    const firstChange = log.findIndex((l) => l.method === 'PUT' || l.method === 'PATCH')
    expect(firstLog).toBeLessThan(firstChange)
    expect(logRows()[0]).toMatchObject({ action: 'picture_reset.run', reason: 'pepper rotated', detail: { active_students: 2 } })
    expect(logRows()[1]).toMatchObject({ action: 'picture_reset.batch', detail: { processed: 2, failed: 0 } })

    const patches = log.filter((l) => l.method === 'PATCH')
    expect(patches).toHaveLength(2)
    for (const p of patches) {
      expect(p.body.secret_hash).toMatch(/^[0-9a-f]{64}$/)
      expect(p.body).toMatchObject({ failed_attempts: 0, locked_until: null, hard_locked: false })
    }
    expect(patches.map((p) => p.body.secret_version).sort()).toEqual([2, 8])
    expect(patches[0].body.secret_hash).not.toBe(patches[1].body.secret_hash)
    expect(log.filter((l) => l.method === 'PUT')).toHaveLength(2)
    expect(log.filter((l) => l.u.includes('school_sign_out_user'))).toHaveLength(2)
  })

  it('reports per-student failures and continues', async () => {
    routes.push(
      count(2),
      page([{ id: S1, auth_user_id: 'a1', secret_version: 1 }, { id: S2, auth_user_id: 'a2', secret_version: 1 }]),
      { method: 'PUT', match: '/auth/v1/admin/users/a1', reply: () => new Response('x', { status: 500 }) },
      { method: 'PUT', match: '/auth/v1/admin/users/', reply: () => new Response('{}') },
      { method: 'PATCH', match: '/rest/v1/class_students', reply: () => new Response(null, { status: 204 }) },
      { method: 'POST', match: 'school_sign_out_user', reply: () => new Response('null') },
    )
    const out = await (await post(good)).json()
    expect(out.failed).toEqual([S1])
    expect(out.processed).toBe(1)
  })
})

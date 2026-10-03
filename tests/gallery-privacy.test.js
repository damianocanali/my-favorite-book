// The public gallery API never returns an author's account id (review
// §7.8): is_owner and an opaque author handle instead; blocking works by
// handle (or slug) and actually hides the author's books.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { sealAuthorRef, openAuthorRef } from '../lib/authorRef.js'

const URL_ = 'https://example.supabase.co'
const AUTHOR = '11111111-2222-4333-8444-555555555555'
const READER = '99999999-2222-4333-8444-555555555555'
const ROW = { slug: 'dragons-1', title: 'Dragons', author_name: 'Ann', author_age: 7, reaction_counts: {}, user_id: AUTHOR }

beforeEach(() => {
  vi.resetModules()
  process.env.SUPABASE_URL = URL_
  process.env.SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
})

function mock({ user = null, rows = [ROW], blocked = [] } = {}) {
  const log = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url)
    log.push({ method: init.method || 'GET', url: u, body: init.body ? JSON.parse(init.body) : undefined })
    if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(user ?? {}), { status: user ? 200 : 401 })
    if (u.includes('/rest/v1/blocked_authors?user_id=eq.') && (init.method || 'GET') === 'GET') return new Response(JSON.stringify(blocked.map((b) => ({ blocked_user_id: b }))))
    if (u.includes('/rest/v1/published_books')) return new Response(JSON.stringify(rows))
    return new Response('[]')
  })
  return log
}

const get = async (q, token) => (await import('../api/publish-book.js')).default(
  new Request(`https://app.test/api/publish-book?${q}`, { headers: token ? { authorization: `Bearer ${token}` } : {} })
)

describe('author handle', () => {
  it('round-trips, differs per read, rejects forgeries', async () => {
    const a = await sealAuthorRef(AUTHOR)
    const b = await sealAuthorRef(AUTHOR)
    expect(a).not.toBe(b)
    expect(a).not.toContain(AUTHOR)
    expect(await openAuthorRef(a)).toBe(AUTHOR)
    expect(await openAuthorRef('ar1.AAAA')).toBe(null)
    expect(await openAuthorRef(AUTHOR)).toBe(null)
  })
})

describe('GET /api/publish-book', () => {
  it('never returns the account id; anonymous readers are not owners', async () => {
    const log = mock()
    const res = await get('recent=true')
    const [book] = await res.json()
    expect(JSON.stringify(book)).not.toContain(AUTHOR)
    expect(book.is_owner).toBe(false)
    expect(book.author_ref).toMatch(/^ar1\./)
    // Old app builds read user_id to block: it now holds the same handle.
    expect(book.user_id).toBe(book.author_ref)
    expect(log.find((l) => l.url.includes('published_books')).url).not.toContain('select=*')
  })

  it('tells the signed-in author it is theirs', async () => {
    mock({ user: { id: AUTHOR, app_metadata: {} } })
    const book = await (await get('slug=dragons-1', 'jwt')).json()
    expect(book.is_owner).toBe(true)
    expect(JSON.stringify(book)).not.toContain(AUTHOR)
  })

  it("hides a blocked author's books from that reader", async () => {
    mock({ user: { id: READER, app_metadata: {} }, blocked: [AUTHOR] })
    expect(await (await get('recent=true', 'jwt')).json()).toEqual([])
  })

  it('a bad token still gets the public list', async () => {
    mock()
    const res = await get('featured=true', 'expired')
    expect(res.status).toBe(200)
    expect((await res.json())).toHaveLength(1)
  })
})

describe('POST /api/report-book block', () => {
  const post = async (body) => (await import('../api/report-book.js')).default(new Request('https://app.test/api/report-book', {
    method: 'POST', headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' }, body: JSON.stringify(body),
  }))

  it('blocks by handle', async () => {
    const log = mock({ user: { id: READER, app_metadata: {} } })
    const ref = await sealAuthorRef(AUTHOR)
    const res = await post({ action: 'block', authorRef: ref })
    expect(res.status).toBe(200)
    const ins = log.find((l) => l.method === 'POST' && l.url.includes('/rest/v1/blocked_authors'))
    expect(ins.body).toEqual({ user_id: READER, blocked_user_id: AUTHOR })
  })

  it('accepts the handle in the legacy userId field (older app builds)', async () => {
    const log = mock({ user: { id: READER, app_metadata: {} } })
    const res = await post({ action: 'block', userId: await sealAuthorRef(AUTHOR) })
    expect(res.status).toBe(200)
    expect(log.find((l) => l.method === 'POST' && l.url.includes('blocked_authors')).body.blocked_user_id).toBe(AUTHOR)
  })

  it('blocks by slug', async () => {
    const log = mock({ user: { id: READER, app_metadata: {} } })
    expect((await post({ action: 'block', slug: 'dragons-1' })).status).toBe(200)
    expect(log.find((l) => l.method === 'POST' && l.url.includes('blocked_authors')).body.blocked_user_id).toBe(AUTHOR)
  })

  it('rejects a forged handle', async () => {
    mock({ user: { id: READER, app_metadata: {} } })
    expect((await post({ action: 'block', authorRef: 'ar1.forged' })).status).toBe(400)
  })
})

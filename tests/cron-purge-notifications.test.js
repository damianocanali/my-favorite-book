// api/cron/purge-deletions.js also prunes bell rows older than 90 days.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  process.env.CRON_SECRET = 'cron-secret'
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-27T03:00:00.000Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  delete process.env.CRON_SECRET
  vi.restoreAllMocks()
})

const run = async () =>
  (await import('../api/cron/purge-deletions.js')).default(
    new Request('https://mybooklab.app/api/cron/purge-deletions', { headers: { authorization: 'Bearer cron-secret' } })
  )

describe('purge-deletions: teacher_notifications retention', () => {
  it('deletes bell rows created more than 90 days ago', async () => {
    const log = []
    globalThis.fetch = vi.fn(async (url, init = {}) => {
      log.push({ url: decodeURIComponent(String(url)), method: init.method || 'GET' })
      return new Response('[]')
    })
    const res = await run()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ notifications_pruned: true })
    const del = log.find((l) => l.method === 'DELETE' && l.url.includes('/rest/v1/teacher_notifications'))
    expect(del.url).toContain('created_at=lt.2026-06-29T03:00:00.000Z')
  })

  it('a failed prune is reported, not fatal', async () => {
    globalThis.fetch = vi.fn(async (url, init = {}) =>
      (init.method === 'DELETE' ? new Response('{}', { status: 500 }) : new Response('[]')))
    const res = await run()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ notifications_pruned: false })
  })

  it('still refuses without the cron secret', async () => {
    globalThis.fetch = vi.fn()
    const res = await (await import('../api/cron/purge-deletions.js')).default(new Request('https://x/api/cron/purge-deletions'))
    expect(res.status).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

describe('purge-deletions: owner alert (review §7.26)', () => {
  it('emails the owner (counts only) when a purge fails', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'x <x@mybooklab.app>'
    process.env.OWNER_ALERT_EMAIL = 'owner@example.com'
    const sent = []
    globalThis.fetch = vi.fn(async (url, init = {}) => {
      const u = String(url)
      if (u.includes('api.resend.com')) { sent.push(JSON.parse(init.body)); return new Response('{}') }
      if (u.includes('account_deletions?requested_at')) return new Response(JSON.stringify([{ user_id: 'u-1' }]))
      if (u.includes('/auth/v1/admin/users/')) return new Response('{}', { status: 500 })
      return new Response('[]')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await run()
    expect((await res.json()).failed).toBe(1)
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toEqual(['owner@example.com'])
    expect(sent[0].text).toContain('failed: 1')
    expect(sent[0].text).not.toContain('u-1')
    delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM; delete process.env.OWNER_ALERT_EMAIL
  })
})

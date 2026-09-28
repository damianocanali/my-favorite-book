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

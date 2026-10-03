// Review §7.23: purgeUser deletes the Stripe Customer and the RevenueCat
// subscriber, never blocks on them, and queues failures for the cron.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { purgeUser, purgeClassroom } from '../lib/deleteUser.js'
import { retryVendorDeletions, MAX_VENDOR_ATTEMPTS } from '../lib/vendorDeletion.js'

const ENV = { supabaseUrl: 'https://example.supabase.co', serviceKey: 'service-key' }
const USER = '11111111-2222-3333-4444-555555555555'
let log

function mock(over = {}) {
  log = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url)
    const method = init.method || 'GET'
    log.push({ method, u, body: init.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined })
    for (const [k, v] of Object.entries(over)) {
      if (u.includes(k) && (!v.method || v.method === method)) return new Response(JSON.stringify(v.body ?? []), { status: v.status ?? 200 })
    }
    return new Response('[]')
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const SUBS = { 'subscriptions?user_id=eq.': { method: 'GET', body: [{ stripe_subscription_id: 'sub_1', stripe_customer_id: 'cus_1' }] } }

describe('purgeUser vendor hooks', () => {
  it('deletes the Stripe customer and the RevenueCat subscriber when keys are set', async () => {
    mock(SUBS)
    const r = await purgeUser(USER, { ...ENV, stripeSecretKey: 'sk', revenueCatKey: 'rc' })
    expect(r).toEqual({ ok: true })
    expect(log.some((l) => l.method === 'DELETE' && l.u === 'https://api.stripe.com/v1/customers/cus_1')).toBe(true)
    expect(log.some((l) => l.method === 'DELETE' && l.u === `https://api.revenuecat.com/v1/subscribers/${USER}`)).toBe(true)
    // Both before the auth delete.
    const auth = log.findIndex((l) => l.u.includes(`/auth/v1/admin/users/${USER}`))
    expect(log.findIndex((l) => l.u.includes('api.revenuecat.com'))).toBeLessThan(auth)
  })

  it('makes no vendor calls without keys', async () => {
    mock(SUBS)
    await purgeUser(USER, ENV)
    expect(log.some((l) => /stripe\.com|revenuecat\.com/.test(l.u))).toBe(false)
  })

  it('a vendor failure is queued and never blocks the purge', async () => {
    mock({
      ...SUBS,
      'api.stripe.com/v1/customers/': { status: 500, body: {} },
      'api.revenuecat.com': { status: 503, body: {} },
    })
    const r = await purgeUser(USER, { ...ENV, stripeSecretKey: 'sk', revenueCatKey: 'rc' })
    expect(r).toEqual({ ok: true })
    const queued = log.filter((l) => l.method === 'POST' && l.u.includes('/rest/v1/vendor_deletion_queue'))
    expect(queued.map((q) => q.body)).toEqual([
      { vendor: 'stripe', external_id: 'cus_1', attempts: 1, last_status: 500 },
      { vendor: 'revenuecat', external_id: USER, attempts: 1, last_status: 503 },
    ])
    expect(log.some((l) => l.method === 'DELETE' && l.u.includes(`/auth/v1/admin/users/${USER}`))).toBe(true)
  })

  it('treats 404 (already gone) as done', async () => {
    mock({ 'api.revenuecat.com': { status: 404, body: {} } })
    await purgeUser(USER, { ...ENV, revenueCatKey: 'rc' })
    expect(log.some((l) => l.u.includes('vendor_deletion_queue'))).toBe(false)
  })

  it('class purges skip vendors for students', async () => {
    mock({ 'class_students?classroom_id=eq.c1': { body: [{ auth_user_id: 'kid-1' }] } })
    await purgeClassroom({ id: 'c1', code: 'ABC234' }, { ...ENV, stripeSecretKey: 'sk', revenueCatKey: 'rc' })
    expect(log.some((l) => /stripe\.com|revenuecat\.com/.test(l.u))).toBe(false)
  })
})

describe('retryVendorDeletions', () => {
  const sb = (path, init = {}) => fetch(`${ENV.supabaseUrl}${path}`, init)

  it('retries queued rows, deletes them on success, bumps attempts on failure', async () => {
    mock({
      'vendor_deletion_queue?vendor=in.(stripe,revenuecat)&attempts=lt.': { method: 'GET', body: [
        { id: 1, vendor: 'stripe', external_id: 'cus_1', attempts: 1 },
        { id: 2, vendor: 'revenuecat', external_id: USER, attempts: 3 },
      ] },
      'api.revenuecat.com': { status: 500, body: {} },
    })
    const out = await retryVendorDeletions(sb, { stripeSecretKey: 'sk', revenueCatKey: 'rc' })
    expect(out).toMatchObject({ retried: 2, done: 1, failed: 1, exhausted: 0 })
    expect(log.some((l) => l.method === 'DELETE' && l.u.endsWith('vendor_deletion_queue?id=eq.1'))).toBe(true)
    const patch = log.find((l) => l.method === 'PATCH' && l.u.endsWith('vendor_deletion_queue?id=eq.2'))
    expect(patch.body).toMatchObject({ attempts: 4, last_status: 500 })
    expect(log.find((l) => l.u.includes('attempts=lt.')).u).toContain(`attempts=lt.${MAX_VENDOR_ATTEMPTS}`)
  })

  it('reads only configured vendors, so an unconfigured one takes no batch slots', async () => {
    mock()
    await retryVendorDeletions(sb, { stripeSecretKey: 'sk' })
    expect(log.find((l) => l.u.includes('attempts=lt.')).u).toContain('vendor=in.(stripe)&')
    log.length = 0
    expect(await retryVendorDeletions(sb, {})).toEqual({ retried: 0, done: 0, failed: 0, exhausted: 0 })
    expect(log).toHaveLength(0)
  })

  it('counts maxed-out rows as failures (so the owner is alerted)', async () => {
    log = []
    globalThis.fetch = vi.fn(async (url, init = {}) => {
      const u = String(url)
      log.push({ method: init.method || 'GET', u })
      if (u.includes('attempts=gte.')) return new Response('[]', { headers: { 'content-range': '0-0/2' } })
      return new Response('[]')
    })
    const out = await retryVendorDeletions(sb, { stripeSecretKey: 'sk' })
    expect(out).toMatchObject({ exhausted: 2, failed: 2 })
  })

  it('dry run retries nothing', async () => {
    mock({ 'attempts=lt.': { method: 'GET', body: [{ id: 1, vendor: 'stripe', external_id: 'cus_1', attempts: 1 }] } })
    const out = await retryVendorDeletions(sb, { stripeSecretKey: 'sk' }, { dryRun: true })
    expect(out.would_retry).toBe(1)
    expect(log.some((l) => l.u.includes('api.stripe.com'))).toBe(false)
  })
})

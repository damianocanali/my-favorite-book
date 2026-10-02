// Consumer print PDFs: deleted 90 days after the order is final (review §7.5).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { purgeOldOrderPdfs, ORDER_PDF_RETENTION_DAYS, DEAD_ORDER_PDF_RETENTION_DAYS } from '../lib/print/orderRetention.js'

const ENV = { supabaseUrl: 'https://x.supabase.co', serviceKey: 'svc' }
let log
function mock(over = {}) {
  log = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url).replace(ENV.supabaseUrl, '')
    const method = init.method || 'GET'
    log.push({ method, u, body: init.body ? JSON.parse(init.body) : undefined })
    for (const [k, v] of Object.entries(over)) {
      if (u.includes(k) && (!v.method || v.method === method)) return new Response(JSON.stringify(v.body ?? []), { status: v.status ?? 200 })
    }
    return new Response('[]')
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

const now = Date.parse('2026-12-01T00:00:00Z')

describe('consumer print PDF retention', () => {
  it('purges shipped orders after 90 days, clears the URLs and stamps them', async () => {
    mock({
      '/rest/v1/print_orders?status=in.(shipped': { method: 'GET', body: [{ id: 'o1' }] },
      '/storage/v1/object/list/print-pdfs': { body: [{ name: 'interior.pdf' }, { name: 'cover.pdf' }] },
    })
    const out = await purgeOldOrderPdfs({ ...ENV, now })
    expect(out).toEqual({ purged: 1, failed: 0 })
    const q = log[0].u
    expect(q).toContain('status=in.(shipped,delivered)')
    expect(q).toContain(`updated_at=lt.${encodeURIComponent(new Date(now - ORDER_PDF_RETENTION_DAYS * 86400000).toISOString())}`)
    expect(q).toContain('pdfs_purged_at=is.null')
    const q2 = log[1].u
    expect(q2).toContain('status=in.(refunded,failed)')
    expect(q2).toContain(`updated_at=lt.${encodeURIComponent(new Date(now - DEAD_ORDER_PDF_RETENTION_DAYS * 86400000).toISOString())}`)
    const del = log.find((l) => l.method === 'DELETE')
    expect(del.body.prefixes).toEqual(['o1/interior.pdf', 'o1/cover.pdf'])
    const patch = log.find((l) => l.method === 'PATCH')
    expect(patch.u).toContain('print_orders?id=eq.o1')
    expect(patch.body).toMatchObject({ interior_pdf_url: null, cover_pdf_url: null, pdfs_purged_at: new Date(now).toISOString() })
  })

  it('a storage failure leaves the order unstamped for tomorrow', async () => {
    mock({
      '/rest/v1/print_orders?status=in.(refunded': { method: 'GET', body: [{ id: 'o1' }] },
      '/storage/v1/object/list/print-pdfs': { body: [{ name: 'interior.pdf' }] },
      '/storage/v1/object/print-pdfs': { method: 'DELETE', status: 500, body: {} },
    })
    const out = await purgeOldOrderPdfs({ ...ENV, now })
    expect(out).toEqual({ purged: 0, failed: 1 })
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })

  it('a failed list is reported as a failure', async () => {
    mock({ '/rest/v1/print_orders?status=in.': { status: 500, body: {} } })
    expect(await purgeOldOrderPdfs({ ...ENV, now })).toEqual({ purged: 0, failed: 1 })
  })
})

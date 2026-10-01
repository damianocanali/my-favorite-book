import { describe, it, expect, beforeEach, vi } from 'vitest'
import { purgeOldClassPrintPdfs, PRINT_PDF_RETENTION_DAYS } from '../lib/school/printRetention.js'

const ENV = { supabaseUrl: 'https://x.supabase.co', serviceKey: 'svc' }
let log
function mock(over = {}) {
  log = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url).replace(ENV.supabaseUrl, '')
    const method = init.method || 'GET'
    log.push({ method, u, body: init.body ? JSON.parse(init.body) : undefined })
    for (const [k, v] of Object.entries(over)) if (u.includes(k) && (!v.method || v.method === method)) return new Response(JSON.stringify(v.body ?? []), { status: v.status ?? 200 })
    return new Response('[]')
  })
}

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))

describe('class print PDF retention', () => {
  it('deletes a shipped request\'s PDFs after 30 days, clears the keys and stamps it', async () => {
    mock({
      'status=eq.shipped': { body: [{ id: 'r1' }] },
      'class_print_request_children?request_id=eq.r1&select': { body: [{ id: 'c1', interior_key: 'writing-year/a/r1-interior.pdf', cover_key: 'writing-year/a/r1-cover.pdf' }] },
    })
    const now = Date.parse('2026-12-01T00:00:00Z')
    const out = await purgeOldClassPrintPdfs({ ...ENV, now })
    expect(out).toEqual({ purged: 1, failed: 0 })
    const q = log.find((l) => l.u.includes('status=eq.shipped')).u
    expect(q).toContain(`shipped_at=lt.${encodeURIComponent(new Date(now - PRINT_PDF_RETENTION_DAYS * 86400000).toISOString())}`)
    expect(q).toContain('pdfs_purged_at=is.null')
    const del = log.find((l) => l.method === 'DELETE')
    expect(del.u).toBe('/storage/v1/object/print-pdfs')
    expect(del.body.prefixes).toEqual(['writing-year/a/r1-interior.pdf', 'writing-year/a/r1-cover.pdf'])
    expect(log.find((l) => l.method === 'PATCH' && l.u.includes('class_print_requests')).body.pdfs_purged_at).toBeTruthy()
  })

  it('failed requests are purged too (30 days after their last change)', async () => {
    mock()
    await purgeOldClassPrintPdfs(ENV)
    const q = log.find((l) => l.u.includes('status=eq.failed'))
    expect(q.u).toContain('updated_at=lt.')
    expect(q.u).toContain('pdfs_purged_at=is.null')
  })

  it('a storage failure leaves it for tomorrow (not stamped)', async () => {
    mock({
      'status=eq.canceled': { body: [{ id: 'r2' }] },
      'class_print_request_children?request_id=eq.r2&select': { body: [{ interior_key: 'k1', cover_key: 'k2' }] },
      '/storage/v1/object/print-pdfs': { method: 'DELETE', status: 500, body: {} },
    })
    const out = await purgeOldClassPrintPdfs(ENV)
    expect(out).toEqual({ purged: 0, failed: 1 })
    expect(log.some((l) => l.method === 'PATCH')).toBe(false)
  })
})

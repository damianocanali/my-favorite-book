// Consumer printed-book PDFs (print-pdfs/<order id>/{interior,cover}.pdf,
// written by api/print-orders/pdf-worker.js) are kept only while a reprint
// or a support question can still need them. Run nightly by
// api/cron/retention.js:
//   * shipped / delivered (the box left Lulu): deleted after 90 days;
//   * refunded / failed (nothing will be printed): deleted after 30 days.
// updated_at is the order's last change (trigger in 005), i.e. when it
// reached that state. Best-effort per order: a failure leaves
// pdfs_purged_at null and the next night retries. Needs migration 026.
import { purgeStoragePrefix, printOrderPdfPrefix } from '../deleteUser.js'

export const ORDER_PDF_RETENTION_DAYS = 90
export const DEAD_ORDER_PDF_RETENTION_DAYS = 30
const BUCKET = 'print-pdfs'
const BATCH = 50
const WINDOWS = [
  { statuses: ['shipped', 'delivered'], days: ORDER_PDF_RETENTION_DAYS },
  { statuses: ['refunded', 'failed'], days: DEAD_ORDER_PDF_RETENTION_DAYS },
]

function makeSb(supabaseUrl, serviceKey) {
  return (path, init = {}) => fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
}

/// The orders due tonight (both windows), ids only. null on a failed read.
async function dueOrders(sb, now) {
  const ids = []
  for (const w of WINDOWS) {
    const cutoff = encodeURIComponent(new Date(now - w.days * 86400000).toISOString())
    const res = await sb(
      `/rest/v1/print_orders?status=in.(${w.statuses.join(',')})&updated_at=lt.${cutoff}&pdfs_purged_at=is.null&select=id&order=updated_at.asc&limit=${BATCH}`
    )
    if (!res.ok) {
      console.error('[order-retention] could not list orders', res.status)
      return null
    }
    const rows = await res.json().catch(() => null)
    if (!Array.isArray(rows)) return null
    ids.push(...rows.map((r) => r.id))
  }
  return ids
}

export async function purgeOldOrderPdfs({ supabaseUrl, serviceKey, now = Date.now(), dryRun = false }) {
  const sb = makeSb(supabaseUrl, serviceKey)
  const ids = await dueOrders(sb, now)
  if (!ids) return { purged: 0, failed: 1 }
  if (dryRun) return { purged: 0, failed: 0, would_purge: ids.length, order_ids: ids }

  let purged = 0
  let failed = 0
  for (const id of ids) {
    try {
      const r = await purgeStoragePrefix(sb, BUCKET, printOrderPdfPrefix(id), 'order-retention')
      if (!r.ok) throw new Error('storage')
      // The signed URLs expired long ago; clear them so nothing points at
      // files that no longer exist.
      const done = await sb(`/rest/v1/print_orders?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ pdfs_purged_at: new Date(now).toISOString(), interior_pdf_url: null, cover_pdf_url: null }),
      })
      if (!done.ok) throw new Error(`order patch ${done.status}`)
      purged++
    } catch (e) {
      failed++
      console.error('[order-retention] could not purge PDFs for an order', id, e?.message)
    }
  }
  return { purged, failed }
}

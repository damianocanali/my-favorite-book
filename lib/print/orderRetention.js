// Consumer printed-book PDFs (print-pdfs/<order id>/{interior,cover}.pdf,
// written by api/print-orders/pdf-worker.js) are kept only while a reprint
// or a support question can still need them: deleted 90 days after the
// order reached a final state. Run nightly by api/cron/retention.js.
//
// "Final" is shipped/delivered (the box left Lulu), refunded, or failed.
// updated_at is the order's last change (trigger in 005), i.e. when it
// reached that state. Best-effort per order: a failure leaves
// pdfs_purged_at null and the next night retries. Needs migration 026.
import { purgeStoragePrefix, printOrderPdfPrefix } from '../deleteUser.js'

export const ORDER_PDF_RETENTION_DAYS = 90
const BUCKET = 'print-pdfs'
const BATCH = 50
const FINAL = ['shipped', 'delivered', 'refunded', 'failed']

export async function purgeOldOrderPdfs({ supabaseUrl, serviceKey, now = Date.now() }) {
  const sb = (path, init = {}) => fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const cutoff = encodeURIComponent(new Date(now - ORDER_PDF_RETENTION_DAYS * 86400000).toISOString())
  const res = await sb(
    `/rest/v1/print_orders?status=in.(${FINAL.join(',')})&updated_at=lt.${cutoff}&pdfs_purged_at=is.null&select=id&order=updated_at.asc&limit=${BATCH}`
  )
  if (!res.ok) {
    console.error('[order-retention] could not list orders', res.status)
    return { purged: 0, failed: 1 }
  }
  const rows = await res.json().catch(() => null)
  if (!Array.isArray(rows)) return { purged: 0, failed: 1 }

  let purged = 0
  let failed = 0
  for (const { id } of rows) {
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

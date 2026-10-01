// The rendered "My Writing Year" PDFs (print-pdfs bucket, migration 024)
// are kept only while they can still matter: deleted 30 days after the box
// shipped, or after the request was canceled or failed (a failed request
// is reconciled and canceled long before; updated_at is its last change). Run by api/cron/purge-deletions.js.
// Best-effort per request: a failure leaves pdfs_purged_at null and the
// next night retries.
export const PRINT_PDF_RETENTION_DAYS = 30
const BUCKET = 'print-pdfs'
const BATCH = 50

export async function purgeOldClassPrintPdfs({ supabaseUrl, serviceKey, now = Date.now() }) {
  const sb = (path, init = {}) => fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const cutoff = encodeURIComponent(new Date(now - PRINT_PDF_RETENTION_DAYS * 86400000).toISOString())
  let purged = 0
  let failed = 0
  for (const [status, col] of [['shipped', 'shipped_at'], ['canceled', 'canceled_at'], ['failed', 'updated_at']]) {
    const res = await sb(`/rest/v1/class_print_requests?status=eq.${status}&${col}=lt.${cutoff}&pdfs_purged_at=is.null&select=id&limit=${BATCH}`)
    if (!res.ok) { failed++; continue }
    const rows = await res.json().catch(() => [])
    for (const { id } of Array.isArray(rows) ? rows : []) {
      try {
        const cr = await sb(`/rest/v1/class_print_request_children?request_id=eq.${id}&select=id,interior_key,cover_key`)
        if (!cr.ok) throw new Error(`children ${cr.status}`)
        const children = await cr.json()
        const prefixes = children.flatMap((c) => [c.interior_key, c.cover_key]).filter(Boolean)
        if (prefixes.length) {
          const del = await sb(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: JSON.stringify({ prefixes }) })
          if (!del.ok) throw new Error(`storage ${del.status}`)
          const clr = await sb(`/rest/v1/class_print_request_children?request_id=eq.${id}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ interior_key: null, cover_key: null }),
          })
          if (!clr.ok) throw new Error(`children patch ${clr.status}`)
        }
        const done = await sb(`/rest/v1/class_print_requests?id=eq.${id}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ pdfs_purged_at: new Date(now).toISOString() }),
        })
        if (!done.ok) throw new Error(`request patch ${done.status}`)
        purged++
      } catch (e) {
        failed++
        console.error('[print-retention] could not purge PDFs for', id, e?.message)
      }
    }
  }
  return { purged, failed }
}

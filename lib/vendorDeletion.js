// Vendor-side deletion when an account is purged (privacy review §4.6 /
// §7.23): the Stripe Customer and the RevenueCat subscriber.
//
// Both run only when their key is configured, never throw, and never block
// the rest of the purge. A failed call is queued in vendor_deletion_queue
// (migration 027) and retried nightly by api/cron/retention.js; the queue
// row holds only the vendor's own id (a Stripe customer id, or the
// RevenueCat app_user_id, which is the Supabase user UUID), never a name or
// an email.
//
// Stripe: DELETE /v1/customers/:id deletes the customer and cancels its
// subscriptions. Stripe itself keeps the invoices and payment records it
// must keep for tax and accounting; that is the data counsel said to keep.
// RevenueCat: DELETE /v1/subscribers/:app_user_id removes the subscriber and
// its purchase history from RevenueCat (Apple keeps its own records).
//
// Env: STRIPE_SECRET_KEY, REVENUECAT_SECRET_API_KEY (a v1 secret key).

const TIMEOUT_MS = 8000
export const MAX_VENDOR_ATTEMPTS = 8

// 404 means the object is already gone, which is the outcome we want.
const done = (status) => (status >= 200 && status < 300) || status === 404

export async function deleteStripeCustomer(customerId, stripeSecretKey) {
  try {
    const res = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return { ok: done(res.status), status: res.status }
  } catch (e) {
    return { ok: false, status: 0 }
  }
}

export async function deleteRevenueCatSubscriber(appUserId, revenueCatKey) {
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${revenueCatKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return { ok: done(res.status), status: res.status }
  } catch (e) {
    return { ok: false, status: 0 }
  }
}

const VENDORS = {
  stripe: { keyName: 'stripeSecretKey', run: deleteStripeCustomer },
  revenuecat: { keyName: 'revenueCatKey', run: deleteRevenueCatSubscriber },
}

/// Queues a failed vendor deletion for the nightly retry. Best-effort: a
/// failed insert is logged (with the vendor, never the id) and swallowed.
async function enqueue(sb, vendor, externalId, status) {
  try {
    const res = await sb('/rest/v1/vendor_deletion_queue?on_conflict=vendor,external_id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ vendor, external_id: externalId, attempts: 1, last_status: status }),
    })
    if (!res.ok) console.error('[vendorDeletion] could not queue a retry', vendor, res.status)
  } catch (e) {
    console.error('[vendorDeletion] queue insert threw', vendor, e?.message)
  }
}

/// Runs one vendor deletion now; on failure, queues it. Returns the result.
export async function deleteAtVendor(sb, vendor, externalId, keys) {
  const v = VENDORS[vendor]
  const key = keys?.[v.keyName]
  if (!key || !externalId) return { ok: true, skipped: true }
  const r = await v.run(externalId, key)
  if (!r.ok) {
    console.warn('[vendorDeletion] delete failed, queued for retry', vendor, r.status)
    await enqueue(sb, vendor, externalId, r.status)
  }
  return r
}

/// The nightly retry (api/cron/retention.js). Only vendors configured here
/// are read, so an unconfigured one never takes batch slots. Rows past
/// MAX_VENDOR_ATTEMPTS stay for a human and are counted as `exhausted` (and
/// as failures, so the owner is alerted every night until resolved).
export async function retryVendorDeletions(sb, keys, { limit = 25, dryRun = false } = {}) {
  const out = { retried: 0, done: 0, failed: 0, exhausted: 0 }
  const configured = Object.entries(VENDORS).filter(([, v]) => keys?.[v.keyName]).map(([name]) => name)
  if (!configured.length) return out
  const vendors = `vendor=in.(${configured.join(',')})`

  try {
    const ex = await sb(`/rest/v1/vendor_deletion_queue?${vendors}&attempts=gte.${MAX_VENDOR_ATTEMPTS}&select=id&limit=1`, {
      headers: { Prefer: 'count=exact' },
    })
    if (ex.ok) {
      const n = Number((ex.headers?.get?.('content-range') ?? '').split('/')[1])
      out.exhausted = Number.isFinite(n) ? n : 0
      out.failed += out.exhausted
    }
  } catch {
    // counted below only if the main read fails too
  }

  const res = await sb(
    `/rest/v1/vendor_deletion_queue?${vendors}&attempts=lt.${MAX_VENDOR_ATTEMPTS}&select=id,vendor,external_id,attempts&order=created_at.asc&limit=${limit}`
  )
  if (!res.ok) {
    console.error('[vendorDeletion] could not read the retry queue', res.status)
    out.failed++
    return out
  }
  const rows = await res.json().catch(() => null)
  const list = Array.isArray(rows) ? rows : []
  if (dryRun) return { ...out, would_retry: list.length }
  for (const row of list) {
    const v = VENDORS[row.vendor]
    out.retried++
    const r = await v.run(row.external_id, keys[v.keyName])
    if (r.ok) {
      const del = await sb(`/rest/v1/vendor_deletion_queue?id=eq.${row.id}`, { method: 'DELETE' })
      if (del.ok) out.done++
      else out.failed++
    } else {
      out.failed++
      await sb(`/rest/v1/vendor_deletion_queue?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ attempts: row.attempts + 1, last_status: r.status, last_attempt_at: new Date().toISOString() }),
      }).catch(() => {})
    }
  }
  return out
}

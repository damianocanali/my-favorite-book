// Shared so the schedule endpoint and the purge cron can never disagree.
export const GRACE_DAYS = 7

// Must match BUCKET in api/_imageStore.js, which writes the objects.
const ILLUSTRATION_BUCKET = 'book-illustrations'

/// Remove every stored illustration belonging to one user.
///
/// Storage has no "delete by prefix", so this lists the user's folder and
/// deletes the names it finds. Best-effort by design: a storage failure must
/// not abort the purge, because the database rows — the part that actually
/// carries the child's name and age — are already gone by the time this runs,
/// and leaving the account undeleted over an orphaned PNG is the worse trade.
/// Failures are logged loudly so they can be swept separately.
async function purgeStoredImages(userId, sb) {
  try {
    const listRes = await sb(`/storage/v1/object/list/${ILLUSTRATION_BUCKET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // limit is the API's page size; a child with more illustrations than
      // this keeps the remainder, hence the warning below.
      body: JSON.stringify({ prefix: `${userId}/`, limit: 1000 }),
    })
    if (!listRes.ok) {
      console.warn('[purgeUser] storage list failed', listRes.status)
      return
    }
    const objects = await listRes.json().catch(() => [])
    if (!Array.isArray(objects) || objects.length === 0) return
    if (objects.length === 1000) {
      console.warn(`[purgeUser] storage list hit the page limit for ${userId} — some objects may remain`)
    }

    const prefixes = objects.map((o) => `${userId}/${o.name}`)
    const delRes = await sb(`/storage/v1/object/${ILLUSTRATION_BUCKET}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes }),
    })
    if (!delRes.ok) {
      console.warn('[purgeUser] storage delete failed', delRes.status, prefixes.length, 'objects')
    }
  } catch (e) {
    console.warn('[purgeUser] storage purge threw', e?.message)
  }
}

// Irreversible hard-delete of a user and all their data. Called ONLY by the
// purge cron after the grace window — never directly from a user request.
export async function purgeUser(userId, { supabaseUrl, serviceKey, stripeSecretKey }) {
  const sb = (path, init = {}) =>
    fetch(`${supabaseUrl}${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        ...(init.headers || {}),
      },
    })

  if (stripeSecretKey) {
    try {
      const subsRes = await sb(
        `/rest/v1/subscriptions?user_id=eq.${userId}&select=stripe_subscription_id`
      )
      const rows = await subsRes.json().catch(() => [])
      const stripeSubId = rows?.[0]?.stripe_subscription_id
      if (stripeSubId) {
        const cancelRes = await fetch(
          `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(stripeSubId)}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${stripeSecretKey}` } }
        )
        if (!cancelRes.ok) {
          console.warn('[purgeUser] Stripe cancel failed', cancelRes.status, await cancelRes.text().catch(() => ''))
        }
      }
    } catch (e) {
      console.warn('[purgeUser] Stripe cancel threw', e?.message)
    }
  }

  await sb(`/rest/v1/user_books?user_id=eq.${userId}`, { method: 'DELETE' })
  await sb(`/rest/v1/subscriptions?user_id=eq.${userId}`, { method: 'DELETE' })

  // Published gallery books. These MUST be deleted here, before the auth
  // delete below, and the ordering is the whole point: published_books.user_id
  // is ON DELETE SET NULL (supabase-migrations/001_published_books.sql:6), so
  // deleting the auth user first does not remove the row — it orphans it. The
  // row keeps author_name and author_age, which are a child's first name and
  // age, and the book stays publicly readable in the gallery forever. Worse,
  // once user_id is NULL there is no way left to find which rows belonged to
  // the deleted account, so the mistake is unrecoverable rather than merely
  // wrong.
  //
  // Deleting rather than anonymising is deliberate: an erasure request from a
  // parent is about the child's name, age and story together, and stripping
  // the name would still leave the story they asked us to remove.
  const booksRes = await sb(`/rest/v1/published_books?user_id=eq.${userId}`, { method: 'DELETE' })
  if (!booksRes.ok) {
    // Fail the purge rather than deleting the auth user anyway. Continuing
    // would null the user_id and strand these rows permanently; leaving the
    // deletion queued means the cron retries tomorrow with the link intact.
    console.error(
      '[purgeUser] published_books delete failed — aborting so the rows stay findable',
      booksRes.status,
      await booksRes.text().catch(() => '')
    )
    return { ok: false }
  }

  // Generated illustrations. api/_imageStore.js namespaces every object as
  // `${userId}/<kind>-<id>.png` in the book-illustrations bucket, which is
  // public — so anything left behind stays world-readable at a stable URL.
  await purgeStoredImages(userId, sb)

  const deleteRes = await sb(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' })
  if (!deleteRes.ok) {
    console.error('[purgeUser] auth delete failed', deleteRes.status, await deleteRes.text().catch(() => ''))
    return { ok: false }
  }
  // The ON DELETE CASCADE from auth.users already removes this; delete it
  // explicitly too so a non-cascading config can't re-queue the same user.
  await sb(`/rest/v1/account_deletions?user_id=eq.${userId}`, { method: 'DELETE' }).catch(() => {})
  return { ok: true }
}

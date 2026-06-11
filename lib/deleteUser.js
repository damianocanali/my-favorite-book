// Shared so the schedule endpoint and the purge cron can never disagree.
export const GRACE_DAYS = 7

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

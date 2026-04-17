export const config = { runtime: 'edge' }

import { handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'

// Permanently deletes a user account and all associated data.
// Requires the user's own JWT to verify identity.

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Not configured' }), {
      status: 503, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response
  const { userId } = auth

  try {
    // If the user has an active Stripe subscription, cancel it at Stripe
    // BEFORE we drop the subscriptions row — otherwise we lose the
    // stripe_subscription_id and the customer keeps getting billed.
    // Apple (RevenueCat) subscriptions can't be cancelled server-side;
    // iOS users must cancel in Settings → Subscriptions themselves, and
    // deleting the account does not refund prior Apple charges.
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const subsRes = await fetch(
          `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&select=stripe_subscription_id`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
        )
        const rows = await subsRes.json().catch(() => [])
        const stripeSubId = rows?.[0]?.stripe_subscription_id
        if (stripeSubId) {
          const cancelRes = await fetch(
            `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(stripeSubId)}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
              },
            }
          )
          if (!cancelRes.ok) {
            // Log but don't block account deletion — the user may already
            // have cancelled via the portal, leaving a stale row.
            const err = await cancelRes.text().catch(() => '')
            console.warn('[delete-account] Stripe cancel failed', cancelRes.status, err)
          }
        }
      } catch (e) {
        console.warn('[delete-account] Stripe cancel threw', e)
      }
    }

    // Delete user data in order (books, subscriptions, then auth account)
    await fetch(`${supabaseUrl}/rest/v1/user_books?user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    })

    await fetch(`${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    })

    // Delete the auth account (admin API)
    const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    })

    if (!deleteRes.ok) {
      const err = await deleteRes.text()
      console.error('[delete-account] auth delete failed:', err)
      return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
        status: 500, headers: withCors({ 'Content-Type': 'application/json' }),
      })
    }

    return new Response(JSON.stringify({ deleted: true }), {
      status: 200, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  } catch (err) {
    console.error('[delete-account] error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }
}

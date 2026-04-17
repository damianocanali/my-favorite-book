export const config = { runtime: 'edge' }

// Handles RevenueCat webhook events:
//   - Subscriptions (INITIAL_PURCHASE / RENEWAL / …) sync into the
//     `subscriptions` table so the plan gate works off a server record.
//   - NON_RENEWING_PURCHASE for coin-pack consumables credits the user's
//     coin balance via the add_coins RPC. Required for iOS compliance with
//     App Store Review Guideline 3.1.1 — coin purchases on iOS must go
//     through StoreKit, not our Stripe Checkout.

// Consumable IAP product IDs → coin amounts. Keep in sync with
// src/services/purchaseService.js COIN_PACK_IAP_PRODUCTS.
const COIN_PACK_AMOUNTS = {
  'com.myfavoritebook.app.coins.small':  50,
  'com.myfavoritebook.app.coins.medium': 200,
  'com.myfavoritebook.app.coins.large':  500,
}

async function upsertSubscription(supabaseUrl, serviceKey, data) {
  const res = await fetch(`${supabaseUrl}/rest/v1/subscriptions?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(data),
  })
  return res.ok
}

async function creditCoins(supabaseUrl, serviceKey, userId, amount) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/add_coins`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_user_id: userId, p_amount: amount }),
  })
  return res.ok
}

function planFromProductId(productId) {
  if (!productId) return 'family'
  if (productId.includes('teacher')) return 'teacher'
  return 'family'
}

// Constant-time bearer-token check. Always enforced now — previously the
// check only fired when REVENUECAT_WEBHOOK_SECRET was set, so a missing
// env var left the endpoint wide open.
function verifySecret(req) {
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET
  if (!expected) return false
  const header = req.headers.get('authorization') || ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : header
  if (provided.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < provided.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!verifySecret(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const event = await req.json().catch(() => null)
  if (!event?.event) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }
  const { type, app_user_id, product_id, expiration_at_ms, period_type } = event.event

  // app_user_id is the Supabase user UUID we passed to RC.logIn()
  const userId = app_user_id
  if (!userId) {
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }

  const plan = planFromProductId(product_id)

  try {
    switch (type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
      case 'REACTIVATION': {
        const status = period_type === 'TRIAL' ? 'trialing' : 'active'
        await upsertSubscription(supabaseUrl, serviceKey, {
          user_id: userId,
          plan,
          status,
          revenuecat_product_id: product_id,
          current_period_end: expiration_at_ms
            ? new Date(expiration_at_ms).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        break
      }

      case 'CANCELLATION':
      case 'EXPIRATION': {
        await upsertSubscription(supabaseUrl, serviceKey, {
          user_id: userId,
          plan: 'free',
          status: type === 'CANCELLATION' ? 'canceled' : 'expired',
          revenuecat_product_id: product_id,
          updated_at: new Date().toISOString(),
        })
        break
      }

      case 'BILLING_ISSUE': {
        await upsertSubscription(supabaseUrl, serviceKey, {
          user_id: userId,
          plan,
          status: 'past_due',
          revenuecat_product_id: product_id,
          updated_at: new Date().toISOString(),
        })
        break
      }

      case 'NON_RENEWING_PURCHASE': {
        // Consumable IAP — currently only coin packs. If we ever add other
        // consumables, branch on product_id.
        const amount = COIN_PACK_AMOUNTS[product_id]
        if (amount) {
          await creditCoins(supabaseUrl, serviceKey, userId, amount)
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('[RC webhook] error', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}

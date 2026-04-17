export const config = { runtime: 'edge' }

// Handles RevenueCat webhook events to sync iOS subscription status to Supabase.

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

function planFromProductId(productId) {
  if (!productId) return 'family'
  if (productId.includes('teacher')) return 'teacher'
  return 'family'
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('authorization') || ''
  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET
  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
  }

  const event = await req.json()
  const { event: { type, app_user_id, product_id, expiration_at_ms, period_type } } = event

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

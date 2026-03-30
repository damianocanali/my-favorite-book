export const config = { runtime: 'edge' }

// Handles Stripe webhook events to sync subscription status to Supabase.
// Uses Web Crypto API (Edge-compatible, no Node.js crypto import).

async function verifyStripeSignature(body, signature, secret) {
  const parts = signature.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=')
    acc[k] = v
    return acc
  }, {})

  const timestamp = parts['t']
  const expectedSig = parts['v1']

  if (!timestamp || !expectedSig) return false

  // Reject if timestamp is more than 5 minutes old
  const diff = Math.abs(Date.now() / 1000 - parseInt(timestamp))
  if (diff > 300) return false

  const payload = `${timestamp}.${body}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-length comparison
  if (computed.length !== expectedSig.length) return false
  let mismatch = 0
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ expectedSig.charCodeAt(i)
  }
  return mismatch === 0
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

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!webhookSecret || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing signature' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await req.text()
  const isValid = await verifyStripeSignature(body, signature, webhookSecret)
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const event = JSON.parse(body)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.user_id
        const plan = session.metadata?.plan || 'family'
        const customerId = session.customer
        const subscriptionId = session.subscription

        if (!userId) break

        await upsertSubscription(supabaseUrl, serviceKey, {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const userId = sub.metadata?.user_id
        const plan = sub.metadata?.plan

        if (!userId) break

        await upsertSubscription(supabaseUrl, serviceKey, {
          user_id: userId,
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          plan: plan || 'family',
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const userId = sub.metadata?.user_id
        if (!userId) break

        await upsertSubscription(supabaseUrl, serviceKey, {
          user_id: userId,
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          plan: 'free',
          status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subId = invoice.subscription
        if (!subId) break

        const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        })
        const stripeSub = await res.json()
        const userId = stripeSub.metadata?.user_id
        if (!userId) break

        await upsertSubscription(supabaseUrl, serviceKey, {
          user_id: userId,
          stripe_customer_id: invoice.customer,
          stripe_subscription_id: subId,
          plan: stripeSub.metadata?.plan || 'family',
          status: 'past_due',
          updated_at: new Date().toISOString(),
        })
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}

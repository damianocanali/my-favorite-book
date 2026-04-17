export const config = { runtime: 'edge' }

import { handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'

// Opens Stripe's hosted billing portal for the signed-in user.
// Customer ID is looked up by the verified JWT's user id (via the
// subscriptions table) — never trusted from the client.

async function stripePost(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  })
  return res.json()
}

async function lookupCustomerId(supabaseUrl, serviceKey, userId) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}&select=stripe_customer_id`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  )
  const rows = await res.json().catch(() => [])
  return rows?.[0]?.stripe_customer_id || null
}

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Payments not configured' }), {
      status: 503, headers: withCors({ 'Content-Type': 'application/json' }),
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

  const customerId = await lookupCustomerId(supabaseUrl, serviceKey, userId)
  if (!customerId) {
    return new Response(JSON.stringify({ error: 'No billing account found' }), {
      status: 404, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  const origin = req.headers.get('origin') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

  const portal = await stripePost('billing_portal/sessions', {
    customer: customerId,
    return_url: `${origin}/`,
  })

  if (portal.error) {
    return new Response(JSON.stringify({ error: portal.error.message }), {
      status: 400, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  return new Response(JSON.stringify({ url: portal.url }), {
    status: 200, headers: withCors({ 'Content-Type': 'application/json' }),
  })
}

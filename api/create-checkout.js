export const config = { runtime: 'edge' }

import { handleCors, withCors } from './_rateLimit.js'

// Creates a Stripe Checkout session and returns the redirect URL.
// Price IDs are resolved server-side — never exposed to the browser.

const PRICE_MAP = {
  family_monthly:  'STRIPE_PRICE_FAMILY_MONTHLY',
  family_annual:   'STRIPE_PRICE_FAMILY_ANNUAL',
  teacher_monthly: 'STRIPE_PRICE_TEACHER_MONTHLY',
  teacher_annual:  'STRIPE_PRICE_TEACHER_ANNUAL',
}

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

  const { planName, billing, userId, userEmail } = await req.json()
  if (!planName || !billing || !userId || !userEmail) {
    return new Response(JSON.stringify({ error: 'planName, billing, userId, and userEmail are required' }), {
      status: 400, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  // Look up the Stripe price ID from server-side env vars
  const envKey = PRICE_MAP[`${planName}_${billing}`]
  const priceId = envKey && process.env[envKey]

  if (!priceId) {
    return new Response(JSON.stringify({ error: 'Pricing not configured for this plan' }), {
      status: 503, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  const origin = req.headers.get('origin') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

  const session = await stripePost('checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    customer_email: userEmail,
    'metadata[user_id]': userId,
    'metadata[plan]': planName,
    'subscription_data[metadata][user_id]': userId,
    'subscription_data[metadata][plan]': planName,
    ...(planName === 'teacher' ? { 'subscription_data[trial_period_days]': '14' } : {}),
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
    allow_promotion_codes: 'true',
    'phone_number_collection[enabled]': 'false',
  })

  if (session.error) {
    return new Response(JSON.stringify({ error: session.error.message }), {
      status: 400, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200, headers: withCors({ 'Content-Type': 'application/json' }),
  })
}

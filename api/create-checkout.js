export const config = { runtime: 'edge' }

// Creates a Stripe Checkout session and returns the redirect URL.

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
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Payments not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
  }

  const { priceId, planName, userId, userEmail } = await req.json()
  if (!priceId || !userId || !userEmail) {
    return new Response(JSON.stringify({ error: 'priceId, userId, and userEmail are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const origin = req.headers.get('origin') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

  const session = await stripePost('checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    customer_email: userEmail,
    // Store user info in metadata so the webhook knows who paid
    'metadata[user_id]': userId,
    'metadata[plan]': planName,
    'subscription_data[metadata][user_id]': userId,
    'subscription_data[metadata][plan]': planName,
    // 14-day free trial for teachers
    ...(planName === 'teacher' ? { 'subscription_data[trial_period_days]': '14' } : {}),
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
    allow_promotion_codes: 'true',
  })

  if (session.error) {
    return new Response(JSON.stringify({ error: session.error.message }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}

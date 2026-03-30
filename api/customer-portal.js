export const config = { runtime: 'edge' }

// Opens Stripe's hosted billing portal so users can manage or cancel their subscription.

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

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
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

  const { stripeCustomerId, userEmail } = await req.json()

  const origin = req.headers.get('origin') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

  let customerId = stripeCustomerId

  // If we don't have a customer ID, look it up by email
  if (!customerId && userEmail) {
    const search = await stripeGet(`customers/search?query=email:'${encodeURIComponent(userEmail)}'`)
    customerId = search.data?.[0]?.id
  }

  if (!customerId) {
    return new Response(JSON.stringify({ error: 'No billing account found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    })
  }

  const portal = await stripePost('billing_portal/sessions', {
    customer: customerId,
    return_url: `${origin}/`,
  })

  if (portal.error) {
    return new Response(JSON.stringify({ error: portal.error.message }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ url: portal.url }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}

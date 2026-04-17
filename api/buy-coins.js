export const config = { runtime: 'edge' }

import { handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'

// Creates a Stripe Checkout session for a one-time coin pack purchase.
// The user identity comes from the verified JWT. Coins are credited by the
// Stripe webhook after payment succeeds — never from a client redirect.

const COIN_PACKS = {
  small:  { coins: 50,  priceEnv: 'STRIPE_PRICE_COINS_SMALL' },
  medium: { coins: 200, priceEnv: 'STRIPE_PRICE_COINS_MEDIUM' },
  large:  { coins: 500, priceEnv: 'STRIPE_PRICE_COINS_LARGE' },
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

  const auth = await verifyJwt(req)
  if (!auth.ok) return auth.response
  const { userId, email } = auth

  if (!email) {
    return new Response(JSON.stringify({ error: 'Account has no email on file' }), {
      status: 400, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  const { pack } = await req.json().catch(() => ({}))
  const packInfo = COIN_PACKS[pack]
  if (!packInfo) {
    return new Response(JSON.stringify({ error: 'Unknown pack' }), {
      status: 400, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  const priceId = process.env[packInfo.priceEnv]
  if (!priceId) {
    return new Response(JSON.stringify({ error: 'Coin packs not configured yet' }), {
      status: 503, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  const origin = req.headers.get('origin') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

  const session = await stripePost('checkout/sessions', {
    mode: 'payment',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    customer_email: email,
    'metadata[user_id]': userId,
    'metadata[type]': 'coin_pack',
    'metadata[coins]': String(packInfo.coins),
    success_url: `${origin}/avatar?coins_purchased=1`,
    cancel_url: `${origin}/avatar`,
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

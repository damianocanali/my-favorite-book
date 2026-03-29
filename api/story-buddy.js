import { checkRateLimit, getClientIp } from './_rateLimit.js'

export const config = { runtime: 'edge' }

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const STORY_BUDDY_LIMIT = 30 // requests per hour per IP

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ip = getClientIp(req)
  const { allowed } = checkRateLimit(`story-buddy:${ip}`, STORY_BUDDY_LIMIT)
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again in an hour.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { system, messages, max_tokens = 300 } = await req.json()

    if (!system || !messages) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens,
        system,
        messages,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return new Response(
        JSON.stringify({ error: error?.error?.message || `Anthropic API error: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = { runtime: 'edge' }

import { checkRateLimit, getClientIp, handleCors, withCors } from './_rateLimit.js'

const TOGETHER_API_URL = 'https://api.together.xyz/v1/images/generations'
const AVATAR_LIMIT = 10 // per hour per IP

const ART_STYLE_PROMPTS = {
  cartoon: 'cute cartoon style, bold outlines, bright colors, Cartoon Network style',
  pixar: '3D Pixar animation style, soft lighting, expressive features, Disney Pixar render',
  anime: 'anime style, big expressive eyes, colorful, Studio Ghibli inspired',
  watercolor: 'soft watercolor painting style, gentle colors, artistic brushstrokes, storybook illustration',
  pixel: '16-bit pixel art style, retro game character, clean pixel rendering',
}

function buildAvatarPrompt(features, artStyle) {
  const style = ART_STYLE_PROMPTS[artStyle] || ART_STYLE_PROMPTS.cartoon

  const parts = [
    'Portrait of a friendly child character',
    `${features.skinTone || 'medium'} skin tone`,
    features.hairStyle && features.hairStyle !== 'none' ? `${features.hairColor || ''} ${features.hairStyle} hair` : 'no hair',
    features.clothing ? `wearing a ${features.clothing}` : '',
    features.hat && features.hat !== 'none' ? `wearing a ${features.hat}` : '',
    features.accessory && features.accessory !== 'none' ? `with ${features.accessory}` : '',
    features.expression || 'happy smiling expression',
  ].filter(Boolean).join(', ')

  return `${parts}. ${style}. Centered circular avatar portrait, simple clean background, child-friendly, no text, no watermark, safe for kids.`
}

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  const ip = getClientIp(req)
  const { allowed } = checkRateLimit(`generate-avatar:${ip}`, AVATAR_LIMIT)
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many avatar generations. Try again in an hour.' }),
      { status: 429, headers: withCors({ 'Content-Type': 'application/json' }) }
    )
  }

  const apiKey = process.env.TOGETHER_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  try {
    const { features, artStyle } = await req.json()

    if (!features) {
      return new Response(JSON.stringify({ error: 'Features are required' }), {
        status: 400, headers: withCors({ 'Content-Type': 'application/json' }),
      })
    }

    const prompt = buildAvatarPrompt(features, artStyle || 'cartoon')

    const response = await fetch(TOGETHER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell',
        prompt,
        width: 512,
        height: 512,
        steps: 4,
        n: 1,
        response_format: 'b64_json',
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return new Response(
        JSON.stringify({ error: error?.error?.message || `Image API error: ${response.status}` }),
        { status: response.status, headers: withCors({ 'Content-Type': 'application/json' }) }
      )
    }

    const data = await response.json()
    const b64 = data.data?.[0]?.b64_json
    if (!b64) {
      return new Response(JSON.stringify({ error: 'No image data returned' }), {
        status: 500, headers: withCors({ 'Content-Type': 'application/json' }),
      })
    }

    return new Response(JSON.stringify({ image: `data:image/png;base64,${b64}` }), {
      status: 200, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }
}

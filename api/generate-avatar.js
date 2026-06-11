export const config = { runtime: 'edge' }

import { checkRateLimit, handleCors, withCors } from './_rateLimit.js'
import { logUsage, estimateTogetherImageCostCents } from './_usage.js'
import { requireUser, validateSourceImage, moderatePrompt, enforceDailyCap } from './_aiGuard.js'

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

  const auth = await requireUser(req)
  if (!auth.ok) return auth.response

  const { allowed } = checkRateLimit(`generate-avatar:${auth.userId}`, AVATAR_LIMIT)
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
    const { features, artStyle, sourceImage } = await req.json()

    const imageErr = validateSourceImage(sourceImage, req)
    if (imageErr) return imageErr

    // Two modes:
    //   (a) Photo cartoonify: when sourceImage is present (base64 data URL),
    //       transform the kid's photo into a cartoon avatar via FLUX Kontext
    //       image-to-image. The original photo is never persisted — it lives
    //       only in this request body and Together's transient request cache.
    //   (b) Text-to-image: original feature-builder flow (skin/hair/clothing
    //       selectors). Requires `features` object.
    const isPhotoMode = Boolean(sourceImage)
    if (!isPhotoMode && !features) {
      return new Response(JSON.stringify({ error: 'features or sourceImage required' }), {
        status: 400, headers: withCors({ 'Content-Type': 'application/json' }),
      })
    }

    const style = ART_STYLE_PROMPTS[artStyle] || ART_STYLE_PROMPTS.cartoon

    const prompt = isPhotoMode
      ? `Transform this photograph of a child into a friendly cartoon avatar portrait. Preserve the child's likeness — same hair, same expression, similar clothing — but render in ${style}. Centered circular portrait composition, simple soft background, child-friendly, no text, no watermark, safe for kids.`
      : buildAvatarPrompt(features, artStyle || 'cartoon')

    const modErr = await moderatePrompt(prompt, req)
    if (modErr) return modErr
    const capErr = await enforceDailyCap(auth.userId, req)
    if (capErr) return capErr

    // FLUX.1-kontext-pro is the serverless image-to-image model on Together.
    // The -dev variant is dedicated/non-serverless and 403s without an
    // endpoint provisioned. Pro is fine for kid avatars; -max is the
    // higher-quality / pricier sibling, deferred unless quality demands it.
    const model = isPhotoMode
      ? 'black-forest-labs/FLUX.1-kontext-pro'
      : 'black-forest-labs/FLUX.1-schnell'

    const requestBody = isPhotoMode
      ? {
          model, prompt,
          image_url: sourceImage,
          // 0.0 keeps the photo unchanged; 1.0 ignores the source. ~0.55 keeps
          // the kid recognizable while applying real cartoon stylization.
          strength: 0.55,
          width: 512, height: 512, steps: 12, n: 1,
          response_format: 'b64_json',
        }
      : {
          model, prompt,
          width: 512, height: 512, steps: 4, n: 1,
          response_format: 'b64_json',
        }

    const response = await fetch(TOGETHER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[generate-avatar] Together error', response.status, detail.slice(0, 500))
      return new Response(
        JSON.stringify({ error: 'Avatar generation failed. Please try again.' }),
        { status: 502, headers: withCors({ 'Content-Type': 'application/json' }, req) }
      )
    }

    const data = await response.json()
    const b64 = data.data?.[0]?.b64_json
    if (!b64) {
      return new Response(JSON.stringify({ error: 'No image data returned' }), {
        status: 500, headers: withCors({ 'Content-Type': 'application/json' }),
      })
    }

    logUsage({
      service: 'together',
      feature: isPhotoMode ? 'generate_avatar_photo' : 'generate_avatar',
      model,
      images: 1,
      cost_cents: estimateTogetherImageCostCents({ model, images: 1 }),
    })

    return new Response(JSON.stringify({ image: `data:image/png;base64,${b64}` }), {
      status: 200, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  } catch (err) {
    console.error('[generate-avatar] error', err?.message)
    return new Response(JSON.stringify({ error: 'Avatar generation failed.' }), {
      status: 500, headers: withCors({ 'Content-Type': 'application/json' }, req),
    })
  }
}

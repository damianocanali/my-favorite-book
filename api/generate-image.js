import { checkRateLimit, handleCors, withCors } from './_rateLimit.js'
import { logUsage, estimateTogetherImageCostCents } from './_usage.js'
import { requireUser, validatePrompt, validateSourceImage, moderatePrompt, enforceDailyCap } from './_aiGuard.js'
import { classifyAttestation, dailyCapFor, hourlyLimitFor } from './_appAttest.js'
import { storeIllustration } from './_imageStore.js'

export const config = { runtime: 'edge' }

const TOGETHER_API_URL = 'https://api.together.xyz/v1/images/generations'
const IMAGE_GEN_LIMIT = 20 // requests per hour per IP

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  const auth = await requireUser(req)
  if (!auth.ok) return auth.response

  // Read the raw body ONCE — the App Attest assertion signs these exact
  // bytes, so the same buffer must be hashed and then parsed.
  let rawBody, payload
  try {
    rawBody = new Uint8Array(await req.arrayBuffer())
    payload = JSON.parse(new TextDecoder().decode(rawBody))
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: withCors({ 'Content-Type': 'application/json' }, req),
    })
  }

  // Attested iOS requests get the full caps; unattested (web, older
  // builds) get reduced ones. Invalid assertions 401 in enforce mode.
  const attest = await classifyAttestation(req, rawBody, auth.userId)
  if (attest.reject) return attest.reject

  const { allowed } = checkRateLimit(
    `generate-image:${auth.userId}`,
    hourlyLimitFor(attest.attested, IMAGE_GEN_LIMIT)
  )
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again in an hour.' }),
      { status: 429, headers: withCors({ 'Content-Type': 'application/json' }) }
    )
  }

  const apiKey = process.env.TOGETHER_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  try {
    const { prompt, sourceImage, strength } = payload

    const promptErr = validatePrompt(prompt, req)
    if (promptErr) return promptErr
    const imageErr = validateSourceImage(sourceImage, req)
    if (imageErr) return imageErr
    const modErr = await moderatePrompt(prompt, req)
    if (modErr) return modErr
    const capErr = await enforceDailyCap(auth.userId, req, dailyCapFor(attest.attested))
    if (capErr) return capErr

    // Image edits go through FLUX.1-Kontext-Dev (purpose-built for editing
    // an existing image with a text instruction). Falls back to FLUX.1-schnell
    // for plain generation. Edit cost is ~5× schnell — reflected in usage log.
    const isEdit = Boolean(sourceImage)
    const model = isEdit
      ? 'black-forest-labs/FLUX.1-kontext-dev'
      : 'black-forest-labs/FLUX.1-schnell'

    const body = isEdit
      ? {
          model,
          prompt,
          image_url: sourceImage,
          // 0.0 = identical to source; 1.0 = full regen. ~0.55 keeps composition
          // while letting the instruction take effect.
          strength: typeof strength === 'number' ? strength : 0.55,
          width: 768,
          height: 512,
          steps: 12,
          n: 1,
          response_format: 'b64_json',
        }
      : {
          model,
          prompt,
          width: 768,
          height: 512,
          steps: 4,
          n: 1,
          response_format: 'b64_json',
        }

    const response = await fetch(TOGETHER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[generate-image] Together error', response.status, detail.slice(0, 500))
      return new Response(
        JSON.stringify({ error: 'Image generation failed. Please try again.' }),
        { status: 502, headers: withCors({ 'Content-Type': 'application/json' }, req) }
      )
    }

    const data = await response.json()
    const b64 = data.data?.[0]?.b64_json
    if (!b64) {
      return new Response(JSON.stringify({ error: 'No image data returned' }), {
        status: 500,
        headers: withCors({ 'Content-Type': 'application/json' }),
      })
    }

    logUsage({
      service: 'together',
      feature: isEdit ? 'edit_image' : 'generate_image',
      model,
      images: 1,
      cost_cents: estimateTogetherImageCostCents({ model, images: 1 }),
    })

    // Park the art in Storage and hand back a URL. Books sync with a URL
    // intact, so the print pipeline can actually fetch the image — a
    // base64 data URL got stripped to '[saved-locally]' on sync and
    // printed as a broken image. Falls back to the data URL if Storage is
    // unavailable, so a paid generation is never lost to a storage blip.
    const stored = await storeIllustration(b64, auth.userId, isEdit ? 'edit' : 'page')

    return new Response(JSON.stringify({ image: stored ?? `data:image/png;base64,${b64}` }), {
      status: 200,
      headers: withCors({ 'Content-Type': 'application/json' }),
    })
  } catch (err) {
    console.error('[generate-image] error', err?.message)
    return new Response(JSON.stringify({ error: 'Image generation failed.' }), {
      status: 500,
      headers: withCors({ 'Content-Type': 'application/json' }, req),
    })
  }
}

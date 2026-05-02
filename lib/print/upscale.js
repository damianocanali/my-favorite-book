// 2× upscale of book illustrations to print resolution. The model name on
// Together AI has churned over time; a clean upscale endpoint isn't always
// available. We fail SOFT here: if the upscale call errors out, we log the
// reason and return the original URL so the print pipeline isn't blocked.
// Print quality will be lower than ideal until we wire up a verified
// upscaler — tracked as a follow-up.
//
// Docs: https://docs.together.ai/reference/post_images-generations
const TOGETHER_UPSCALE_URL = 'https://api.together.xyz/v1/images/generations'
const UPSCALE_TIMEOUT_MS = 30_000

export async function upscaleImageUrl(sourceUrl) {
  const apiKey = process.env.TOGETHER_API_KEY
  // Read at call time, not module load, so test env tweaks take effect.
  const upscaleModel = process.env.TOGETHER_UPSCALE_MODEL
  if (!apiKey) {
    console.warn('[upscale] TOGETHER_API_KEY not set; passing through source image')
    return sourceUrl
  }
  if (!upscaleModel) {
    // No model configured — pass through. This is intentional: the Together
    // upscale catalog has been flaky, and we'd rather ship the print at
    // source resolution than fail an order at the upscale step.
    return sourceUrl
  }

  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), UPSCALE_TIMEOUT_MS)
    const res = await fetch(TOGETHER_UPSCALE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: upscaleModel,
        image: sourceUrl,
        scale: 2,
        response_format: 'url',
      }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t))

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn(`[upscale] failed (${res.status}); using original. body=${text.slice(0, 200)}`)
      return sourceUrl
    }
    const json = await res.json()
    const url = json?.data?.[0]?.url
    return url ?? sourceUrl
  } catch (e) {
    console.warn('[upscale] threw; using original.', e?.message ?? e)
    return sourceUrl
  }
}

export async function upscaleAllIllustrations(book) {
  const next = structuredClone(book)
  if (next.coverImage) next.coverImage = await upscaleImageUrl(next.coverImage)
  next.pages = await Promise.all(
    next.pages.map(async (p) => {
      if (!p.illustrationData) return p
      return { ...p, illustrationData: await upscaleImageUrl(p.illustrationData) }
    })
  )
  return next
}

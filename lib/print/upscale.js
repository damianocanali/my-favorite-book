// 2x upscale via Together AI Real-ESRGAN endpoint.
// Docs: https://docs.together.ai/reference/post_images-generations
const TOGETHER_UPSCALE_URL = 'https://api.together.xyz/v1/images/generations'

export async function upscaleImageUrl(sourceUrl) {
  const apiKey = process.env.TOGETHER_API_KEY
  if (!apiKey) throw new Error('TOGETHER_API_KEY not set')

  const res = await fetch(TOGETHER_UPSCALE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'stabilityai/stable-diffusion-x4-upscaler',
      image: sourceUrl,
      scale: 2,
      response_format: 'url',
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`upscale failed (${res.status}): ${text}`)
  }

  const json = await res.json()
  const url = json?.data?.[0]?.url
  if (!url) throw new Error('upscale response missing url')
  return url
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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { upscaleImageUrl } from '../../lib/print/upscale.js'

const ORIG_MODEL = process.env.TOGETHER_UPSCALE_MODEL

beforeEach(() => {
  global.fetch = vi.fn()
})

afterEach(() => {
  if (ORIG_MODEL == null) delete process.env.TOGETHER_UPSCALE_MODEL
  else process.env.TOGETHER_UPSCALE_MODEL = ORIG_MODEL
})

describe('upscaleImageUrl', () => {
  it('passes through the source URL when no upscale model is configured', async () => {
    delete process.env.TOGETHER_UPSCALE_MODEL
    const src = 'https://supabase.co/img/page1.png'
    const out = await upscaleImageUrl(src)
    expect(out).toBe(src)
    // Should not even attempt the upstream call.
    expect(fetch).not.toHaveBeenCalled()
  })

  it('POSTs to Together AI with the configured model and returns the upscaled URL', async () => {
    process.env.TOGETHER_UPSCALE_MODEL = 'some-real-upscaler/v1'
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ url: 'https://together.ai/out/upscaled.png' }] }),
    })
    const out = await upscaleImageUrl('https://supabase.co/img/page1.png')
    expect(out).toBe('https://together.ai/out/upscaled.png')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.image).toBe('https://supabase.co/img/page1.png')
    expect(body.scale).toBe(2)
    expect(body.model).toBe('some-real-upscaler/v1')
  })

  it('falls back to the original URL on upstream non-OK response', async () => {
    process.env.TOGETHER_UPSCALE_MODEL = 'some-real-upscaler/v1'
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'not found',
    })
    const src = 'https://x/img.png'
    const out = await upscaleImageUrl(src)
    expect(out).toBe(src)
  })

  it('falls back to the original URL when the upstream throws', async () => {
    process.env.TOGETHER_UPSCALE_MODEL = 'some-real-upscaler/v1'
    fetch.mockRejectedValueOnce(new Error('network down'))
    const src = 'https://x/img.png'
    const out = await upscaleImageUrl(src)
    expect(out).toBe(src)
  })
})

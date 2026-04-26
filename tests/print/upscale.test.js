import { describe, it, expect, vi, beforeEach } from 'vitest'
import { upscaleImageUrl } from '../../lib/print/upscale.js'

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('upscaleImageUrl', () => {
  it('POSTs to Together AI with the source URL and 2x scale', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ url: 'https://together.ai/out/upscaled.png' }] }),
    })
    const out = await upscaleImageUrl('https://supabase.co/img/page1.png')
    expect(out).toBe('https://together.ai/out/upscaled.png')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('together'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Bearer '),
          'Content-Type': 'application/json',
        }),
      })
    )
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.image).toBe('https://supabase.co/img/page1.png')
    expect(body.scale).toBe(2)
  })

  it('throws on non-OK response with diagnostic', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'upstream exploded',
    })
    await expect(upscaleImageUrl('https://x/img.png')).rejects.toThrow(/upscale failed.*500/i)
  })
})

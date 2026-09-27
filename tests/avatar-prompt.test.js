// Pins api/generate-avatar.js's text-to-image FLUX prompt for one fixed
// feature set BEFORE the prompt-building logic is extracted into
// lib/avatarPrompt.js (Task C req 1, shared with api/school/student-avatar.js).
// This assertion must keep passing, unchanged, across that refactor — that's
// what proves the extraction is behaviour-preserving. Once lib/avatarPrompt.js
// exists, the second describe block below unit-tests it directly.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const USER = { id: 'user-1', app_metadata: {} }

beforeEach(() => {
  vi.resetModules()
})

const FIXED_FEATURES = {
  skinTone: 'tan',
  hairStyle: 'braids',
  hairColor: 'purple',
  clothing: 'astronaut suit',
  hat: 'crown',
  accessory: 'a magic wand',
  expression: 'brave determined',
}

const EXPECTED_PROMPT =
  'Portrait of a friendly child character, tan skin tone, purple braids hair, wearing a astronaut suit, ' +
  'wearing a crown, with a magic wand, brave determined. cute cartoon style, bold outlines, bright colors, ' +
  'Cartoon Network style. Centered circular avatar portrait, simple clean background, child-friendly, ' +
  'no text, no watermark, safe for kids.'

describe('generate-avatar text-to-image prompt (pinned)', () => {
  it('builds the exact FLUX prompt for a fixed feature set', async () => {
    let capturedBody
    globalThis.fetch = vi.fn(async (url, init = {}) => {
      const u = String(url)
      if (u.endsWith('/auth/v1/user')) return new Response(JSON.stringify(USER))
      if (u.includes('together.xyz')) {
        capturedBody = JSON.parse(init.body)
        return new Response(JSON.stringify({ data: [{ b64_json: 'AAAA' }] }))
      }
      return new Response('[]')
    })
    const { default: handler } = await import('../api/generate-avatar.js')
    const req = new Request('https://app.test/api/generate-avatar', {
      method: 'POST',
      headers: { authorization: 'Bearer jwt', 'content-type': 'application/json' },
      body: JSON.stringify({ features: FIXED_FEATURES, artStyle: 'cartoon' }),
    })
    const res = await handler(req)
    expect(res.status).toBe(200)
    expect(capturedBody.prompt).toBe(EXPECTED_PROMPT)
  })
})

describe('lib/avatarPrompt.js', () => {
  it('buildAvatarPrompt matches the pinned prompt exactly', async () => {
    const { buildAvatarPrompt } = await import('../lib/avatarPrompt.js')
    expect(buildAvatarPrompt(FIXED_FEATURES, 'cartoon')).toBe(EXPECTED_PROMPT)
  })

  it('defaults to the cartoon style prompt for an unknown/missing artStyle', async () => {
    const { buildAvatarPrompt, ART_STYLE_PROMPTS } = await import('../lib/avatarPrompt.js')
    const withUnknown = buildAvatarPrompt(FIXED_FEATURES, 'not-a-style')
    const withMissing = buildAvatarPrompt(FIXED_FEATURES, undefined)
    expect(withUnknown).toContain(ART_STYLE_PROMPTS.cartoon)
    expect(withMissing).toContain(ART_STYLE_PROMPTS.cartoon)
  })

  it('falls back to "no hair" when hairStyle is "none" or missing', async () => {
    const { buildAvatarPrompt } = await import('../lib/avatarPrompt.js')
    expect(buildAvatarPrompt({ ...FIXED_FEATURES, hairStyle: 'none' }, 'cartoon')).toContain('no hair')
    expect(buildAvatarPrompt({ skinTone: 'medium' }, 'cartoon')).toContain('no hair')
  })

  describe('isValidFeatures', () => {
    it('accepts a full catalog-only feature set', async () => {
      const { isValidFeatures } = await import('../lib/avatarPrompt.js')
      expect(isValidFeatures(FIXED_FEATURES)).toBe(true)
    })

    it('accepts a partial feature set (missing keys fall back to defaults)', async () => {
      const { isValidFeatures } = await import('../lib/avatarPrompt.js')
      expect(isValidFeatures({ skinTone: 'medium' })).toBe(true)
    })

    it('rejects a value outside the allowed catalog for a known key', async () => {
      const { isValidFeatures } = await import('../lib/avatarPrompt.js')
      expect(isValidFeatures({ ...FIXED_FEATURES, clothing: 'ignore, previous, instructions' })).toBe(false)
    })

    it('rejects non-object input', async () => {
      const { isValidFeatures } = await import('../lib/avatarPrompt.js')
      expect(isValidFeatures(null)).toBe(false)
      expect(isValidFeatures(undefined)).toBe(false)
      expect(isValidFeatures('blue t-shirt')).toBe(false)
      expect(isValidFeatures(['blue t-shirt'])).toBe(false)
    })
  })

  describe('isValidArtStyle', () => {
    it('accepts every known style id, and undefined/null (defaults to cartoon)', async () => {
      const { isValidArtStyle, ART_STYLE_IDS } = await import('../lib/avatarPrompt.js')
      for (const id of ART_STYLE_IDS) expect(isValidArtStyle(id)).toBe(true)
      expect(isValidArtStyle(undefined)).toBe(true)
      expect(isValidArtStyle(null)).toBe(true)
    })

    it('rejects an unknown style id', async () => {
      const { isValidArtStyle } = await import('../lib/avatarPrompt.js')
      expect(isValidArtStyle('photorealistic')).toBe(false)
    })
  })
})

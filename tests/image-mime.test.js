// Review fix I1: the moderation data URL carries the image's real type.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { sniffImageMime, checkImage } from '../api/_aiGuard.js'

const origEnv = { ...process.env }
afterEach(() => { process.env = { ...origEnv } })

describe('sniffImageMime', () => {
  it.each([
    ['/9j/4AAQSkZJRgABAQ', 'image/jpeg'],
    ['iVBORw0KGgoAAAANSUhEUg', 'image/png'],
    ['UklGRiQAAABXRUJQVlA4', 'image/webp'],
    ['AAAA', 'image/png'],
    ['', 'image/png'],
  ])('%s → %s', (b64, mime) => expect(sniffImageMime(b64)).toBe(mime))
})

describe('checkImage labels the data URL from the bytes', () => {
  it.each([
    ['/9j/4AAQ', 'data:image/jpeg;base64,/9j/4AAQ'],
    ['iVBORw0K', 'data:image/png;base64,iVBORw0K'],
    ['UklGRiQA', 'data:image/webp;base64,UklGRiQA'],
  ])('%s', async (b64, url) => {
    process.env.OPENAI_API_KEY = 'k'
    let sent
    globalThis.fetch = vi.fn(async (_u, init) => { sent = JSON.parse(init.body); return new Response(JSON.stringify({ results: [{ flagged: false }] })) })
    expect(await checkImage(b64)).toBe('ok')
    expect(sent.input[0].image_url.url).toBe(url)
  })
})

describe('Together is asked for PNG wherever we call it', () => {
  it.each(['api/generate-image.js', 'api/generate-avatar.js', 'api/school/student-avatar.js'])('%s', (f) => {
    const src = readFileSync(f, 'utf8')
    expect(src.match(/output_format: 'png'/g)?.length).toBe(src.match(/response_format: 'b64_json'/g)?.length)
  })
})

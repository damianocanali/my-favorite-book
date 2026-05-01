import { describe, it, expect } from 'vitest'
import { buildInteriorHtml, buildCoverHtml } from '../../lib/print/pdf-html.js'

const fixtureBook = {
  title: 'My Bear',
  authorName: 'Theo',
  authorAge: 7,
  colors: { cover: '#8B5CF6', accent: '#06B6D4', text: '#F1F5F9' },
  coverImage: 'https://x/cover.png',
  pages: [
    { id: 1, pageNumber: 1, text: 'Once upon a time.', illustrationData: 'https://x/p1.png' },
    { id: 2, pageNumber: 2, text: 'There was a bear.', illustrationData: 'https://x/p2.png' },
  ],
  characters: [{ id: 'c1', emoji: '🐻' }],
  setting: { emoji: '🌲' },
  createdAt: '2026-04-30T00:00:00Z',
}

describe('buildInteriorHtml', () => {
  it('contains every story page text', async () => {
    const html = await buildInteriorHtml(fixtureBook)
    expect(html).toContain('Once upon a time.')
    expect(html).toContain('There was a bear.')
  })

  it('does NOT include the front cover image (cover lives in the cover spread, not interior)', async () => {
    const html = await buildInteriorHtml(fixtureBook)
    expect(html).not.toContain('https://x/cover.png')
  })

  it('uses 8.75in × 8.75in trim for interior pages', async () => {
    const html = await buildInteriorHtml(fixtureBook)
    expect(html).toMatch(/size:\s*8\.75in\s+8\.75in/)
  })

  it('appends closing pages: The End, About the Author, MyBookLab promo', async () => {
    const html = await buildInteriorHtml(fixtureBook)
    expect(html).toContain('The End')
    expect(html).toContain('About the Author')
    expect(html).toContain('Make your own magical book')
  })

  it('mentions IG handle and website on the promo page', async () => {
    const html = await buildInteriorHtml(fixtureBook)
    expect(html).toContain('@mybooklab')
    expect(html).toContain('mybooklab.app')
  })

  it('embeds an inline QR code data URL', async () => {
    const html = await buildInteriorHtml(fixtureBook)
    expect(html).toMatch(/data:image\/png;base64,/)
  })

  it('pads with "Notes from your reader" pages until at least 24 interior pages total', async () => {
    const html = await buildInteriorHtml(fixtureBook)
    // Count all <section class="print-page" tags as a proxy for total pages.
    const matches = html.match(/<section class="print-page"/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(24)
    expect(html).toContain('Notes from your reader')
  })

  it('keeps interior page count even (binding folds cleanly)', async () => {
    const html = await buildInteriorHtml(fixtureBook)
    const matches = html.match(/<section class="print-page"/g) ?? []
    expect(matches.length % 2).toBe(0)
  })

  it('escapes HTML in user-supplied text', async () => {
    const html = await buildInteriorHtml({
      ...fixtureBook,
      pages: [{ id: 1, pageNumber: 1, text: '<script>alert(1)</script>', illustrationData: 'https://x/p.png' }],
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})

describe('buildCoverHtml', () => {
  it('produces a single-page spread sized for back + spine + front + bleed', async () => {
    const html = await buildCoverHtml(fixtureBook, { spineWidthInches: 0.11 })
    // 0.25 (bleed both sides) + 8.5 + 0.11 + 8.5 = 17.36in wide; 8.75in tall.
    expect(html).toMatch(/size:\s*17\.36in\s+8\.75in/)
  })

  it('embeds the front cover image and the title on both back and front', async () => {
    const html = await buildCoverHtml(fixtureBook, { spineWidthInches: 0.11 })
    expect(html).toContain('https://x/cover.png')
    // Title appears on back, spine, and front — at least 2 occurrences.
    const titleMatches = html.match(/My Bear/g) ?? []
    expect(titleMatches.length).toBeGreaterThanOrEqual(2)
  })

  it('uses the spine width to size the middle column', async () => {
    const html = await buildCoverHtml(fixtureBook, { spineWidthInches: 0.25 })
    expect(html).toContain('0.25in')
  })
})

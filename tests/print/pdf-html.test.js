import { describe, it, expect } from 'vitest'
import { buildPrintHtml } from '../../lib/print/pdf-html.js'

const fixtureBook = {
  title: 'My Bear',
  authorName: 'Theo',
  colors: { cover: '#8B5CF6', accent: '#06B6D4', text: '#F1F5F9' },
  coverImage: 'https://x/cover.png',
  pages: [
    { id: 1, pageNumber: 1, text: 'Once upon a time.', illustrationData: 'https://x/p1.png' },
    { id: 2, pageNumber: 2, text: 'There was a bear.', illustrationData: 'https://x/p2.png' },
  ],
  characters: [{ id: 'c1', emoji: '🐻' }],
  setting: { emoji: '🌲' },
}

describe('buildPrintHtml', () => {
  it('contains every page text', () => {
    const html = buildPrintHtml(fixtureBook)
    expect(html).toContain('Once upon a time.')
    expect(html).toContain('There was a bear.')
  })
  it('embeds the title and author', () => {
    const html = buildPrintHtml(fixtureBook)
    expect(html).toContain('My Bear')
    expect(html).toContain('Theo')
  })
  it('includes 8.75in @page CSS for Lulu trim', () => {
    expect(buildPrintHtml(fixtureBook)).toMatch(/size:\s*8\.75in\s+8\.75in/)
  })
  it('includes the cover and every illustration URL', () => {
    const html = buildPrintHtml(fixtureBook)
    expect(html).toContain('https://x/cover.png')
    expect(html).toContain('https://x/p1.png')
    expect(html).toContain('https://x/p2.png')
  })
  it('escapes HTML in user text', () => {
    const html = buildPrintHtml({
      ...fixtureBook,
      pages: [{ id: 1, pageNumber: 1, text: '<script>alert(1)</script>', illustrationData: 'https://x/p.png' }],
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

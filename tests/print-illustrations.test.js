import { describe, it, expect } from 'vitest'
import { buildInteriorHtml } from '../lib/print/pdf-html.js'
import { isFetchableImage } from '../api/_imageStore.js'

// Regression guard for a bug that shipped in printed books: sync-books
// replaced every illustration with the literal string '[saved-locally]',
// the print pipeline reads that stored copy, and pdf-html's
// `illustrationData ? <img> : emoji` treats a non-empty string as an
// image — so paying customers received books with a broken <img> on
// every page.

function bookWith(illustration) {
  return {
    title: 'Theo and the Star Bear',
    authorName: 'Theo',
    colors: { cover: '#5B3FA8', accent: '#F4B860', text: '#FFF8E7' },
    setting: { emoji: '🌙' },
    pages: [{ pageNumber: 1, text: 'Theo looked at the stars.', illustrationData: illustration }],
  }
}

const imgSrcs = (html) => [...html.matchAll(/<img[^>]*src="([^"]*)"/g)].map((m) => m[1])

describe('what sync keeps vs strips', () => {
  it('keeps fetchable http(s) URLs — these are what print needs', () => {
    expect(isFetchableImage('https://x.supabase.co/storage/v1/object/public/a/b.png')).toBe(true)
    expect(isFetchableImage('http://example.com/a.png')).toBe(true)
  })

  it('rejects on-device and placeholder values', () => {
    expect(isFetchableImage('data:image/png;base64,AAAA')).toBe(false)
    expect(isFetchableImage('[saved-locally]')).toBe(false)
    expect(isFetchableImage(null)).toBe(false)
    expect(isFetchableImage(undefined)).toBe(false)
    expect(isFetchableImage('')).toBe(false)
  })
})

describe('printed page rendering', () => {
  it('renders a real Storage URL as the page image', async () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/book-illustrations/u/page-1.png'
    const html = await buildInteriorHtml(bookWith(url))
    expect(imgSrcs(html)).toContain(url)
  })

  it('never emits the placeholder as an image source', async () => {
    // The exact shape a pre-fix book still has in Supabase.
    const html = await buildInteriorHtml(bookWith('[saved-locally]'))
    expect(imgSrcs(html)).not.toContain('[saved-locally]')
    expect(html).not.toContain('src="[saved-locally]"')
  })

  it('falls back to artwork-free layout rather than a broken image', async () => {
    const html = await buildInteriorHtml(bookWith(null))
    expect(imgSrcs(html)).not.toContain('[saved-locally]')
  })
})

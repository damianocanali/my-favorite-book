// Review §7 item 18: no third-party font host anywhere in the app or print.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { buildInteriorHtml, buildCoverHtml } from '../lib/print/pdf-html.js'
import { PRINT_FONT_FACES } from '../lib/print/fontFaces.js'

const FONT_HOSTS = /fonts\.googleapis\.com|fonts\.gstatic\.com|fonts\.cdnfonts\.com/

describe('self-hosted fonts', () => {
  it('index.html loads only our own font CSS', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).not.toMatch(FONT_HOSTS)
    expect(html).toContain('/fonts/fonts.css')
  })
  it('every font file fonts.css points at exists', () => {
    const css = readFileSync('public/fonts/fonts.css', 'utf8')
    const files = [...css.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map((m) => m[1])
    expect(files.length).toBeGreaterThanOrEqual(6)
    for (const f of files) expect(existsSync(`public/fonts/${f}`), f).toBe(true)
    for (const fam of ['Fredoka', 'Nunito', 'OpenDyslexic']) expect(css).toContain(`'${fam}'`)
  })
  it('print HTML embeds the fonts as data: URIs and names no font host', async () => {
    expect(PRINT_FONT_FACES).toMatch(/url\(data:font\/woff2;base64,/)
    expect(PRINT_FONT_FACES).not.toMatch(/url\('\//)
    for (const f of ['lib/print/pdf-html.js', 'lib/print/writing-year-html.js']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(FONT_HOSTS)
    }
    const book = { title: 'T', authorName: 'A', pages: [{ pageNumber: 1, text: 'x' }], characters: [] }
    const interior = await buildInteriorHtml(book)
    expect(interior).not.toMatch(FONT_HOSTS)
    expect(interior).toContain('data:font/woff2;base64,')
    const cover = await Promise.resolve(buildCoverHtml?.(book, { spineWidthInches: 0.25 })).catch(() => null)
    if (typeof cover === 'string') expect(cover).not.toMatch(FONT_HOSTS)
  })
})

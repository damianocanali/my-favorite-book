// The worksheet library's search and filters (teacher round 6B): instant,
// client-side, in the current language, accent- and case-insensitive, with
// the filters in the URL so links and Back work.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  normalizeSearch, filterTemplates, groupByCategory, parseLibraryParams, withLibraryParams, hasActiveFilters, QUERY_MAX,
} from '../src/lib/worksheets/library.js'
import { WORKSHEET_TEMPLATES, WORKSHEET_CATEGORIES } from '../lib/school/worksheets.js'

const load = (lang) => JSON.parse(readFileSync(`src/i18n/locales/${lang}/school.json`, 'utf8'))
const at = (obj, dotted) => dotted.split('.').reduce((o, k) => o?.[k], obj)
const tFor = (d) => (key) => at(d, key.replace(/^school:/, '')) ?? key
const tEn = tFor(load('en'))
const tIt = tFor(load('it'))
const ids = (list) => list.map((t) => t.id)

describe('normalizeSearch', () => {
  it('drops case, accents and extra spaces', () => {
    expect(normalizeSearch('  Città   DELLE Emozioni ')).toBe('citta delle emozioni')
    expect(normalizeSearch(null)).toBe('')
  })
})

describe('filterTemplates', () => {
  it('no filters: all 33, in catalogue order', () => {
    expect(ids(filterTemplates({}, tEn))).toEqual(ids(WORKSHEET_TEMPLATES))
  })

  it('matches title, keywords and category name in the current language', () => {
    expect(ids(filterTemplates({ q: 'haiku' }, tEn))).toEqual(['haiku'])
    expect(ids(filterTemplates({ q: 'POEM' }, tEn))).toEqual(expect.arrayContaining(['acrostic', 'haiku', 'i_am_poem', 'cinquain']))
    expect(ids(filterTemplates({ q: 'mind map' }, tEn))).toEqual(['word_web'])
    // Category name: "Facts & how-to".
    expect(ids(filterTemplates({ q: 'facts' }, tEn))).toEqual(expect.arrayContaining(['all_about', 'how_to']))
    // Italian, accent-insensitive: "identità" typed as "identita".
    expect(ids(filterTemplates({ q: 'identita' }, tIt))).toEqual(expect.arrayContaining(['i_am_poem', 'all_about_me']))
    expect(ids(filterTemplates({ q: 'poesia' }, tIt))).toEqual(expect.arrayContaining(['acrostic', 'haiku', 'i_am_poem', 'cinquain']))
    expect(filterTemplates({ q: 'zzzz' }, tEn)).toEqual([])
  })

  it('every word must match; filters combine with the search', () => {
    expect(ids(filterTemplates({ q: 'story plan' }, tEn))).toContain('story_map')
    expect(ids(filterTemplates({ cat: 'poems' }, tEn))).toEqual(['acrostic', 'haiku', 'i_am_poem', 'cinquain'])
    expect(ids(filterTemplates({ cat: 'poems', grade: 'k2' }, tEn))).toEqual(['acrostic', 'i_am_poem'])
    expect(ids(filterTemplates({ cat: 'poems', grade: 'g35', q: 'syllables' }, tEn))).toEqual(['haiku'])
  })

  it('every template is findable by its own title in both languages', () => {
    for (const [t, d] of [[tEn, load('en')], [tIt, load('it')]]) {
      for (const tpl of WORKSHEET_TEMPLATES) {
        expect(ids(filterTemplates({ q: d.worksheet.templates[tpl.id].title }, t)), tpl.id).toContain(tpl.id)
      }
    }
  })
})

describe('groupByCategory', () => {
  it('shelf by shelf, in shelf order, empty shelves left out', () => {
    const all = groupByCategory(WORKSHEET_TEMPLATES)
    expect(all.map((g) => g.category)).toEqual(WORKSHEET_CATEGORIES)
    expect(all.reduce((n, g) => n + g.templates.length, 0)).toBe(33)
    expect(groupByCategory(filterTemplates({ q: 'haiku' }, tEn)).map((g) => g.category)).toEqual(['poems'])
  })
})

describe('URL state', () => {
  it('reads ?q=&cat=&grade=, dropping anything unknown and capping the query', () => {
    expect(parseLibraryParams(new URLSearchParams('q=poem&cat=poems&grade=k2'))).toEqual({ q: 'poem', cat: 'poems', grade: 'k2' })
    expect(parseLibraryParams(new URLSearchParams('cat=nope&grade=all'))).toEqual({ q: '', cat: null, grade: null })
    expect(parseLibraryParams(new URLSearchParams(`q=${'x'.repeat(200)}`)).q).toHaveLength(QUERY_MAX)
    expect(parseLibraryParams(null)).toEqual({ q: '', cat: null, grade: null })
  })

  it('writes filters, keeping every other parameter (the ?template= deep link)', () => {
    const next = withLibraryParams(new URLSearchParams('template=story-map&q=old'), { q: '', cat: 'poems' })
    expect(next.toString()).toBe('template=story-map&cat=poems')
    expect(hasActiveFilters({ q: '  ', cat: null, grade: null })).toBe(false)
    expect(hasActiveFilters({ q: '', cat: null, grade: 'k2' })).toBe(true)
  })
})

describe('the /worksheets page and its full-size preview', () => {
  const page = readFileSync('src/pages/WorksheetsPage.jsx', 'utf8')
  const preview = readFileSync('src/components/worksheets/WorksheetPreview.jsx', 'utf8')
  const thumb = readFileSync('src/components/worksheets/WorksheetThumbnail.jsx', 'utf8')

  it('search, shelves and grade from the URL; shelf headings when nothing is filtered; an empty state', () => {
    expect(page).toContain('parseLibraryParams(searchParams)')
    expect(page).toContain('setSearchParams((prev) => withLibraryParams(prev, patch), { replace: typingOnly })')
    expect(page).toContain('groupByCategory(results)')
    expect(page).toContain('<LibraryEmpty value={filters} onChange={setFilters} />')
    // The old ?template= deep link still opens Customize (aliases resolved).
    expect(page).toContain('parseWorksheetParams(searchParams)')
  })

  it('a card opens the preview through its title button stretched over the card; no block content inside a button', () => {
    const card = page.slice(page.indexOf('const card = (template) => ('), page.indexOf('  return (\n    <div className="max-w-5xl'))
    expect(card).toContain("after:absolute after:inset-0")
    expect(card).toMatch(/<h3[^>]*>\s*<button/)
    // The thumbnail sits outside every button; actions above the overlay.
    const btns = [...card.matchAll(/<button[\s\S]*?<\/button>/g)].map((m) => m[0])
    for (const b of btns) expect(b).not.toMatch(/<(div|p|h\d|section|CardThumbnail)\b/)
    expect(card).toContain('relative z-10 flex items-center')
  })

  it('stepping to the end hands focus to the other nav button, never <body>', () => {
    expect(preview).toContain('(next ? nextRef.current : panelRef.current)?.focus()')
    expect(preview).toContain('(prev ? prevRef.current : panelRef.current)?.focus()')
  })

  it('thumbnails render lazily (33 live sheets)', () => {
    expect(page).toContain('<WorksheetThumbnail lazy')
    expect(thumb).toContain('new IntersectionObserver(')
  })

  it('the preview is opaque, modal, inert behind, Esc / arrows, never printed, teacher-scoped for a teacher', () => {
    expect(preview).toContain('bg-galaxy-bg-light')
    expect(preview).not.toMatch(/bg-black\/\d+|glass/)
    expect(preview).toContain('aria-modal="true"')
    expect(preview).toContain('enterInertBackground(document)')
    expect(preview).toContain('exitInertBackground(document)')
    expect(preview).toContain("e.key === 'Escape'")
    expect(preview).toContain("e.key === 'ArrowLeft' && prev")
    expect(preview).toContain('print:hidden')
    expect(preview).toContain("teacherMode ? 'teacher-ui' : ''")
    expect(preview).toContain('assignWorksheetHref(template.id)')
    // Previous / next walk the list as filtered.
    expect(page).toContain('list={results.some((x) => x.id === previewTemplate.id) ? results : [previewTemplate]}')
  })
})

describe('the assign picker renders', () => {
  it('every sheet as a card, shelf by shelf, with the filters; an unknown template\'s own prompts when editing', async () => {
    const { createElement } = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { default: WorksheetPicker } = await import('../src/components/school/WorksheetPicker.jsx')
    const html = renderToStaticMarkup(createElement(WorksheetPicker, { value: { templateId: null, prompts: {}, word: '' }, onChange: () => {} }))
    expect((html.match(/aria-pressed="false"/g) ?? []).length).toBeGreaterThanOrEqual(33)
    expect(html).toContain('id="ws-picker-search"')
    const edit = renderToStaticMarkup(createElement(WorksheetPicker, { value: { templateId: 'from_the_future', prompts: { a: 'Ask A' }, word: '' }, onChange: () => {} }))
    expect(edit).toContain('value="Ask A"')
  })
})

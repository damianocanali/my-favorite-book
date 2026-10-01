import { describe, it, expect } from 'vitest'
import {
  schoolYear, schoolYearLabel, canPrintClass, cleanAddress, pieceContent, buildChildBook, hasPieces,
  aboutMeDone, canMovePrint, cleanShortText, storageImage, handInSnapshot, defaultShippingLevel,
} from '../lib/school/writingYear.js'
import {
  buildWritingYearInteriorHtml, buildWritingYearCoverHtml, MIN_PAGES, paginateLines, wrapLines, lineCount,
  CHARS_PER_LINE, LINES_PER_PAGE, CONTENTS_PER_PAGE,
} from '../lib/print/writing-year-html.js'

const ORIGIN = 'https://proj.supabase.co'
const IMG = `${ORIGIN}/storage/v1/object/public/book-illustrations/u/p1.png`
const COVER = `${ORIGIN}/storage/v1/object/public/book-illustrations/u/c.png`

const future = new Date(Date.now() + 86400_000 * 100).toISOString()
const past = new Date(Date.now() - 86400_000).toISOString()

const ADDRESS = {
  school_name: 'Lincoln Elementary', contact_name: 'Ms Rivera', contact_email: 'rivera@school.org',
  contact_phone: '555 010 0199', address_line1: '1 Main St', city: 'Springfield', state_code: 'il',
  postal_code: '62701', country_code: 'us',
}

describe('school year', () => {
  it('starts on Aug 1 (UTC)', () => {
    expect(schoolYear(new Date('2026-07-31T23:00:00Z'))).toBe('2025-26')
    expect(schoolYear(new Date('2026-08-01T00:00:00Z'))).toBe('2026-27')
    expect(schoolYear(new Date('2027-05-15T00:00:00Z'))).toBe('2026-27')
    expect(schoolYear(new Date('2099-09-01T00:00:00Z'))).toBe('2099-00')
    expect(schoolYearLabel('2026-27')).toBe('2026–27')
  })
})

describe('canPrintClass (R1)', () => {
  it('paid or comped only — never a trial, never lapsed', () => {
    expect(canPrintClass({ status: 'active', expires_at: future })).toBe(true)
    expect(canPrintClass({ status: 'comped', expires_at: future })).toBe(true)
    expect(canPrintClass({ status: 'grace', expires_at: past })).toBe(true)
    expect(canPrintClass({ status: 'trial', expires_at: future })).toBe(false)
    expect(canPrintClass({ status: 'active', expires_at: past })).toBe(false)
    expect(canPrintClass({ status: 'lapsed', expires_at: future })).toBe(false)
    expect(canPrintClass({ status: 'pending_payment', expires_at: future })).toBe(false)
    expect(canPrintClass(null)).toBe(false)
  })
})

describe('print status moves', () => {
  it('only forward, cancel only before the printer has it', () => {
    expect(canMovePrint('requested', 'approved')).toBe(true)
    expect(canMovePrint('approved', 'submitted')).toBe(true)
    expect(canMovePrint('submitted', 'canceled')).toBe(false)
    expect(canMovePrint('shipped', 'in_production')).toBe(false)
    expect(canMovePrint('requested', 'submitted')).toBe(false)
    expect(canMovePrint('failed', 'canceled')).toBe(true)
  })
})

describe('cleanAddress', () => {
  it('normalises and accepts a full address', () => {
    const r = cleanAddress(ADDRESS)
    expect(r.ok).toBe(true)
    expect(r.address.country_code).toBe('US')
    expect(r.address.state_code).toBe('IL')
    expect(r.address.address_line2).toBe('')
  })
  it('refuses missing, malformed and too-long fields', () => {
    expect(cleanAddress(null).ok).toBe(false)
    expect(cleanAddress({ ...ADDRESS, city: ' ' })).toMatchObject({ ok: false, field: 'city' })
    expect(cleanAddress({ ...ADDRESS, contact_email: 'nope' })).toMatchObject({ ok: false, field: 'contact_email' })
    expect(cleanAddress({ ...ADDRESS, country_code: 'USA' })).toMatchObject({ ok: false, field: 'country_code' })
    expect(cleanAddress({ ...ADDRESS, state_code: '' })).toMatchObject({ ok: false, field: 'state_code' })
    expect(cleanAddress({ ...ADDRESS, contact_phone: '12' })).toMatchObject({ ok: false, field: 'contact_phone' })
    expect(cleanAddress({ ...ADDRESS, school_name: 'x'.repeat(121) })).toMatchObject({ ok: false, field: 'school_name' })
    // Outside the US a state is optional.
    expect(cleanAddress({ ...ADDRESS, country_code: 'IT', state_code: '' }).ok).toBe(true)
  })
  it('cleanShortText', () => {
    expect(cleanShortText('  hi ', 10)).toBe('hi')
    expect(cleanShortText(undefined, 10)).toBe('')
    expect(cleanShortText(5, 10)).toBeNull()
    expect(cleanShortText('x'.repeat(11), 10)).toBeNull()
  })
})

const WORKSHEET = {
  kind: 'worksheet', templateId: 'acrostic', word: 'SUN',
  boxes: [{ id: 'lines', prompt: 'Write a line for each letter' }, { id: 'why', prompt: 'Why this word?' }, { id: 'empty', prompt: 'Skipped' }],
  answers: { line_1: 'Shines bright', line_2: 'Up high', line_3: 'Never tired', why: 'I like summer', empty: '  ' },
}
const BOOK = {
  title: 'The Dragon', coverImage: COVER,
  pages: [{ text: 'Once upon a time', illustrationData: IMG }, { text: 'The end', illustrationData: '[saved-locally]' }, { text: '' }],
}

describe('pieceContent', () => {
  it('a book: its pages, only real image URLs, empty pages dropped', () => {
    const c = pieceContent('', BOOK, { imageOrigin: ORIGIN })
    expect(c).toMatchObject({ kind: 'book', title: 'The Dragon', cover: COVER })
    expect(c.pages).toEqual([{ text: 'Once upon a time', image: IMG }, { text: 'The end', image: null }])
  })
  it('only pictures from our storage origin pass (the renderer fetches every <img>)', () => {
    expect(storageImage(IMG, ORIGIN)).toBe(IMG)
    expect(storageImage('https://evil.example/x.png', ORIGIN)).toBeNull()
    expect(storageImage(`http://proj.supabase.co/storage/v1/object/public/x.png`, ORIGIN)).toBeNull()
    expect(storageImage(`${ORIGIN}/rest/v1/user_books`, ORIGIN)).toBeNull()
    expect(storageImage('http://169.254.169.254/latest', ORIGIN)).toBeNull()
    expect(storageImage(IMG, null)).toBeNull()
    expect(pieceContent('', BOOK).pages[0].image).toBeNull()
  })
  it('a hand-in prints its latest graded version, else the frozen copy, else the latest', () => {
    const latest = { v: 'latest' }, frozen = { v: 'frozen' }
    expect(handInSnapshot({ latest, latestVersion: 3, frozen, frozenVersion: 2, gradedVersions: [2, 3] })).toBe(latest)
    expect(handInSnapshot({ latest, latestVersion: 3, frozen, frozenVersion: 2, gradedVersions: [2] })).toBe(frozen)
    expect(handInSnapshot({ latest, latestVersion: 3, frozen: null, gradedVersions: [] })).toBe(latest)
  })
  it('default shipping: ground in the US, priority mail elsewhere', () => {
    expect(defaultShippingLevel('US')).toBe('GROUND')
    expect(defaultShippingLevel('IT')).toBe('PRIORITY_MAIL')
  })
  it('a worksheet: prompt + answer per box, acrostic lines, empty boxes dropped', () => {
    const c = pieceContent('My acrostic', WORKSHEET)
    expect(c.kind).toBe('worksheet')
    expect(c.boxes).toHaveLength(2)
    expect(c.boxes[0].answer).toBe('S — Shines bright\nU — Up high\nN — Never tired')
    expect(c.boxes[1]).toEqual({ prompt: 'Why this word?', answer: 'I like summer' })
  })
  it('nothing to print → null', () => {
    expect(pieceContent('x', null)).toBeNull()
    expect(pieceContent('x', { pages: [] })).toBeNull()
    expect(pieceContent('x', { kind: 'worksheet', boxes: [], answers: {} })).toBeNull()
  })
})

function book(over = {}) {
  return buildChildBook({
    student: { display_name: 'Ann', avatar_emoji: '🦊' },
    className: 'Room 5', lang: 'en', year: '2026-27',
    pieces: [{ title: 'The Dragon', snapshot: BOOK }, { title: 'My acrostic', snapshot: WORKSHEET }],
    meta: { about_favorite: 'Dragons', about_best_sentence: '', about_learned: 'Commas', teacher_note: 'So proud of you' },
    ...over,
  })
}

describe('buildChildBook', () => {
  it('freezes name, class, year, pieces in order, About me and the note', () => {
    const b = book()
    expect(b).toMatchObject({ name: 'Ann', class_name: 'Room 5', lang: 'en', year: '2026-27', teacher_note: 'So proud of you' })
    expect(b.pieces.map((p) => p.title)).toEqual(['The Dragon', 'My acrostic'])
    expect(hasPieces(b)).toBe(true)
    expect(hasPieces(book({ pieces: [] }))).toBe(false)
    expect(aboutMeDone(b.about)).toBe(true)
    expect(aboutMeDone({})).toBe(false)
    expect(b.avatar_url).toBeNull()
    expect(book({ avatarUrl: 'data:image/png;base64,xx' }).avatar_url).toBeNull()
  })
})

describe('Writing Year PDF HTML (smoke)', () => {
  it('interior: cover title, name, pieces in order, About me, note; even and ≥ 32 pages', () => {
    const { html, pageCount } = buildWritingYearInteriorHtml(book())
    expect(html).toContain('My Writing Year')
    expect(html).toContain('2026–27')
    expect(html).toContain('Ann')
    expect(html).toContain('Room 5')
    const order = ['Once upon a time', 'Shines bright', 'About me', 'A note from my teacher', 'Made at school with My Book Lab']
    const idx = order.map((s) => html.indexOf(s))
    for (const i of idx) expect(i).toBeGreaterThan(0)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
    expect(pageCount).toBeGreaterThanOrEqual(MIN_PAGES)
    expect(pageCount % 2).toBe(0)
    expect((html.match(/<section class="page/g) || []).length).toBe(pageCount)
    expect(html).not.toContain('[saved-locally]')
  })

  it('escapes the child\'s words and uses the class language for back matter', () => {
    const it_ = book({ lang: 'it', student: { display_name: '<b>Lu</b>', avatar_emoji: '🐢' } })
    const { html } = buildWritingYearInteriorHtml(it_)
    expect(html).toContain('Il mio anno di scrittura')
    expect(html).toContain('Su di me')
    expect(html).toContain('&lt;b&gt;Lu&lt;/b&gt;')
    expect(html).not.toContain('<b>Lu</b>')
  })

  it('a long book grows past the floor and stays even', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ text: `Page ${i}` }))
    const { pageCount } = buildWritingYearInteriorHtml(book({ pieces: [{ title: 'Long', snapshot: { pages: many } }] }))
    expect(pageCount).toBeGreaterThan(40)
    expect(pageCount % 2).toBe(0)
  })

  it('cover: the exact spread size, name and year', () => {
    const html = buildWritingYearCoverHtml(book(), { widthInches: 17.4, heightInches: 8.75, spineWidthInches: 0.2 })
    expect(html).toContain('size: 17.4in 8.75in')
    expect(html).toContain('Ann')
    expect(html).toContain('2026–27')
    expect(html).toContain('🦊')
  })
})

describe('measured pagination (nothing is cut off)', () => {
  const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')
  const pageTexts = (html) => [...html.matchAll(/<p class="body" style="margin:0;">([\s\S]*?)<\/p>/g)].map((m) => m[1])

  it('wrapLines / lineCount: words wrap, typed line breaks count, long words are cut', () => {
    expect(lineCount('a\nb\nc')).toBe(3)
    expect(lineCount('')).toBe(0)
    expect(wrapLines('x'.repeat(CHARS_PER_LINE * 2 + 5)).length).toBe(3)
    for (const l of wrapLines(words(200))) expect(l.text.length).toBeLessThanOrEqual(CHARS_PER_LINE)
  })

  it('paginateLines keeps every word and line break, and respects the budgets', () => {
    const text = `${words(300)}\nA\nB\n${words(50)}`
    const chunks = paginateLines(text, LINES_PER_PAGE, 5)
    expect(lineCount(chunks[0])).toBeLessThanOrEqual(5)
    for (const c of chunks.slice(1)) expect(lineCount(c)).toBeLessThanOrEqual(LINES_PER_PAGE)
    expect(chunks.join(' ').split(/\s+/).filter(Boolean)).toEqual(text.split(/\s+/).filter(Boolean))
  })

  it('a long book page continues on more pages; the picture stays on the first', () => {
    const long = words(600)
    const b = book({ pieces: [{ title: 'Long', snapshot: { pages: [{ text: long, illustrationData: IMG }] } }], imageOrigin: ORIGIN, meta: {} })
    const { html } = buildWritingYearInteriorHtml(b)
    const texts = pageTexts(html).filter((t) => t.includes('word'))
    expect(texts.length).toBeGreaterThan(3)
    expect(texts.join(' ').split(/\s+/)).toEqual(long.split(' '))
    expect((html.match(/<img src=/g) || []).length).toBe(1)
  })

  it('a worksheet with many typed lines is paginated by lines, not characters', () => {
    const answer = Array.from({ length: 60 }, (_, i) => `L${i}`).join('\n') // short, but 60 lines
    const ws = { kind: 'worksheet', boxes: [{ id: 'a', prompt: 'P' }], answers: { a: answer } }
    const { html } = buildWritingYearInteriorHtml(book({ pieces: [{ title: 'Lines', snapshot: ws }], meta: {} }))
    const texts = pageTexts(html).filter((t) => /L\d/.test(t))
    expect(texts.length).toBeGreaterThanOrEqual(4)
    for (const t of texts) expect(lineCount(t)).toBeLessThanOrEqual(LINES_PER_PAGE)
    expect(texts.join('\n')).toBe(answer)
  })

  it('the contents page is paginated for a full year', () => {
    const pieces = Array.from({ length: 30 }, (_, i) => ({ title: `Piece ${i + 1}`, snapshot: { pages: [{ text: 'x' }] } }))
    const { html } = buildWritingYearInteriorHtml(book({ pieces, meta: {} }))
    const contentsPages = html.split('<section').filter((sec) => sec.includes('text-overflow:ellipsis'))
    expect(contentsPages.length).toBe(Math.ceil(30 / CONTENTS_PER_PAGE))
    for (const sec of contentsPages) expect((sec.match(/text-overflow:ellipsis/g) || []).length).toBeLessThanOrEqual(CONTENTS_PER_PAGE)
    expect(html).toContain('30. Piece 30')
  })

  it('a long, many-line teacher note and full About me split across pages', () => {
    const note = Array.from({ length: 40 }, (_, i) => `Line ${i}`).join('\n')
    const about = { about_favorite: words(28), about_best_sentence: words(28), about_learned: words(28) }
    const { html } = buildWritingYearInteriorHtml(book({ meta: { ...about, teacher_note: note } }))
    const noteTexts = pageTexts(html).filter((t) => t.startsWith('Line'))
    expect(noteTexts.length).toBeGreaterThanOrEqual(3)
    expect(noteTexts.join('\n')).toBe(note)
    for (const t of pageTexts(html)) expect(lineCount(t)).toBeLessThanOrEqual(LINES_PER_PAGE)
  })
})

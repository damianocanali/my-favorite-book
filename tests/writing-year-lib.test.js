import { describe, it, expect } from 'vitest'
import {
  schoolYear, schoolYearLabel, canPrintClass, cleanAddress, pieceContent, buildChildBook, hasPieces,
  aboutMeDone, canMovePrint, cleanShortText,
} from '../lib/school/writingYear.js'
import { buildWritingYearInteriorHtml, buildWritingYearCoverHtml, MIN_PAGES } from '../lib/print/writing-year-html.js'

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
  title: 'The Dragon', coverImage: 'https://cdn/x.png',
  pages: [{ text: 'Once upon a time', illustrationData: 'https://cdn/p1.png' }, { text: 'The end', illustrationData: '[saved-locally]' }, { text: '' }],
}

describe('pieceContent', () => {
  it('a book: its pages, only real image URLs, empty pages dropped', () => {
    const c = pieceContent('', BOOK)
    expect(c).toMatchObject({ kind: 'book', title: 'The Dragon', cover: 'https://cdn/x.png' })
    expect(c.pages).toEqual([{ text: 'Once upon a time', image: 'https://cdn/p1.png' }, { text: 'The end', image: null }])
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

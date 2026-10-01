// Worksheet assignments on the web: the pure helpers (worksheetUi.js), a
// print-rendering smoke test of the sheet, and static checks that the
// child's view uses the existing speech / word-help pieces.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  fillLayout, answersForSubmit, hasAnswers, readWorksheetDraft, writeWorksheetDraft, hasWorksheetDraft,
  appendWorksheetPages, pagesFor, defaultPrompts, isWorksheet,
  removeWorksheetDraft, pruneWorksheetDrafts, startingPoint, canHandInWorksheet, pagesBase,
} from '../src/components/school/worksheetUi.js'
import { AssignmentWorksheetSheet } from '../src/components/worksheets/AssignmentSheet.jsx'
import { BOOK_PAGES_MAX } from '../lib/school/worksheets.js'

const en = JSON.parse(readFileSync('src/i18n/locales/en/school.json', 'utf8'))
const at = (obj, dotted) => dotted.split('.').reduce((o, k) => o?.[k], obj)
const tEn = (key, opts) => {
  const v = key.startsWith('school:') ? at(en, key.slice(7)) : key
  return typeof v === 'string' ? v.replace(/\{\{(\w+)\}\}/g, (_, k) => opts?.[k] ?? '') : key
}

function fakeStorage() {
  const m = new Map()
  return {
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    get length() { return m.size }, key: (i) => [...m.keys()][i] ?? null, _m: m,
  }
}

const SEQ = { templateId: 'sequence', prompts: { first: 'First…', next: 'Next…', then: 'Then…', last: 'Last…' } }
const ACR = { templateId: 'acrostic', prompts: { word: 'Pick a word', lines: 'A line per letter' } }

describe('worksheetUi', () => {
  it('isWorksheet needs both the kind and the definition', () => {
    expect(isWorksheet({ kind: 'worksheet', worksheet: SEQ })).toBe(true)
    expect(isWorksheet({ kind: 'worksheet' })).toBe(false)
    expect(isWorksheet({ kind: 'book' })).toBe(false)
  })

  it('defaultPrompts reads the template\'s own prompts from the catalogue', () => {
    expect(defaultPrompts(tEn, 'sequence')).toEqual(en.worksheet.templates.sequence.boxes)
    expect(defaultPrompts(tEn, 'nope')).toEqual({})
  })

  it('fillLayout: boxes in order; the acrostic expands to one box per letter of the teacher\'s or the child\'s word', () => {
    expect(fillLayout(SEQ).map((b) => [b.type, b.id, b.prompt])).toEqual([
      ['box', 'first', 'First…'], ['box', 'next', 'Next…'], ['box', 'then', 'Then…'], ['box', 'last', 'Last…'],
    ])
    const fixed = fillLayout({ ...ACR, word: 'SUN' })
    expect(fixed[0]).toMatchObject({ type: 'word', fixed: true })
    expect(fixed[1].letters).toEqual([{ id: 'line_1', letter: 'S' }, { id: 'line_2', letter: 'U' }, { id: 'line_3', letter: 'N' }])
    const open = fillLayout(ACR, 'cat')
    expect(open[0].fixed).toBe(false)
    expect(open[1].letters.map((l) => l.letter)).toEqual(['C', 'A', 'T'])
    expect(fillLayout(ACR, '')[1].letters).toEqual([])
  })

  it('answersForSubmit drops blanks, lines past a shortened word, and the word when the teacher set it', () => {
    expect(answersForSubmit(SEQ, { first: 'a', next: ' ', then: '' })).toEqual({ first: 'a' })
    expect(answersForSubmit(ACR, { word: 'ab', line_1: 'x', line_2: 'y', line_3: 'stale' })).toEqual({ word: 'ab', line_1: 'x', line_2: 'y' })
    expect(answersForSubmit({ ...ACR, word: 'SUN' }, { word: 'zzz', line_1: 'x' })).toEqual({ line_1: 'x' })
    expect(hasAnswers({ word: 'ab' })).toBe(false)
    expect(hasAnswers({ line_1: 'x' })).toBe(true)
  })

  it('drafts are per child and per assignment, and survive bad storage', () => {
    const s = fakeStorage()
    writeWorksheetDraft('kid-1', 'a1', { first: 'hello' }, s)
    expect(readWorksheetDraft('kid-1', 'a1', s).answers).toEqual({ first: 'hello' })
    expect(readWorksheetDraft('kid-2', 'a1', s)).toBeNull()
    expect(readWorksheetDraft('kid-1', 'a2', s)).toBeNull()
    expect(hasWorksheetDraft('kid-1', 'a1', s)).toBe(true)
    s.setItem('mbl.worksheetDraft.kid-1.a3', '{nope')
    expect(readWorksheetDraft('kid-1', 'a3', s)).toBeNull()
    const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(readWorksheetDraft('kid-1', 'a1', throwing)).toBeNull()
    expect(() => writeWorksheetDraft('kid-1', 'a1', {}, throwing)).not.toThrow()
    expect(readWorksheetDraft(null, 'a1', s)).toBeNull()
  })

  it('drafts are pruned: after a hand-in, and for assignments no longer listed or closed — only this child\'s', () => {
    const s = fakeStorage()
    for (const id of ['open', 'closed', 'gone']) writeWorksheetDraft('kid-1', id, { first: 'x' }, s)
    writeWorksheetDraft('kid-2', 'gone', { first: 'x' }, s)
    s.setItem('unrelated', '1')
    pruneWorksheetDrafts('kid-1', [{ id: 'open', status: 'published' }, { id: 'closed', status: 'closed' }], s)
    expect(readWorksheetDraft('kid-1', 'open', s)).not.toBeNull()
    expect(readWorksheetDraft('kid-1', 'closed', s)).toBeNull()
    expect(readWorksheetDraft('kid-1', 'gone', s)).toBeNull()
    expect(readWorksheetDraft('kid-2', 'gone', s)).not.toBeNull()
    expect(s.getItem('unrelated')).toBe('1')
    removeWorksheetDraft('kid-1', 'open', s)
    expect(readWorksheetDraft('kid-1', 'open', s)).toBeNull()
    const throwing = { get length() { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
    expect(() => pruneWorksheetDrafts('kid-1', [], throwing)).not.toThrow()
    expect(() => removeWorksheetDraft('kid-1', 'a', throwing)).not.toThrow()
  })

  it('starts from the hand-in when it is newer than this device\'s draft (so pages use what was handed in)', () => {
    const draft = { answers: { first: 'old' }, updatedAt: '2026-09-27T10:00:00.000Z' }
    expect(startingPoint(draft, { id: 's', submitted_at: '2026-09-27T11:00:00.000Z' })).toBe('handed_in')
    expect(startingPoint(draft, { id: 's', submitted_at: '2026-09-27T09:00:00.000Z' })).toBe('draft')
    expect(startingPoint(draft, null)).toBe('draft')
    expect(startingPoint(null, { id: 's', submitted_at: '2026-09-27T09:00:00.000Z' })).toBe('handed_in')
    expect(startingPoint(null, null)).toBe('empty')
  })

  it('hand-in is offered only when it can succeed (past due without late work: no)', () => {
    expect(canHandInWorksheet({ status: 'published' })).toBe(true)
    expect(canHandInWorksheet({ status: 'published', past_due: true, allow_late: true })).toBe(true)
    expect(canHandInWorksheet({ status: 'published', past_due: true, allow_late: false })).toBe(false)
    expect(canHandInWorksheet({ status: 'closed' })).toBe(false)
  })

  it('turn into pages into the book that is open: the open draft (unsaved edits kept), not the shelf copy', () => {
    const shelf = { id: 'b1', pages: [{ id: 'x', pageNumber: 1, text: 'saved' }] }
    const open = { id: 'b1', pages: [{ id: 'x', pageNumber: 1, text: 'saved' }, { id: 'y', pageNumber: 2, text: 'unsaved edit' }] }
    expect(pagesBase(open, shelf)).toBe(open)
    let n = 0
    const { pages } = appendWorksheetPages(pagesBase(open, shelf).pages, ['new'], () => `p${++n}`)
    expect(pages.map((p) => p.text)).toEqual(['saved', 'unsaved edit', 'new'])
    expect(pagesBase({ id: 'other' }, shelf)).toBe(shelf)
    expect(pagesBase(open, null)).toBeNull()
  })

  it('turn into pages: numbered on from the existing pages, never past the limit', () => {
    let n = 0
    const id = () => `p${++n}`
    const { pages, added } = appendWorksheetPages([{ id: 'x', pageNumber: 1, text: 'Once' }], ['a', 'b'], id)
    expect(added).toBe(2)
    expect(pages.map((p) => [p.pageNumber, p.text])).toEqual([[1, 'Once'], [2, 'a'], [3, 'b']])
    expect(pages[1]).toMatchObject({ id: 'p1', illustrationData: null })
    const full = Array.from({ length: BOOK_PAGES_MAX }, (_, i) => ({ id: `e${i}`, pageNumber: i + 1, text: '' }))
    expect(appendWorksheetPages(full, ['a'], id).added).toBe(0)
    expect(pagesFor(SEQ, { first: 'Up.', last: 'Bed.' })).toEqual(['Up.', 'Bed.'])
    expect(pagesFor({ ...ACR, word: 'AB' }, { line_1: 'Ant' })).toEqual(['Ant\nB'])
  })
})

describe('print: the assignment sheet renders blank and filled', () => {
  const tSheet = (k) => ({ 'sheet.header.name': 'Name', 'sheet.header.date': 'Date', 'sheet.header.class': 'Class', 'sheet.footer': 'Make it a real book' }[k] ?? k)
  const render = (props) => renderToStaticMarkup(createElement(AssignmentWorksheetSheet, { t: tEn, tSheet, ...props }))

  it('blank: the assignment title, template name, every prompt, ruled lines, no answers', () => {
    const html = render({ title: 'My morning', studentName: 'Ann', worksheet: SEQ, answers: null })
    expect(html).toContain('My morning')
    expect(html).toContain(en.worksheet.templates.sequence.title)
    for (const p of Object.values(SEQ.prompts)) expect(html).toContain(p)
    expect(html).toContain('Ann')
    expect(html).toContain('worksheet-sheet')
    expect(html).not.toContain('worksheet-sheet-flow')
    expect((html.match(/border-b border-black h-4/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })

  it('filled: the child\'s answers in place of the lines, and the sheet grows to fit', () => {
    const html = render({ title: 'My morning', studentName: 'Ann', worksheet: SEQ, answers: { first: 'I woke up early.' } })
    expect(html).toContain('I woke up early.')
    expect(html).toContain('worksheet-sheet-flow')
  })

  it('acrostic: one row per letter of the word', () => {
    const html = render({ title: 'Sun poem', worksheet: { ...ACR, word: 'SUN' }, answers: { line_1: 'Sunny' } })
    expect(html).toContain('SUN')
    expect(html).toContain('Sunny')
    expect(html).toMatch(/>S<\/span>[\s\S]*>U<\/span>[\s\S]*>N<\/span>/)
  })

  it('every template prints', () => {
    for (const id of Object.keys(en.worksheet.templates)) {
      const html = render({ title: 'T', worksheet: { templateId: id, prompts: en.worksheet.templates[id].boxes }, answers: null })
      expect(html, id).toContain(en.worksheet.templates[id].title)
    }
  })
})

describe('the child\'s fill-in view reuses the existing pieces', () => {
  const fill = readFileSync('src/components/school/WorksheetFill.jsx', 'utf8')
  const mine = readFileSync('src/components/school/MyAssignments.jsx', 'utf8')

  it('read-aloud, dictation, word help, device autosave, hand-in with answers', () => {
    expect(fill).toContain("from '../../hooks/useSpeechSynthesis'")
    expect(fill).toContain("from '../../hooks/useSpeechRecognition'")
    expect(fill).toContain("from '../editor/WritingScaffold'")
    // Word help only on large boxes, with fixed middle-of-story starters.
    expect(fill).toContain("{ scaffold: box.size === 'large' }")
    expect(fill).toMatch(/page=\{\{ id, pageNumber: 2, text: value \}\}\n\s+totalPages=\{3\}/)
    // Prompts read in the class language; a hand-in clears the draft.
    expect(fill).toContain('synth.speak(text, assignment.class_locale)')
    expect(fill).toContain('removeWorksheetDraft(userId, assignment.id)')
    expect(fill).toContain('canHandInWorksheet(assignment)')
    expect(fill).toMatch(/writeWorksheetDraft\(userId, assignment\.id, next\)/)
    expect(fill).toMatch(/schoolFetch\('\/api\/school\/submit'[\s\S]*answers: answersForSubmit\(worksheet, answers\)/)
  })

  it('a worksheet card opens the fill-in view, never the book draft; nudges go the same way', () => {
    expect(mine).toMatch(/function startOrContinue\(assignment\) \{\n\s+markOpened\(assignment\.id\)\n[\s\S]*?if \(isWorksheet\(assignment\)\) \{\n\s+setWorksheetFor\(assignment\)/)
    expect(mine).toMatch(/if \(isWorksheet\(assignment\)\) \{\n\s+markOpened\(assignment\.id\)\n\s+setWorksheetFor\(assignment\)/)
  })
})

// Worksheet assignments (spec 2026-10-01 §2): the template list, the
// validation the API applies, the turn-into-book-pages mapping, and the
// web copy. The iPad mirror is pinned in tests/worksheets-ios.test.js; the
// migration in tests/worksheets-migration.test.js; the endpoints in
// tests/worksheets-api.test.js.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  WORKSHEET_TEMPLATES, TEMPLATE_IDS, PROMPT_TEXT_MAX, ANSWER_MAX, BOX_SIZES, BOOK_PAGES_MAX, PAGE_TEXT_MAX,
  getTemplate, boxIds, cleanWorksheet, cleanAnswers, snapshotWorksheet, worksheetPages, splitPageText,
  pagesThatFit, cleanAcrosticWord,
} from '../lib/school/worksheets.js'

const en = JSON.parse(readFileSync('src/i18n/locales/en/school.json', 'utf8'))
const itL = JSON.parse(readFileSync('src/i18n/locales/it/school.json', 'utf8'))

const prompts = (id, text = 'Write here') => Object.fromEntries(boxIds(getTemplate(id)).map((b) => [b, text]))

describe('templates', () => {
  it('the nine v1 templates, in the spec\'s order', () => {
    expect(TEMPLATE_IDS).toEqual([
      'story_map', 'character_profile', 'beginning_middle_end', 'five_senses', 'letter',
      'opinion', 'acrostic', 'sequence', 'my_week',
    ])
  })

  it('every box has a unique id and a known size; every page group names real boxes, each box once', () => {
    for (const t of WORKSHEET_TEMPLATES) {
      const ids = boxIds(t)
      expect(new Set(ids).size, t.id).toBe(ids.length)
      expect(ids.length).toBeLessThanOrEqual(12)
      for (const b of t.boxes) {
        expect(BOX_SIZES).toContain(b.size)
        expect(b.id).toMatch(/^[a-z_]{1,40}$/)
      }
      expect(t.id).toMatch(/^[a-z_]{1,40}$/)
      const mapped = t.pages.flat()
      for (const id of mapped) expect(ids, `${t.id}:${id}`).toContain(id)
      expect(new Set(mapped).size).toBe(mapped.length)
      expect(['lines', 'paragraph']).toContain(t.join)
    }
  })

  it('aligns with the free printable sheets where the same sheet exists', () => {
    // src/components/worksheets/sheets.jsx CharacterProfileBody's fields.
    expect(boxIds(getTemplate('character_profile'))).toEqual(['name', 'looks_like', 'likes', 'wants', 'afraid_of'])
    // The printable "story-map" is beginning / middle / end.
    expect(boxIds(getTemplate('beginning_middle_end'))).toEqual(['beginning', 'middle', 'end'])
  })
})

describe('web copy ↔ lib', () => {
  it('every template has an EN and an authored IT title, description and a prompt per box — nothing extra', () => {
    for (const [lang, d] of [['en', en], ['it', itL]]) {
      expect(Object.keys(d.worksheet.templates), lang).toEqual(TEMPLATE_IDS)
      for (const t of WORKSHEET_TEMPLATES) {
        const c = d.worksheet.templates[t.id]
        expect(c.title).toMatch(/\S/)
        expect(c.description).toMatch(/\S/)
        expect(Object.keys(c.boxes), `${lang}:${t.id}`).toEqual(boxIds(t))
        for (const id of boxIds(t)) {
          expect(c.boxes[id]).toMatch(/\S/)
          // A default prompt must itself pass the API's rule.
          expect(c.boxes[id].length).toBeLessThanOrEqual(PROMPT_TEXT_MAX)
        }
      }
    }
    for (const t of WORKSHEET_TEMPLATES) {
      expect(itL.worksheet.templates[t.id].title).not.toBe(en.worksheet.templates[t.id].title)
      for (const id of boxIds(t)) expect(itL.worksheet.templates[t.id].boxes[id]).not.toBe(en.worksheet.templates[t.id].boxes[id])
    }
  })

  it('the default prompts make a valid worksheet in both languages', () => {
    for (const d of [en, itL]) {
      for (const t of WORKSHEET_TEMPLATES) {
        expect(cleanWorksheet({ templateId: t.id, prompts: d.worksheet.templates[t.id].boxes }).ok, t.id).toBe(true)
      }
    }
  })

  it('UI strings and the new error codes have the same keys in EN and IT', () => {
    expect(Object.keys(itL.worksheet.teacher)).toEqual(Object.keys(en.worksheet.teacher))
    expect(Object.keys(itL.worksheet.student)).toEqual(Object.keys(en.worksheet.student))
    for (const code of ['empty_worksheet', 'unkind', 'answer_too_long', 'wrong_kind']) {
      expect(en.student.hand_in.errors[code]).toMatch(/\S/)
      expect(itL.student.hand_in.errors[code]).toMatch(/\S/)
    }
    expect(itL.teacher.errors.template_locked).toMatch(/\S/)
  })
})

describe('cleanWorksheet (the teacher\'s worksheet)', () => {
  it('accepts a known template with a prompt for every box, trimmed to one line', () => {
    const r = cleanWorksheet({ templateId: 'sequence', prompts: { first: '  First\nthing ', next: 'n', then: 't', last: 'l' } })
    expect(r).toEqual({ ok: true, worksheet: { templateId: 'sequence', prompts: { first: 'First thing', next: 'n', then: 't', last: 'l' } } })
  })

  it('refuses an unknown template, a missing / extra / unknown box, an empty or too-long prompt', () => {
    expect(cleanWorksheet(null).ok).toBe(false)
    expect(cleanWorksheet([]).ok).toBe(false)
    expect(cleanWorksheet({ templateId: 'nope', prompts: {} }).ok).toBe(false)
    const p = prompts('sequence')
    expect(cleanWorksheet({ templateId: 'sequence', prompts: { ...p, extra: 'x' } }).ok).toBe(false)
    const { last: _l, ...missing } = p
    expect(cleanWorksheet({ templateId: 'sequence', prompts: missing }).ok).toBe(false)
    expect(cleanWorksheet({ templateId: 'sequence', prompts: { ...p, last: '   ' } }).ok).toBe(false)
    expect(cleanWorksheet({ templateId: 'sequence', prompts: { ...p, last: 'x'.repeat(PROMPT_TEXT_MAX + 1) } }).ok).toBe(false)
    expect(cleanWorksheet({ templateId: 'sequence', prompts: { ...p, last: 'x'.repeat(PROMPT_TEXT_MAX) } }).ok).toBe(true)
    expect(cleanWorksheet({ templateId: 'sequence', prompts: { ...p, last: 4 } }).ok).toBe(false)
    expect(cleanWorksheet({ templateId: 'sequence', prompts: 'x' }).ok).toBe(false)
  })

  it('the acrostic takes an optional word: 2-12 letters, upper-cased; no other template does', () => {
    const p = prompts('acrostic')
    expect(cleanWorksheet({ templateId: 'acrostic', prompts: p }).worksheet).toEqual({ templateId: 'acrostic', prompts: p })
    expect(cleanWorksheet({ templateId: 'acrostic', prompts: p, word: ' mare ' }).worksheet.word).toBe('MARE')
    expect(cleanWorksheet({ templateId: 'acrostic', prompts: p, word: 'città' }).worksheet.word).toBe('CITTÀ')
    expect(cleanWorksheet({ templateId: 'acrostic', prompts: p, word: 'a' }).ok).toBe(false)
    expect(cleanWorksheet({ templateId: 'acrostic', prompts: p, word: 'two words' }).ok).toBe(false)
    expect(cleanWorksheet({ templateId: 'acrostic', prompts: p, word: 'abc1' }).ok).toBe(false)
    expect(cleanWorksheet({ templateId: 'acrostic', prompts: p, word: 'x'.repeat(13) }).ok).toBe(false)
    expect(cleanWorksheet({ templateId: 'sequence', prompts: prompts('sequence'), word: 'MARE' }).ok).toBe(false)
    // Upper-casing can lengthen a word ('ß' -> 'SS'): checked after.
    expect(cleanAcrosticWord('ßßßßßßß')).toBeNull()
  })
})

describe('cleanAnswers (the child\'s hand-in)', () => {
  const seq = { templateId: 'sequence', prompts: prompts('sequence') }

  it('keeps known boxes, trims, drops blanks', () => {
    expect(cleanAnswers(seq, { first: ' We woke up. ', next: '', then: '  ' })).toEqual({ ok: true, answers: { first: 'We woke up.' }, word: null })
  })

  it('refuses unknown boxes, non-strings, too-long answers and an all-empty sheet', () => {
    expect(cleanAnswers(seq, { nope: 'x' })).toMatchObject({ ok: false, code: 'bad_request' })
    expect(cleanAnswers(seq, { first: 3 })).toMatchObject({ ok: false, code: 'bad_request' })
    expect(cleanAnswers(seq, [])).toMatchObject({ ok: false, code: 'bad_request' })
    expect(cleanAnswers(seq, { first: 'x'.repeat(ANSWER_MAX + 1) })).toMatchObject({ ok: false, code: 'answer_too_long' })
    expect(cleanAnswers(seq, { first: 'x'.repeat(ANSWER_MAX) }).ok).toBe(true)
    expect(cleanAnswers(seq, { first: '  ' })).toMatchObject({ ok: false, code: 'empty_worksheet' })
    expect(cleanAnswers({ templateId: 'nope' }, { first: 'x' })).toMatchObject({ ok: false })
  })

  it('acrostic with the teacher\'s word: one line per letter, the word can\'t be changed', () => {
    const w = { templateId: 'acrostic', prompts: prompts('acrostic'), word: 'SUN' }
    expect(cleanAnswers(w, { line_1: 'Sunny', line_3: 'Nice' })).toEqual({ ok: true, answers: { line_1: 'Sunny', line_3: 'Nice' }, word: 'SUN' })
    expect(cleanAnswers(w, { line_4: 'x' }).ok).toBe(false)
    expect(cleanAnswers(w, { word: 'MOON', line_1: 'x' }).ok).toBe(false)
    expect(cleanAnswers(w, { word: 'sun', line_1: 'x' }).ok).toBe(true)
    expect(cleanAnswers(w, { line_0: 'x' }).ok).toBe(false)
  })

  it('acrostic left open: the child\'s word is stored, lines follow it', () => {
    const w = { templateId: 'acrostic', prompts: prompts('acrostic') }
    expect(cleanAnswers(w, { word: 'cat', line_1: 'Cuddly', line_2: 'Amazing' })).toEqual({
      ok: true, answers: { word: 'CAT', line_1: 'Cuddly', line_2: 'Amazing' }, word: 'CAT',
    })
    expect(cleanAnswers(w, { word: 'cat', line_4: 'x' }).ok).toBe(false)
    expect(cleanAnswers(w, { line_1: 'x' }).ok).toBe(false)
    expect(cleanAnswers(w, { word: 'c4t', line_1: 'x' }).ok).toBe(false)
    // A word alone is not an answer.
    expect(cleanAnswers(w, { word: 'cat' })).toMatchObject({ ok: false, code: 'empty_worksheet' })
  })
})

describe('snapshotWorksheet', () => {
  it('freezes the prompts the child answered, with the answers', () => {
    const w = { templateId: 'sequence', prompts: { first: 'A', next: 'B', then: 'C', last: 'D' } }
    expect(snapshotWorksheet(w, { first: 'x' }, null)).toEqual({
      kind: 'worksheet', templateId: 'sequence',
      boxes: [{ id: 'first', prompt: 'A' }, { id: 'next', prompt: 'B' }, { id: 'then', prompt: 'C' }, { id: 'last', prompt: 'D' }],
      answers: { first: 'x' },
    })
    expect(snapshotWorksheet({ templateId: 'acrostic', prompts: prompts('acrostic') }, { line_1: 'x' }, 'AB').word).toBe('AB')
  })
})

describe('turn into book pages', () => {
  it('a story map becomes beginning / middle / end pages', () => {
    expect(worksheetPages('story_map', {
      characters: 'A brave fox.', setting: 'In a snowy wood.', problem: 'She is lost.', events: 'She follows the stars.', ending: 'She finds home.',
    })).toEqual(['A brave fox.\nIn a snowy wood.', 'She is lost.\nShe follows the stars.', 'She finds home.'])
  })

  it('skips empty pages and boxes; one page per box for a sequence', () => {
    expect(worksheetPages('sequence', { first: 'Wake up.', then: 'Eat.' })).toEqual(['Wake up.', 'Eat.'])
    expect(worksheetPages('story_map', { ending: 'The end.' })).toEqual(['The end.'])
    expect(worksheetPages('sequence', {})).toEqual([])
    expect(worksheetPages('nope', { first: 'x' })).toEqual([])
  })

  it('OREO runs together as one paragraph', () => {
    expect(worksheetPages('opinion', { opinion: 'Dogs are best.', reason: 'They play.', example: 'Mine fetches.', conclusion: 'So dogs win.' }))
      .toEqual(['Dogs are best. They play. Mine fetches. So dogs win.'])
  })

  it('acrostic: one line per letter, the bare letter where a line is empty', () => {
    expect(worksheetPages('acrostic', { line_1: 'Sunny', line_3: 'Nice' }, 'SUN')).toEqual(['Sunny\nU\nNice'])
    expect(worksheetPages('acrostic', { word: 'AB', line_2: 'Bee' })).toEqual(['A\nBee'])
    expect(worksheetPages('acrostic', { word: 'AB' })).toEqual([])
  })

  it('a long answer runs onto more pages, never over the page limit, splitting at a sentence or a space', () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i}.`).join(' ')
    const pages = worksheetPages('beginning_middle_end', { beginning: long })
    expect(pages.length).toBeGreaterThan(1)
    for (const p of pages) {
      expect(p.length).toBeLessThanOrEqual(PAGE_TEXT_MAX)
      expect(p.endsWith('.')).toBe(true)
    }
    expect(pages.join(' ')).toBe(long)
    expect(splitPageText('x'.repeat(1001))).toEqual(['x'.repeat(500), 'x'.repeat(500), 'x'])
  })

  it('pagesThatFit keeps a book within the page limit', () => {
    expect(pagesThatFit(0, ['a', 'b'])).toEqual(['a', 'b'])
    expect(pagesThatFit(BOOK_PAGES_MAX - 1, ['a', 'b'])).toEqual(['a'])
    expect(pagesThatFit(BOOK_PAGES_MAX, ['a'])).toEqual([])
  })
})

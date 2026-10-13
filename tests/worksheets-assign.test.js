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
  pagesThatFit, cleanAcrosticWord, FROZEN_TEMPLATE_IDS, WORKSHEET_CATEGORIES, GRADE_BANDS, matchesGrade,
  TEMPLATE_ALIASES, resolveTemplateId,
} from '../lib/school/worksheets.js'

const en = JSON.parse(readFileSync('src/i18n/locales/en/school.json', 'utf8'))
const itL = JSON.parse(readFileSync('src/i18n/locales/it/school.json', 'utf8'))

const prompts = (id, text = 'Write here') => Object.fromEntries(boxIds(getTemplate(id)).map((b) => [b, text]))

describe('templates', () => {
  it('one library of 33 sheets, the nine live ones among them with their box ids exactly as before', () => {
    expect(TEMPLATE_IDS).toHaveLength(33)
    expect(new Set(TEMPLATE_IDS).size).toBe(33)
    expect(FROZEN_TEMPLATE_IDS).toEqual([
      'story_map', 'character_profile', 'beginning_middle_end', 'five_senses', 'letter',
      'opinion', 'acrostic', 'sequence', 'my_week',
    ])
    // Live assignments and hand-ins reference these box ids: frozen.
    const frozen = {
      story_map: ['characters', 'setting', 'problem', 'events', 'ending'],
      character_profile: ['name', 'looks_like', 'likes', 'wants', 'afraid_of'],
      beginning_middle_end: ['beginning', 'middle', 'end'],
      five_senses: ['place', 'see', 'hear', 'smell', 'touch', 'taste'],
      letter: ['greeting', 'opening', 'body', 'closing', 'signature'],
      opinion: ['opinion', 'reason', 'example', 'conclusion'],
      acrostic: ['word', 'lines'],
      sequence: ['first', 'next', 'then', 'last'],
      my_week: ['best', 'learned', 'tricky', 'felt_good', 'next_week'],
    }
    for (const [id, boxes] of Object.entries(frozen)) expect(boxIds(getTemplate(id)), id).toEqual(boxes)
    expect(getTemplate('acrostic').boxes[1]).toEqual({ id: 'lines', size: 'large', perLetter: true })
  })

  it('every sheet is on one of the eight shelves, with a grade band; every shelf has sheets; listed shelf by shelf', () => {
    expect(WORKSHEET_CATEGORIES).toEqual(['plan', 'characters', 'words', 'poems', 'opinions', 'reading', 'facts', 'me'])
    for (const t of WORKSHEET_TEMPLATES) {
      expect(WORKSHEET_CATEGORIES, t.id).toContain(t.category)
      expect(GRADE_BANDS, t.id).toContain(t.gradeBand)
    }
    for (const c of WORKSHEET_CATEGORIES) expect(WORKSHEET_TEMPLATES.some((t) => t.category === c), c).toBe(true)
    const order = WORKSHEET_TEMPLATES.map((t) => WORKSHEET_CATEGORIES.indexOf(t.category))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('a grade filter keeps that band and the any-grade sheets', () => {
    const k2 = getTemplate('beginning_middle_end')
    const g35 = getTemplate('opinion')
    const any = getTemplate('story_map')
    expect([k2, g35, any].map((t) => matchesGrade(t, 'k2'))).toEqual([true, false, true])
    expect([k2, g35, any].map((t) => matchesGrade(t, 'g35'))).toEqual([false, true, true])
    expect([k2, g35, any].every((t) => matchesGrade(t, null) && matchesGrade(t, 'all'))).toBe(true)
  })

  it('every box has a unique id and a known size; every page group names real boxes, each box once', () => {
    for (const t of WORKSHEET_TEMPLATES) {
      const ids = boxIds(t)
      expect(new Set(ids).size, t.id).toBe(ids.length)
      expect(ids.length).toBeLessThanOrEqual(12)
      for (const b of t.boxes) {
        expect(BOX_SIZES).toContain(b.size)
        // Migration 023's CHECK: letters and underscores only (no digits).
        expect(b.id).toMatch(/^[a-z_]{1,40}$/)
      }
      expect(t.id).toMatch(/^[a-z_]{1,40}$/)
      const mapped = t.pages.flat()
      for (const id of mapped) expect(ids, `${t.id}:${id}`).toContain(id)
      expect(new Set(mapped).size).toBe(mapped.length)
      expect(t.pages.length, t.id).toBeLessThanOrEqual(4)
      expect(['lines', 'paragraph']).toContain(t.join)
    }
    // Only the acrostic expands per letter (cleanAnswers' line_N rule).
    expect(WORKSHEET_TEMPLATES.filter((t) => t.boxes.some((b) => b.perLetter)).map((t) => t.id)).toEqual(['acrostic'])
  })

  it('the old printable ids still resolve (deep links), to the sheet each one became', () => {
    expect(resolveTemplateId('story-map')).toBe('beginning_middle_end')
    expect(resolveTemplateId('character-profile')).toBe('character_profile')
    expect(resolveTemplateId('setting-sketch')).toBe('setting_sketch')
    expect(resolveTemplateId('storyboard')).toBe('storyboard')
    expect(resolveTemplateId('sentence-starters')).toBe('sentence_starters')
    expect(resolveTemplateId('book-report')).toBe('book_report')
    expect(resolveTemplateId('feelings-checkin')).toBe('feelings_checkin')
    expect(resolveTemplateId('about-author')).toBe('about_author')
    for (const id of Object.values(TEMPLATE_ALIASES)) expect(getTemplate(id)).not.toBeNull()
    expect(resolveTemplateId('haiku')).toBe('haiku')
    expect(resolveTemplateId('nope')).toBeNull()
    expect(resolveTemplateId('constructor')).toBeNull()
    expect(resolveTemplateId(undefined)).toBeNull()
    // The API never takes an alias: assignments store the real id.
    expect(cleanWorksheet({ templateId: 'story-map', prompts: { beginning: 'a', middle: 'b', end: 'c' } }).ok).toBe(false)
  })

  it('a new sheet needs no migration: it validates, and a hand-in to it is accepted', () => {
    const w = cleanWorksheet({ templateId: 'how_to', prompts: prompts('how_to') })
    expect(w.ok).toBe(true)
    expect(cleanAnswers(w.worksheet, { step_one: 'Get bread.' })).toMatchObject({ ok: true, answers: { step_one: 'Get bread.' } })
    expect(worksheetPages('how_to', { what: 'A sandwich', step_one: 'Get bread.', step_two: 'Add jam.' }))
      .toEqual(['A sandwich', 'Get bread.\nAdd jam.'])
    expect(worksheetPages('persuade', { should: 'We need a longer break.', reason_one: 'We play more.' }))
      .toEqual(['We need a longer break. We play more.'])
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
        // The printed sheet's big title, and a few search synonyms.
        expect(c.heading, `${lang}:${t.id}`).toMatch(/\S/)
        expect(c.keywords.split(',').map((k) => k.trim()).filter(Boolean).length, `${lang}:${t.id}`).toBeGreaterThanOrEqual(3)
        // A drawing box on paper has its own label; no label without one.
        expect('picture' in c, `${lang}:${t.id}`).toBe(!!t.print?.picture)
        if (t.print?.picture) expect(c.picture).toMatch(/\S/)
        expect(Object.keys(c).filter((k) => !['title', 'description', 'heading', 'keywords', 'picture', 'boxes'].includes(k))).toEqual([])
        expect(Object.keys(c.boxes), `${lang}:${t.id}`).toEqual(boxIds(t))
        for (const id of boxIds(t)) {
          expect(c.boxes[id]).toMatch(/\S/)
          // A default prompt must itself pass the API's rule.
          expect(c.boxes[id].length).toBeLessThanOrEqual(PROMPT_TEXT_MAX)
        }
      }
    }
    for (const [lang, d] of [['en', en], ['it', itL]]) {
      expect(Object.keys(d.worksheet.categories), lang).toEqual(WORKSHEET_CATEGORIES)
      expect(Object.keys(d.worksheet.grades).sort(), lang).toEqual([...GRADE_BANDS].sort())
      for (const v of [...Object.values(d.worksheet.categories), ...Object.values(d.worksheet.grades), ...Object.values(d.worksheet.library)]) {
        expect(v).toMatch(/\S/)
      }
    }
    expect(Object.keys(itL.worksheet.library)).toEqual(Object.keys(en.worksheet.library))
    for (const c of WORKSHEET_CATEGORIES) expect(itL.worksheet.categories[c]).not.toBe(en.worksheet.categories[c])
    for (const t of WORKSHEET_TEMPLATES) {
      expect(itL.worksheet.templates[t.id].title).not.toBe(en.worksheet.templates[t.id].title)
      expect(itL.worksheet.templates[t.id].keywords).not.toBe(en.worksheet.templates[t.id].keywords)
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

import { describe, it, expect } from 'vitest'
import {
  renderPage, renderStory, missingSlots, isComplete, progress,
  validateCustomWord, bankFor, buildBookFromBlanks,
} from '../src/lib/storyBlanks'
import { STORY_TEMPLATES, WORD_BANKS, slotsForTemplate } from '../src/data/storyTemplates'

const T = {
  id: 't', title: 'Test Story', emoji: '🧪',
  pages: ['{name} met a {colour} {animal}.', 'Then {name} went home.'],
}

let n = 0
const makeId = () => `id-${++n}`

describe('renderPage', () => {
  it('substitutes picks', () => {
    expect(renderPage(T.pages[0], { name: 'mia', colour: 'blue', animal: 'fox' }))
      .toBe('Mia met a blue fox.')
  })

  it('capitalises a name even mid-sentence', () => {
    expect(renderPage('The {animal} saw {name} there.', { animal: 'owl', name: 'ada' }))
      .toBe('The owl saw Ada there.')
  })

  it('leaves the marker visible while a blank is unfilled', () => {
    expect(renderPage(T.pages[0], { name: 'Mia' })).toBe('Mia met a {colour} {animal}.')
  })

  it('handles a non-string page without throwing', () => {
    expect(renderPage(undefined, {})).toBe('')
    expect(renderPage(null, {})).toBe('')
  })

  it('tolerates missing picks entirely', () => {
    expect(renderPage(T.pages[0], undefined)).toBe('{name} met a {colour} {animal}.')
  })
})

describe('progress and completion', () => {
  it('lists only the unfilled slots, deduped across pages', () => {
    // {name} appears on both pages but is one slot.
    expect(slotsForTemplate(T)).toEqual(['name', 'colour', 'animal'])
    expect(missingSlots(T, { name: 'Mia' })).toEqual(['colour', 'animal'])
  })

  it('treats a whitespace-only pick as unfilled', () => {
    expect(missingSlots(T, { name: '   ', colour: 'red', animal: 'fox' })).toEqual(['name'])
  })

  it('is complete only when every slot is filled', () => {
    expect(isComplete(T, { name: 'Mia', colour: 'blue' })).toBe(false)
    expect(isComplete(T, { name: 'Mia', colour: 'blue', animal: 'fox' })).toBe(true)
  })

  it('reports fractional progress', () => {
    expect(progress(T, {})).toBe(0)
    expect(progress(T, { name: 'Mia' })).toBeCloseTo(1 / 3)
    expect(progress(T, { name: 'Mia', colour: 'blue', animal: 'fox' })).toBe(1)
  })

  it('does not divide by zero on a template with no slots', () => {
    const empty = { id: 'e', pages: ['Just words.'] }
    expect(progress(empty, {})).toBe(0)
    expect(isComplete(empty, {})).toBe(false)
  })
})

describe('validateCustomWord', () => {
  it('accepts ordinary words, including accents and hyphens', () => {
    expect(validateCustomWord('dragon').ok).toBe(true)
    expect(validateCustomWord('Éloïse').ok).toBe(true)
    expect(validateCustomWord("upside-down").ok).toBe(true)
    expect(validateCustomWord('  fox  ')).toEqual({ ok: true, value: 'fox' })
  })

  it('rejects empty input', () => {
    expect(validateCustomWord('').ok).toBe(false)
    expect(validateCustomWord('   ').ok).toBe(false)
    expect(validateCustomWord(undefined).ok).toBe(false)
  })

  it('rejects markup and code, which would reach a printed book', () => {
    expect(validateCustomWord('<script>').ok).toBe(false)
    expect(validateCustomWord('a{b}c').ok).toBe(false)
    expect(validateCustomWord('http://x.com').ok).toBe(false)
  })

  it('rejects digits, so a blank cannot become a phone number', () => {
    expect(validateCustomWord('call 5551234').ok).toBe(false)
  })

  it('rejects keyboard-mashing and over-long words', () => {
    expect(validateCustomWord('aaaaaaa').ok).toBe(false)
    expect(validateCustomWord('a'.repeat(30)).ok).toBe(false)
  })
})

describe('bankFor', () => {
  it('puts the child their own name first', () => {
    const bank = bankFor('name', { authorName: 'Damiano Canali' })
    expect(bank.words[0]).toBe('Damiano')
    expect(bank.words).toHaveLength(WORD_BANKS.name.words.length)
  })

  it('does not duplicate a name already in the bank', () => {
    const bank = bankFor('name', { authorName: 'theo' })
    expect(bank.words[0]).toBe('theo')
    expect(bank.words.filter((w) => w.toLowerCase() === 'theo')).toHaveLength(1)
  })

  it('leaves other banks untouched and returns null for unknown slots', () => {
    expect(bankFor('animal', { authorName: 'Mia' })).toBe(WORD_BANKS.animal)
    expect(bankFor('nope')).toBeNull()
  })

  it('ignores a blank author name', () => {
    expect(bankFor('name', { authorName: '  ' })).toBe(WORD_BANKS.name)
    expect(bankFor('name', {})).toBe(WORD_BANKS.name)
  })
})

describe('buildBookFromBlanks', () => {
  const picks = { name: 'mia', colour: 'blue', animal: 'fox' }

  it('produces a book in the shape the rest of the app expects', () => {
    n = 0
    const book = buildBookFromBlanks({ template: T, picks, authorName: 'Mia', makeId })
    expect(book.title).toBe('Test Story')
    expect(book.authorName).toBe('Mia')
    expect(book.pages).toHaveLength(2)
    expect(book.pages[0]).toMatchObject({
      pageNumber: 1,
      text: 'Mia met a blue fox.',
      illustrationData: null,
      borderStyle: 'stars',
    })
    expect(book.pages[1].pageNumber).toBe(2)
    // Every page needs its own id, or the editor keys collide.
    expect(new Set(book.pages.map((p) => p.id)).size).toBe(2)
    expect(book.id).toBeTruthy()
  })

  it('falls back to the chosen name when there is no signed-in author', () => {
    const book = buildBookFromBlanks({ template: T, picks, authorName: '', makeId })
    expect(book.authorName).toBe('Mia')
  })

  it('falls back again to "Me" when there is no name at all', () => {
    const book = buildBookFromBlanks({ template: T, picks: {}, authorName: '', makeId })
    expect(book.authorName).toBe('Me')
  })
})

describe('shipped templates', () => {
  it.each(STORY_TEMPLATES)('$id is playable and every slot has a bank', (t) => {
    const slots = slotsForTemplate(t)
    expect(t.pages.length).toBeGreaterThanOrEqual(3)
    expect(slots.length).toBeGreaterThan(2)
    for (const s of slots) expect(WORD_BANKS[s], `missing bank: ${s}`).toBeTruthy()
  })

  it.each(STORY_TEMPLATES)('$id renders with no leftover markers once filled', (t) => {
    const picks = {}
    for (const s of slotsForTemplate(t)) picks[s] = WORD_BANKS[s].words[0]
    const text = renderStory(t, picks).join(' ')
    expect(text).not.toMatch(/[{}]/)
    expect(text.length).toBeGreaterThan(40)
  })

  it('has unique template ids', () => {
    const ids = STORY_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

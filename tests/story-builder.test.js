import { describe, it, expect } from 'vitest'
import {
  slotsForFrame, segmentsForPage, canDrop, place, clearSlot,
  missingSlots, isComplete, progress, renderPage, renderStory,
  cardsOnPage, randomPlacements, buildBookFromCards,
} from '../src/lib/storyBuilder'
import { STORY_FRAMES, STORY_CARDS, CARD_KINDS, cardById } from '../src/data/storyCards'

const F = {
  id: 'f', title: 'Test Frame', emoji: '🧪',
  pages: ['{who} went to {where}.', 'They found {what}.'],
}

let n = 0
const makeId = () => `id-${++n}`

describe('slots and segments', () => {
  it('addresses every slot by page and position', () => {
    expect(slotsForFrame(F).map((s) => s.key)).toEqual(['0:0', '0:1', '1:0'])
    expect(slotsForFrame(F).map((s) => s.kind)).toEqual(['who', 'where', 'what'])
  })

  it('treats a repeated kind on one page as two distinct slots', () => {
    const rep = { pages: ['{who} met {who}.'] }
    const keys = slotsForFrame(rep).map((s) => s.key)
    expect(keys).toEqual(['0:0', '0:1'])
  })

  it('splits a page into text and slots in order', () => {
    expect(segmentsForPage(F, 0)).toEqual([
      { type: 'slot', kind: 'who', key: '0:0', slotIndex: 0 },
      { type: 'text', value: ' went to ' },
      { type: 'slot', kind: 'where', key: '0:1', slotIndex: 1 },
      { type: 'text', value: '.' },
    ])
  })

  it('returns nothing for a page that does not exist', () => {
    expect(segmentsForPage(F, 9)).toEqual([])
    expect(segmentsForPage(undefined, 0)).toEqual([])
  })

  it('handles a frame with no slots at all', () => {
    expect(slotsForFrame({ pages: ['Just words.'] })).toEqual([])
    expect(slotsForFrame(undefined)).toEqual([])
  })
})

describe('canDrop', () => {
  it('accepts a card of the matching kind', () => {
    expect(canDrop('who', 'w-bear')).toBe(true)
  })

  it('rejects a mismatched kind — the game rule that stops nonsense', () => {
    expect(canDrop('who', 'p-moon')).toBe(false)
    expect(canDrop('where', 'w-bear')).toBe(false)
  })

  it('rejects an unknown card id', () => {
    expect(canDrop('who', 'nope')).toBe(false)
    expect(canDrop('who', undefined)).toBe(false)
  })
})

describe('place and clear', () => {
  it('places a valid card without mutating the original map', () => {
    const before = {}
    const after = place(before, '0:0', 'w-bear', 'who')
    expect(after).toEqual({ '0:0': 'w-bear' })
    expect(before).toEqual({})
  })

  it('refuses a card of the wrong kind', () => {
    const before = { '0:0': 'w-bear' }
    expect(place(before, '0:1', 'w-fox', 'where')).toBe(before)
  })

  it('lets one card be used in several slots', () => {
    let p = place({}, '0:0', 'w-bear', 'who')
    p = place(p, '1:0', 'w-bear', 'who')
    expect(p).toEqual({ '0:0': 'w-bear', '1:0': 'w-bear' })
  })

  it('replaces whatever was in the slot', () => {
    const p = place({ '0:0': 'w-bear' }, '0:0', 'w-fox', 'who')
    expect(p['0:0']).toBe('w-fox')
  })

  it('clears a slot, and is a no-op for an empty one', () => {
    const p = { '0:0': 'w-bear' }
    expect(clearSlot(p, '0:0')).toEqual({})
    expect(clearSlot(p, '9:9')).toBe(p)
  })
})

describe('progress and rendering', () => {
  const full = { '0:0': 'w-bear', '0:1': 'p-moon', '1:0': 't-key' }

  it('counts what is left', () => {
    expect(missingSlots(F, {}).length).toBe(3)
    expect(missingSlots(F, full)).toEqual([])
    expect(isComplete(F, full)).toBe(true)
    expect(isComplete(F, { '0:0': 'w-bear' })).toBe(false)
  })

  it('reports fractional progress and never divides by zero', () => {
    expect(progress(F, {})).toBe(0)
    expect(progress(F, { '0:0': 'w-bear' })).toBeCloseTo(1 / 3)
    expect(progress(F, full)).toBe(1)
    expect(progress({ pages: ['no slots'] }, {})).toBe(0)
  })

  it('renders words, and a visible gap while unfilled', () => {
    expect(renderPage(F, 0, full)).toBe('the bear went to the moon.')
    expect(renderPage(F, 0, {})).toBe('_____ went to _____.')
    expect(renderStory(F, full)).toEqual(['the bear went to the moon.', 'They found a golden key.'])
  })

  it('lists the cards used on a page, for the illustration hint', () => {
    expect(cardsOnPage(F, 0, full).map((c) => c.id)).toEqual(['w-bear', 'p-moon'])
    expect(cardsOnPage(F, 0, {})).toEqual([])
  })
})

describe('randomPlacements', () => {
  it('fills every slot with a card of the right kind', () => {
    const p = randomPlacements(F)
    expect(Object.keys(p).sort()).toEqual(['0:0', '0:1', '1:0'])
    for (const slot of slotsForFrame(F)) {
      expect(cardById(p[slot.key]).kind).toBe(slot.kind)
    }
    expect(isComplete(F, p)).toBe(true)
  })

  it('is deterministic when the picker is', () => {
    const first = (arr) => arr[0]
    expect(randomPlacements(F, first)).toEqual(randomPlacements(F, first))
  })
})

describe('buildBookFromCards', () => {
  const full = { '0:0': 'w-bear', '0:1': 'p-moon', '1:0': 't-key' }

  it('produces a book the rest of the app can already open', () => {
    n = 0
    const book = buildBookFromCards({ frame: F, placements: full, authorName: 'Mia', makeId })
    expect(book.title).toBe('Test Frame')
    expect(book.authorName).toBe('Mia')
    expect(book.pages).toHaveLength(2)
    expect(book.pages[0].text).toBe('the bear went to the moon.')
    expect(book.pages[0].pageNumber).toBe(1)
    expect(new Set(book.pages.map((p) => p.id)).size).toBe(2)
  })

  it('carries the chosen pictures forward as an illustration hint', () => {
    const book = buildBookFromCards({ frame: F, placements: full, authorName: 'Mia', makeId })
    expect(book.pages[0].illustrationHint).toBe('the bear, the moon')
    expect(book.pages[1].illustrationHint).toBe('a golden key')
  })

  it('falls back to "Me" with no author', () => {
    const book = buildBookFromCards({ frame: F, placements: full, authorName: '', makeId })
    expect(book.authorName).toBe('Me')
  })
})

describe('shipped cards and frames', () => {
  it('gives every card a picture, a word and a known kind', () => {
    for (const c of STORY_CARDS) {
      expect(c.emoji, c.id).toBeTruthy()
      expect(c.word, c.id).toBeTruthy()
      expect(CARD_KINDS[c.kind], `unknown kind on ${c.id}`).toBeTruthy()
    }
  })

  it('has unique card ids', () => {
    const ids = STORY_CARDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('offers at least three choices for every kind, so there is a real decision', () => {
    for (const kind of Object.keys(CARD_KINDS)) {
      expect(STORY_CARDS.filter((c) => c.kind === kind).length, kind).toBeGreaterThanOrEqual(3)
    }
  })

  it.each(STORY_FRAMES)('$id is playable and every slot kind has cards', (f) => {
    const slots = slotsForFrame(f)
    expect(f.pages.length).toBeGreaterThanOrEqual(3)
    expect(slots.length).toBeGreaterThan(2)
    for (const s of slots) {
      expect(CARD_KINDS[s.kind], `unknown kind ${s.kind}`).toBeTruthy()
      expect(STORY_CARDS.some((c) => c.kind === s.kind), `no cards for ${s.kind}`).toBe(true)
    }
  })

  it.each(STORY_FRAMES)('$id leaves no gaps once randomly filled', (f) => {
    const text = renderStory(f, randomPlacements(f)).join(' ')
    expect(text).not.toContain('_____')
    expect(text).not.toMatch(/[{}]/)
  })

  it('has unique frame ids', () => {
    const ids = STORY_FRAMES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

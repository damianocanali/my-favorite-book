import { describe, it, expect } from 'vitest'
import { constellationFeelings, CONSTELLATION_LAYOUTS, FEELINGS } from '../src/lib/checkIn'

const e = (feeling, day) => ({ at: `2026-09-${String(day).padStart(2, '0')}T10:00:00Z`, feeling })

describe('constellationFeelings', () => {
  it('shows each feeling once, however often it was noticed', () => {
    // Five angry check-ins must not become five angry stars — that is a tally.
    const out = constellationFeelings([e('angry', 1), e('angry', 2), e('angry', 3), e('happy', 4), e('angry', 5)])
    expect(out).toEqual(['happy', 'angry'])
  })

  it('orders by when each feeling was last noticed, most recent last', () => {
    expect(constellationFeelings([e('sad', 3), e('proud', 1), e('tired', 2)])).toEqual(['proud', 'tired', 'sad'])
  })

  it('ignores anything that is not a known feeling', () => {
    expect(constellationFeelings([e('happy', 1), { at: '2026-09-02T00:00:00Z', feeling: 'bogus' }])).toEqual(['happy'])
  })

  it('is empty with no check-ins', () => {
    expect(constellationFeelings([])).toEqual([])
  })
})

describe('CONSTELLATION_LAYOUTS', () => {
  it('has a layout for every possible number of distinct feelings', () => {
    for (let n = 0; n <= FEELINGS.length; n++) expect(CONSTELLATION_LAYOUTS[n]).toHaveLength(n)
  })

  it('never lets a word overlap another word or another star', () => {
    // Label geometry mirrors FeelingConstellation.jsx: 320x200 viewBox, 13px
    // bold text ~7.4px per character, anchored start/middle/end by x, drawn
    // 19px below its star; a glowing star is ~12px across.
    //
    // Every pair of slots is tried with the two longest real words in BOTH
    // orders. An earlier version assigned words in one fixed order, so it never
    // put "Preoccupazione" in the slot where it collided — and it compared
    // words with words, when the real collision was a word across a star.
    const W = 320, H = 200, CH = 7.4, TEXT_H = 14, STAR = 6
    const LONG = ['Preoccupazione', 'Stanchezza']
    const label = ([fx, fy], word) => {
      const x = fx * W, y = fy * H + 19, w = word.length * CH
      const left = fx < 0.2 ? x - 6 : fx > 0.8 ? x + 6 - w : x - w / 2
      return { left, right: left + w, top: y - TEXT_H, bottom: y + 3 }
    }
    const star = ([fx, fy]) => ({ left: fx * W - STAR, right: fx * W + STAR, top: fy * H - STAR, bottom: fy * H + STAR })
    const apart = (a, b) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top

    for (const layout of CONSTELLATION_LAYOUTS) {
      for (const pt of layout) {
        const b = label(pt, LONG[0])
        expect(b.left).toBeGreaterThanOrEqual(0)
        expect(b.right).toBeLessThanOrEqual(W)
        expect(b.bottom).toBeLessThanOrEqual(H)
      }
      for (let i = 0; i < layout.length; i++)
        for (let j = 0; j < layout.length; j++) {
          if (i === j) continue
          for (const [wi, wj] of [LONG, [...LONG].reverse()]) {
            const where = `layout ${layout.length}: slot ${i} ("${wi}")`
            expect(apart(label(layout[i], wi), label(layout[j], wj)), `${where} overlaps slot ${j}'s word`).toBe(true)
            expect(apart(label(layout[i], wi), star(layout[j])), `${where} overlaps slot ${j}'s star`).toBe(true)
          }
        }
    }
  })
})

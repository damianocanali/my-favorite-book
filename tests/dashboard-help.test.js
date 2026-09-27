import { describe, it, expect } from 'vitest'
import { sortHelp, groupHelp } from '../src/lib/dashboardHelp.js'

const row = (over) => ({ id: 'x', kind: 'book', created_at: '2026-09-27T00:00:00.000Z', ...over })

describe('sortHelp', () => {
  it('puts every grownup ask before every book ask, regardless of input order', () => {
    const rows = [row({ id: 'b1', kind: 'book' }), row({ id: 'g1', kind: 'grownup' }), row({ id: 'b2', kind: 'book' })]
    expect(sortHelp(rows).map((r) => r.id)).toEqual(['g1', 'b1', 'b2'])
  })

  it('orders newest-first within each kind', () => {
    const rows = [
      row({ id: 'old', kind: 'grownup', created_at: '2026-09-27T09:00:00.000Z' }),
      row({ id: 'new', kind: 'grownup', created_at: '2026-09-27T10:00:00.000Z' }),
    ]
    expect(sortHelp(rows).map((r) => r.id)).toEqual(['new', 'old'])
  })

  it('does not mutate the input array', () => {
    const rows = [row({ id: 'a' }), row({ id: 'b' })]
    const copy = [...rows]
    sortHelp(rows)
    expect(rows).toEqual(copy)
  })
})

describe('groupHelp', () => {
  it('splits rows into grownup and book lists', () => {
    const rows = [row({ id: 'g1', kind: 'grownup' }), row({ id: 'b1', kind: 'book' })]
    const { grownup, book } = groupHelp(rows)
    expect(grownup.map((r) => r.id)).toEqual(['g1'])
    expect(book.map((r) => r.id)).toEqual(['b1'])
  })

  it('returns empty lists for no rows', () => {
    expect(groupHelp([])).toEqual({ grownup: [], book: [] })
  })
})

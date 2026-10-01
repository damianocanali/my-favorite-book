import { describe, it, expect } from 'vitest'
import { moveItem, statusStep, emptyAddress, REQUIRED_ADDRESS, splitItems, wyErrorText } from '../src/components/school/writingYearUi.js'

describe('writingYearUi', () => {
  it('moveItem moves one element and leaves bad indexes alone', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    const same = ['a']
    expect(moveItem(same, 0, 3)).toBe(same)
  })
  it('status steps and address form', () => {
    expect(statusStep('requested')).toBe(0)
    expect(statusStep('shipped')).toBe(4)
    expect(statusStep('failed')).toBe(-1)
    expect(emptyAddress('IT').country_code).toBe('IT')
    expect(REQUIRED_ADDRESS).not.toContain('address_line2')
  })
  it('splitItems: approved in order, then waiting', () => {
    const { approved, waiting } = splitItems([{ id: 'b', position: 2, approved: true }, { id: 'w', position: 3, approved: false }, { id: 'a', position: 1, approved: true }])
    expect(approved.map((i) => i.id)).toEqual(['a', 'b'])
    expect(waiting.map((i) => i.id)).toEqual(['w'])
  })
  it('wyErrorText falls back to generic', () => {
    const t = (k, o) => (k.endsWith('.nope') ? o.defaultValue : k)
    expect(wyErrorText(t, 'already_requested')).toBe('school:writing_year.errors.already_requested')
    expect(wyErrorText(t, 'nope')).toBe('school:writing_year.errors.generic')
  })
})

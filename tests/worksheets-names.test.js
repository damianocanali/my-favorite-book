// "Pre-fill names" (brief §2): a teacher pastes a class list and gets one
// printed copy per name. Pure parsing of that pasted blob into a clean name
// list — the same untrusted-text posture as params.js (this text was typed
// or pasted by whoever has the page open, kept only in component state,
// never sent anywhere), just split on newlines/commas instead of read from
// a URL.
import { describe, it, expect } from 'vitest'
import { parseNameList, MAX_NAMES, MAX_NAME_LENGTH } from '../src/lib/worksheets/names.js'

describe('parseNameList', () => {
  it('splits on newlines', () => {
    expect(parseNameList('Ava\nBen\nCleo')).toEqual(['Ava', 'Ben', 'Cleo'])
  })

  it('splits on commas too, for a paste from a spreadsheet cell', () => {
    expect(parseNameList('Ava, Ben, Cleo')).toEqual(['Ava', 'Ben', 'Cleo'])
  })

  it('drops blank lines and trims whitespace', () => {
    expect(parseNameList('  Ava \n\n  \nBen  ')).toEqual(['Ava', 'Ben'])
  })

  it('returns an empty array for empty or non-string input', () => {
    expect(parseNameList('')).toEqual([])
    expect(parseNameList('   ')).toEqual([])
    expect(parseNameList(null)).toEqual([])
    expect(parseNameList(undefined)).toEqual([])
  })

  it('strips angle brackets from a name', () => {
    expect(parseNameList('<b>Ava</b>')).toEqual(['bAva/b'])
  })

  it('caps the number of names', () => {
    const many = Array.from({ length: MAX_NAMES + 20 }, (_, i) => `Kid${i}`).join('\n')
    expect(parseNameList(many)).toHaveLength(MAX_NAMES)
  })

  it('caps each name length', () => {
    const long = 'A'.repeat(MAX_NAME_LENGTH + 30)
    expect(parseNameList(long)[0]).toHaveLength(MAX_NAME_LENGTH)
  })
})

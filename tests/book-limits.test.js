import { describe, it, expect } from 'vitest'
import { capCustomBookText, publicBookText, CUSTOM_NAME_MAX, CUSTOM_DESCRIPTION_MAX, CUSTOM_PLACE_MAX } from '../lib/bookLimits.js'
import { withPrintLanguage } from '../api/print-orders/create.js'

const long = (n) => 'x'.repeat(n)

describe('capCustomBookText', () => {
  it('caps child-typed characters and places, leaves catalogue entries alone', () => {
    const book = capCustomBookText({
      characters: [
        { id: 'custom-1', custom: true, name: long(50), description: long(500), promptEn: { name: long(50), description: long(500) } },
        { id: 'grandma', name: long(50), description: long(500) },
      ],
      setting: { id: 'custom-2', isCustom: true, name: long(200), label: long(200), description: long(200) },
    })
    expect(book.characters[0].name).toHaveLength(CUSTOM_NAME_MAX)
    expect(book.characters[0].description).toHaveLength(CUSTOM_DESCRIPTION_MAX)
    expect(book.characters[0].promptEn.description).toHaveLength(CUSTOM_DESCRIPTION_MAX)
    expect(book.characters[1].name).toHaveLength(50)
    expect(book.setting.name).toHaveLength(CUSTOM_PLACE_MAX)
    expect(book.setting.description).toHaveLength(CUSTOM_PLACE_MAX)
  })

  it('passes through a book with nothing custom', () => {
    expect(capCustomBookText({ title: 'T', characters: [], setting: null })).toEqual({ title: 'T', characters: [], setting: null })
    expect(capCustomBookText(null)).toBe(null)
  })
})

describe('publicBookText', () => {
  it('screens character descriptions and the place too', () => {
    const text = publicBookText({
      title: 'T', authorName: 'A',
      characters: [{ name: 'N', description: 'D' }],
      setting: { name: 'P', label: 'L', description: 'PD' },
      pages: [{ text: 'page' }],
    })
    for (const s of ['T', 'A', 'N', 'D', 'P', 'L', 'PD', 'page']) expect(text.split('\n')).toContain(s)
  })
})

describe('withPrintLanguage', () => {
  it("uses the orderer's locale only when the book has none", () => {
    expect(withPrintLanguage({ pages: [] }, 'it-IT').language).toBe('it')
    expect(withPrintLanguage({ language: 'en' }, 'it').language).toBe('en')
    expect(withPrintLanguage({ pages: [] }, 'fr').language).toBeUndefined()
  })
})

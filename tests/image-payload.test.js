// Web client payloads for /api/generate-image: structured, English catalogue
// terms only, never a client-built prompt.
import { describe, it, expect } from 'vitest'
import { coverPayload, portraitPayload, pagePayload, editPayload } from '../src/services/imagePayload.js'
import { validateScenePayload } from '../lib/imageScene.js'

const book = {
  title: 'La mia volpe',
  characters: [{ id: 'fox', name: 'Volpe Neo', promptEn: { name: 'Neo the Fox', description: 'an orange fox' } }],
  setting: { id: 'forest', name: 'Foresta incantata', promptEn: { name: 'Enchanted Forest' } },
  timePeriod: { id: 'now', label: 'Adesso', promptEn: { label: 'Right Now' } },
}
const page = { text: 'Il presidente era felice', illustrationHint: 'a crown, a castle', illustrationData: 'data:image/png;base64,AA' }

describe('image payloads', () => {
  it('page: structured, promptEn catalogue terms, raw text only as pageText', () => {
    const p = pagePayload(page, book, 'it')
    expect(p).toEqual({
      kind: 'page',
      characters: [{ name: 'Volpe Neo', promptEn: 'Neo the Fox', description: 'an orange fox' }],
      setting: { promptEn: 'Enchanted Forest', description: '' },
      timePeriod: 'Right Now',
      locale: 'it',
      pageText: 'Il presidente era felice',
      hint: 'a crown, a castle',
    })
    expect(p).not.toHaveProperty('prompt')
    expect(validateScenePayload(p).ok).toBe(true)
  })
  it('cover, portrait and edit validate server-side', () => {
    expect(validateScenePayload(coverPayload(book, 'en')).ok).toBe(true)
    expect(validateScenePayload(portraitPayload(book.characters[0], book, 'en')).ok).toBe(true)
    const e = editPayload(page, book, 'add a hat', 'en')
    expect(e).toMatchObject({ kind: 'edit', instruction: 'add a hat', sourceImage: page.illustrationData, strength: 0.55 })
    expect(validateScenePayload(e).ok).toBe(true)
  })
  it('portrait pre-filters an empty character', () => {
    expect(portraitPayload(null, book, 'en').characters).toEqual([])
  })
  it('caps characters at the server limit of 6', () => {
    const many = { ...book, characters: Array.from({ length: 9 }, (_, i) => ({ name: `C${i}` })) }
    expect(pagePayload(page, many, 'en').characters).toHaveLength(6)
    expect(validateScenePayload(pagePayload(page, many, 'en')).ok).toBe(true)
  })
  it('handles a book with no setting or characters', () => {
    const p = pagePayload({ text: '' }, {}, undefined)
    expect(p).toMatchObject({ characters: [], setting: null, timePeriod: '', locale: 'en', pageText: '' })
    expect(validateScenePayload(p).ok).toBe(true)
  })
})

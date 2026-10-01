// Child-made ("create your own") characters and places in picture requests:
// they travel to the scene writer as the child's words, but the offline
// fallback never draws from them — even when they spell a catalogue entry.
// And the new people characters are recognised on an Italian page.
import { describe, it, expect } from 'vitest'
import { pagePayload, coverPayload } from '../src/services/imagePayload.js'
import { validateScenePayload, fallbackScene, charactersNamedIn } from '../lib/imageScene.js'
import { characters } from '../src/data/characters.js'

const grandma = characters.find((c) => c.id === 'grandma')
const king = characters.find((c) => c.id === 'king')

const customChar = {
  id: 'custom-1', name: 'Grandma Greta', description: 'una presidente col cappello',
  promptEn: { name: 'Grandma Greta', description: 'una presidente col cappello' }, custom: true,
}
const customPlace = {
  id: 'custom-2', name: 'Enchanted Forest', description: 'una scuola sulla luna',
  promptEn: { name: 'Enchanted Forest', description: 'una scuola sulla luna' }, custom: true,
}

describe('custom entries in the image payload', () => {
  it('flags custom characters and places and sends the place description', () => {
    const p = pagePayload({ text: 'x' }, { characters: [customChar, grandma], setting: customPlace }, 'it')
    expect(p.characters[0].custom).toBe(true)
    expect(p.characters[1].custom).toBeUndefined()
    expect(p.setting).toMatchObject({ custom: true, description: 'una scuola sulla luna' })
  })

  it('the server keeps the flags', () => {
    const r = validateScenePayload(coverPayload({ title: 'T', characters: [customChar], setting: customPlace }, 'it'))
    expect(r.ok).toBe(true)
    expect(r.input.characters[0].custom).toBe(true)
    expect(r.input.settingCustom).toBe(true)
  })

  it('the offline fallback never uses their text, even if it spells a catalogue entry', () => {
    const r = validateScenePayload(coverPayload({ title: 'T', characters: [customChar], setting: customPlace }, 'it'))
    const scene = fallbackScene(r.input)
    expect(scene).not.toMatch(/Grandma Greta|Enchanted Forest|presidente|luna/i)
    expect(scene).toContain('a friendly character')
    expect(scene).toContain('a magical place')
  })

  it('a catalogue character still gets its catalogue words', () => {
    const r = validateScenePayload(coverPayload({ title: 'T', characters: [grandma], setting: null }, 'it'))
    expect(fallbackScene(r.input)).toContain('Grandma Greta')
  })
})

describe('Italian pages name the new people', () => {
  it('matches the shared given name on an Italian page', () => {
    const r = validateScenePayload(pagePayload(
      { text: 'Nonna Greta e Re Theo vanno al mercato.' },
      { characters: [grandma, king, characters.find((c) => c.id === 'chef')] },
      'it'
    ))
    const named = charactersNamedIn(r.input.pageText, r.input.characters).map((c) => c.name)
    expect(named).toEqual(['Grandma Greta', 'King Theo'])
  })
})

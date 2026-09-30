// Owner feedback round: people characters, up to MAX_CHARACTERS, child-made
// ("create your own") characters and places shown exactly as typed, and the
// book remembering the language it was written in.
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import i18next, { bootI18n, loadLocale } from '../src/i18n/index.js'
import { useBookStore } from '../src/stores/useBookStore.js'
import { characters, MAX_CHARACTERS } from '../src/data/characters.js'
import { isChildAuthored, displayName, displayDescription } from '../src/i18n/contentCatalog.js'
import { buddyBook } from '../src/services/storyBuddy.js'
import { speechLocale } from '../src/lib/speechLocale.js'

beforeAll(async () => {
  if (!i18next.isInitialized) await bootI18n()
  await loadLocale('it')
})

describe('character limit', () => {
  beforeEach(() => useBookStore.getState().startNewBook())

  it('toggleCharacter stops at MAX_CHARACTERS', () => {
    const { toggleCharacter } = useBookStore.getState()
    for (const c of characters.slice(0, MAX_CHARACTERS + 2)) toggleCharacter(c)
    expect(useBookStore.getState().book.characters).toHaveLength(MAX_CHARACTERS)
  })

  it('addCharacter stops at MAX_CHARACTERS, and a full book can still drop one', () => {
    const { addCharacter, toggleCharacter } = useBookStore.getState()
    for (let i = 0; i < MAX_CHARACTERS + 1; i++) addCharacter({ id: `custom-${i}`, name: `N${i}`, custom: true })
    expect(useBookStore.getState().book.characters).toHaveLength(MAX_CHARACTERS)
    toggleCharacter({ id: 'custom-0' })
    expect(useBookStore.getState().book.characters).toHaveLength(MAX_CHARACTERS - 1)
  })
})

describe('a new book remembers its language', () => {
  it('stamps the app language', async () => {
    await i18next.changeLanguage('it')
    useBookStore.getState().startNewBook()
    expect(useBookStore.getState().book.language).toBe('it')
    await i18next.changeLanguage('en')
    useBookStore.getState().startNewBook()
    expect(useBookStore.getState().book.language).toBe('en')
  })
})

describe('child-authored entries', () => {
  const t = (key, opts) => (key === 'content:characters.custom-1.name' ? 'WRONG' : opts?.defaultValue)

  it('isChildAuthored reads custom and the legacy isCustom', () => {
    expect(isChildAuthored({ custom: true })).toBe(true)
    expect(isChildAuthored({ isCustom: true })).toBe(true)
    expect(isChildAuthored({ id: 'girl' })).toBe(false)
    expect(isChildAuthored(null)).toBe(false)
  })

  it('shows a custom entry exactly as typed, never via the catalogue', () => {
    const c = { id: 'custom-1', name: 'La Presidente', description: 'con un cappello', custom: true }
    expect(displayName(c, t, 'characters')).toBe('La Presidente')
    expect(displayDescription(c, t, 'characters')).toBe('con un cappello')
  })

  it('gives every new person the same given name in English and Italian', async () => {
    const en = (await import('../src/i18n/locales/en/content.json')).default.characters
    const it = (await import('../src/i18n/locales/it/content.json')).default.characters
    const people = ['girl', 'boy', 'aunt', 'uncle', 'grandma', 'grandpa', 'teacher', 'firefighter', 'doctor', 'chef', 'king', 'queen']
    const lastWord = (s) => s.split(/\s+/).find((w) => /^[A-Z][a-z]+$/.test(w) && !['Grandma', 'Grandpa', 'Aunt', 'Uncle', 'Teacher', 'Firefighter', 'Doc', 'Chef', 'King', 'Queen'].includes(w))
    for (const id of people) {
      const given = lastWord(en[id].name)
      expect(given, id).toBeTruthy()
      expect(it[id].name, id).toContain(given)
    }
  })
})

describe('Story Buddy gets the names the child sees', () => {
  it('sends display names, not stored English or prompt text', async () => {
    await i18next.changeLanguage('it')
    const grandma = characters.find((c) => c.id === 'grandma')
    const out = buddyBook({
      characters: [grandma, { id: 'custom-1', name: 'Zorro', custom: true }],
      setting: { id: 'enchanted-forest', name: 'Enchanted Forest' },
    })
    expect(out.characters.map((c) => c.name)).toEqual(['Nonna Rosa', 'Zorro'])
    expect(out.characters[0].promptEn).toBeUndefined()
    expect(out.setting.name).not.toBe('Enchanted Forest')
    await i18next.changeLanguage('en')
  })
})

describe('speechLocale', () => {
  it('prefers the book language, then the app language, then en-US', () => {
    expect(speechLocale('it', 'en')).toBe('it-IT')
    expect(speechLocale(undefined, 'it')).toBe('it-IT')
    expect(speechLocale('fr', 'en-GB')).toBe('en-US')
    expect(speechLocale()).toBe('en-US')
  })
})

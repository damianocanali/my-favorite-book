// lib/imageCatalog.js copies lists it can't import into an edge function.
// These fail when the source lists drift, so the offline picture fallback
// never silently loses (or gains) a trusted word.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { STORY_CARDS } from '../src/data/storyCards.js'
import { characters } from '../src/data/characters.js'
import { CATALOG_CARDS, KNOWN_SPECIES, CATALOG_SETTINGS, CATALOG_CHARACTERS } from '../lib/imageCatalog.js'

describe('image catalogue drift', () => {
  it('story card promptEn words match src/data/storyCards.js', () => {
    expect([...CATALOG_CARDS].sort()).toEqual(STORY_CARDS.map((c) => c.promptEn.toLowerCase()).sort())
  })

  it('species match BookCharacter.emojiSpecies in Book.swift', () => {
    const swift = readFileSync('ios-native/MyBookLab/Models/Book.swift', 'utf8')
    const block = swift.slice(swift.indexOf('static let emojiSpecies'))
    const values = new Set([...block.slice(0, block.indexOf(']\n')).matchAll(/"[^"]+":\s*"([^"]+)"/g)].map((m) => m[1].toLowerCase()))
    expect(values.size).toBeGreaterThan(30)
    expect([...KNOWN_SPECIES].sort()).toEqual([...values].sort())
  })

  it('iOS setting presets are all trusted settings', () => {
    const swift = readFileSync('ios-native/MyBookLab/Views/CreateBookView.swift', 'utf8')
    const presets = [...swift.matchAll(/^\s*\("(The [^"]+)",\s*"[^"]+",\s*"/gm)].map((m) => m[1])
    expect(presets.length).toBeGreaterThanOrEqual(6)
    for (const p of presets) expect(CATALOG_SETTINGS.has(p.toLowerCase()), p).toBe(true)
  })

  it('every web catalogue character is known', () => {
    for (const c of characters) expect(CATALOG_CHARACTERS.has(c.promptEn.name.toLowerCase())).toBe(true)
  })
})

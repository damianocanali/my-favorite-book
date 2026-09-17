// Guards the display/prompt firewall (src/i18n/contentCatalog.js).
//
// The failure this prevents is silent and expensive: if a catalogue entry
// loses its frozen `promptEn`, or the prompt builder starts reading display
// text again, illustrations quietly degrade for every non-English child and
// nothing in the UI looks wrong.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { characters } from '../src/data/characters.js'
import { scenes } from '../src/data/scenes.js'
import { timePeriods } from '../src/data/timePeriods.js'
import { STORY_CARDS } from '../src/data/storyCards.js'
import { promptName, promptLabel, promptDescription, displayName } from '../src/i18n/contentCatalog.js'

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('prompt firewall — frozen English', () => {
  it('every character carries promptEn.name matching its English name', () => {
    for (const c of characters) {
      expect(c.promptEn?.name, `character ${c.id}`).toBeTruthy()
      expect(c.promptEn.name).toBe(c.name)
    }
  })

  it('every scene carries promptEn.name matching its English name', () => {
    for (const s of scenes) {
      expect(s.promptEn?.name, `scene ${s.id}`).toBeTruthy()
      expect(s.promptEn.name).toBe(s.name)
    }
  })

  it('every time period carries promptEn.label matching its English label', () => {
    for (const t of timePeriods) {
      expect(t.promptEn?.label, `timePeriod ${t.id}`).toBeTruthy()
      expect(t.promptEn.label).toBe(t.label)
    }
  })

  it('every story card carries promptEn matching its English word', () => {
    for (const card of STORY_CARDS) {
      expect(card.promptEn, `card ${card.id}`).toBeTruthy()
      expect(card.promptEn).toBe(card.word)
    }
  })
})

describe('prompt firewall — the builder never reads display text', () => {
  it('imageGenerator routes catalogue terms through the prompt helpers', () => {
    const src = read('src/services/imageGenerator.js')
    // No bare display-field reads off a catalogue entity.
    expect(src).not.toMatch(/\(c\)\s*=>\s*c\.name/)
    expect(src).not.toMatch(/book\.setting\?\.name/)
    expect(src).not.toMatch(/book\.timePeriod\?\.label(?!\s*\|\|)/)
    expect(src).toMatch(/promptName\(/)
  })

  it('storyBuilder sends promptEn, not the localised word, to the hint', () => {
    const src = read('src/lib/storyBuilder.js')
    expect(src).toMatch(/illustrationHint:.*promptEn/)
    expect(src).not.toMatch(/illustrationHint: cards\.map\(\(c\) => c\.word\)/)
  })
})

describe('prompt helpers fall back for legacy and custom entries', () => {
  it('uses promptEn when present', () => {
    expect(promptName({ id: 'x', promptEn: { name: 'A fox' }, name: 'Una volpe' })).toBe('A fox')
    expect(promptLabel({ id: 'x', promptEn: { label: 'Long ago' }, label: 'Tanto tempo fa' })).toBe('Long ago')
    expect(promptDescription({ promptEn: { description: 'brave' }, description: 'coraggioso' })).toBe('brave')
  })

  it('falls back to legacy fields for books saved before the split', () => {
    expect(promptName({ id: 'old', name: 'Astro the Explorer' })).toBe('Astro the Explorer')
    expect(promptLabel({ id: 'old', label: 'Right Now' })).toBe('Right Now')
  })

  it('falls back to what the child typed for custom entries', () => {
    expect(promptName({ name: 'Mr Wigglesworth' })).toBe('Mr Wigglesworth')
    expect(promptName(null, 'a hero')).toBe('a hero')
  })

  it('displayName falls back to the entity when no translation exists', () => {
    const t = (key, opts) => opts?.defaultValue ?? key
    expect(displayName({ id: 'astronaut', name: 'Astro the Explorer' }, t, 'characters'))
      .toBe('Astro the Explorer')
  })
})

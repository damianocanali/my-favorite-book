// The tip library and the four levels live in three places that must agree:
//   lib/school/grading.js            — what the API accepts (the allowlist)
//   src/i18n/locales/{en,it}/school.json — the web's wording (grading.*)
//   ios-native/.../Models/Grading.swift + Views/GradingCopy.swift +
//   Localizable.xcstrings            — the iPad's key list and wording
// A key the server accepts but a client can't render shows a child nothing;
// a key a client offers but the server refuses is a teacher's 400.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { LEVELS, SKILLS, TIP_SKILLS, TIP_KEYS } from '../lib/school/grading.js'

const en = JSON.parse(readFileSync('src/i18n/locales/en/school.json', 'utf8')).grading
const itL = JSON.parse(readFileSync('src/i18n/locales/it/school.json', 'utf8')).grading
const swiftModel = readFileSync('ios-native/MyBookLab/Models/Grading.swift', 'utf8')
const swiftCopy = readFileSync('ios-native/MyBookLab/Views/GradingCopy.swift', 'utf8')
const catalog = JSON.parse(readFileSync('ios-native/MyBookLab/Localizable.xcstrings', 'utf8')).strings

const at = (obj, dotted) => dotted.split('.').reduce((o, k) => o?.[k], obj)

describe('grading: lib ↔ web', () => {
  it('every level, skill and tip has EN and IT copy, and nothing extra', () => {
    expect(Object.keys(en.levels)).toEqual(LEVELS)
    expect(Object.keys(itL.levels)).toEqual(LEVELS)
    expect(Object.keys(en.skills)).toEqual(SKILLS)
    expect(Object.keys(itL.skills)).toEqual(SKILLS)
    for (const s of SKILLS) {
      expect(Object.keys(en.tips[s])).toEqual(TIP_SKILLS[s])
      expect(Object.keys(itL.tips[s])).toEqual(TIP_SKILLS[s])
    }
    for (const k of TIP_KEYS) {
      expect(at(en.tips, k)).toMatch(/\S/)
      expect(at(itL.tips, k)).toMatch(/\S/)
      // Authored, not left in English.
      expect(at(itL.tips, k)).not.toBe(at(en.tips, k))
    }
  })

  it('library tips fit the custom-tip limit too (one rule for what a child reads)', () => {
    for (const k of TIP_KEYS) {
      expect(at(en.tips, k).length).toBeLessThanOrEqual(140)
      expect(at(itL.tips, k).length).toBeLessThanOrEqual(140)
    }
  })
})

describe('grading: lib ↔ iPad', () => {
  it('Grading.swift has the same levels and the same tips per skill, in order', () => {
    const levels = swiftModel.match(/static let levels = \[([^\]]*)\]/)[1]
    expect([...levels.matchAll(/"([a-z_]+)"/g)].map((m) => m[1])).toEqual(LEVELS)
    const skills = [...swiftModel.matchAll(/\("([a-z]+)", \[([^\]]*)\]\)/g)].map((m) => [m[1], [...m[2].matchAll(/"([a-z_]+)"/g)].map((x) => x[1])])
    expect(skills).toEqual(SKILLS.map((s) => [s, TIP_SKILLS[s]]))
  })

  it('GradingCopy renders every library tip, under the web\'s key', () => {
    for (const k of TIP_KEYS) {
      expect(swiftCopy).toContain(`case "${k}": AppText("school.grading.tips.${k}", defaultValue: `)
    }
    const swiftTipCases = [...swiftCopy.matchAll(/AppText\("school\.grading\.tips\.([a-z_.]+)"/g)].map((m) => m[1])
    expect(swiftTipCases.sort()).toEqual([...TIP_KEYS].sort())
    for (const l of LEVELS) expect(swiftCopy).toContain(`AppText("school.grading.levels.${l}"`)
  })

  it('every school.grading.* string the iPad uses is in the catalog, EN = code default, IT = the web\'s Italian', () => {
    const uses = [...swiftCopy.matchAll(/AppText\("(school\.grading\.[a-z_.]+)", defaultValue: "((?:[^"\\]|\\.)*)"\)/g)]
    expect(uses.length).toBeGreaterThan(TIP_KEYS.length)
    for (const [, key, def] of uses) {
      const entry = catalog[key]
      expect(entry, key).toBeTruthy()
      const webKey = key.replace(/^school\.grading\./, '')
      expect(entry.localizations.en.stringUnit.value).toBe(def.replace(/\\"/g, '"'))
      expect(entry.localizations.en.stringUnit.value).toBe(at(en, webKey))
      expect(entry.localizations.it.stringUnit.value).toBe(at(itL, webKey))
    }
  })

  it('the two new teacher error codes have copy on both clients', () => {
    const enErr = JSON.parse(readFileSync('src/i18n/locales/en/school.json', 'utf8')).teacher.errors
    const itErr = JSON.parse(readFileSync('src/i18n/locales/it/school.json', 'utf8')).teacher.errors
    for (const code of ['version_changed', 'cannot_return']) {
      expect(enErr[code]).toBeTruthy()
      expect(itErr[code]).toBeTruthy()
      expect(catalog[`school.teacher.errors.${code}`]?.localizations?.it?.stringUnit?.value).toBe(itErr[code])
    }
  })
})

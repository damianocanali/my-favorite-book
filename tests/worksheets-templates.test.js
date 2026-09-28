// Pure template registry for the free /worksheets library (brief §11 / task
// WS). Each entry is just data — id, i18n keys, grade band — so the page,
// the print job and any future surface all read from one source instead of
// three copies of the same list drifting apart.
import { describe, it, expect } from 'vitest'
import { WORKSHEET_TEMPLATES, GRADE_BANDS, getWorksheetTemplate } from '../src/lib/worksheets/templates.js'

describe('WORKSHEET_TEMPLATES', () => {
  it('has exactly the 8 templates the brief lists', () => {
    expect(WORKSHEET_TEMPLATES).toHaveLength(8)
  })

  it('every id is unique and kebab-case', () => {
    const ids = WORKSHEET_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/)
  })

  it('every template has a title key, description key and a valid grade band', () => {
    const bands = new Set(Object.values(GRADE_BANDS))
    for (const t of WORKSHEET_TEMPLATES) {
      expect(t.titleKey).toMatch(/^worksheets:templates\..+\.title$/)
      expect(t.descriptionKey).toMatch(/^worksheets:templates\..+\.description$/)
      expect(bands.has(t.gradeBand)).toBe(true)
    }
  })

  it('includes the specific templates named in the brief', () => {
    const ids = WORKSHEET_TEMPLATES.map((t) => t.id)
    expect(ids).toEqual([
      'story-map',
      'character-profile',
      'setting-sketch',
      'storyboard',
      'sentence-starters',
      'book-report',
      'feelings-checkin',
      'about-author',
    ])
  })
})

describe('getWorksheetTemplate', () => {
  it('returns the matching template for a known id', () => {
    expect(getWorksheetTemplate('story-map')?.id).toBe('story-map')
  })

  it('returns null for an unknown or missing id', () => {
    expect(getWorksheetTemplate('not-a-template')).toBeNull()
    expect(getWorksheetTemplate(undefined)).toBeNull()
    expect(getWorksheetTemplate(null)).toBeNull()
  })
})

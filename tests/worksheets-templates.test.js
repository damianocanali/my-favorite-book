// The printable library reads the ONE worksheet catalogue
// (lib/school/worksheets.js): every assignable template is printable too,
// and the old printable kebab ids still resolve, as aliases.
import { describe, it, expect } from 'vitest'
import { WORKSHEET_TEMPLATES, getWorksheetTemplate, schoolKey } from '../src/lib/worksheets/templates.js'
import { WORKSHEET_TEMPLATES as LIB } from '../lib/school/worksheets.js'

describe('the printable library', () => {
  it('is the assignable catalogue itself: 33 sheets, same objects', () => {
    expect(WORKSHEET_TEMPLATES).toBe(LIB)
    expect(WORKSHEET_TEMPLATES).toHaveLength(33)
  })

  it('copy keys are role-named in the school namespace', () => {
    expect(schoolKey('haiku', 'heading')).toBe('school:worksheet.templates.haiku.heading')
    expect(schoolKey('haiku', 'boxes.line_one')).toBe('school:worksheet.templates.haiku.boxes.line_one')
  })
})

describe('getWorksheetTemplate', () => {
  it('returns a template by id or old printable alias', () => {
    expect(getWorksheetTemplate('haiku')?.id).toBe('haiku')
    expect(getWorksheetTemplate('story-map')?.id).toBe('beginning_middle_end')
    expect(getWorksheetTemplate('about-author')?.id).toBe('about_author')
  })

  it('returns null for an unknown or missing id', () => {
    expect(getWorksheetTemplate('not-a-template')).toBeNull()
    expect(getWorksheetTemplate(undefined)).toBeNull()
    expect(getWorksheetTemplate(null)).toBeNull()
  })
})

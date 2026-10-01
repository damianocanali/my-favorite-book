import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { errorKeyFor, teacherErrorText, KNOWN_CODES } from '../src/components/school/teacherErrors.js'

describe('errorKeyFor', () => {
  it('passes most codes through unchanged', () => {
    for (const code of ['name_required', 'bad_timezone', 'seats_full', 'license_required', 'generic']) {
      expect(errorKeyFor(code)).toBe(code)
    }
  })

  it('maps duplicate_name/create_failed to their full-sentence variant by default (standalone)', () => {
    expect(errorKeyFor('duplicate_name')).toBe('duplicate_name_full')
    expect(errorKeyFor('create_failed')).toBe('create_failed_full')
  })

  it('keeps the short fragment form when standalone is false (e.g. a skipped-name reason)', () => {
    expect(errorKeyFor('duplicate_name', { standalone: false })).toBe('duplicate_name')
    expect(errorKeyFor('create_failed', { standalone: false })).toBe('create_failed')
  })
})

describe('class_archived (an archived class: nudges, grading)', () => {
  const en = JSON.parse(readFileSync('src/i18n/locales/en/school.json', 'utf8'))
  const it_ = JSON.parse(readFileSync('src/i18n/locales/it/school.json', 'utf8'))
  it('has its own EN and IT sentence', () => {
    expect(KNOWN_CODES).toContain('class_archived')
    expect(en.teacher.errors.class_archived).toMatch(/archived/)
    expect(it_.teacher.errors.class_archived).toMatch(/archiviata/)
  })
  it('is generic (nudges and grading both return it), never about nudges only', () => {
    expect(en.teacher.errors.class_archived).toBe('This class is archived. Restore it to make changes.')
    expect(it_.teacher.errors.class_archived).toBe('Questa classe è archiviata. Ripristinala per fare modifiche.')
    expect(KNOWN_CODES).toEqual(expect.arrayContaining(['version_changed', 'cannot_return']))
  })
  it('renders through teacherErrorText with that key', () => {
    const t = (k) => k
    expect(teacherErrorText(t, 'class_archived')).toBe('school:teacher.errors.class_archived')
  })
})

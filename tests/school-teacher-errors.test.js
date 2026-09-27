import { describe, it, expect } from 'vitest'
import { errorKeyFor } from '../src/components/school/teacherErrors.js'

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

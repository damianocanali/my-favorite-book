// Pure helpers behind the assignments teacher UI (Task S2) — see
// src/components/school/assignmentUi.js's own header comment for why these
// are unit-tested in isolation rather than through the components.
import { describe, it, expect } from 'vitest'
import {
  STATUS_CHIP_KEY,
  handInChipKey,
  formatDueDate,
  localInputToIso,
  isoToLocalInput,
  canDeleteAssignment,
  nextStatusActions,
} from '../src/components/school/assignmentUi.js'

describe('STATUS_CHIP_KEY', () => {
  it('maps published to "open" (the teacher-facing word) and leaves the others as-is', () => {
    expect(STATUS_CHIP_KEY.draft).toBe('draft')
    expect(STATUS_CHIP_KEY.published).toBe('open')
    expect(STATUS_CHIP_KEY.closed).toBe('closed')
  })
})

describe('handInChipKey', () => {
  it('reads a raw dashboard string through unchanged', () => {
    expect(handInChipKey('handed_in')).toBe('handed_in')
    expect(handInChipKey('late')).toBe('late')
    expect(handInChipKey('not_started')).toBe('not_started')
  })

  it('flattens a submissions.js row into the same three states', () => {
    expect(handInChipKey({ status: 'not_started', late: false })).toBe('not_started')
    expect(handInChipKey({ status: 'handed_in', late: false })).toBe('handed_in')
    expect(handInChipKey({ status: 'handed_in', late: true })).toBe('late')
  })

  it('treats a missing row as not started', () => {
    expect(handInChipKey(null)).toBe('not_started')
    expect(handInChipKey(undefined)).toBe('not_started')
  })
})

describe('formatDueDate', () => {
  it('is null with no due date', () => {
    expect(formatDueDate(null, 'en-US')).toBeNull()
    expect(formatDueDate(undefined, 'en-US')).toBeNull()
  })

  it('is null for an unparsable value', () => {
    expect(formatDueDate('not-a-date', 'en-US')).toBeNull()
  })

  it('formats a real due date', () => {
    const s = formatDueDate('2026-05-01T14:30:00.000Z', 'en-US')
    expect(typeof s).toBe('string')
    expect(s.length).toBeGreaterThan(0)
  })
})

describe('localInputToIso / isoToLocalInput', () => {
  it('round-trips a datetime-local value through local time', () => {
    const local = '2026-05-01T09:15'
    const iso = localInputToIso(local)
    expect(iso).toBe(new Date(local).toISOString())
    expect(isoToLocalInput(iso)).toBe(local)
  })

  it('is null/empty for no value', () => {
    expect(localInputToIso(null)).toBeNull()
    expect(localInputToIso('')).toBeNull()
    expect(isoToLocalInput(null)).toBe('')
    expect(isoToLocalInput(undefined)).toBe('')
  })

  it('is null for an unparsable input value', () => {
    expect(localInputToIso('not-a-date')).toBeNull()
  })
})

describe('canDeleteAssignment', () => {
  it('allows delete only when nobody has handed in', () => {
    expect(canDeleteAssignment({ handed_in: 0, total_students: 20 })).toBe(true)
    expect(canDeleteAssignment({ handed_in: 1, total_students: 20 })).toBe(false)
  })

  it('defaults to allowed when counts are missing', () => {
    expect(canDeleteAssignment(undefined)).toBe(true)
    expect(canDeleteAssignment({})).toBe(true)
  })
})

describe('nextStatusActions', () => {
  it('offers publish from draft, close from published, reopen (publish) from closed', () => {
    expect(nextStatusActions('draft')).toEqual(['published'])
    expect(nextStatusActions('published')).toEqual(['closed'])
    expect(nextStatusActions('closed')).toEqual(['published'])
  })

  it('is empty for an unknown status', () => {
    expect(nextStatusActions('archived')).toEqual([])
  })
})

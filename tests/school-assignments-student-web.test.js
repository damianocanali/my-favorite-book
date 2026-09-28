// Pure helpers behind the assignments STUDENT UI (Task S3) — see
// src/components/school/assignmentStudentUi.js's own header comment for why
// these are unit-tested in isolation rather than through the components.
import { describe, it, expect, vi } from 'vitest'
import {
  assignmentCardStatus,
  canHandInAgain,
  canSubmitTo,
  hasUnseenFeedback,
  dueWording,
  runHandInSequence,
} from '../src/components/school/assignmentStudentUi.js'

const base = (overrides = {}) => ({
  id: 'a1', title: 'Title', prompt: 'Prompt', due_at: null, status: 'published',
  allow_late: true, created_at: '2026-01-01T00:00:00.000Z', past_due: false, my_submission: null,
  ...overrides,
})

describe('assignmentCardStatus', () => {
  it('is not_started with no submission', () => {
    expect(assignmentCardStatus(base())).toBe('not_started')
  })

  it('is handed_in once my_submission exists', () => {
    expect(assignmentCardStatus(base({ my_submission: { id: 's1' } }))).toBe('handed_in')
  })

  it('is closed once the teacher closes it, even with a submission', () => {
    expect(assignmentCardStatus(base({ status: 'closed', my_submission: { id: 's1' } }))).toBe('closed')
    expect(assignmentCardStatus(base({ status: 'closed' }))).toBe('closed')
  })

  it('treats a missing assignment as not_started', () => {
    expect(assignmentCardStatus(null)).toBe('not_started')
    expect(assignmentCardStatus(undefined)).toBe('not_started')
  })
})

describe('canHandInAgain', () => {
  it('is true only once handed in AND still open', () => {
    expect(canHandInAgain(base({ my_submission: { id: 's1' } }))).toBe(true)
  })

  it('is false without a submission', () => {
    expect(canHandInAgain(base())).toBe(false)
  })

  it('is false once closed, even with a submission', () => {
    expect(canHandInAgain(base({ status: 'closed', my_submission: { id: 's1' } }))).toBe(false)
  })

  it('does not consider past_due/allow_late — the server is the one gate', () => {
    expect(canHandInAgain(base({ my_submission: { id: 's1' }, past_due: true, allow_late: false }))).toBe(true)
  })
})

describe('canSubmitTo', () => {
  it('is true while published, false once closed or missing', () => {
    expect(canSubmitTo(base())).toBe(true)
    expect(canSubmitTo(base({ status: 'closed' }))).toBe(false)
    expect(canSubmitTo(null)).toBe(false)
  })
})

describe('hasUnseenFeedback', () => {
  it('reads feedback_unseen off my_submission', () => {
    expect(hasUnseenFeedback(base({ my_submission: { feedback_unseen: 2 } }))).toBe(true)
    expect(hasUnseenFeedback(base({ my_submission: { feedback_unseen: 0 } }))).toBe(false)
  })

  it('is false with no submission at all', () => {
    expect(hasUnseenFeedback(base())).toBe(false)
    expect(hasUnseenFeedback(null)).toBe(false)
  })
})

describe('dueWording', () => {
  const NOW = new Date('2026-05-08T12:00:00').getTime() // a Friday, local time

  it('is none with no due date', () => {
    expect(dueWording(base({ due_at: null }), NOW)).toEqual({ kind: 'none' })
    expect(dueWording(base({ due_at: 'not-a-date' }), NOW)).toEqual({ kind: 'none' })
  })

  it('is today for a due date later the same calendar day (or already passed today, not yet flagged past_due)', () => {
    const r = dueWording(base({ due_at: new Date('2026-05-08T20:00:00').toISOString() }), NOW)
    expect(r.kind).toBe('today')
  })

  it('is tomorrow for the next calendar day', () => {
    const r = dueWording(base({ due_at: new Date('2026-05-09T09:00:00').toISOString() }), NOW)
    expect(r.kind).toBe('tomorrow')
  })

  it('is weekday for 2-6 days out', () => {
    const r = dueWording(base({ due_at: new Date('2026-05-12T09:00:00').toISOString() }), NOW) // +4 days
    expect(r.kind).toBe('weekday')
  })

  it('is date for a week or more out', () => {
    const r = dueWording(base({ due_at: new Date('2026-05-20T09:00:00').toISOString() }), NOW)
    expect(r.kind).toBe('date')
  })

  it('is late_ok when past_due and the teacher still allows late hand-in', () => {
    const r = dueWording(base({ due_at: '2026-05-01T00:00:00.000Z', past_due: true, allow_late: true }), NOW)
    expect(r.kind).toBe('late_ok')
  })

  it('is past_due when past_due and late hand-in is not allowed', () => {
    const r = dueWording(base({ due_at: '2026-05-01T00:00:00.000Z', past_due: true, allow_late: false }), NOW)
    expect(r.kind).toBe('past_due')
  })

  it('trusts the server past_due flag over its own date math', () => {
    // Due date reads as "tomorrow" by the calendar, but the server says
    // past_due — the server's DB clock wins.
    const r = dueWording(base({ due_at: new Date('2026-05-09T09:00:00').toISOString(), past_due: true, allow_late: true }), NOW)
    expect(r.kind).toBe('late_ok')
  })
})

describe('runHandInSequence', () => {
  it('never calls submitFn when syncFn resolves false, and reports sync_failed', async () => {
    const syncFn = vi.fn().mockResolvedValue(false)
    const submitFn = vi.fn().mockResolvedValue({ ok: true })
    const result = await runHandInSequence(syncFn, submitFn)
    expect(submitFn).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: false, code: 'sync_failed' })
  })

  it('calls submitFn and returns its result unchanged once syncFn resolves true', async () => {
    const syncFn = vi.fn().mockResolvedValue(true)
    const submitFn = vi.fn().mockResolvedValue({ ok: true, data: { id: 'sub-1' } })
    const result = await runHandInSequence(syncFn, submitFn)
    expect(submitFn).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true, data: { id: 'sub-1' } })
  })

  it("surfaces submitFn's own failure code untouched", async () => {
    const syncFn = vi.fn().mockResolvedValue(true)
    const submitFn = vi.fn().mockResolvedValue({ ok: false, code: 'past_due' })
    const result = await runHandInSequence(syncFn, submitFn)
    expect(result).toEqual({ ok: false, code: 'past_due' })
  })
})

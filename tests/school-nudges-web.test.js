// Pure helpers behind the nudge UI (src/components/school/nudgeUi.js).
import { describe, it, expect } from 'vitest'
import {
  nudgeReasons, suggestedIds, openNotHandedIn, cleanMessage, truncateUtf16,
  buildNudgeBody, nudgeText, nudgeTeacher, nudgeAction, nudgeResultText, NUDGE_MESSAGE_MAX,
} from '../src/components/school/nudgeUi.js'

const NOW = new Date('2026-09-30T12:00:00Z').getTime()
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString()
const t = (key, opts) => (opts ? `${key}|${JSON.stringify(opts)}` : key)

const A_OPEN = { id: 'a1', title: 'My pet', status: 'published' }
const A_CLOSED = { id: 'a2', title: 'Old', status: 'closed' }

describe('nudgeReasons / suggestedIds', () => {
  it('quiet: never edited, or 3+ days since the last edit', () => {
    expect(nudgeReasons({ last_book_edited_at: null }, [], NOW)).toEqual(['quiet'])
    expect(nudgeReasons({ last_book_edited_at: daysAgo(3) }, [], NOW)).toEqual(['quiet'])
    expect(nudgeReasons({ last_book_edited_at: daysAgo(1) }, [], NOW)).toEqual([])
  })

  it('not_handed_in: only published assignments not handed in', () => {
    const s = { last_book_edited_at: daysAgo(0), assignments: { a1: 'not_started', a2: 'not_started' } }
    expect(nudgeReasons(s, [A_OPEN, A_CLOSED], NOW)).toEqual(['not_handed_in'])
    expect(nudgeReasons({ ...s, assignments: { a1: 'handed_in' } }, [A_OPEN], NOW)).toEqual([])
    expect(nudgeReasons({ ...s, assignments: { a1: 'late' } }, [A_OPEN], NOW)).toEqual([])
    expect(openNotHandedIn({ assignments: {} }, [A_OPEN, A_CLOSED])).toEqual([A_OPEN])
  })

  it('pre-ticks only students with a reason, at most 35', () => {
    const busy = { id: 'b', last_book_edited_at: daysAgo(0), assignments: { a1: 'handed_in' } }
    expect(suggestedIds([{ id: 'q', last_book_edited_at: null }, busy], [A_OPEN], NOW)).toEqual(['q'])
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, last_book_edited_at: null }))
    expect(suggestedIds(many, [], NOW)).toHaveLength(35)
  })
})

describe('message length (UTF-16, like the server)', () => {
  it('cleanMessage trims and counts UTF-16 units', () => {
    expect(cleanMessage('  hi  ')).toBe('hi')
    expect(cleanMessage('   ')).toBeNull()
    expect(cleanMessage('😀'.repeat(70))).toHaveLength(140)
    expect(cleanMessage('😀'.repeat(71))).toBeNull()
  })

  it('truncateUtf16 never splits an emoji', () => {
    const cut = truncateUtf16('a' + '😀'.repeat(70), NUDGE_MESSAGE_MAX)
    expect(cut.length).toBe(139)
    expect(cut.endsWith('😀')).toBe(true)
  })
})

describe('buildNudgeBody', () => {
  const base = { classId: 'c1', selected: new Set(['s1']), custom: '', assignmentId: null }
  it('preset', () => {
    expect(buildNudgeBody({ ...base, choice: 'cant_wait' })).toEqual({ body: { classId: 'c1', studentIds: ['s1'], preset: 'cant_wait' } })
  })
  it('custom message, trimmed, with a linked assignment', () => {
    expect(buildNudgeBody({ ...base, choice: 'custom', custom: ' Go! ', assignmentId: 'a1' }))
      .toEqual({ body: { classId: 'c1', studentIds: ['s1'], message: 'Go!', assignmentId: 'a1' } })
  })
  it('errors: nobody ticked, blank message, hand_in without assignment', () => {
    expect(buildNudgeBody({ ...base, selected: new Set(), choice: 'cant_wait' }).error).toBe('need_students')
    expect(buildNudgeBody({ ...base, choice: 'custom', custom: '  ' }).error).toBe('need_message')
    expect(buildNudgeBody({ ...base, choice: 'hand_in' }).error).toBe('need_message')
  })
})

describe('child side', () => {
  it('nudgeText: preset in the reader language, hand_in with title, custom as written', () => {
    expect(nudgeText(t, { preset: 'story_waiting' })).toBe('school:nudges.presets.story_waiting')
    expect(nudgeText(t, { preset: 'hand_in', assignment: { title: 'My pet' } })).toBe('school:nudges.presets.hand_in|{"title":"My pet"}')
    expect(nudgeText(t, { preset: 'hand_in', assignment: null })).toBe('school:nudges.presets.hand_in_generic')
    expect(nudgeText(t, { preset: null, message: 'Hello!' })).toBe('Hello!')
  })

  it('nudgeTeacher falls back to "Your teacher"', () => {
    expect(nudgeTeacher(t, { teacher_name: 'Ms R' })).toBe('Ms R')
    expect(nudgeTeacher(t, { teacher_name: null })).toBe('school:nudges.student.your_teacher')
  })

  it('nudgeAction: open linked assignment, else draft with work, else newest book, else create', () => {
    const n = { assignment: { id: 'a1' } }
    const open = { id: 'a1', status: 'published', my_submission: null }
    expect(nudgeAction(n, { assignments: [open] })).toEqual({ kind: 'assignment', assignment: open })
    const handed = { ...open, my_submission: { id: 's' } }
    const books = [{ id: 'old', updatedAt: '2026-01-01' }, { id: 'new', updatedAt: '2026-09-01' }]
    expect(nudgeAction(n, { assignments: [handed], books }).book.id).toBe('new')
    expect(nudgeAction({}, { draft: { title: 'Mine', pages: [] }, books })).toEqual({ kind: 'draft' })
    expect(nudgeAction({}, {})).toEqual({ kind: 'create' })
  })
})

describe('nudgeResultText', () => {
  it('sent + capped, and falls back to an error when nothing went out', () => {
    expect(nudgeResultText(t, { sent: [{}, {}], skipped: [{ code: 'daily_cap' }] }))
      .toBe('school:nudges.teacher.sent_count|{"count":2} school:nudges.teacher.capped_count|{"count":1}')
    expect(nudgeResultText(t, { sent: [], skipped: [{ code: 'not_found' }] })).toBe('school:teacher.errors.upstream')
  })
})

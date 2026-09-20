import { describe, it, expect } from 'vitest'
import {
  FEELINGS, NEEDS, MAX_ENTRIES,
  pruneEntries, appendEntry, isEligibleForPrompt,
} from '../src/lib/checkIn'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-09-20T12:00:00Z')
const entry = (feeling, need, agoDays = 0) => ({
  at: new Date(NOW - agoDays * DAY).toISOString(), feeling, need,
})

describe('catalogs', () => {
  it('offers six feelings and four needs', () => {
    expect(FEELINGS).toHaveLength(6)
    expect(NEEDS).toHaveLength(4)
  })

  it('has stable ids the catalogue and storage both key on', () => {
    expect(FEELINGS.map((f) => f.id)).toEqual(
      ['happy', 'proud', 'tired', 'worried', 'angry', 'sad']
    )
    expect(NEEDS.map((n) => n.id)).toEqual(['break', 'quiet', 'help', 'keep_going'])
  })
})

describe('pruneEntries', () => {
  it('drops entries older than 30 days', () => {
    const kept = pruneEntries([entry('sad', 'break', 31), entry('happy', 'keep_going', 2)], NOW)
    expect(kept).toHaveLength(1)
    expect(kept[0].feeling).toBe('happy')
  })

  it('keeps an entry exactly at the boundary and drops one just past it', () => {
    expect(pruneEntries([entry('happy', 'quiet', 30)], NOW)).toHaveLength(1)
    const justPast = { at: new Date(NOW - 30 * DAY - 1).toISOString(), feeling: 'happy', need: 'quiet' }
    expect(pruneEntries([justPast], NOW)).toHaveLength(0)
  })

  it('caps at MAX_ENTRIES, keeping the newest and evicting the oldest', () => {
    // Distinct, known ages (0, 0.1, 0.2, ... days), all well inside the
    // retention window, so only the MAX_ENTRIES cap is under test here.
    const many = Array.from({ length: MAX_ENTRIES + 10 }, (_, i) =>
      entry('happy', 'keep_going', i * 0.1)
    )
    const kept = pruneEntries(many, NOW)
    expect(kept).toHaveLength(MAX_ENTRIES)
    const keptAt = new Set(kept.map((e) => e.at))
    const newest = many.slice(0, MAX_ENTRIES)
    const oldest = many.slice(MAX_ENTRIES)
    expect(newest.every((e) => keptAt.has(e.at))).toBe(true)
    expect(oldest.some((e) => keptAt.has(e.at))).toBe(false)
  })

  it('survives a corrupt or empty store', () => {
    expect(pruneEntries(undefined, NOW)).toEqual([])
    expect(pruneEntries([{ nonsense: true }], NOW)).toEqual([])
  })
})

describe('appendEntry', () => {
  it('adds the entry and prunes in one step', () => {
    const out = appendEntry([entry('sad', 'break', 40)], { feeling: 'proud', need: 'keep_going' }, NOW)
    expect(out).toHaveLength(1)
    expect(out[0].feeling).toBe('proud')
    expect(out[0].at).toBe(new Date(NOW).toISOString())
  })

  it('records a feeling with no need when the child closed at step one', () => {
    const out = appendEntry([], { feeling: 'worried' }, NOW)
    expect(out[0].need).toBeUndefined()
  })

  it('refuses an unknown feeling rather than storing junk', () => {
    expect(appendEntry([], { feeling: 'hangry' }, NOW)).toEqual([])
  })
})

describe('isEligibleForPrompt', () => {
  it('allows the first prompt of a session', () => {
    expect(isEligibleForPrompt({ lastPromptedAt: null, nowMs: NOW })).toBe(true)
  })

  it('refuses a second prompt in the same session', () => {
    expect(isEligibleForPrompt({ lastPromptedAt: NOW - 60_000, nowMs: NOW })).toBe(false)
  })

  it('allows again once the quiet window has passed', () => {
    expect(isEligibleForPrompt({ lastPromptedAt: NOW - 5 * 60 * 60 * 1000, nowMs: NOW })).toBe(true)
  })
})

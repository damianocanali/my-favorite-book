import { create } from 'zustand'

// Transient celebration beats. Deliberately NOT persisted: a milestone is
// a moment, and replaying "halfway there!" after a refresh would be a lie.
//
// `seen` is per-session and keyed by book, so a child who edits page 3
// again doesn't get congratulated for finishing it a second time — the
// fastest way to make a reward feel worthless is to hand it out on a loop.

export const useMilestoneStore = create((set, get) => ({
  current: null,
  seen: new Set(),

  /**
   * Fire a beat. `id` must be stable for the thing being celebrated
   * (e.g. `halfway:book-42`) so it only ever shows once per session.
   */
  fire: ({ id, title, sub, mood = 'cheer' }) => {
    if (!id || get().seen.has(id)) return
    const seen = new Set(get().seen)
    seen.add(id)
    set({ seen, current: { id, title, sub, mood } })
  },

  clear: () => set({ current: null }),

  /** Called when a book is abandoned or a new one started. */
  resetForBook: (bookId) => {
    if (!bookId) return
    const seen = new Set([...get().seen].filter((k) => !k.endsWith(`:${bookId}`)))
    set({ seen })
  },
}))

/**
 * Works out which beat, if any, a page edit just earned.
 * Pure so it can be unit-tested without a React tree.
 *
 * Returns null when nothing is worth celebrating — which is most edits.
 * That restraint is the point: a beat on every keystroke is noise.
 */
export function milestoneForProgress({ bookId, pages }) {
  if (!bookId || !Array.isArray(pages) || pages.length === 0) return null

  const total = pages.length
  const written = pages.filter((p) => (p.text ?? '').trim().length > 0).length
  if (written === 0) return null

  if (written === total) {
    return {
      id: `all-pages:${bookId}`,
      title: 'Every page done!',
      sub: 'Your story is complete',
      mood: 'proud',
    }
  }

  // Halfway only makes sense in a book long enough to have a middle.
  if (total >= 4 && written === Math.ceil(total / 2)) {
    return {
      id: `halfway:${bookId}`,
      title: 'Halfway there!',
      sub: `${written} of ${total} pages written`,
      mood: 'cheer',
    }
  }

  if (written === 1) {
    return {
      id: `first-page:${bookId}`,
      title: 'Page one done!',
      sub: 'Keep going',
      mood: 'cheer',
    }
  }

  return null
}

// Pure helpers behind the teacher dashboard's "Needs you now" strip (Task
// D2). No DOM, no network — kept separate from TeacherDashboardPage/
// NeedsYouNow so they're unit-testable directly, same convention as
// src/components/school/rosterText.js.

/**
 * Grownup asks first, then newest-first within each group — mirrors
 * api/school/dashboard.js's own sortHelp exactly (kind can't be sorted with
 * a plain comparison: 'book' < 'grownup' alphabetically, backwards from
 * what's wanted). Used client-side to restore a "Seen" row's position when
 * the POST /api/school/help-seen call that removed it optimistically turns
 * out to have failed — without this, a restored row would just land at
 * whatever index splice put it, not back among its own kind in time order.
 * @param {Array<{kind: string, created_at: string}>} rows
 */
export function sortHelp(rows) {
  return [...rows].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'grownup' ? -1 : 1
    return new Date(b.created_at) - new Date(a.created_at)
  })
}

/**
 * Split already-sorted help rows into the two lists the strip renders:
 * "I need a grown-up" (urgent) first, "Help with my book" (calmer) second.
 * @param {Array<{kind: string}>} rows
 * @returns {{grownup: Array, book: Array}}
 */
export function groupHelp(rows) {
  return {
    grownup: rows.filter((h) => h.kind === 'grownup'),
    book: rows.filter((h) => h.kind === 'book'),
  }
}

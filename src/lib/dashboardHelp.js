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

/// How long a just-marked-Seen id is kept out of poll results, once the
/// POST that marked it succeeds. Long enough to outlast the poll interval
/// (30s) plus request latency, so the ONE poll that could plausibly have
/// been in flight before the PATCH committed never gets to resurrect it.
export const SEEN_SUPPRESS_MS = 60 * 1000

/**
 * Drops any row whose id is still within its post-Seen suppression window.
 * TeacherDashboardPage's 30s poll replaces `help` wholesale from the
 * server; without this, a poll that started fetching a beat before this
 * tab's own "Seen" PATCH committed can win the race and hand back a
 * response that still includes the row the teacher just dismissed,
 * re-adding it right after the optimistic removal took it away.
 * @param {Array<{id: string}>} rows
 * @param {Map<string, number>} recentlySeenUntil id -> ms timestamp the
 *   suppression ends at (see SEEN_SUPPRESS_MS)
 * @param {number} [nowMs]
 */
export function filterRecentlySeen(rows, recentlySeenUntil, nowMs = Date.now()) {
  return rows.filter((row) => {
    const until = recentlySeenUntil.get(row.id)
    return !(until && nowMs < until)
  })
}

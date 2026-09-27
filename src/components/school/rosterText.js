// Pure helpers behind the teacher roster UI (Task 12). No DOM, no network —
// kept separate from AddStudents/RosterTable/LicenseBadge/SignInCards so
// they're trivially unit-testable (see tests/school-teacher-web.test.js).

const MAX_NAME_LENGTH = 24

/**
 * Turn a pasted roster textarea's raw text into a clean, deduped list of
 * names. Names are split on both newlines and commas (a teacher pasting
 * from a spreadsheet often has one or the other), trimmed, internally
 * collapsed to single spaces, cut to 24 characters (the same limit the
 * server enforces in api/school/students.js's cleanName), and deduped
 * case-insensitively — keeping the first spelling seen, since that's the
 * one that will actually reach the server (the duplicate would just come
 * back in `skipped` otherwise).
 * @param {string} text
 * @returns {string[]}
 */
export function parseRosterText(text) {
  const seen = new Set()
  const out = []
  for (const raw of String(text ?? '').split(/[\n,]/)) {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

/**
 * Whole days left on a trial license, for LicenseBadge's "Free trial: N
 * days left". `null` for anything that isn't a live trial (active, comped,
 * or no license at all) — those never show a day count. Ceils rather than
 * floors: a class with 29.2 days left should still read "30 days left"
 * today, not tick down to 29 hours before the calendar date changes.
 * Never negative — an already-expired trial reads 0, not a negative count.
 * @param {{status: string, expires_at: string} | null | undefined} license
 * @param {Date} [now]
 * @returns {number | null}
 */
export function trialDaysLeft(license, now = new Date()) {
  if (!license || license.status !== 'trial') return null
  const ms = new Date(license.expires_at).getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/**
 * Split an array into fixed-size groups, in order, with a shorter final
 * group when the length isn't a multiple of `size`. Used to lay out
 * sign-in cards 6-to-a-page for print.
 * @template T
 * @param {T[]} array
 * @param {number} size
 * @returns {T[][]}
 */
export function chunk(array, size) {
  const out = []
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size))
  return out
}

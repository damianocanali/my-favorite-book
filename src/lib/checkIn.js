// Pure check-in logic: the catalogs, retention rules and prompt eligibility.
//
// Deliberately free of React, zustand and localStorage so it can be tested in
// the node environment vitest runs in — the same reason milestoneForProgress
// is a plain function in useMilestoneStore.js.

/// Feeling tiles, in display order. `tone` picks the star colour in the
/// constellation; it is NOT a valence score and nothing ranks these.
export const FEELINGS = [
  { id: 'happy', tone: 'gold' },
  { id: 'proud', tone: 'purple' },
  { id: 'tired', tone: 'blue' },
  { id: 'worried', tone: 'cyan' },
  { id: 'angry', tone: 'pink' },
  { id: 'sad', tone: 'indigo' },
]

/// What the child is offered next. `break` first because it is the one a
/// struggling child most needs and should not have to hunt for.
export const NEEDS = [
  { id: 'break' },
  { id: 'quiet' },
  { id: 'help' },
  { id: 'keep_going' },
]

export const MAX_ENTRIES = 60
export const MAX_AGE_DAYS = 30

/// Once a session, roughly. A prompt on every page save is noise — the same
/// lesson useMilestoneStore's `seen` set encodes.
const QUIET_WINDOW_MS = 4 * 60 * 60 * 1000

const FEELING_IDS = new Set(FEELINGS.map((f) => f.id))
const NEED_IDS = new Set(NEEDS.map((n) => n.id))

function isValid(e) {
  if (!e || typeof e.at !== 'string' || !FEELING_IDS.has(e.feeling)) return false
  if (e.need !== undefined && !NEED_IDS.has(e.need)) return false
  return !Number.isNaN(Date.parse(e.at))
}

/// Drops anything invalid, anything past MAX_AGE_DAYS, and the oldest
/// entries beyond MAX_ENTRIES. Tolerates undefined and corrupt storage,
/// because localStorage can be edited by hand or truncated by the browser.
export function pruneEntries(entries, nowMs = Date.now()) {
  const cutoff = nowMs - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  return (Array.isArray(entries) ? entries : [])
    .filter((e) => isValid(e) && Date.parse(e.at) >= cutoff)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, MAX_ENTRIES)
}

/// Adds one entry, newest first, then prunes. Returns a new array.
export function appendEntry(entries, { feeling, need }, nowMs = Date.now()) {
  if (!FEELING_IDS.has(feeling)) return pruneEntries(entries, nowMs)
  const e = { at: new Date(nowMs).toISOString(), feeling }
  if (need !== undefined && NEED_IDS.has(need)) e.need = need
  return pruneEntries([e, ...(Array.isArray(entries) ? entries : [])], nowMs)
}

/// Whether an automatic prompt may fire now. The child-initiated button
/// never consults this — it is always available.
export function isEligibleForPrompt({ lastPromptedAt, nowMs = Date.now() }) {
  if (!lastPromptedAt) return true
  return nowMs - lastPromptedAt >= QUIET_WINDOW_MS
}

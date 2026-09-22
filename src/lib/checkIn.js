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

/// Rebuilds an entry with exactly the three fields the design allows —
/// nothing else survives, no matter what else was sitting on the object.
/// `isValid` only checks that `at`/`feeling`/`need` are well-formed; it
/// doesn't reject an entry for carrying extra fields, so without this step
/// "an entry records no book id and no page id" would be a convention
/// every caller happens to follow rather than something pruneEntries
/// actually enforces.
function normalise(e) {
  return e.need !== undefined ? { at: e.at, feeling: e.feeling, need: e.need } : { at: e.at, feeling: e.feeling }
}

/// Drops anything invalid, anything past MAX_AGE_DAYS, and the oldest
/// entries beyond MAX_ENTRIES, and normalises whatever survives to exactly
/// {at, feeling, need?}. Tolerates undefined and corrupt storage, because
/// localStorage can be edited by hand or truncated by the browser.
export function pruneEntries(entries, nowMs = Date.now()) {
  const cutoff = nowMs - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  return (Array.isArray(entries) ? entries : [])
    .filter((e) => isValid(e) && Date.parse(e.at) >= cutoff)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, MAX_ENTRIES)
    .map(normalise)
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
  if (lastPromptedAt == null) return true
  return nowMs - lastPromptedAt >= QUIET_WINDOW_MS
}

/// CURRENTLY UNUSED — no caller. PageEditor used to call this to decide
/// whether its text-change effect should offer a breakpoint check-in; that
/// wiring was removed (see the comment in PageEditor.jsx) because a
/// text-change effect has no "page saved" event for this guard to key on,
/// no matter how the guard itself is written — it fired on the first
/// character of a blank page and could go permanently silent once a
/// milestone id was already in `seen`. Both were seam bugs, not bugs in the
/// function below, which correctly implements "writtenCount must have
/// genuinely grown past prevWritten". Kept, with its tests, because a
/// future trigger hooked to a real "page just finished" event (addPage,
/// page navigation, illustration success) will likely still want this
/// exact "did progress genuinely happen, and are we in the quiet window"
/// check — just called from a different seam.
///
/// Pure so the guard can be pinned by a test without a DOM/render harness.
export function shouldOfferBreakpointCheckIn({ prevWritten, writtenCount, milestoneFired, lastPromptedAt, nowMs = Date.now() }) {
  if (milestoneFired) return false
  if (!(writtenCount > prevWritten)) return false
  return isEligibleForPrompt({ lastPromptedAt, nowMs })
}

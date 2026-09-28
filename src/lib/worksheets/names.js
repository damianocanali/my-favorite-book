// "Pre-fill names" (brief §2): a teacher pastes a class list into the
// Customize panel and gets one printed copy per name, each with that name
// already filled in — kept only in component state, nothing sent to a
// server. Pure parsing of the pasted blob into a clean name list; same
// untrusted-text posture as params.js (strip anything tag-like, cap
// length), just split on newlines/commas rather than read from a URL.
export const MAX_NAMES = 60
export const MAX_NAME_LENGTH = 40

export function parseNameList(raw) {
  if (typeof raw !== 'string') return []
  return raw
    .split(/[\n,]+/)
    .map((s) => s.replace(/[<>]/g, '').trim())
    .filter(Boolean)
    .slice(0, MAX_NAMES)
    .map((s) => s.slice(0, MAX_NAME_LENGTH))
}

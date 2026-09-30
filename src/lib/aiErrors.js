// The AI endpoints (story-buddy, generate-image, generate-avatar and the
// shared _aiGuard) answer failures with an English `error` sentence. Shown
// raw, an Italian child got English in the middle of an Italian app. This
// maps the sentences a child can actually hit to translated copy and
// everything else to a friendly generic line. Pure (t is injected) so it
// is unit-tested without React.
const KNOWN = [
  [/creation limit/i, 'errors:ai.daily_limit'],
  [/kind and friendly/i, 'errors:ai.unkind'],
  [/too many requests/i, 'errors:ai.rate_limited'],
  [/too long/i, 'errors:ai.too_long'],
  [/story buddy/i, 'errors:ai.buddy_unavailable'],
]

export function friendlyAiError(err, t) {
  const message = typeof err === 'string' ? err : err?.message ?? ''
  const hit = KNOWN.find(([re]) => re.test(message))
  return t(hit ? hit[1] : 'errors:ai.generic')
}

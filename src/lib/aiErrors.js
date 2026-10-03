// The AI endpoints (story-buddy, generate-image, generate-avatar and the
// shared _aiGuard) answer failures with an English `error` sentence and,
// increasingly, a machine `code`. Shown raw, an Italian child got English in
// the middle of an Italian app. This maps the server's CODE first (callers
// copy it onto the thrown Error as err.code), then a few known sentences as
// a fallback, and everything else to a friendly generic line. Pure (t is
// injected) so it is unit-tested without React.
const BY_CODE = {
  // Student-facing (the teacher's own wording lives in school:teacher.errors).
  class_image_limit: 'errors:ai.class_image_limit',
  daily_limit: 'errors:ai.daily_limit',
  rate_limited: 'errors:ai.rate_limited',
  scene_unavailable: 'errors:ai.try_again',
  // Moderation couldn't run and a student request fails closed.
  moderation_unavailable: 'errors:ai.try_again',
  // The finished picture failed output moderation and was not kept.
  image_flagged: 'errors:ai.image_flagged',
  timeout: 'errors:ai.timeout',
  unkind: 'errors:ai.unkind',
  prompt_too_long: 'errors:ai.too_long',
}

// Fallback only, for servers that send no code. Order matters: a timeout
// ("took too long") must never read as "make it shorter".
const BY_MESSAGE = [
  [/timed? ?out|took too long|timeout/i, 'errors:ai.timeout'],
  [/creation limit/i, 'errors:ai.daily_limit'],
  [/all the pictures for today/i, 'errors:ai.class_image_limit'],
  [/kind and friendly/i, 'errors:ai.unkind'],
  [/too many requests/i, 'errors:ai.rate_limited'],
  [/^prompt is too long/i, 'errors:ai.too_long'],
  [/story buddy/i, 'errors:ai.buddy_unavailable'],
  [/couldn't change the picture/i, 'errors:ai.try_again'],
]

export function friendlyAiError(err, t) {
  const code = typeof err === 'object' && err ? err.code : undefined
  if (code && BY_CODE[code]) return t(BY_CODE[code])
  // No code (an older server): the known sentence beats the bare status,
  // so the daily cap's 429 still says "come back tomorrow".
  const message = typeof err === 'string' ? err : err?.message ?? ''
  const hit = BY_MESSAGE.find(([re]) => re.test(message))
  if (hit) return t(hit[1])
  if (typeof err === 'object' && err?.status === 429) return t('errors:ai.rate_limited')
  if (typeof err === 'object' && err?.status === 504) return t('errors:ai.timeout')
  return t('errors:ai.generic')
}

/// Builds the Error a fetch helper throws from a failed AI response, keeping
/// the server's code and HTTP status for friendlyAiError.
export async function aiResponseError(response, fallback = 'AI error') {
  const body = await response.json().catch(() => ({}))
  const err = new Error(body?.error || `${fallback}: ${response.status}`)
  if (body?.code) err.code = body.code
  err.status = response.status
  return err
}

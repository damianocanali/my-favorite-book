// Classifies Supabase's raw auth errors into a stable machine code that the
// UI turns into copy with `t('errors:auth.<code>')`.
//
// The old catch-all was "Incorrect email or password", which is simply
// wrong for an unconfirmed account — that user's password is fine, they
// just never clicked the confirmation link, and telling them otherwise
// sends them round in circles re-typing a correct password.
//
// !! DO NOT "FIX" THE SUBSTRING MATCHING BELOW BY LOCALISING IT !!
// The strings we match on are the *provider's English wire response* from
// Supabase/GoTrue. They are protocol, not UI copy: they are identical no
// matter what language the app is displayed in, and they do not change when
// the user switches to Italian. Matching them in English is correct and
// must stay that way. Only the returned CODE reaches the UI, and only the
// UI translates it.
//
// Mirrors AuthStore.friendlyAuthMessage in the iOS app; keep the two in
// sync so both surfaces explain a failure the same way.

/**
 * @typedef {'email_not_confirmed'|'invalid_credentials'|'rate_limited'
 *   |'weak_password'|'offline'|'sign_up_failed'|'sign_in_failed'} AuthErrorCode
 */

/**
 * @param {unknown} error   the thrown Supabase error
 * @param {{ signingUp?: boolean }} [opts]
 * @returns {AuthErrorCode} a code to look up under `errors:auth.<code>`
 */
export function authErrorCode(error, { signingUp = false } = {}) {
  // Provider wire text — English by protocol. See the note above.
  const raw = (error?.message || error?.error_description || String(error || '')).toLowerCase()

  if (raw.includes('not confirmed') || raw.includes('email_not_confirmed')) {
    return 'email_not_confirmed'
  }
  if (raw.includes('invalid login') || raw.includes('invalid_credentials')) {
    return 'invalid_credentials'
  }
  if (
    raw.includes('rate limit') ||
    raw.includes('only request this after') ||
    raw.includes('too many')
  ) {
    return 'rate_limited'
  }
  if (raw.includes('password') && raw.includes('6')) {
    return 'weak_password'
  }
  if (raw.includes('failed to fetch') || raw.includes('network') || raw.includes('offline')) {
    return 'offline'
  }
  return signingUp ? 'sign_up_failed' : 'sign_in_failed'
}

// Turns Supabase's raw auth errors into something a parent can act on.
//
// The old catch-all was "Incorrect email or password", which is simply
// wrong for an unconfirmed account — that user's password is fine, they
// just never clicked the confirmation link, and telling them otherwise
// sends them round in circles re-typing a correct password.
//
// Mirrors AuthStore.friendlyAuthMessage in the iOS app; keep the two in
// sync so both surfaces explain a failure the same way.

/**
 * @param {unknown} error   the thrown Supabase error
 * @param {{ signingUp?: boolean }} [opts]
 * @returns {string} a message safe to show a user
 */
export function friendlyAuthMessage(error, { signingUp = false } = {}) {
  const raw = (error?.message || error?.error_description || String(error || '')).toLowerCase()

  if (raw.includes('not confirmed') || raw.includes('email_not_confirmed')) {
    return 'Please confirm your email first — check your inbox for the link we sent.'
  }
  if (raw.includes('invalid login') || raw.includes('invalid_credentials')) {
    return "That email and password don't match. Try again, or reset your password below."
  }
  if (
    raw.includes('rate limit') ||
    raw.includes('only request this after') ||
    raw.includes('too many')
  ) {
    return 'Too many attempts just now. Please wait a minute and try again.'
  }
  if (raw.includes('password') && raw.includes('6')) {
    return 'Passwords need to be at least 6 characters.'
  }
  if (raw.includes('failed to fetch') || raw.includes('network') || raw.includes('offline')) {
    return "Can't reach the internet. Check your connection and try again."
  }
  return signingUp
    ? "Couldn't create your account. Please try again."
    : "Couldn't sign in. Please try again."
}

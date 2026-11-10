// What a password-reset link brought back to /reset-password. Supabase's
// verify endpoint redirects here with the session in the hash (implicit
// flow), a `?code=` (PKCE), or — when it refused the link — the reason in
// the hash or query: error_code=otp_expired covers both "already used" and
// "too old" (links work once, for an hour, and only the newest email's).
export function readResetLink(search = '', hash = '') {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const h = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const pick = (k) => h.get(k) || q.get(k)
  const errorCode = pick('error_code')
  const error = pick('error')
  if (errorCode || error) {
    const expired = errorCode === 'otp_expired' || errorCode === 'flow_state_expired'
    return { kind: 'error', reason: expired ? 'expired' : 'invalid' }
  }
  const code = q.get('code')
  if (code) return { kind: 'code', code }
  return { kind: 'session' }
}

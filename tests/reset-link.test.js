import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readResetLink } from '../src/lib/resetLink.js'

describe('readResetLink', () => {
  it('reads an expired or already-used link from the hash', () => {
    const hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    expect(readResetLink('', hash)).toEqual({ kind: 'error', reason: 'expired' })
  })
  it('reads an error from the query too', () => {
    expect(readResetLink('?error=server_error&error_code=unexpected_failure', '')).toEqual({ kind: 'error', reason: 'invalid' })
  })
  it('passes a PKCE code through', () => {
    expect(readResetLink('?code=abc123', '')).toEqual({ kind: 'code', code: 'abc123' })
  })
  it('falls back to the session (implicit flow tokens in the hash)', () => {
    expect(readResetLink('', '#access_token=x&refresh_token=y&type=recovery')).toEqual({ kind: 'session' })
  })
})

describe('ResetPasswordPage', () => {
  const page = readFileSync('src/pages/ResetPasswordPage.jsx', 'utf8')
  it('offers a new link when the link was refused', () => {
    expect(page).toContain('to="/login?reset=1"')
    expect(page).toContain("errors:auth.reset_link_expired")
  })
  it('clears tokens and error codes from the address bar', () => {
    expect(page).toContain("window.history.replaceState(null, '', window.location.pathname)")
  })
})

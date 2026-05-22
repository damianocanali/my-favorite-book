// Google + Apple OAuth buttons. Used on LoginPage and SignupPage.
//
// Setup required in Supabase Dashboard for these to actually work:
//   Authentication → Providers → enable Google (paste OAuth client id +
//   secret from Google Cloud Console) and Apple (paste Services ID +
//   key id + team id + .p8 key from Apple Developer). Each provider's
//   redirect URI must be set to:
//     <supabase-url>/auth/v1/callback
//   and the same callback must be allow-listed in each provider's
//   console alongside our own /auth/callback page.
//
// App Store note: if we ship Google sign-in on iOS, "Sign in with Apple"
// is mandatory per guideline 4.8 — both buttons here ship together for
// that reason.
import { useState } from 'react'
import { useAuthStore } from '../../stores/useAuthStore'

function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  )
}

function AppleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.07zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

export default function OAuthButtons({ label = 'or continue with' }) {
  const signInWithProvider = useAuthStore((s) => s.signInWithProvider)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const handle = async (provider) => {
    setBusy(provider)
    setError('')
    try {
      await signInWithProvider(provider)
      // OAuth redirects out of the SPA; the auth callback page handles
      // the rest. We stay in `busy` until the navigation occurs.
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.')
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-galaxy-text-muted/15" />
        <p className="text-galaxy-text-muted text-xs font-body uppercase tracking-wide">{label}</p>
        <div className="flex-1 h-px bg-galaxy-text-muted/15" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handle('google')}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-slate-800 font-body font-semibold text-sm hover:bg-slate-100 disabled:opacity-50 transition-colors"
        >
          <GoogleIcon />
          {busy === 'google' ? 'Opening…' : 'Google'}
        </button>
        <button
          type="button"
          onClick={() => handle('apple')}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-black text-white font-body font-semibold text-sm hover:bg-slate-900 disabled:opacity-50 transition-colors"
        >
          <AppleIcon />
          {busy === 'apple' ? 'Opening…' : 'Apple'}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
    </div>
  )
}

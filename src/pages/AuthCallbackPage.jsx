import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AppLogo from '../components/ui/AppLogo'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  // 'loading' → 'signed-in' (OAuth or already-active session, auto-redirect)
  //          → 'email-confirmed' (signup link clicked, user must now sign in)
  //          → 'error'
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search)
        const hash = new URLSearchParams(window.location.hash.slice(1))

        const code = params.get('code')
        const accessToken = params.get('access_token') || hash.get('access_token')
        const refreshToken = params.get('refresh_token') || hash.get('refresh_token')
        const errorParam = params.get('error_description') || hash.get('error_description')
        // Supabase email confirmation links include type=signup. OAuth code
        // exchanges have no type. We use that to pick the post-success copy.
        const type = params.get('type') || hash.get('type')

        if (errorParam) throw new Error(errorParam)

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (error) throw error
        } else {
          throw new Error('No auth tokens found')
        }

        // After a successful exchange the session is active either way; for
        // email confirmation we still want to surface "you're all set" copy
        // briefly, but every other flow (OAuth, magic link, password reset)
        // should land you straight on the home page.
        if (type === 'signup') {
          setStatus('email-confirmed')
        } else {
          setStatus('signed-in')
          navigate('/', { replace: true })
        }
      } catch {
        setStatus('error')
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="flex justify-center">
          <AppLogo size={56} />
        </div>

        {(status === 'loading' || status === 'signed-in') && (
          <>
            <Loader2 size={36} className="text-galaxy-primary animate-spin mx-auto" />
            <p className="text-galaxy-text font-body">
              {status === 'signed-in' ? 'Signing you in…' : 'Confirming your account…'}
            </p>
          </>
        )}

        {status === 'email-confirmed' && (
          <>
            <CheckCircle size={48} className="text-green-400 mx-auto" />
            <div>
              <h1 className="font-heading text-2xl font-bold text-galaxy-text mb-2">
                You're all set!
              </h1>
              <p className="text-galaxy-text-muted font-body text-sm leading-relaxed">
                Your email has been confirmed. You can now open My Book Lab on any of your devices and sign in.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-block px-6 py-3 rounded-2xl bg-galaxy-primary text-white font-body font-semibold text-sm hover:bg-galaxy-primary/80 transition-colors"
            >
              Sign in
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={48} className="text-red-400 mx-auto" />
            <div>
              <h1 className="font-heading text-2xl font-bold text-galaxy-text mb-2">
                Something went wrong
              </h1>
              <p className="text-galaxy-text-muted font-body text-sm">
                The confirmation link may have expired. Please try signing up again.
              </p>
            </div>
            <Link
              to="/signup"
              className="inline-block px-6 py-3 rounded-2xl bg-galaxy-primary text-white font-body font-semibold text-sm hover:bg-galaxy-primary/80 transition-colors"
            >
              Back to sign up
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

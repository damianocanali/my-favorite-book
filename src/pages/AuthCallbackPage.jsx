import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
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

        setStatus('success')
        setTimeout(() => navigate('/login', { replace: true }), 1500)
      } catch {
        setStatus('error')
        setTimeout(() => navigate('/login', { replace: true }), 3000)
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 size={40} className="text-galaxy-primary animate-spin mx-auto" />
            <p className="text-galaxy-text font-body">Confirming your account…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={40} className="text-green-400 mx-auto" />
            <p className="text-galaxy-text font-body font-semibold">Email confirmed! Taking you to sign in…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={40} className="text-red-400 mx-auto" />
            <p className="text-galaxy-text font-body">Something went wrong. Redirecting to login…</p>
          </>
        )}
      </div>
    </div>
  )
}

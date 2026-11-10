import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { readResetLink } from '../lib/resetLink'

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)
  // Set when the link itself was refused: the form is replaced by a way to
  // ask for a new one.
  const [linkError, setLinkError] = useState('')

  useEffect(() => {
    let live = true
    const link = readResetLink(window.location.search, window.location.hash)
    // Don't leave tokens or error codes in the address bar or history.
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, '', window.location.pathname)
    }
    if (link.kind === 'error') {
      setLinkError(t(link.reason === 'expired' ? 'errors:auth.reset_link_expired' : 'errors:auth.reset_link_invalid'))
      return
    }
    // The client may finish reading the link just after mount.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (live && session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) setReady(true)
    })
    const check = link.kind === 'code'
      ? supabase.auth.exchangeCodeForSession(link.code).then(({ data, error }) => !error && !!data?.session)
      : supabase.auth.getSession().then(({ data: { session } }) => !!session)
    check
      .catch(() => false)
      .then((ok) => {
        if (!live) return
        if (ok) setReady(true)
        else setLinkError(t('errors:auth.reset_link_invalid'))
      })
    return () => { live = false; sub?.subscription?.unsubscribe() }
    // Runs once on mount: this reads the reset link, and re-running it
    // because `t` changed identity on a locale switch would be pointless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError(t('errors:auth.passwords_mismatch')); return }
    if (password.length < 6) { setError(t('errors:auth.password_too_short')); return }
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err) {
      setError(err.message || t('errors:auth.generic_retry'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center mb-8">
          <img src="/logo-mark.png" alt="My Book Lab" className="w-16 h-16 mx-auto mb-4 rounded-xl" />
          <h1 className="font-heading text-2xl font-bold text-galaxy-text">{t('auth:reset_password.title')}</h1>
          <p className="text-galaxy-text-muted font-body text-sm mt-1">
            {t('auth:reset_password.subtitle')}
          </p>
        </div>

        {linkError && !ready ? (
          <div role="alert" className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 text-center space-y-4">
            <p className="text-galaxy-text font-body text-sm">{linkError}</p>
            <Link
              to="/login?reset=1"
              className="inline-block px-4 py-2.5 rounded-xl font-body font-bold text-sm text-white btn-fill-primary"
            >
              {t('auth:reset_password.send_new_link')}
            </Link>
          </div>
        ) : done ? (
          <div className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 text-center space-y-3">
            <CheckCircle size={40} className="mx-auto text-green-400" />
            <p className="text-galaxy-text font-body font-semibold">{t('auth:reset_password.done_title')}</p>
            <p className="text-galaxy-text-muted font-body text-sm">{t('auth:reset_password.redirecting')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-4">
            <div className="space-y-1">
              <label className="text-galaxy-text-muted text-sm font-body font-semibold">{t('auth:fields.new_password_label')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-galaxy-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-3 glass border border-white/15 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-primary focus:outline-none font-body"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-galaxy-text-muted hover:text-galaxy-text transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-galaxy-text-muted text-sm font-body font-semibold">{t('auth:fields.confirm_password_label')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-galaxy-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-3 glass border border-white/15 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-primary focus:outline-none font-body"
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-sm font-body">{error}</p>}

            <button
              type="submit"
              disabled={loading || !ready || !password || !confirm}
              className="w-full py-3 rounded-xl font-body font-bold text-white btn-fill-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('auth:reset_password.submitting') : t('auth:reset_password.submit')}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}

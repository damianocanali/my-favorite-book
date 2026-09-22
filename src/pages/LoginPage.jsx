import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTranslation, Trans } from 'react-i18next'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import { supabase } from '../lib/supabase'
import OAuthButtons from '../components/auth/OAuthButtons'
import { authErrorCode } from '../lib/authErrors'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const signIn = useAuthStore((s) => s.signIn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(searchParams.get('reset') === '1')
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { user } = await signIn(email.trim(), password)
      const role = user?.user_metadata?.role
      navigate(role === 'teacher' ? '/teacher' : '/', { replace: true })
    } catch (err) {
      setError(t(`errors:auth.${authErrorCode(err)}`))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!resetEmail.trim()) { setResetError(t('errors:auth.email_required')); return }
    if (!supabase) { setResetError(t('errors:auth.not_configured')); return }
    setResetLoading(true)
    setResetError('')
    try {
      // VITE_API_BASE_URL may be empty in dev; fall back to the live origin
      // so the reset link always lands on the same site the user is on.
      const origin = (typeof window !== 'undefined' && window.location?.origin) || ''
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${origin}/reset-password`,
      })
      if (error) throw error
      setResetSent(true)
    } catch (err) {
      setResetError(err.message || t('errors:auth.generic_retry'))
    } finally {
      setResetLoading(false)
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
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="My Book Lab" className="w-16 h-16 mx-auto mb-4 rounded-xl" />
          <h1 className="font-heading text-2xl font-bold text-galaxy-text">{t('auth:sign_in.title')}</h1>
          <p className="text-galaxy-text-muted font-body text-sm mt-1">
            {t('auth:sign_in.subtitle')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-4">
          <div className="space-y-1">
            <label className="text-galaxy-text-muted text-sm font-body font-semibold">{t('auth:fields.email_label')}</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-galaxy-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t('auth:fields.email_placeholder')}
                className="w-full pl-9 pr-4 py-3 glass border border-white/15 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-primary focus:outline-none font-body"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-galaxy-text-muted text-sm font-body font-semibold">{t('auth:fields.password_label')}</label>
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

          {error && <p className="text-red-400 text-sm font-body">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl font-body font-bold text-white btn-fill-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t('auth:sign_in.submitting') : t('auth:sign_in.submit')}
          </button>

          <button
            type="button"
            onClick={() => { setShowReset(true); setResetEmail(email) }}
            className="w-full text-center text-galaxy-text-muted text-sm font-body hover:text-galaxy-primary transition-colors"
          >
            {t('auth:shared.forgot_password')}
          </button>

          <OAuthButtons />
        </form>

        {/* Password reset form */}
        {showReset && (
          <motion.div
            className="mt-4 glass rounded-2xl p-6 border border-galaxy-text-muted/10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {resetSent ? (
              <div className="text-center space-y-3">
                <CheckCircle size={40} className="text-green-400 mx-auto" />
                <h3 className="font-heading text-lg font-bold text-galaxy-text">{t('auth:reset_request.sent_title')}</h3>
                <p className="text-galaxy-text-muted font-body text-sm">
                  <Trans
                    i18nKey="auth:reset_request.sent_body"
                    values={{ email: resetEmail }}
                    components={{ email: <span className="text-galaxy-text font-semibold" /> }}
                  />
                </p>
                <button
                  onClick={() => { setShowReset(false); setResetSent(false) }}
                  className="text-galaxy-primary text-sm font-body font-semibold hover:underline"
                >
                  {t('auth:reset_request.back_to_sign_in')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base font-bold text-galaxy-text">{t('auth:reset_request.title')}</h3>
                  <button
                    type="button"
                    onClick={() => setShowReset(false)}
                    className="text-galaxy-text-muted hover:text-galaxy-text transition-colors"
                  >
                    <ArrowLeft size={16} />
                  </button>
                </div>
                <p className="text-galaxy-text-muted font-body text-xs">
                  {t('auth:reset_request.hint')}
                </p>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-galaxy-text-muted" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    placeholder={t('auth:fields.email_placeholder')}
                    className="w-full pl-9 pr-4 py-3 glass border border-white/15 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-primary focus:outline-none font-body"
                  />
                </div>
                {resetError && <p className="text-red-400 text-sm font-body">{resetError}</p>}
                <button
                  type="submit"
                  disabled={resetLoading || !resetEmail.trim()}
                  className="w-full py-3 rounded-xl font-body font-bold text-white btn-fill-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resetLoading ? t('auth:reset_request.submitting') : t('auth:reset_request.submit')}
                </button>
              </form>
            )}
          </motion.div>
        )}

        <div className="text-center mt-4 space-y-2">
          <p className="text-galaxy-text-muted text-sm font-body">
            <Trans
              i18nKey="auth:sign_in.no_account"
              components={{
                signup: <Link to="/signup" className="text-galaxy-primary hover:underline font-semibold" />,
              }}
            />
          </p>
          <Link to="/" className="text-galaxy-text-muted text-sm font-body hover:text-galaxy-text transition-colors block">
            {t('auth:shared.back_to_app')}
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTranslation, Trans } from 'react-i18next'
import { GraduationCap, Mail, Lock, User, Eye, EyeOff, CheckCircle, BookOpen } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import OAuthButtons from '../components/auth/OAuthButtons'
import { authErrorCode } from '../lib/authErrors'

export default function SignupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const signUp = useAuthStore((s) => s.signUp)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const [role, setRole] = useState(searchParams.get('role') === 'teacher' ? 'teacher' : 'student')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [existingAccount, setExistingAccount] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError(t('errors:auth.passwords_mismatch')); return }
    if (password.length < 6) { setError(t('errors:auth.password_too_short')); return }
    if (role === 'student' && !displayName.trim()) { setError(t('errors:auth.name_required')); return }
    setLoading(true)
    setError('')
    try {
      const result = await signUp(email.trim(), password, {
        role,
        display_name: role === 'student' ? displayName.trim() : '',
      })
      if (result?.status === 'already_registered') {
        // No email was sent — telling them to check their inbox would
        // leave them waiting for something that will never arrive.
        setExistingAccount(true)
        return
      }
      setSuccess(true)
    } catch (err) {
      setError(t(`errors:auth.${authErrorCode(err, { signingUp: true })}`))
    } finally {
      setLoading(false)
    }
  }

  // Supabase silently declines to re-send for an address that already has
  // an account, so send them where they can actually get in rather than
  // leaving them staring at an inbox.
  if (existingAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          className="text-center max-w-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Mail size={56} className="text-galaxy-primary mx-auto mb-4" />
          <h2 className="font-heading text-2xl font-bold text-galaxy-text mb-2">
            {t('auth:existing_account.title')}
          </h2>
          <p className="text-galaxy-text-muted font-body mb-6">
            {t('auth:existing_account.body', { email })}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/login"
              className="inline-block px-6 py-3 rounded-xl font-body font-bold text-white btn-fill-primary transition-colors"
            >
              {t('auth:shared.sign_in')}
            </Link>
            <Link
              to="/login?reset=1"
              className="font-body text-sm text-galaxy-text-muted hover:text-galaxy-text transition-colors"
            >
              {t('auth:shared.forgot_password')}
            </Link>
            <button
              onClick={() => { setExistingAccount(false); setEmail('') }}
              className="font-body text-sm text-galaxy-text-muted hover:text-galaxy-text transition-colors"
            >
              {t('auth:existing_account.use_different_email')}
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          className="text-center max-w-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <CheckCircle size={56} className="text-green-400 mx-auto mb-4" />
          <h2 className="font-heading text-2xl font-bold text-galaxy-text mb-2">
            {role === 'student' ? t('auth:sign_up.success_title_student') : t('auth:sign_up.success_title_teacher')}
          </h2>
          <p className="text-galaxy-text-muted font-body mb-6">
            {role === 'student'
              ? t('auth:sign_up.success_body_student', { name: displayName, email })
              : t('auth:sign_up.success_body_teacher', { email })}
          </p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 rounded-xl font-body font-bold text-white btn-fill-primary transition-colors"
          >
            {t('auth:sign_up.success_cta')}
          </Link>
        </motion.div>
      </div>
    )
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
        <div className="text-center mb-6">
          <img src="/logo.png" alt="My Book Lab" className="w-16 h-16 mx-auto mb-4 rounded-xl" />
          <h1 className="font-heading text-2xl font-bold text-galaxy-text">{t('auth:sign_up.title')}</h1>
          <p className="text-galaxy-text-muted font-body text-sm mt-1">{t('auth:sign_up.subtitle')}</p>
        </div>

        {/* Role toggle */}
        <div className="flex rounded-xl overflow-hidden border border-galaxy-text-muted/20 mb-5">
          <button
            type="button"
            onClick={() => { setRole('student'); setError('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-body font-semibold transition-colors ${
              role === 'student'
                ? 'bg-galaxy-primary text-white'
                : 'text-galaxy-text-muted hover:text-galaxy-text'
            }`}
          >
            <BookOpen size={15} /> {t('auth:sign_up.role_student')}
          </button>
          <button
            type="button"
            onClick={() => { setRole('teacher'); setError('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-body font-semibold transition-colors ${
              role === 'teacher'
                ? 'bg-galaxy-secondary text-white'
                : 'text-galaxy-text-muted hover:text-galaxy-text'
            }`}
          >
            <GraduationCap size={15} /> {t('auth:sign_up.role_teacher')}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-4">

          {/* Display name — students only */}
          {role === 'student' && (
            <div className="space-y-1">
              <label className="text-galaxy-text-muted text-sm font-body font-semibold">{t('auth:fields.display_name_label')}</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-galaxy-text-muted" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('auth:fields.display_name_placeholder')}
                  maxLength={30}
                  className="w-full pl-9 pr-4 py-3 glass border border-white/15 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-primary focus:outline-none font-body"
                />
              </div>
              <p className="text-galaxy-text-muted text-xs font-body">{t('auth:fields.display_name_hint')}</p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-galaxy-text-muted text-sm font-body font-semibold">
              {role === 'student' ? t('auth:fields.email_label_student') : t('auth:fields.email_label')}
            </label>
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
                placeholder={t('auth:fields.password_placeholder_min')}
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
                placeholder={t('auth:fields.confirm_password_placeholder')}
                className="w-full pl-9 pr-4 py-3 glass border border-white/15 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-primary focus:outline-none font-body"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm font-body">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !password || !confirm}
            className={`w-full py-3 rounded-xl font-body font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              role === 'teacher'
                ? 'bg-galaxy-secondary hover:bg-galaxy-secondary/90'
                : 'btn-fill-primary'
            }`}
          >
            {loading ? t('auth:sign_up.submitting') : t('auth:sign_up.submit')}
          </button>

          <OAuthButtons label={t('auth:oauth.divider_sign_up')} />
        </form>

        <div className="text-center mt-4 space-y-2">
          <p className="text-galaxy-text-muted text-sm font-body">
            <Trans
              i18nKey="auth:sign_up.have_account"
              components={{
                signin: <Link to="/login" className="text-galaxy-primary hover:underline font-semibold" />,
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

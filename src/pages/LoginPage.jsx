import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTranslation, Trans } from 'react-i18next'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle, Users, GraduationCap } from 'lucide-react'
import { useAuthStore, selectIsTeacher } from '../stores/useAuthStore'
import { supabase } from '../lib/supabase'
import OAuthButtons from '../components/auth/OAuthButtons'
import Mascot from '../components/ui/Mascot'
import { authErrorCode } from '../lib/authErrors'
import { safeNext } from '../lib/safeNext'
import { readClassDevice, readClassDeviceSkip, clearClassDeviceSkip, classDeviceLabel, signedOutRedirect } from '../lib/classDevice'

// "Who's signing in?" chooser cards, in the fixed order the brief asks
// for: kid first (the destination with the worst discoverability before
// this redesign — it used to be a single link hiding at the very bottom of
// one shared email form, half-covered by the tab bar), then the two
// grown-up paths.
function useChooserCards(t) {
  return [
    {
      who: 'kid',
      title: t('auth:chooser.kid.title'),
      subtitle: t('auth:chooser.kid.subtitle'),
    },
    {
      who: 'family',
      title: t('auth:chooser.family.title'),
      subtitle: t('auth:chooser.family.subtitle'),
    },
    {
      who: 'teacher',
      title: t('auth:chooser.teacher.title'),
      subtitle: t('auth:chooser.teacher.subtitle'),
    },
  ]
}

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const signIn = useAuthStore((s) => s.signIn)
  const markClassroomOwner = useAuthStore((s) => s.markClassroomOwner)
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)
  // A class browser (a teacher set it up on the class page). Read once.
  const [classDevice] = useState(() => readClassDevice())

  // null = the chooser is showing. 'family' | 'teacher' = that choice's
  // form is showing. 'kid' never lands here — choosing it navigates
  // straight to /class. Nothing about the choice is remembered: the next
  // person on a shared device always starts at the chooser.
  const [who, setWho] = useState(null)
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

  // On a class browser, signed out: straight to the class's name list —
  // unless "Not in <class>?" sent them here for the chooser (?choose=1).
  useEffect(() => {
    if (authLoading) return
    const to = signedOutRedirect({
      device: classDevice,
      signedIn: !!user,
      choose: searchParams.get('choose') === '1',
      skip: readClassDeviceSkip(),
      next: safeNext(searchParams.get('next')),
    })
    if (to) navigate(to, { replace: true })
    // Once auth has settled; not on every later sign-in/out on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  function handleChoose(choice) {
    // `next` is never forwarded for 'kid': a child always lands on
    // /bookshelf (ClassSignInPage's own post-sign-in redirect). On a class
    // browser, ?other=1 asks /class for the code step instead of this
    // browser's own class.
    if (choice === 'kid') { navigate(classDevice ? '/class?other=1' : '/class'); return }
    setWho(choice)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { user } = await signIn(email.trim(), password)
      // A same-site `?next=` (ProtectedRoute's redirect-back, e.g. someone
      // who typed /teacher signed out) always wins over the role-based
      // default.
      const next = safeNext(searchParams.get('next'))
      if (who === 'teacher') {
        // Best-effort, same as this call's other two sites (TeacherPage,
        // AccountPage): swallow a failure rather than block navigation on
        // it — the sign-in itself already succeeded.
        markClassroomOwner().catch(() => {})
        navigate(next || '/teacher', { replace: true })
        return
      }
      // Chosen "Parent or family", but selectIsTeacher — not just the
      // sign-up "teacher" role — still sends an existing class owner
      // straight to /teacher, same as before this chooser existed.
      navigate(next || (selectIsTeacher({ user }) ? '/teacher' : '/'), { replace: true })
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

  const cards = useChooserCards(t)

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {who === null ? (
          <>
            {/* Header */}
            {classDevice && (
              <button
                type="button"
                onClick={() => {
                  // Back to the class list, which is home again for this tab.
                  clearClassDeviceSkip()
                  navigate('/class')
                }}
                className="mb-4 min-h-[44px] inline-flex items-center gap-1.5 px-4 rounded-full bg-white/[0.08] text-galaxy-text font-body font-semibold hover:bg-white/[0.12] transition-colors"
              >
                <ArrowLeft size={16} aria-hidden="true" /> {t('auth:chooser.back_to_class', { name: classDeviceLabel(classDevice) })}
              </button>
            )}
            <div className="text-center mb-8">
              <img src="/logo-mark.png" alt="My Book Lab" className="w-16 h-16 mx-auto mb-4 rounded-xl" />
              <h1 className="font-heading text-2xl font-bold text-galaxy-text">{t('auth:chooser.heading')}</h1>
            </div>

            <div className="space-y-3">
              {cards.map((card) => (
                <button
                  key={card.who}
                  type="button"
                  onClick={() => handleChoose(card.who)}
                  className={`w-full min-h-[120px] flex items-center gap-4 p-4 rounded-2xl border transition-all text-left active:scale-[0.99] ${
                    card.who === 'kid'
                      ? 'glass border-galaxy-primary/30 bg-gradient-to-br from-galaxy-primary/15 to-galaxy-secondary/15 hover:border-galaxy-primary/60'
                      : 'glass border-galaxy-text-muted/10 hover:border-galaxy-primary/40 hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="shrink-0 flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.06] overflow-hidden">
                    {card.who === 'kid' && <Mascot mood="wave" size={56} />}
                    {card.who === 'family' && <Users size={30} className="text-galaxy-primary" aria-hidden="true" />}
                    {card.who === 'teacher' && <GraduationCap size={30} className="text-galaxy-secondary" aria-hidden="true" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-heading text-lg font-bold text-galaxy-text">{card.title}</span>
                    <span className="block font-body text-sm text-galaxy-text-muted">{card.subtitle}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-8">
              <img src="/logo-mark.png" alt="My Book Lab" className="w-16 h-16 mx-auto mb-4 rounded-xl" />
              <h1 className="font-heading text-2xl font-bold text-galaxy-text">
                {who === 'teacher' ? t('auth:chooser.teacher.form_title') : t('auth:sign_in.title')}
              </h1>
              <p className="text-galaxy-text-muted font-body text-sm mt-1">
                {who === 'teacher' ? t('auth:chooser.teacher.form_subtitle') : t('auth:sign_in.subtitle')}
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
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
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
                    autoComplete="current-password"
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
              {who === 'teacher' ? (
                <Link
                  to="/signup?role=teacher"
                  className="text-galaxy-primary text-sm font-body font-semibold hover:underline block"
                >
                  {t('auth:chooser.teacher.signup_cta')}
                </Link>
              ) : (
                <p className="text-galaxy-text-muted text-sm font-body">
                  <Trans
                    i18nKey="auth:sign_in.no_account"
                    components={{
                      signup: <Link to="/signup" className="text-galaxy-primary hover:underline font-semibold" />,
                    }}
                  />
                </p>
              )}
              <button
                type="button"
                onClick={() => setWho(null)}
                className="text-galaxy-text-muted text-sm font-body hover:text-galaxy-text transition-colors block mx-auto"
              >
                {t('auth:chooser.choose_again')}
              </button>
              <Link to="/" className="text-galaxy-text-muted text-sm font-body hover:text-galaxy-text transition-colors block">
                {t('auth:shared.back_to_app')}
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

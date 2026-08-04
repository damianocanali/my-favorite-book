import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { GraduationCap, Mail, Lock, User, Eye, EyeOff, CheckCircle, BookOpen } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import OAuthButtons from '../components/auth/OAuthButtons'
import { friendlyAuthMessage } from '../lib/authErrors'

export default function SignupPage() {
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
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (role === 'student' && !displayName.trim()) { setError('Please enter your name.'); return }
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
      setError(friendlyAuthMessage(err, { signingUp: true }))
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
            You already have an account
          </h2>
          <p className="text-galaxy-text-muted font-body mb-6">
            {email} is already registered, so we didn&apos;t send a new
            confirmation email. Sign in instead — or reset your password if you
            can&apos;t remember it.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/login"
              className="inline-block px-6 py-3 rounded-xl font-body font-bold text-white btn-fill-primary transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/login?reset=1"
              className="font-body text-sm text-galaxy-text-muted hover:text-galaxy-text transition-colors"
            >
              Forgot your password?
            </Link>
            <button
              onClick={() => { setExistingAccount(false); setEmail('') }}
              className="font-body text-sm text-galaxy-text-muted hover:text-galaxy-text transition-colors"
            >
              Use a different email
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
            {role === 'student' ? '🎉 You\'re all set!' : 'Check your email'}
          </h2>
          <p className="text-galaxy-text-muted font-body mb-6">
            {role === 'student'
              ? `Welcome, ${displayName}! We sent a confirmation to ${email}. Once confirmed, you can sign in and start writing.`
              : `We sent a confirmation link to ${email}. Click it to activate your teacher account.`}
          </p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 rounded-xl font-body font-bold text-white btn-fill-primary transition-colors"
          >
            Go to Sign In
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
          <h1 className="font-heading text-2xl font-bold text-galaxy-text">Create an Account</h1>
          <p className="text-galaxy-text-muted font-body text-sm mt-1">Join the adventure!</p>
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
            <BookOpen size={15} /> Student / Parent
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
            <GraduationCap size={15} /> Teacher
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-4">

          {/* Display name — students only */}
          {role === 'student' && (
            <div className="space-y-1">
              <label className="text-galaxy-text-muted text-sm font-body font-semibold">Your Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-galaxy-text-muted" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should we call you?"
                  maxLength={30}
                  className="w-full pl-9 pr-4 py-3 glass border border-white/15 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-primary focus:outline-none font-body"
                />
              </div>
              <p className="text-galaxy-text-muted text-xs font-body">This will appear on your books</p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-galaxy-text-muted text-sm font-body font-semibold">
              {role === 'student' ? 'Email (parent\'s email is fine)' : 'Email'}
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-galaxy-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full pl-9 pr-4 py-3 glass border border-white/15 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-primary focus:outline-none font-body"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-galaxy-text-muted text-sm font-body font-semibold">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-galaxy-text-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 6 characters"
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
            <label className="text-galaxy-text-muted text-sm font-body font-semibold">Confirm Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-galaxy-text-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Repeat your password"
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
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <OAuthButtons label="or sign up with" />
        </form>

        <div className="text-center mt-4 space-y-2">
          <p className="text-galaxy-text-muted text-sm font-body">
            Already have an account?{' '}
            <Link to="/login" className="text-galaxy-primary hover:underline font-semibold">
              Sign in
            </Link>
          </p>
          <Link to="/" className="text-galaxy-text-muted text-sm font-body hover:text-galaxy-text transition-colors block">
            ← Back to the app
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

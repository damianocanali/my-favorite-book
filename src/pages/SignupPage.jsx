import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { GraduationCap, Mail, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'

export default function SignupPage() {
  const navigate = useNavigate()
  const signUp = useAuthStore((s) => s.signUp)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    setError('')
    try {
      await signUp(email.trim(), password)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
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
          <h2 className="font-heading text-2xl font-bold text-galaxy-text mb-2">Check your email</h2>
          <p className="text-galaxy-text-muted font-body mb-6">
            We sent a confirmation link to <span className="text-galaxy-text font-semibold">{email}</span>.
            Click the link to activate your teacher account.
          </p>
          <Link to="/login" className="text-galaxy-secondary hover:underline font-body text-sm">
            Back to login
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
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-galaxy-secondary/20 flex items-center justify-center border border-galaxy-secondary/30">
            <GraduationCap size={32} className="text-galaxy-secondary" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-galaxy-text">Create Teacher Account</h1>
          <p className="text-galaxy-text-muted font-body text-sm mt-1">
            For educators managing classrooms
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-4">

          <div className="space-y-1">
            <label className="text-galaxy-text-muted text-sm font-body font-semibold">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-galaxy-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@school.edu"
                className="w-full pl-9 pr-4 py-3 bg-galaxy-bg border border-galaxy-text-muted/20 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-secondary focus:outline-none font-body"
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
                className="w-full pl-9 pr-10 py-3 bg-galaxy-bg border border-galaxy-text-muted/20 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-secondary focus:outline-none font-body"
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
                className="w-full pl-9 pr-4 py-3 bg-galaxy-bg border border-galaxy-text-muted/20 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-secondary focus:outline-none font-body"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm font-body">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !password || !confirm}
            className="w-full py-3 rounded-xl font-body font-bold text-white bg-galaxy-secondary hover:bg-galaxy-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="text-center mt-4 space-y-2">
          <p className="text-galaxy-text-muted text-sm font-body">
            Already have an account?{' '}
            <Link to="/login" className="text-galaxy-secondary hover:underline">
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

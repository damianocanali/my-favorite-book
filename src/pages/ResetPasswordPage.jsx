import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase puts the session tokens in the URL hash after clicking the email link
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true)
      } else {
        setError('Invalid or expired reset link. Please request a new one.')
      }
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
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
          <img src="/logo.png" alt="My Book Lab" className="w-16 h-16 mx-auto mb-4 rounded-xl" />
          <h1 className="font-heading text-2xl font-bold text-galaxy-text">Set New Password</h1>
          <p className="text-galaxy-text-muted font-body text-sm mt-1">
            Choose a strong password for your account
          </p>
        </div>

        {done ? (
          <div className="bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-text-muted/10 text-center space-y-3">
            <CheckCircle size={40} className="mx-auto text-green-400" />
            <p className="text-galaxy-text font-body font-semibold">Password updated!</p>
            <p className="text-galaxy-text-muted font-body text-sm">Redirecting you to login…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-4">
            <div className="space-y-1">
              <label className="text-galaxy-text-muted text-sm font-body font-semibold">New Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-galaxy-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-3 bg-galaxy-bg border border-galaxy-text-muted/20 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-primary focus:outline-none font-body"
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
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-3 bg-galaxy-bg border border-galaxy-text-muted/20 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-primary focus:outline-none font-body"
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-sm font-body">{error}</p>}

            <button
              type="submit"
              disabled={loading || !ready || !password || !confirm}
              className="w-full py-3 rounded-xl font-body font-bold text-white bg-galaxy-primary hover:bg-galaxy-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  )
}

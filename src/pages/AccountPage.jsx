import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Trash2, LogOut, AlertTriangle, Loader2, Sparkles, CreditCard, ExternalLink } from 'lucide-react'
import { useAuthStore, selectDisplayName } from '../stores/useAuthStore'
import { useSubscription } from '../hooks/useSubscription'
import { apiFetchAuthed } from '../lib/api'
import { IS_NATIVE } from '../services/purchaseService'
import AvatarDisplay from '../components/avatar/AvatarDisplay'

export default function AccountPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const displayName = useAuthStore(selectDisplayName)

  const { planKey, isPaid, loading: subLoading } = useSubscription()
  const [confirmStep, setConfirmStep] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState(null)

  const handleManageSubscription = async () => {
    setPortalError(null)
    setPortalLoading(true)
    try {
      const res = await apiFetchAuthed('/api/customer-portal', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || `Couldn't open billing portal (${res.status})`)
      }
      window.location.href = data.url
    } catch (e) {
      setPortalError(e?.message || 'Failed to open billing portal. Please try again.')
      setPortalLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setError(null)
    try {
      const res = await apiFetchAuthed('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch((e) => { throw new Error(`Network error: ${e.message}`) })
      const data = await res.json().catch(() => { throw new Error(`Server error: ${res.status}`) })
      if (!data.deleted) throw new Error(data.error || 'Deletion failed')

      await signOut()
      navigate('/')
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.')
      setDeleting(false)
    }
  }

  // Redirect unauthenticated visitors. navigate() must run after render —
  // calling it inline logs a React warning about updating during render.
  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  if (!user) return null

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-galaxy-bg-light border border-galaxy-text-muted/20 rounded-3xl p-8"
        >
          {/* Avatar + name */}
          <div className="flex items-center gap-4 mb-8">
            <AvatarDisplay size={56} />
            <div>
              <h1 className="font-heading text-2xl font-bold text-galaxy-text">{displayName}</h1>
              <p className="text-galaxy-text-muted font-body text-sm">{user.email}</p>
            </div>
          </div>

          {/* Avatar customization */}
          <div className="border-b border-galaxy-text-muted/20 pb-6 mb-6">
            <h2 className="font-heading text-lg font-semibold text-galaxy-text mb-3">Profile</h2>
            <Link
              to="/avatar"
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-galaxy-text-muted/30 text-galaxy-text-muted hover:text-galaxy-text hover:border-galaxy-text-muted/60 transition-colors font-body text-sm w-fit"
            >
              <Sparkles size={16} />
              Customize my avatar
            </Link>
          </div>

          {/* Subscription */}
          {!subLoading && isPaid && (
            <div className="border-b border-galaxy-text-muted/20 pb-6 mb-6">
              <h2 className="font-heading text-lg font-semibold text-galaxy-text mb-1">Subscription</h2>
              <p className="text-galaxy-text-muted font-body text-sm mb-3">
                Current plan: <span className="text-galaxy-text font-semibold capitalize">{planKey}</span>
              </p>
              {IS_NATIVE ? (
                <p className="text-galaxy-text-muted font-body text-sm">
                  Manage or cancel your subscription in <span className="text-galaxy-text">Settings → Apple ID → Subscriptions</span>.
                </p>
              ) : (
                <>
                  <button
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-galaxy-text-muted/30 text-galaxy-text-muted hover:text-galaxy-text hover:border-galaxy-text-muted/60 transition-colors font-body text-sm disabled:opacity-60"
                  >
                    {portalLoading ? (
                      <><Loader2 size={15} className="animate-spin" /> Opening portal…</>
                    ) : (
                      <><CreditCard size={16} /> Manage subscription <ExternalLink size={13} className="opacity-60" /></>
                    )}
                  </button>
                  <p className="text-galaxy-text-muted font-body text-xs mt-2">
                    Update payment method, change plan, or cancel anytime via Stripe's secure portal.
                  </p>
                  {portalError && (
                    <p className="text-red-400 font-body text-sm mt-3">{portalError}</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Sign out */}
          <div className="border-b border-galaxy-text-muted/20 pb-6 mb-6">
            <h2 className="font-heading text-lg font-semibold text-galaxy-text mb-3">Session</h2>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-galaxy-text-muted/30 text-galaxy-text-muted hover:text-galaxy-text hover:border-galaxy-text-muted/60 transition-colors font-body text-sm"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>

          {/* Delete account */}
          <div>
            <h2 className="font-heading text-lg font-semibold text-galaxy-text mb-1">Danger Zone</h2>
            <p className="text-galaxy-text-muted font-body text-sm mb-4">
              Permanently delete your account and all your books. This cannot be undone.
            </p>

            {!confirmStep ? (
              <button
                onClick={() => setConfirmStep(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/70 transition-colors font-body text-sm"
              >
                <Trash2 size={16} />
                Delete my account
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5"
              >
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-body font-semibold text-red-300 text-sm mb-1">
                      Are you sure?
                    </p>
                    <p className="font-body text-galaxy-text-muted text-sm">
                      This will permanently delete your account, all your books, and cancel any active subscription. This action cannot be reversed.
                    </p>
                  </div>
                </div>

                {error && (
                  <p className="text-red-400 font-body text-sm mb-3">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setConfirmStep(false); setError(null) }}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 rounded-2xl border border-galaxy-text-muted/30 text-galaxy-text-muted hover:text-galaxy-text transition-colors font-body text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-colors font-body text-sm font-semibold disabled:opacity-60"
                  >
                    {deleting ? (
                      <><Loader2 size={15} className="animate-spin" /> Deleting...</>
                    ) : (
                      <><Trash2 size={15} /> Yes, delete everything</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

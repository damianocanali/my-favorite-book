import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Trash2, LogOut, AlertTriangle, Loader2, Sparkles, CreditCard, ExternalLink, Pencil, Check, X } from 'lucide-react'
import { useAuthStore, selectDisplayName } from '../stores/useAuthStore'
import { useSubscription } from '../hooks/useSubscription'
import { apiFetchAuthed } from '../lib/api'
import { IS_NATIVE } from '../services/purchaseService'
import AvatarDisplay from '../components/avatar/AvatarDisplay'
import { useRewardsStore } from '../stores/useRewardsStore'

export default function AccountPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const currentStreak = useRewardsStore((s) => s.currentStreak)
  const longestStreak = useRewardsStore((s) => s.longestStreak)
  const badges = useRewardsStore((s) => s.getBadges())
  const earnedCount = badges.filter((b) => b.earned).length
  const signOut = useAuthStore((s) => s.signOut)
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName)
  const displayName = useAuthStore(selectDisplayName)

  const { planKey, isPaid, loading: subLoading } = useSubscription()
  const [confirmStep, setConfirmStep] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [scheduled, setScheduled] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState(null)

  const startEditingName = () => {
    setNameDraft(displayName ?? '')
    setNameError(null)
    setEditingName(true)
  }
  const cancelEditingName = () => {
    setEditingName(false)
    setNameError(null)
  }
  const saveName = async () => {
    setSavingName(true)
    setNameError(null)
    try {
      await updateDisplayName(nameDraft)
      setEditingName(false)
    } catch (e) {
      setNameError(e?.message || 'Failed to update name')
    } finally {
      setSavingName(false)
    }
  }

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
      if (!data.scheduled) throw new Error(data.error || 'Could not schedule deletion')

      // Soft-delete: the account is scheduled, not gone. Keep the user signed
      // in during the grace window and show a confirmation.
      setScheduled(true)
      setConfirmStep(false)
      setDeleting(false)
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
          className="glass border border-galaxy-text-muted/20 rounded-3xl p-8"
        >
          {/* Avatar + name */}
          <div className="flex items-center gap-4 mb-8">
            <AvatarDisplay size={56} />
            <div className="min-w-0 flex-1">
              {editingName ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !savingName) saveName()
                        if (e.key === 'Escape') cancelEditingName()
                      }}
                      autoFocus
                      maxLength={60}
                      placeholder="Your name"
                      className="flex-1 min-w-0 px-3 py-2 glass border border-white/15 rounded-lg text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-primary focus:outline-none font-heading text-xl font-bold"
                    />
                    <button
                      onClick={saveName}
                      disabled={savingName || !nameDraft.trim()}
                      title="Save"
                      className="p-2 rounded-lg text-green-400 hover:bg-green-400/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingName ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    </button>
                    <button
                      onClick={cancelEditingName}
                      disabled={savingName}
                      title="Cancel"
                      className="p-2 rounded-lg text-galaxy-text-muted hover:bg-galaxy-text-muted/10 disabled:opacity-40 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {nameError && <p className="text-red-400 text-xs font-body">{nameError}</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="font-heading text-2xl font-bold text-galaxy-text truncate">{displayName}</h1>
                  <button
                    onClick={startEditingName}
                    title="Edit name"
                    className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text hover:bg-galaxy-text-muted/10 transition-colors flex-shrink-0"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              )}
              <p className="text-galaxy-text-muted font-body text-sm truncate">{user.email}</p>
            </div>
          </div>

          {/* Writing streak + badges — the iOS app has shown these since
              2.1, so the same account looked emptier on the web. */}
          <div className="border-b border-galaxy-text-muted/20 pb-6 mb-6">
            <h2 className="font-heading text-lg font-semibold text-galaxy-text mb-3">
              Writing streak
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-4xl" aria-hidden>🔥</span>
              <div className="min-w-0">
                <p className="font-heading text-xl font-bold text-galaxy-text">
                  {currentStreak === 1 ? '1 day' : `${currentStreak} days`} in a row
                </p>
                <p className="text-galaxy-text-muted font-body text-sm">
                  {currentStreak > 0
                    ? `Write a little every day to keep it going! Best: ${longestStreak}`
                    : 'Write something today to start a streak!'}
                </p>
              </div>
            </div>

            {earnedCount > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {badges
                  .filter((b) => b.earned)
                  .map((b) => (
                    <span
                      key={b.id}
                      title={`${b.label} — ${b.description}`}
                      className="inline-flex items-center gap-1.5 rounded-full glass border border-galaxy-text-muted/20 px-3 py-1.5 text-sm font-body"
                    >
                      <span aria-hidden>{b.emoji}</span>
                      <span className="text-galaxy-text">{b.label}</span>
                    </span>
                  ))}
              </div>
            )}
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
              Delete your account and all your books. You'll have 7 days to change your mind before it becomes permanent.
            </p>

            {scheduled ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
                <p className="font-body text-green-300 text-sm">
                  Your account is scheduled for deletion in 7 days. You can still change your mind during that window — nothing is removed until then.
                </p>
              </div>
            ) : !confirmStep ? (
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
                      This schedules your account, all your books, and any active subscription for deletion in 7 days. You can change your mind during that window.
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
                      <><Loader2 size={15} className="animate-spin" /> Scheduling...</>
                    ) : (
                      <><Trash2 size={15} /> Schedule deletion</>
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

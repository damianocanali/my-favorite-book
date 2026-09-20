import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTranslation, Trans } from 'react-i18next'
import { Trash2, LogOut, AlertTriangle, Loader2, Sparkles, CreditCard, ExternalLink, Pencil, Check, X } from 'lucide-react'
import { useAuthStore, selectDisplayName } from '../stores/useAuthStore'
import { useSubscription } from '../hooks/useSubscription'
import { apiFetchAuthed } from '../lib/api'
import { IS_NATIVE } from '../services/purchaseService'
import AvatarDisplay from '../components/avatar/AvatarDisplay'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'
import { useRewardsStore, BADGE_DEFINITIONS } from '../stores/useRewardsStore'
import FeelingConstellation from '../components/ui/FeelingConstellation'
import { formatDate, formatNumber } from '../i18n/formats'

// Mirrors GRACE_DAYS in lib/deleteUser.js. Duplicated rather than imported:
// that module is server-side and would drag its Supabase deps into the
// browser bundle just to read one number.
const GRACE_DAYS = 7

export default function AccountPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)
  const currentStreak = useRewardsStore((s) => s.currentStreak)
  const longestStreak = useRewardsStore((s) => s.longestStreak)
  // Select the stored array, then derive. Calling s.getBadges() inside the
  // selector built a fresh array of fresh objects on every store read, so
  // zustand's Object.is check never matched and the component re-rendered
  // forever — which is what crashed this page into the error boundary.
  const earnedBadges = useRewardsStore((s) => s.earnedBadges)
  const earnedList = useMemo(
    () => BADGE_DEFINITIONS.filter((b) => earnedBadges.includes(b.id)),
    [earnedBadges]
  )
  const signOut = useAuthStore((s) => s.signOut)
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName)
  const displayName = useAuthStore(selectDisplayName)

  const { planKey, isPaid, loading: subLoading } = useSubscription()
  const [confirmStep, setConfirmStep] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [scheduled, setScheduled] = useState(false)
  const [scheduledFor, setScheduledFor] = useState(null)
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
      setNameError(e?.message || t('account:name.error_generic'))
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
        throw new Error(data?.error || t('account:subscription.portal_open_failed', { status: res.status }))
      }
      window.location.href = data.url
    } catch (e) {
      setPortalError(e?.message || t('account:subscription.portal_error_generic'))
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
      }).catch((e) => { throw new Error(t('account:errors.network', { message: e.message })) })
      const data = await res.json().catch(() => { throw new Error(t('account:errors.server', { status: res.status })) })
      if (!data.scheduled) throw new Error(data.error || t('account:danger.schedule_failed'))

      // Soft-delete: the account is scheduled, not gone. Keep the user signed
      // in during the grace window and show a confirmation.
      setScheduledFor(data.scheduled_for ?? null)
      setScheduled(true)
      setConfirmStep(false)
      setDeleting(false)
    } catch (e) {
      setError(e.message || t('account:danger.error_generic'))
      setDeleting(false)
    }
  }

  // Redirect unauthenticated visitors. navigate() must run after render —
  // calling it inline logs a React warning about updating during render.
  useEffect(() => {
    // Wait for the session to hydrate. On a fresh load `user` is null for
    // a moment, and redirecting on that sent already-signed-in people to
    // the sign-in page after every refresh.
    if (!authLoading && !user) navigate('/login', { replace: true })
  }, [authLoading, user, navigate])

  if (authLoading) return null
  if (!user) return null

  // The API returns the exact purge date; fall back to the grace-period
  // wording if an older deployment omits it.
  const scheduledForLabel = formatDate(scheduledFor, 'long')

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
                      placeholder={t('account:name.placeholder')}
                      className="flex-1 min-w-0 px-3 py-2 glass border border-white/15 rounded-lg text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-primary focus:outline-none font-heading text-xl font-bold"
                    />
                    <button
                      onClick={saveName}
                      disabled={savingName || !nameDraft.trim()}
                      title={t('common:actions.save')}
                      className="p-2 rounded-lg text-green-400 hover:bg-green-400/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingName ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    </button>
                    <button
                      onClick={cancelEditingName}
                      disabled={savingName}
                      title={t('common:actions.cancel')}
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
                    title={t('account:name.edit')}
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
              {t('account:streak.title')}
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-4xl" aria-hidden>🔥</span>
              <div className="min-w-0">
                <p className="font-heading text-xl font-bold text-galaxy-text">
                  {t('account:streak.days', { count: currentStreak })}
                </p>
                <p className="text-galaxy-text-muted font-body text-sm">
                  {currentStreak > 0
                    ? t('account:streak.keep_going', { count: longestStreak, best: formatNumber(longestStreak) })
                    : t('account:streak.empty')}
                </p>
              </div>
            </div>

            {earnedList.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {earnedList
                  .map((b) => (
                    <span
                      key={b.id}
                      title={t('account:badges.tooltip', { label: b.label, description: b.description })}
                      className="inline-flex items-center gap-1.5 rounded-full glass border border-galaxy-text-muted/20 px-3 py-1.5 text-sm font-body"
                    >
                      <span aria-hidden>{b.emoji}</span>
                      <span className="text-galaxy-text">{b.label}</span>
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* The child's own check-in history, as stars rather than a score. */}
          <div className="border-b border-galaxy-text-muted/20 pb-6 mb-6">
            <FeelingConstellation />
          </div>

          {/* Avatar customization */}
          <div className="border-b border-galaxy-text-muted/20 pb-6 mb-6">
            <h2 className="font-heading text-lg font-semibold text-galaxy-text mb-3">{t('account:profile.title')}</h2>
            <Link
              to="/avatar"
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-galaxy-text-muted/30 text-galaxy-text-muted hover:text-galaxy-text hover:border-galaxy-text-muted/60 transition-colors font-body text-sm w-fit"
            >
              <Sparkles size={16} />
              {t('account:profile.customize_avatar')}
            </Link>
          </div>

          {/* Language */}
          <div className="border-b border-galaxy-text-muted/20 pb-6 mb-6">
            <h2 className="font-heading text-lg font-semibold text-galaxy-text mb-3">{t('account:language.title')}</h2>
            <LanguageSwitcher id="account-language" hideLabel />
          </div>

          {/* Subscription */}
          {!subLoading && isPaid && (
            <div className="border-b border-galaxy-text-muted/20 pb-6 mb-6">
              <h2 className="font-heading text-lg font-semibold text-galaxy-text mb-1">{t('account:subscription.title')}</h2>
              <p className="text-galaxy-text-muted font-body text-sm mb-3">
                <Trans
                  i18nKey="account:subscription.current_plan"
                  values={{ name: planKey }}
                  components={{ plan: <span className="text-galaxy-text font-semibold capitalize" /> }}
                />
              </p>
              {IS_NATIVE ? (
                <p className="text-galaxy-text-muted font-body text-sm">
                  <Trans
                    i18nKey="account:subscription.native_manage"
                    components={{ path: <span className="text-galaxy-text" /> }}
                  />
                </p>
              ) : (
                <>
                  <button
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-galaxy-text-muted/30 text-galaxy-text-muted hover:text-galaxy-text hover:border-galaxy-text-muted/60 transition-colors font-body text-sm disabled:opacity-60"
                  >
                    {portalLoading ? (
                      <><Loader2 size={15} className="animate-spin" /> {t('account:subscription.opening_portal')}</>
                    ) : (
                      <><CreditCard size={16} /> {t('account:subscription.manage')} <ExternalLink size={13} className="opacity-60" /></>
                    )}
                  </button>
                  <p className="text-galaxy-text-muted font-body text-xs mt-2">
                    {t('account:subscription.portal_hint')}
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
            <h2 className="font-heading text-lg font-semibold text-galaxy-text mb-3">{t('account:session.title')}</h2>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-galaxy-text-muted/30 text-galaxy-text-muted hover:text-galaxy-text hover:border-galaxy-text-muted/60 transition-colors font-body text-sm"
            >
              <LogOut size={16} />
              {t('account:session.sign_out')}
            </button>
          </div>

          {/* Delete account */}
          <div>
            <h2 className="font-heading text-lg font-semibold text-galaxy-text mb-1">{t('account:danger.title')}</h2>
            <p className="text-galaxy-text-muted font-body text-sm mb-4">
              {t('account:danger.description', { count: GRACE_DAYS })}
            </p>

            {scheduled ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
                <p className="font-body text-green-300 text-sm">
                  {scheduledForLabel
                    ? t('account:danger.scheduled_on', { date: scheduledForLabel })
                    : t('account:danger.scheduled_in_days', { count: GRACE_DAYS })}
                </p>
              </div>
            ) : !confirmStep ? (
              <button
                onClick={() => setConfirmStep(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/70 transition-colors font-body text-sm"
              >
                <Trash2 size={16} />
                {t('account:danger.delete_button')}
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
                      {t('account:danger.confirm_title')}
                    </p>
                    <p className="font-body text-galaxy-text-muted text-sm">
                      {t('account:danger.confirm_body', { count: GRACE_DAYS })}
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
                    {t('common:actions.cancel')}
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-colors font-body text-sm font-semibold disabled:opacity-60"
                  >
                    {deleting ? (
                      <><Loader2 size={15} className="animate-spin" /> {t('account:danger.scheduling')}</>
                    ) : (
                      <><Trash2 size={15} /> {t('account:danger.confirm_button')}</>
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

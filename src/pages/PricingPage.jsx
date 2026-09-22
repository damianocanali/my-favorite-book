import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTranslation, Trans } from 'react-i18next'
import { Check, Sparkles, GraduationCap, BookOpen, RotateCcw } from 'lucide-react'

const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
import { useAuthStore } from '../stores/useAuthStore'
import { useSubscription } from '../hooks/useSubscription'
import { PRICES, formatPlanPrice, formatMonthlyEquivalent } from '../lib/plans'
import { apiFetchAuthed } from '../lib/api'
import SparkleButton from '../components/ui/SparkleButton'
import ParentalGate from '../components/ui/ParentalGate'
import { IS_NATIVE, purchasePackage, restorePurchases } from '../services/purchaseService'

// Feature bullets are catalogue keys, not English sentences. They used to be
// arrays of copy used directly as React `key={f}` — translating the copy then
// silently rekeys every <li> and remounts the list.
const FREE_FEATURES = [
  'pricing:plans.free.features.one_book',
  'pricing:plans.free.features.story_buddy',
  'pricing:plans.free.features.illustrations',
  'pricing:plans.free.features.themes',
  'pricing:plans.free.features.read_aloud',
  'pricing:plans.free.features.classroom_submit',
]

const FAMILY_FEATURES = [
  'pricing:plans.family.features.unlimited_books',
  'pricing:plans.family.features.unlimited_story_buddy',
  'pricing:plans.family.features.unlimited_illustrations',
  'pricing:plans.family.features.pdf_export',
  'pricing:plans.family.features.accessibility',
  'pricing:plans.family.features.priority_support',
]

const TEACHER_FEATURES = [
  'pricing:plans.teacher.features.everything_in_family',
  'pricing:plans.teacher.features.manage_classrooms',
  'pricing:plans.teacher.features.collect_submissions',
  'pricing:plans.teacher.features.view_books',
  'pricing:plans.teacher.features.free_trial',
  'pricing:plans.teacher.features.admin_dashboard',
]

// `isFree` and `interval` are passed explicitly rather than inferred from the
// display strings. Branching on copy (price !== 'Free') breaks the moment the
// copy is translated, and the break is silent — the card renders "/mese" next
// to a free plan.
function PlanCard({ icon: Icon, iconColor, title, badge, billingLabel, price, isFree = false, interval = 'monthly', monthlyEquivalent, features, cta, onCta, current, highlight, loading, disabled }) {
  const { t } = useTranslation()

  return (
    <motion.div
      className={`relative flex flex-col rounded-3xl p-6 sm:p-8 border transition-all ${
        highlight
          ? 'border-galaxy-primary/60 bg-galaxy-primary/10 shadow-glow'
          : 'border-galaxy-text-muted/20 glass'
      }`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-galaxy-primary text-white text-xs font-body font-bold uppercase tracking-wider whitespace-nowrap">
          {badge}
        </div>
      )}

      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${highlight ? 'bg-galaxy-primary/20' : 'bg-galaxy-bg'}`}>
        <Icon size={24} className={iconColor} />
      </div>

      <h3 className="font-heading text-2xl font-bold text-galaxy-text mb-1">{title}</h3>
      <p className="text-galaxy-text-muted font-body text-sm mb-4">{billingLabel}</p>

      <div className="mb-1">
        <span className="font-heading text-4xl font-bold text-galaxy-text">{price}</span>
        {!isFree && (
          <span className="text-galaxy-text-muted font-body text-sm ml-1">
            {interval === 'annual' ? t('pricing:interval.per_year') : t('pricing:interval.per_month')}
          </span>
        )}
      </div>
      {monthlyEquivalent && (
        <p className="text-galaxy-secondary font-body text-sm mb-4">{monthlyEquivalent}</p>
      )}

      <ul className="space-y-2.5 mb-8 flex-1 mt-4">
        {features.map((featureKey) => (
          <li key={featureKey} className="flex items-start gap-2 text-galaxy-text font-body text-sm">
            <Check size={16} className={`mt-0.5 shrink-0 ${highlight ? 'text-galaxy-primary' : 'text-galaxy-secondary'}`} />
            {t(featureKey)}
          </li>
        ))}
      </ul>

      {current ? (
        <div className="text-center text-galaxy-text-muted font-body text-sm py-3 border border-galaxy-text-muted/20 rounded-2xl">
          {t('pricing:card.current_plan')}
        </div>
      ) : (
        <SparkleButton
          onClick={onCta}
          variant={highlight ? 'primary' : 'secondary'}
          size="default"
          className="w-full"
          disabled={disabled || loading}
        >
          {loading ? t('pricing:card.starting_checkout') : cta}
        </SparkleButton>
      )}
    </motion.div>
  )
}

export default function PricingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const { planKey, loading } = useSubscription()
  const [billing, setBilling] = useState('monthly')
  const [showGate, setShowGate] = useState(null) // null or plan name
  const [upgrading, setUpgrading] = useState(null) // plan currently being processed
  const [upgradeError, setUpgradeError] = useState(null)

  const handleUpgradeClick = (planName) => {
    setUpgradeError(null)
    if (!user) {
      navigate('/signup')
      return
    }
    setShowGate(planName)
  }

  const handleUpgrade = async (planName) => {
    setShowGate(null)
    setUpgradeError(null)
    setUpgrading(planName)

    try {
      if (IS_NATIVE) {
        try {
          await purchasePackage(planName, billing)
          setTimeout(() => window.location.reload(), 1500)
        } catch (e) {
          const cancelled = e?.userCancelled || /cancell?ed/i.test(e?.message || '')
          if (!cancelled) throw e
        }
        return
      }

      const res = await apiFetchAuthed('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName, billing }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.url) {
        // The env var names are wire identifiers, not copy — they are
        // interpolated in so translation can move them but never rename them.
        const msg = data?.error
          || t('pricing:errors.checkout_failed', {
            status: res.status,
            secretVar: 'STRIPE_SECRET_KEY',
            priceVar: `STRIPE_PRICE_${planName.toUpperCase()}_${billing.toUpperCase()}`,
          })
        throw new Error(msg)
      }

      window.location.href = data.url
    } catch (e) {
      // Surface the real error in the UI instead of a silent reject, which
      // is what you hit if the Stripe env vars aren't wired up or the
      // auth token didn't attach.
      console.error('[upgrade]', e)
      setUpgradeError(e?.message || t('pricing:errors.upgrade_failed'))
    } finally {
      setUpgrading(null)
    }
  }

  const handleRestore = async () => {
    try {
      await restorePurchases()
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      alert(e.message || t('pricing:errors.restore_failed'))
    }
  }

  const familyPrice = billing === 'annual' ? PRICES.family.annual : PRICES.family.monthly
  const teacherPrice = billing === 'annual' ? PRICES.teacher.annual : PRICES.teacher.monthly
  const billingLabel = billing === 'annual'
    ? t('pricing:card.billed_annually')
    : t('pricing:card.billed_monthly')

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-galaxy-text mb-3">
            {t('pricing:page.title')}
          </h1>
          <p className="text-galaxy-text-muted font-body text-xl">
            {t('pricing:page.subtitle')}
          </p>
        </motion.div>

        {/* Billing toggle */}
        <motion.div
          className="flex items-center justify-center gap-3 mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={() => setBilling('monthly')}
            className={`px-4 py-2 rounded-full font-body text-sm font-semibold transition-all ${
              billing === 'monthly'
                ? 'bg-galaxy-primary text-white'
                : 'text-galaxy-text-muted hover:text-galaxy-text'
            }`}
          >
            {t('pricing:billing.monthly')}
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-4 py-2 rounded-full font-body text-sm font-semibold transition-all ${
              billing === 'annual'
                ? 'bg-galaxy-primary text-white'
                : 'text-galaxy-text-muted hover:text-galaxy-text'
            }`}
          >
            {t('pricing:billing.annual')}
            <span className="ml-2 text-xs text-galaxy-secondary font-bold">{t('pricing:billing.annual_save')}</span>
          </button>
        </motion.div>

        {/* Upgrade error banner */}
        {upgradeError && (
          <motion.div
            className="max-w-2xl mx-auto mb-6 rounded-2xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-red-200 font-body text-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="flex-1">{upgradeError}</p>
              <button
                onClick={() => setUpgradeError(null)}
                className="text-red-200/70 hover:text-red-100 text-xs font-bold shrink-0"
                aria-label={t('pricing:errors.dismiss_aria')}
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PlanCard
            icon={BookOpen}
            iconColor="text-galaxy-text-muted"
            title={t('pricing:plans.free.name')}
            billingLabel={t('pricing:plans.free.billing_label')}
            price={t('pricing:plans.free.price')}
            isFree
            features={FREE_FEATURES}
            cta={t('pricing:plans.free.cta')}
            onCta={() => navigate('/create')}
            current={!loading && planKey === 'free' && !!user}
          />

          <PlanCard
            icon={Sparkles}
            iconColor="text-galaxy-primary"
            title={t('pricing:plans.family.name')}
            badge={t('pricing:plans.family.badge')}
            billingLabel={billingLabel}
            interval={billing}
            price={formatPlanPrice(familyPrice)}
            monthlyEquivalent={billing === 'annual'
              ? t('pricing:card.monthly_equivalent', { price: formatMonthlyEquivalent(familyPrice) })
              : null}
            features={FAMILY_FEATURES}
            cta={t('pricing:plans.family.cta')}
            onCta={() => handleUpgradeClick('family')}
            current={!loading && planKey === 'family'}
            loading={upgrading === 'family'}
            disabled={!!upgrading && upgrading !== 'family'}
            highlight
          />

          <PlanCard
            icon={GraduationCap}
            iconColor="text-galaxy-secondary"
            title={t('pricing:plans.teacher.name')}
            billingLabel={billingLabel}
            interval={billing}
            price={formatPlanPrice(teacherPrice)}
            monthlyEquivalent={billing === 'annual'
              ? t('pricing:card.monthly_equivalent', { price: formatMonthlyEquivalent(teacherPrice) })
              : null}
            features={TEACHER_FEATURES}
            cta={t('pricing:plans.teacher.cta')}
            onCta={() => handleUpgradeClick('teacher')}
            current={!loading && planKey === 'teacher'}
            loading={upgrading === 'teacher'}
            disabled={!!upgrading && upgrading !== 'teacher'}
          />
        </div>

        {/* FAQ / reassurance */}
        <motion.div
          className="text-center mt-10 space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-galaxy-text-muted font-body text-sm">
            {IS_NATIVE
              ? t('pricing:footer.native_note')
              : t('pricing:footer.web_note')}
          </p>
          {IS_NATIVE && (
            <button
              onClick={handleRestore}
              className="flex items-center gap-1.5 mx-auto text-galaxy-text-muted font-body text-sm hover:text-galaxy-text transition-colors"
            >
              <RotateCcw size={14} />
              {t('pricing:footer.restore')}
            </button>
          )}
        </motion.div>

        {/* Subscription legal disclosure — required by App Store Review
            Guideline 3.1.2 for auto-renewable subscriptions. Must be visible
            at the point of purchase, and must include title, length, price,
            and links to Privacy Policy + Terms of Use (EULA). */}
        <motion.div
          className="max-w-3xl mx-auto mt-10 pt-8 border-t border-galaxy-text-muted/20 text-galaxy-text-muted font-body text-xs leading-relaxed space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="font-semibold text-galaxy-text">{t('pricing:legal.heading')}</p>
          <ul className="space-y-1.5 list-disc pl-5">
            <li>
              <Trans
                i18nKey="pricing:legal.family_terms"
                values={{
                  monthly: formatPlanPrice(PRICES.family.monthly),
                  annual: formatPlanPrice(PRICES.family.annual),
                }}
                components={{ name: <span className="text-galaxy-text" /> }}
              />
            </li>
            <li>
              <Trans
                i18nKey="pricing:legal.teacher_terms"
                values={{
                  monthly: formatPlanPrice(PRICES.teacher.monthly),
                  annual: formatPlanPrice(PRICES.teacher.annual),
                }}
                components={{ name: <span className="text-galaxy-text" /> }}
              />
            </li>
          </ul>
          <p>
            {t('pricing:legal.auto_renew')}
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <Link to="/privacy" className="underline hover:text-galaxy-text transition-colors">
              {t('pricing:legal.privacy_link')}
            </Link>
            <a
              href={APPLE_EULA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-galaxy-text transition-colors"
            >
              {t('pricing:legal.terms_link')}
            </a>
          </p>
        </motion.div>
      </div>

      {/* Parental gate — requires solving a math problem before checkout */}
      {showGate && (
        <ParentalGate
          onPass={() => handleUpgrade(showGate)}
          onClose={() => setShowGate(null)}
        />
      )}
    </div>
  )
}

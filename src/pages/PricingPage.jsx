import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check, Sparkles, GraduationCap, BookOpen } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'
import { useSubscription } from '../hooks/useSubscription'
import { PRICES } from '../lib/plans'
import { apiFetch } from '../lib/api'
import SparkleButton from '../components/ui/SparkleButton'
import ParentalGate from '../components/ui/ParentalGate'

const FREE_FEATURES = [
  '1 book total',
  '3 Story Buddy suggestions/day',
  '2 AI illustrations per day',
  'All themes & characters',
  'Read aloud & voice input',
  'Submit to classroom',
]

const FAMILY_FEATURES = [
  'Unlimited books',
  'Unlimited Story Buddy',
  'Unlimited AI illustrations',
  'PDF & print export',
  'All accessibility features',
  'Priority support',
]

const TEACHER_FEATURES = [
  'Everything in Family',
  'Create & manage classrooms',
  'Collect student submissions',
  'View all student books',
  '14-day free trial',
  'Classroom admin dashboard',
]

function PlanCard({ icon: Icon, iconColor, title, badge, billing, price, monthlyEquivalent, features, cta, onCta, current, highlight }) {
  return (
    <motion.div
      className={`relative flex flex-col rounded-3xl p-6 sm:p-8 border transition-all ${
        highlight
          ? 'border-galaxy-primary/60 bg-galaxy-primary/10 shadow-glow'
          : 'border-galaxy-text-muted/20 bg-galaxy-bg-light'
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
      <p className="text-galaxy-text-muted font-body text-sm mb-4">{billing}</p>

      <div className="mb-1">
        <span className="font-heading text-4xl font-bold text-galaxy-text">{price}</span>
        {price !== 'Free' && <span className="text-galaxy-text-muted font-body text-sm ml-1">/{billing === 'Billed annually' ? 'year' : 'month'}</span>}
      </div>
      {monthlyEquivalent && (
        <p className="text-galaxy-secondary font-body text-sm mb-4">{monthlyEquivalent}</p>
      )}

      <ul className="space-y-2.5 mb-8 flex-1 mt-4">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-galaxy-text font-body text-sm">
            <Check size={16} className={`mt-0.5 shrink-0 ${highlight ? 'text-galaxy-primary' : 'text-galaxy-secondary'}`} />
            {f}
          </li>
        ))}
      </ul>

      {current ? (
        <div className="text-center text-galaxy-text-muted font-body text-sm py-3 border border-galaxy-text-muted/20 rounded-2xl">
          Current plan
        </div>
      ) : (
        <SparkleButton
          onClick={onCta}
          variant={highlight ? 'primary' : 'secondary'}
          size="default"
          className="w-full"
        >
          {cta}
        </SparkleButton>
      )}
    </motion.div>
  )
}

export default function PricingPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { planKey, loading } = useSubscription()
  const [billing, setBilling] = useState('monthly')
  const [showGate, setShowGate] = useState(null) // null or plan name

  const handleUpgradeClick = (planName) => {
    if (!user) {
      navigate('/signup')
      return
    }
    setShowGate(planName)
  }

  const handleUpgrade = async (planName) => {
    setShowGate(null)

    const res = await apiFetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planName,
        billing,
        userId: user.id,
        userEmail: user.email,
      }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else alert(data.error || 'Something went wrong')
  }

  const familyPrice = billing === 'annual' ? PRICES.family.annual : PRICES.family.monthly
  const teacherPrice = billing === 'annual' ? PRICES.teacher.annual : PRICES.teacher.monthly

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
            Choose your plan
          </h1>
          <p className="text-galaxy-text-muted font-body text-xl">
            Start free. Upgrade anytime. Cancel anytime.
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
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-4 py-2 rounded-full font-body text-sm font-semibold transition-all ${
              billing === 'annual'
                ? 'bg-galaxy-primary text-white'
                : 'text-galaxy-text-muted hover:text-galaxy-text'
            }`}
          >
            Annual
            <span className="ml-2 text-xs text-galaxy-secondary font-bold">Save 33%</span>
          </button>
        </motion.div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PlanCard
            icon={BookOpen}
            iconColor="text-galaxy-text-muted"
            title="Free"
            billing="Forever free"
            price="Free"
            features={FREE_FEATURES}
            cta="Get started"
            onCta={() => navigate('/create')}
            current={!loading && planKey === 'free' && !!user}
          />

          <PlanCard
            icon={Sparkles}
            iconColor="text-galaxy-primary"
            title="Family"
            badge="Most Popular"
            billing={billing === 'annual' ? 'Billed annually' : 'Billed monthly'}
            price={familyPrice.amount}
            monthlyEquivalent={billing === 'annual' ? familyPrice.monthlyEquivalent : null}
            features={FAMILY_FEATURES}
            cta="Upgrade to Family"
            onCta={() => handleUpgradeClick('family')}
            current={!loading && planKey === 'family'}
            highlight
          />

          <PlanCard
            icon={GraduationCap}
            iconColor="text-galaxy-secondary"
            title="Teacher"
            billing={billing === 'annual' ? 'Billed annually' : 'Billed monthly'}
            price={teacherPrice.amount}
            monthlyEquivalent={billing === 'annual' ? teacherPrice.monthlyEquivalent : null}
            features={TEACHER_FEATURES}
            cta="Start free trial"
            onCta={() => handleUpgradeClick('teacher')}
            current={!loading && planKey === 'teacher'}
          />
        </div>

        {/* FAQ / reassurance */}
        <motion.p
          className="text-center text-galaxy-text-muted font-body text-sm mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Secure checkout by Stripe · Cancel anytime from your account · No hidden fees
        </motion.p>
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

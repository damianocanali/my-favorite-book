import { useEffect } from 'react'
import { motion } from 'motion/react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, Library, GraduationCap, Check, Sparkles, Mic, Brain, Palette, Users, Volume2, Wand2 } from 'lucide-react'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { useAuthStore } from '../stores/useAuthStore'
import { PRICES, PLAN_CURRENCY, formatPlanPrice, formatMonthlyEquivalent } from '../lib/plans'
import { formatMoneyCents } from '../i18n/formats'
import SparkleButton from '../components/ui/SparkleButton'
import { playTrack } from '../services/audioService'

// Deliberately NOT translated. Each letter is animated with its own stagger
// delay, so the wordmark is an animation timeline as much as a string — and
// it is the brand name besides.
const titleLetters = 'My Book Lab'.split('')

// Feature cards keyed by a stable id rather than by their English title:
// `key={title}` remounts every card the moment the copy changes language.
const FEATURES = [
  { id: 'story_buddy', icon: Wand2, color: 'text-galaxy-primary' },
  { id: 'illustrations', icon: Palette, color: 'text-pink-400' },
  { id: 'voice', icon: Mic, color: 'text-green-400' },
  { id: 'focus', icon: Brain, color: 'text-yellow-400' },
  { id: 'classroom', icon: Users, color: 'text-galaxy-secondary' },
  { id: 'accessibility', icon: Volume2, color: 'text-cyan-400' },
]

const FREE_BULLETS = [
  'marketing:pricing.free_features.books',
  'marketing:pricing.free_features.story_buddy',
  'marketing:pricing.free_features.illustrations',
  'marketing:pricing.free_features.read_aloud',
]

const FAMILY_BULLETS = [
  'marketing:pricing.family_features.unlimited_books',
  'marketing:pricing.family_features.unlimited_story_buddy',
  'marketing:pricing.family_features.unlimited_illustrations',
  'marketing:pricing.family_features.pdf_export',
]

const TEACHER_BULLETS = [
  'marketing:pricing.teacher_features.everything_in_family',
  'marketing:pricing.teacher_features.manage_classrooms',
  'marketing:pricing.teacher_features.submissions',
  'marketing:pricing.teacher_features.dashboard',
]

function FloatingElement({ emoji, className, delay = 0 }) {
  return (
    <motion.div
      className={`absolute text-4xl sm:text-5xl select-none ${className}`}
      animate={{
        y: [0, -20, 0],
        rotate: [0, 5, -5, 0],
      }}
      transition={{
        duration: 5 + Math.random() * 3,
        repeat: Infinity,
        delay,
      }}
    >
      {emoji}
    </motion.div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const bookCount = useBookshelfStore((state) => state.books.length)
  const user = useAuthStore((s) => s.user)

  useEffect(() => { playTrack('home') }, [])

  return (
    <div className="min-h-screen relative flex flex-col items-center px-4 pb-8 overflow-hidden">
      {/* CosmicBackground is mounted once by AppShell — rendering a second
          copy here doubled the starfield and nebula blobs. */}

      {/* Floating cosmic elements */}
      <FloatingElement emoji="🚀" className="top-[10%] left-[10%]" delay={0} />
      <FloatingElement emoji="🪐" className="top-[15%] right-[12%]" delay={1} />
      <FloatingElement emoji="⭐" className="bottom-[20%] left-[8%]" delay={0.5} />
      <FloatingElement emoji="🌙" className="bottom-[25%] right-[10%]" delay={1.5} />
      <FloatingElement emoji="✨" className="top-[40%] left-[5%]" delay={2} />
      <FloatingElement emoji="🌟" className="top-[35%] right-[5%]" delay={0.8} />

      {/* Main content */}
      <div className="relative z-10 text-center max-w-2xl mt-16 sm:mt-24">
        {/* Logo + halo — mirrors HeroLanding.swift: a blurred purple
            radial halo pulsing 0.95↔1.05 behind a logo breathing 1↔1.02,
            both on the same 3s ease-in-out loop. */}
        <motion.div
          className="relative w-28 h-28 mx-auto mb-8"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        >
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 animate-halo-pulse motion-reduce:animate-none"
            style={{
              background:
                'radial-gradient(circle, rgba(191,90,242,0.55) 0%, rgba(191,90,242,0) 70%)',
              filter: 'blur(8px)',
            }}
            aria-hidden="true"
          />
          <img
            src="/logo.png"
            alt="My Book Lab"
            className="h-full w-full rounded-logo shadow-glow-logo animate-logo-pulse motion-reduce:animate-none"
          />
        </motion.div>

        {/* Animated title */}
        <h1 className="font-heading text-2xl sm:text-7xl font-bold mb-4 leading-tight">
          {titleLetters.map((letter, i) => (
            <motion.span
              key={i}
              className="inline-block"
              style={{
                color: letter === ' ' ? 'transparent' : undefined,
                // Wordmark gradient from HeroLanding.swift:
                // sky blue → periwinkle → soft pink-violet
                background: letter !== ' '
                  ? 'linear-gradient(135deg, #66D9FF, #A68CFF, #D9A6F2)'
                  : undefined,
                WebkitBackgroundClip: letter !== ' ' ? 'text' : undefined,
                WebkitTextFillColor: letter !== ' ' ? 'transparent' : undefined,
              }}
              initial={{ opacity: 0, y: 50, rotate: -10 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{
                delay: 0.5 + i * 0.04,
                type: 'spring',
                stiffness: 200,
                damping: 12,
              }}
            >
              {letter === ' ' ? '\u00A0' : letter}
            </motion.span>
          ))}
        </h1>

        {/* Subtitle with typewriter effect */}
        <motion.p
          className="text-galaxy-text-muted font-body text-xl sm:text-2xl mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          {t('marketing:hero.tagline')}
        </motion.p>

        {/* One hero action. Creating a book is what this app is for, and a
            row of six equal-weight buttons made it just one option among
            many. The games and the example moved to the Play menu in the
            header; Featured Books was already the Gallery tab in the
            bottom bar and is gone rather than duplicated. */}
        <motion.div
          className="flex flex-col items-center gap-5"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.5 }}
        >
          <SparkleButton
            onClick={() => navigate('/create')}
            size="large"
            variant="primary"
            className="w-full max-w-xs sm:max-w-sm"
          >
            {t('marketing:hero.cta_create')}
          </SparkleButton>

          {/* Deliberately a quiet text link, not a second large button —
              anything of equal weight beside the hero competes with it.
              This is also the Books tab, so it's a shortcut, not a route
              a child could otherwise miss. */}
          {user && bookCount > 0 && (
            <button
              onClick={() => navigate('/bookshelf')}
              className="flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm font-semibold text-galaxy-text-muted transition-colors hover:text-galaxy-text"
            >
              <Library size={18} />
              {t('marketing:hero.bookshelf_link', { count: bookCount })}
            </button>
          )}
        </motion.div>
      </div>

      {/* What is My Book Lab */}
      <motion.div
        className="relative z-10 w-full max-w-4xl mt-20 px-2"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.7, duration: 0.6 }}
      >
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-galaxy-text text-center mb-3">
          {t('marketing:about.title')}
        </h2>
        <p className="text-galaxy-text-muted font-body text-sm sm:text-base text-center max-w-2xl mx-auto mb-10">
          {t('marketing:about.body')}
        </p>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {FEATURES.map(({ id, icon: Icon, color }) => (
            <div
              key={id}
              className="rounded-2xl p-5 border border-galaxy-text-muted/10 bg-galaxy-bg-light/60 backdrop-blur-sm"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-galaxy-bg mb-3`}>
                <Icon size={20} className={color} />
              </div>
              <h3 className="font-heading text-sm font-bold text-galaxy-text mb-1">{t(`marketing:features.${id}.title`)}</h3>
              <p className="text-galaxy-text-muted font-body text-xs leading-relaxed">{t(`marketing:features.${id}.desc`)}</p>
            </div>
          ))}
        </div>

        {/* Accessibility callout */}
        <div className="rounded-2xl p-5 sm:p-6 border border-galaxy-secondary/30 bg-galaxy-secondary/5 backdrop-blur-sm text-center max-w-2xl mx-auto">
          <p className="font-heading text-base sm:text-lg font-bold text-galaxy-text mb-2">
            {t('marketing:callout.title')}
          </p>
          <p className="text-galaxy-text-muted font-body text-xs sm:text-sm leading-relaxed">
            {t('marketing:callout.body')}
          </p>
        </div>
      </motion.div>

      {/* Pricing section — guests only */}
      {!user && (
        <motion.div
          className="relative z-10 w-full max-w-4xl mt-16 px-2"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.6 }}
        >
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-galaxy-text text-center mb-2">
            {t('marketing:pricing.title')}
          </h2>
          <p className="text-galaxy-text-muted font-body text-sm text-center mb-8">
            {t('marketing:pricing.subtitle')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Free */}
            <div className="rounded-2xl p-5 border border-galaxy-text-muted/20 bg-galaxy-bg-light/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={20} className="text-galaxy-text-muted" />
                <h3 className="font-heading text-lg font-bold text-galaxy-text">{t('pricing:plans.free.name')}</h3>
              </div>
              <p className="font-heading text-2xl font-bold text-galaxy-text mb-3">{formatMoneyCents(0, PLAN_CURRENCY)}</p>
              <ul className="space-y-1.5">
                {FREE_BULLETS.map((bulletKey) => (
                  <li key={bulletKey} className="flex items-start gap-1.5 text-galaxy-text-muted font-body text-xs">
                    <Check size={13} className="mt-0.5 shrink-0 text-galaxy-secondary" />
                    {t(bulletKey)}
                  </li>
                ))}
              </ul>
            </div>

            {/* Family */}
            <div className="relative rounded-2xl p-5 border border-galaxy-primary/50 bg-galaxy-primary/10 backdrop-blur-sm shadow-glow">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-galaxy-primary text-white text-[10px] font-body font-bold uppercase tracking-wider">
                {t('pricing:plans.family.badge')}
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={20} className="text-galaxy-primary" />
                <h3 className="font-heading text-lg font-bold text-galaxy-text">{t('pricing:plans.family.name')}</h3>
              </div>
              <p className="font-heading text-2xl font-bold text-galaxy-text mb-0.5">
                {formatPlanPrice(PRICES.family.monthly)}<span className="text-sm font-body text-galaxy-text-muted">{t('marketing:pricing.per_month_short')}</span>
              </p>
              <p className="text-galaxy-secondary font-body text-xs mb-3">
                {t('marketing:pricing.family_annual_note', {
                  price: formatPlanPrice(PRICES.family.annual),
                  monthly: formatMonthlyEquivalent(PRICES.family.annual),
                })}
              </p>
              <ul className="space-y-1.5">
                {FAMILY_BULLETS.map((bulletKey) => (
                  <li key={bulletKey} className="flex items-start gap-1.5 text-galaxy-text font-body text-xs">
                    <Check size={13} className="mt-0.5 shrink-0 text-galaxy-primary" />
                    {t(bulletKey)}
                  </li>
                ))}
              </ul>
            </div>

            {/* Teacher */}
            <div className="rounded-2xl p-5 border border-galaxy-text-muted/20 bg-galaxy-bg-light/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap size={20} className="text-galaxy-secondary" />
                <h3 className="font-heading text-lg font-bold text-galaxy-text">{t('pricing:plans.teacher.name')}</h3>
              </div>
              <p className="font-heading text-2xl font-bold text-galaxy-text mb-0.5">
                {formatPlanPrice(PRICES.teacher.monthly)}<span className="text-sm font-body text-galaxy-text-muted">{t('marketing:pricing.per_month_short')}</span>
              </p>
              <p className="text-galaxy-secondary font-body text-xs mb-3">
                {t('marketing:pricing.teacher_annual_note', {
                  price: formatPlanPrice(PRICES.teacher.annual),
                })}
              </p>
              <ul className="space-y-1.5">
                {TEACHER_BULLETS.map((bulletKey) => (
                  <li key={bulletKey} className="flex items-start gap-1.5 text-galaxy-text-muted font-body text-xs">
                    <Check size={13} className="mt-0.5 shrink-0 text-galaxy-secondary" />
                    {t(bulletKey)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="text-center mt-5">
            <Link
              to="/pricing"
              className="text-galaxy-primary font-body text-sm font-semibold hover:underline"
            >
              {t('marketing:pricing.view_details')}
            </Link>
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <div className="relative z-10 w-full max-w-4xl mt-12 mb-8 px-2 text-center">
        <div className="flex items-center justify-center gap-4 text-galaxy-text-muted/50 font-body text-xs">
          <Link to="/privacy" className="hover:text-galaxy-text-muted transition-colors">
            {t('marketing:footer.privacy')}
          </Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-galaxy-text-muted transition-colors">
            {t('marketing:footer.terms')}
          </Link>
          <span>·</span>
          {/* The year is deliberately NOT run through formatNumber — Intl
              would group it as "2.026" in Italian. */}
          <span>{t('marketing:footer.copyright', { year: String(new Date().getFullYear()) })}</span>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-galaxy-bg/80 to-transparent z-10 pointer-events-none" />
    </div>
  )
}

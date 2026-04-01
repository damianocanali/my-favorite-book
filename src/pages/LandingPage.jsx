import { motion } from 'motion/react'
import { useNavigate, Link } from 'react-router-dom'
import { BookOpen, Library, GraduationCap, LogIn, LogOut, Check, Sparkles } from 'lucide-react'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { useAuthStore, selectDisplayName, selectRole } from '../stores/useAuthStore'
import { PRICES } from '../lib/plans'
import SparkleButton from '../components/ui/SparkleButton'
import CosmicBackground from '../components/layout/CosmicBackground'

const titleLetters = 'My Favorite Book'.split('')

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
  const bookCount = useBookshelfStore((state) => state.books.length)
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const displayName = useAuthStore(selectDisplayName)
  const role = useAuthStore(selectRole)

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-4 overflow-hidden">
      <CosmicBackground />

      {/* Floating cosmic elements */}
      <FloatingElement emoji="🚀" className="top-[10%] left-[10%]" delay={0} />
      <FloatingElement emoji="🪐" className="top-[15%] right-[12%]" delay={1} />
      <FloatingElement emoji="⭐" className="bottom-[20%] left-[8%]" delay={0.5} />
      <FloatingElement emoji="🌙" className="bottom-[25%] right-[10%]" delay={1.5} />
      <FloatingElement emoji="✨" className="top-[40%] left-[5%]" delay={2} />
      <FloatingElement emoji="🌟" className="top-[35%] right-[5%]" delay={0.8} />

      {/* Main content */}
      <div className="relative z-10 text-center max-w-2xl">
        {/* Logo/icon */}
        <motion.div
          className="w-24 h-24 mx-auto mb-8 rounded-full bg-galaxy-primary/20 flex items-center justify-center border border-galaxy-primary/30"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        >
          <BookOpen size={48} className="text-galaxy-primary" />
        </motion.div>

        {/* Animated title */}
        <h1 className="font-heading text-2xl sm:text-7xl font-bold mb-4 leading-tight">
          {titleLetters.map((letter, i) => (
            <motion.span
              key={i}
              className="inline-block"
              style={{
                color: letter === ' ' ? 'transparent' : undefined,
                background: letter !== ' '
                  ? 'linear-gradient(135deg, #8B5CF6, #06B6D4, #F472B6)'
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
          Create your own story in the stars ✨
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.5 }}
        >
          <SparkleButton
            onClick={() => navigate('/create')}
            size="large"
            variant="primary"
          >
            Create a Book 📖
          </SparkleButton>

          {bookCount > 0 && (
            <SparkleButton
              onClick={() => navigate('/bookshelf')}
              size="large"
              variant="secondary"
            >
              <span className="flex items-center gap-2">
                <Library size={20} />
                My Bookshelf ({bookCount})
              </span>
            </SparkleButton>
          )}
        </motion.div>
      </div>

      {/* Pricing section — guests only */}
      {!user && (
        <motion.div
          className="relative z-10 w-full max-w-4xl mt-16 px-2"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.6 }}
        >
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-galaxy-text text-center mb-2">
            Plans & Pricing
          </h2>
          <p className="text-galaxy-text-muted font-body text-sm text-center mb-8">
            Start free. Upgrade when you're ready.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Free */}
            <div className="rounded-2xl p-5 border border-galaxy-text-muted/20 bg-galaxy-bg-light/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={20} className="text-galaxy-text-muted" />
                <h3 className="font-heading text-lg font-bold text-galaxy-text">Free</h3>
              </div>
              <p className="font-heading text-2xl font-bold text-galaxy-text mb-3">$0</p>
              <ul className="space-y-1.5">
                {['2 books', '3 Story Buddy chats/day', '2 illustrations per book', 'Read aloud & voice input'].map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-galaxy-text-muted font-body text-xs">
                    <Check size={13} className="mt-0.5 shrink-0 text-galaxy-secondary" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Family */}
            <div className="relative rounded-2xl p-5 border border-galaxy-primary/50 bg-galaxy-primary/10 backdrop-blur-sm shadow-glow">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-galaxy-primary text-white text-[10px] font-body font-bold uppercase tracking-wider">
                Most Popular
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={20} className="text-galaxy-primary" />
                <h3 className="font-heading text-lg font-bold text-galaxy-text">Family</h3>
              </div>
              <p className="font-heading text-2xl font-bold text-galaxy-text mb-0.5">
                {PRICES.family.monthly.amount}<span className="text-sm font-body text-galaxy-text-muted">/mo</span>
              </p>
              <p className="text-galaxy-secondary font-body text-xs mb-3">
                or {PRICES.family.annual.amount}/yr ({PRICES.family.annual.monthlyEquivalent})
              </p>
              <ul className="space-y-1.5">
                {['Unlimited books', 'Unlimited Story Buddy', 'Unlimited illustrations', 'PDF & print export'].map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-galaxy-text font-body text-xs">
                    <Check size={13} className="mt-0.5 shrink-0 text-galaxy-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Teacher */}
            <div className="rounded-2xl p-5 border border-galaxy-text-muted/20 bg-galaxy-bg-light/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap size={20} className="text-galaxy-secondary" />
                <h3 className="font-heading text-lg font-bold text-galaxy-text">Teacher</h3>
              </div>
              <p className="font-heading text-2xl font-bold text-galaxy-text mb-0.5">
                {PRICES.teacher.monthly.amount}<span className="text-sm font-body text-galaxy-text-muted">/mo</span>
              </p>
              <p className="text-galaxy-secondary font-body text-xs mb-3">
                or {PRICES.teacher.annual.amount}/yr · 14-day free trial
              </p>
              <ul className="space-y-1.5">
                {['Everything in Family', 'Create & manage classrooms', 'Student submissions', 'Classroom dashboard'].map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-galaxy-text-muted font-body text-xs">
                    <Check size={13} className="mt-0.5 shrink-0 text-galaxy-secondary" />
                    {f}
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
              View full plan details →
            </Link>
          </div>
        </motion.div>
      )}

      {/* Auth footer */}
      <motion.div
        className="relative z-10 mt-10 flex items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        {user ? (
          <>
            <span className="text-galaxy-text-muted font-body text-sm">Hi, {displayName}!</span>
            {role === 'teacher' && (
              <Link
                to="/teacher"
                className="flex items-center gap-1.5 text-galaxy-secondary hover:text-galaxy-secondary/80 transition-colors font-body text-sm"
              >
                <GraduationCap size={15} /> Classroom
              </Link>
            )}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 text-galaxy-text-muted hover:text-galaxy-text transition-colors font-body text-sm"
            >
              <LogOut size={15} /> Sign out
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-galaxy-text-muted hover:text-galaxy-text transition-colors font-body text-sm"
            >
              <LogIn size={15} /> Sign In
            </Link>
            <Link
              to="/signup"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-galaxy-primary text-white hover:bg-galaxy-primary/80 transition-colors font-body text-sm font-semibold"
            >
              Sign Up
            </Link>
            <Link
              to="/signup?role=teacher"
              className="flex items-center gap-1.5 text-galaxy-text-muted hover:text-galaxy-secondary transition-colors font-body text-sm"
            >
              <GraduationCap size={15} /> Teachers
            </Link>
          </>
        )}
      </motion.div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-galaxy-bg/80 to-transparent z-10 pointer-events-none" />
    </div>
  )
}

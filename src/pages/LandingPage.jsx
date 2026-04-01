import { motion } from 'motion/react'
import { useNavigate, Link } from 'react-router-dom'
import { BookOpen, Library, GraduationCap, LogOut, Check, Sparkles, Mic, Brain, Palette, Users, Volume2, Wand2 } from 'lucide-react'
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
    <div className="min-h-screen relative flex flex-col items-center px-4 pb-8 overflow-hidden">
      <CosmicBackground />

      {/* Top navbar */}
      <motion.nav
        className="relative z-20 w-full max-w-5xl flex items-center justify-between py-4 px-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <BookOpen size={20} className="text-galaxy-primary" />
          <span className="font-heading text-sm font-bold text-galaxy-text hidden sm:inline">My Favorite Book</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <span className="text-galaxy-text-muted font-body text-sm hidden sm:inline">Hi, {displayName}!</span>
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
                className="text-galaxy-text-muted hover:text-galaxy-text transition-colors font-body text-sm"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="px-4 py-1.5 rounded-full bg-galaxy-primary text-white hover:bg-galaxy-primary/80 transition-colors font-body text-sm font-semibold"
              >
                Sign Up
              </Link>
              <Link
                to="/signup?role=teacher"
                className="flex items-center gap-1.5 text-galaxy-text-muted hover:text-galaxy-secondary transition-colors font-body text-sm hidden sm:flex"
              >
                <GraduationCap size={15} /> Teachers
              </Link>
            </>
          )}
        </div>
      </motion.nav>

      {/* Floating cosmic elements */}
      <FloatingElement emoji="🚀" className="top-[10%] left-[10%]" delay={0} />
      <FloatingElement emoji="🪐" className="top-[15%] right-[12%]" delay={1} />
      <FloatingElement emoji="⭐" className="bottom-[20%] left-[8%]" delay={0.5} />
      <FloatingElement emoji="🌙" className="bottom-[25%] right-[10%]" delay={1.5} />
      <FloatingElement emoji="✨" className="top-[40%] left-[5%]" delay={2} />
      <FloatingElement emoji="🌟" className="top-[35%] right-[5%]" delay={0.8} />

      {/* Main content */}
      <div className="relative z-10 text-center max-w-2xl mt-16 sm:mt-24">
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

          {user && bookCount > 0 && (
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

      {/* What is My Favorite Book */}
      <motion.div
        className="relative z-10 w-full max-w-4xl mt-20 px-2"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.7, duration: 0.6 }}
      >
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-galaxy-text text-center mb-3">
          Every child has a story to tell
        </h2>
        <p className="text-galaxy-text-muted font-body text-sm sm:text-base text-center max-w-2xl mx-auto mb-10">
          My Favorite Book helps kids write, illustrate, and share their own stories — with built-in tools
          that make reading and writing fun and accessible for every learner.
        </p>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Wand2, color: 'text-galaxy-primary', title: 'AI Story Buddy', desc: 'A friendly writing assistant that gives ideas, not answers — encouraging kids to build their own stories.' },
            { icon: Palette, color: 'text-pink-400', title: 'AI Illustrations', desc: 'Turn any page into art with one tap. Kids see their words come to life as unique illustrations.' },
            { icon: Mic, color: 'text-green-400', title: 'Voice Input & Read Aloud', desc: 'Speak your story or listen to it read back. Great for early writers and auditory learners.' },
            { icon: Brain, color: 'text-yellow-400', title: 'ADHD & Dyslexia Friendly', desc: 'Sentence starters, word banks, visual progress maps, and gentle nudges keep kids focused without pressure.' },
            { icon: Users, color: 'text-galaxy-secondary', title: 'Classroom Ready', desc: 'Teachers can create classrooms, collect student stories, and track writing progress.' },
            { icon: Volume2, color: 'text-cyan-400', title: 'Built for All Learners', desc: 'Adjustable fonts, high contrast mode, text-to-speech, and scaffolding tools support UDL and WCAG standards.' },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl p-5 border border-galaxy-text-muted/10 bg-galaxy-bg-light/60 backdrop-blur-sm"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-galaxy-bg mb-3`}>
                <Icon size={20} className={color} />
              </div>
              <h3 className="font-heading text-sm font-bold text-galaxy-text mb-1">{title}</h3>
              <p className="text-galaxy-text-muted font-body text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Accessibility callout */}
        <div className="rounded-2xl p-5 sm:p-6 border border-galaxy-secondary/30 bg-galaxy-secondary/5 backdrop-blur-sm text-center max-w-2xl mx-auto">
          <p className="font-heading text-base sm:text-lg font-bold text-galaxy-text mb-2">
            Designed with every child in mind
          </p>
          <p className="text-galaxy-text-muted font-body text-xs sm:text-sm leading-relaxed">
            My Favorite Book follows Universal Design for Learning (UDL) principles and WCAG/COGA accessibility
            guidelines. Features like sentence starters, visual progress tracking, effort-based rewards, and
            multi-modal input are specifically designed to support children with ADHD, dyslexia, and other
            learning differences — making creative writing achievable and fun for everyone.
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
            Plans & Pricing
          </h2>
          <p className="text-galaxy-text-muted font-body text-sm text-center mb-8">
            Start free. Upgrade when you're ready.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Free */}
            <div className="rounded-2xl p-5 border border-galaxy-text-muted/20 bg-galaxy-bg-light/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={20} className="text-galaxy-text-muted" />
                <h3 className="font-heading text-lg font-bold text-galaxy-text">Free</h3>
              </div>
              <p className="font-heading text-2xl font-bold text-galaxy-text mb-3">$0</p>
              <ul className="space-y-1.5">
                {['2 books', '3 Story Buddy chats/day', '2 AI illustrations per day', 'Read aloud & voice input'].map((f) => (
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

      {/* Bottom spacer */}
      <div className="h-16" />

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-galaxy-bg/80 to-transparent z-10 pointer-events-none" />
    </div>
  )
}

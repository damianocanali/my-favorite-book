import { motion } from 'motion/react'
import { useNavigate, Link } from 'react-router-dom'
import { BookOpen, Library, GraduationCap, LogIn, LogOut } from 'lucide-react'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { useAuthStore, selectDisplayName, selectRole } from '../stores/useAuthStore'
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

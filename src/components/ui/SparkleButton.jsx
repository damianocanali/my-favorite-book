import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

// Web port of ios-native/MyBookLab/Views/SparkleButton.swift.
//
// Matching the native button:
//   • capsule with a top→bottom gradient fill and a 1.5px white border
//   • coloured glow that tightens while pressed, scale(0.95) on press
//   • a 7-sparkle burst fired on ACTIVATION (the old web version only
//     sparkled on mouseenter, so touch devices never saw it at all)

const SPARKLE_COLORS = ['#FFD60A', '#FF375F', '#BF5AF2', '#64D2FF', '#FFFFFF']

function SparkleParticle({ x, y, targetY, size, rotation, color, delay }) {
  return (
    <motion.svg
      className="absolute pointer-events-none left-1/2 top-1/2"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      initial={{ x, y, opacity: 1, rotate: rotation }}
      animate={{ y: targetY, opacity: 0, rotate: rotation + 180 }}
      transition={{ duration: 0.7, delay, ease: 'easeOut' }}
      aria-hidden="true"
    >
      <path d="M8 0L9.6 6.4L16 8L9.6 9.6L8 16L6.4 9.6L0 8L6.4 6.4Z" fill={color} />
    </motion.svg>
  )
}

export default function SparkleButton({
  children,
  onClick,
  className = '',
  variant = 'primary',
  disabled = false,
  size = 'default',
  type = 'button',
}) {
  const [sparkles, setSparkles] = useState([])
  const nextId = useRef(0)

  const baseClasses =
    'relative inline-flex items-center justify-center font-heading font-bold rounded-full ' +
    'transition-shadow duration-200 overflow-visible cursor-pointer select-none ' +
    'border-[1.5px] focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-cosmic-900'

  // iOS: small 16/10 · regular 22/14 · large 28/16 (h/v padding, px)
  const sizeClasses = {
    small: 'px-4 py-2.5 text-base',
    default: 'px-[22px] py-3.5 text-[17px]',
    large: 'px-7 py-4 text-xl',
  }

  const variantClasses = {
    primary:
      'bg-gradient-to-b from-btn-primary-from to-btn-primary-to text-white ' +
      'border-white/30 shadow-glow-purple hover:shadow-[0_8px_34px_rgba(191,90,242,0.7)]',
    secondary:
      'glass text-white border-white/35 hover:bg-white/[0.14]',
    accent:
      'bg-gradient-to-b from-btn-accent-from to-btn-accent-to text-white ' +
      'border-white/30 shadow-glow-pink hover:shadow-[0_8px_34px_rgba(255,55,95,0.7)]',
  }

  const burst = useCallback(() => {
    const created = Array.from({ length: 7 }, (_, i) => {
      const id = nextId.current++
      return {
        id,
        x: Math.random() * 120 - 60, // −60…60
        y: 8,
        targetY: -(30 + Math.random() * 50), // −80…−30
        size: 10 + Math.random() * 10, // 10…20
        rotation: Math.random() * 360,
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
        delay: i * 0.02,
      }
    })
    setSparkles((prev) => [...prev, ...created])
    const ids = new Set(created.map((s) => s.id))
    setTimeout(() => setSparkles((prev) => prev.filter((s) => !ids.has(s.id))), 1000)
  }, [])

  const handleClick = (event) => {
    if (disabled) return
    burst()
    onClick?.(event)
  }

  return (
    <motion.button
      type={type}
      className={`${baseClasses} ${sizeClasses[size] ?? sizeClasses.default} ${
        variantClasses[variant] ?? variantClasses.primary
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      // iOS press: spring(response: 0.25, dampingFraction: 0.55) → scale 0.95
      whileTap={disabled ? {} : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 620, damping: 22 }}
    >
      <AnimatePresence>
        {sparkles.map((s) => (
          <SparkleParticle key={s.id} {...s} />
        ))}
      </AnimatePresence>
      {children}
    </motion.button>
  )
}

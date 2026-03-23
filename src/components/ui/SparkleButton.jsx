import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

function SparkleParticle({ x, y, delay }) {
  return (
    <motion.svg
      className="absolute pointer-events-none"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0, rotate: 0 }}
      animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], rotate: [0, 180] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, delay }}
    >
      <path
        d="M8 0L9.5 6.5L16 8L9.5 9.5L8 16L6.5 9.5L0 8L6.5 6.5Z"
        fill="#F472B6"
      />
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
}) {
  const [sparkles, setSparkles] = useState([])

  const baseClasses =
    'relative font-heading font-bold rounded-full transition-all duration-300 overflow-visible cursor-pointer select-none'

  const sizeClasses = {
    small: 'px-4 py-2 text-sm',
    default: 'px-8 py-3 text-lg',
    large: 'px-10 py-4 text-xl',
  }

  const variantClasses = {
    primary:
      'bg-galaxy-primary text-white hover:bg-purple-500 hover:shadow-glow-purple active:scale-95',
    secondary:
      'bg-galaxy-bg-light text-galaxy-text border-2 border-galaxy-primary/50 hover:border-galaxy-primary hover:shadow-glow-purple active:scale-95',
    accent:
      'bg-galaxy-accent text-white hover:bg-pink-400 hover:shadow-glow-pink active:scale-95',
  }

  const handleMouseEnter = () => {
    const newSparkles = Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 120 - 20,
      y: Math.random() * 60 - 20,
      delay: Math.random() * 0.3,
    }))
    setSparkles(newSparkles)
    setTimeout(() => setSparkles([]), 800)
  }

  return (
    <motion.button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={handleMouseEnter}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
    >
      <AnimatePresence>
        {sparkles.map((sparkle) => (
          <SparkleParticle
            key={sparkle.id}
            x={sparkle.x}
            y={sparkle.y}
            delay={sparkle.delay}
          />
        ))}
      </AnimatePresence>
      {children}
    </motion.button>
  )
}

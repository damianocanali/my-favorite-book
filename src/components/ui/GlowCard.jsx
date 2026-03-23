import { motion } from 'motion/react'

export default function GlowCard({
  children,
  selected = false,
  onClick,
  color = '#8B5CF6',
  className = '',
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`relative rounded-2xl p-4 text-left transition-all duration-300 cursor-pointer select-none ${
        selected
          ? 'bg-galaxy-bg-light ring-2'
          : 'bg-galaxy-bg-light/50 hover:bg-galaxy-bg-light border border-galaxy-text-muted/10 hover:border-transparent'
      } ${className}`}
      style={
        selected
          ? {
              ringColor: color,
              borderColor: color,
              boxShadow: `0 0 20px ${color}40, 0 0 40px ${color}20`,
            }
          : {}
      }
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Glow border overlay when selected */}
      {selected && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            border: `2px solid ${color}`,
            boxShadow: `inset 0 0 20px ${color}15`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Checkmark */}
      {selected && (
        <motion.div
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: color }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          ✓
        </motion.div>
      )}

      {children}
    </motion.button>
  )
}

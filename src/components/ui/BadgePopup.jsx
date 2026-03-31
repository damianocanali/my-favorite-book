import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useRewardsStore } from '../../stores/useRewardsStore'

export default function BadgePopup() {
  const newBadge = useRewardsStore((s) => s.newBadge)
  const dismiss = useRewardsStore((s) => s.dismissBadge)

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (!newBadge) return
    const t = setTimeout(dismiss, 4000)
    return () => clearTimeout(t)
  }, [newBadge, dismiss])

  return (
    <AnimatePresence>
      {newBadge && (
        <motion.div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[60]"
          initial={{ opacity: 0, y: -40, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <button
            onClick={dismiss}
            className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-galaxy-bg-light border border-yellow-400/50 shadow-lg shadow-yellow-400/20 cursor-pointer hover:scale-105 transition-transform"
          >
            <span className="text-3xl">{newBadge.emoji}</span>
            <div className="text-left">
              <p className="text-yellow-300 text-xs font-body font-bold uppercase tracking-wider">
                Badge earned!
              </p>
              <p className="text-galaxy-text font-heading font-bold text-sm">
                {newBadge.label}
              </p>
              <p className="text-galaxy-text-muted text-xs font-body">
                {newBadge.description}
              </p>
              {newBadge.coins > 0 && (
                <p className="text-yellow-400 text-xs font-body font-semibold mt-0.5">
                  +{newBadge.coins} coins earned!
                </p>
              )}
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

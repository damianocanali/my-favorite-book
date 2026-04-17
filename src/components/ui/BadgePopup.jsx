import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useRewardsStore } from '../../stores/useRewardsStore'
import { celebrateAt } from '../../lib/celebrate'

// How many coin particles to spray when a badge grants coins. Scales
// gently with reward size so a 100-coin badge feels bigger than a 10.
function coinParticleCount(coins) {
  if (!coins) return 0
  if (coins >= 50) return 14
  if (coins >= 25) return 10
  return 7
}

export default function BadgePopup() {
  const newBadge = useRewardsStore((s) => s.newBadge)
  const dismiss = useRewardsStore((s) => s.dismissBadge)
  const popupRef = useRef(null)
  const firedFor = useRef(null)

  // Auto-dismiss after 4 seconds.
  useEffect(() => {
    if (!newBadge) return
    const t = setTimeout(dismiss, 4000)
    return () => clearTimeout(t)
  }, [newBadge, dismiss])

  // Fire confetti exactly once per badge — React 19 StrictMode double-invokes
  // effects in dev, and the newBadge object gets recreated on some re-renders.
  useEffect(() => {
    if (!newBadge) { firedFor.current = null; return }
    if (firedFor.current === newBadge.id) return
    firedFor.current = newBadge.id
    celebrateAt(popupRef.current)
  }, [newBadge])

  const coinCount = coinParticleCount(newBadge?.coins)

  return (
    <AnimatePresence>
      {newBadge && (
        <motion.div
          ref={popupRef}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[60]"
          initial={{ opacity: 0, y: -40, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <button
            onClick={dismiss}
            className="relative flex items-center gap-3 px-5 py-3 rounded-2xl bg-galaxy-bg-light border border-yellow-400/50 shadow-lg shadow-yellow-400/20 cursor-pointer hover:scale-105 transition-transform"
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

            {/* Coin fly — gold coins arc up-and-outward from the popup when
                a coin reward is attached. Anchored inside the popup so they
                visually "emit" from the badge rather than dropping in from
                nowhere. */}
            {coinCount > 0 && (
              <span className="absolute inset-0 pointer-events-none" aria-hidden>
                {Array.from({ length: coinCount }).map((_, i) => {
                  const angle = (i / coinCount) * Math.PI - Math.PI / 2
                  const distance = 80 + Math.random() * 40
                  const dx = Math.cos(angle) * distance * (0.8 + Math.random() * 0.4)
                  const dy = Math.sin(angle) * distance - 30 - Math.random() * 30
                  return (
                    <motion.span
                      key={i}
                      className="absolute left-1/2 top-1/2 text-lg select-none"
                      initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
                      animate={{
                        x: dx,
                        y: dy,
                        scale: [0.4, 1.1, 0.9],
                        opacity: [0, 1, 0],
                        rotate: (Math.random() - 0.5) * 360,
                      }}
                      transition={{
                        duration: 1.1 + Math.random() * 0.4,
                        ease: 'easeOut',
                        delay: i * 0.03,
                      }}
                    >
                      🪙
                    </motion.span>
                  )
                })}
              </span>
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

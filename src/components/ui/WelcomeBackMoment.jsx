import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useAuthStore, selectDisplayName } from '../../stores/useAuthStore'
import { useRewardsStore } from '../../stores/useRewardsStore'
import { useAvatarStore } from '../../stores/useAvatarStore'
import GameBanner from './GameBanner'
import StatPill from './StatPill'

// The launch beat. Streak and coins existed but only surfaced on a
// settings screen, so a child never saw the numbers they were earning.
//
// Deliberately once per session and tap-anywhere to dismiss: for ages 4-8
// a celebration that blocks the way becomes the thing they learn to tap
// through. It also never shows on a first visit, when there is nothing to
// welcome anyone back to.

const SESSION_KEY = 'mbl-welcomed-this-session'

/** Mascot art is optional — falls back to a star until the asset exists. */
function Mascot() {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <motion.div
        className="text-7xl"
        animate={{ rotate: [-6, 6, -6] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      >
        ⭐
      </motion.div>
    )
  }
  return (
    <motion.img
      src="/mascot.png"
      alt=""
      onError={() => setFailed(true)}
      className="h-28 w-28 object-contain drop-shadow-[0_8px_24px_rgba(191,90,242,0.6)]"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

export default function WelcomeBackMoment() {
  const user = useAuthStore((s) => s.user)
  const displayName = useAuthStore(selectDisplayName)
  const currentStreak = useRewardsStore((s) => s.currentStreak)
  const coins = useAvatarStore((s) => s.coins)

  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    if (sessionStorage.getItem(SESSION_KEY)) return
    // Wait for the streak/coins reads kicked off at sign-in, so the
    // numbers are real rather than animating up from a placeholder.
    const t = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, '1')
      setOpen(true)
    }, 900)
    return () => clearTimeout(t)
  }, [user])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setOpen(false), 4200)
    return () => clearTimeout(t)
  }, [open])

  if (!user) return null

  return (
    <>
      <GameBanner
        show={open}
        text="Welcome back!"
        sub={displayName ? `Good to see you, ${displayName}` : undefined}
      />

      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Dismiss"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[65] flex cursor-pointer flex-col items-center justify-center gap-5 bg-black/55 px-6 pt-40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Mascot />

            <div className="flex items-center gap-3">
              <StatPill icon="🔥" value={currentStreak} label="Day streak" tone="flame" />
              <StatPill icon="🪙" value={coins} label="Coins" />
            </div>

            <p className="font-body text-sm text-white/70">
              {currentStreak > 0
                ? `Write today to reach day ${currentStreak + 1}!`
                : 'Write something today to start a streak!'}
            </p>
            <p className="font-body text-xs text-white/40">Tap anywhere to continue</p>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}

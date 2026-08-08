import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useAuthStore, selectDisplayName } from '../../stores/useAuthStore'
import { useRewardsStore } from '../../stores/useRewardsStore'
import { useAvatarStore } from '../../stores/useAvatarStore'
import GameBanner from './GameBanner'
import StatPill from './StatPill'
import Mascot from './Mascot'

// The launch beat. Streak and coins existed but only surfaced on a
// settings screen, so a child never saw the numbers they were earning.
//
// Deliberately once per session and tap-anywhere to dismiss: for ages 4-8
// a celebration that blocks the way becomes the thing they learn to tap
// through. It also never shows on a first visit, when there is nothing to
// welcome anyone back to.

const SESSION_KEY = 'mbl-welcomed-this-session'
const HOLD_MS = 4200

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

  // Auto-dismiss against an absolute deadline rather than a bare timeout.
  //
  // A one-shot setTimeout is not enough here: browsers suspend or heavily
  // throttle timers in a backgrounded tab, and signing in with Apple or
  // Google leaves the page and comes back — exactly the window this timer
  // lives in. If the timer is deferred across that, a full-screen dark
  // overlay stays up with nothing left to take it down.
  //
  // Re-checking the deadline whenever the page becomes visible again makes
  // that self-healing. Escape and an explicit Close button are the manual
  // escape hatches, because "tap anywhere" is not readable by a 4-year-old.
  useEffect(() => {
    if (!open) return
    const deadline = Date.now() + HOLD_MS

    const closeIfDue = () => {
      if (Date.now() >= deadline) setOpen(false)
    }
    const t = setTimeout(() => setOpen(false), HOLD_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') closeIfDue()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', closeIfDue)
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', closeIfDue)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  return (
    <>
      <GameBanner
        show={open}
        text="Welcome back!"
        sub={displayName ? `Good to see you, ${displayName}` : undefined}
      />

      {/* Portalled into <body>, and removed synchronously with `open`.
          Both matter, and both were the bug:

          AppShell puts page content inside `<main className="relative
          z-10">`, a stacking context — so z-[65] here could never beat
          the header (z-20) or tab bar (z-40). The film darkened the page
          while the bars stayed bright above it.

          And removal used to be delegated to AnimatePresence waiting on
          `exit={{opacity:0}}`. If that exit was ever interrupted the
          element stayed mounted forever, and every escape hatch was a
          no-op: they all call setOpen(false) on state that is ALREADY
          false, so React bails out and AnimatePresence is never
          re-notified. Losing the 300ms fade-out is the price of a layer
          that cannot strand. */}
      {open && createPortal(
          <motion.button
            type="button"
            aria-label="Dismiss"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[65] flex cursor-pointer flex-col items-center justify-center gap-5 bg-black/55 px-6 pt-40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Mascot mood="welcome" size={128} />

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

            {/* An explicit, visible way out. "Tap anywhere" assumes a child
                can read it; this is a button they can see. It is inside the
                dismissing button, so the click bubbles and closes either
                way — it exists to be obvious, not to add behaviour. */}
            <span className="mt-1 rounded-full border-2 border-white/30 px-5 py-2 font-heading text-sm font-bold text-white/90">
              Let's go
            </span>
          </motion.button>,
        document.body
      )}
    </>
  )
}

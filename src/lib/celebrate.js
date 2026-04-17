import confetti from 'canvas-confetti'

// Celebration FX shared across the app. All helpers respect
// prefers-reduced-motion and silently no-op when set, so nothing fires
// visual noise at users who've asked the OS to tone it down.

function motionOK() {
  if (typeof window === 'undefined') return false
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// Big celebration — use for "finished a book" moments. Fires from both
// bottom corners so the whole screen feels it.
export function celebrateBig() {
  if (!motionOK()) return
  const defaults = {
    startVelocity: 45,
    spread: 70,
    ticks: 120,
    zIndex: 9999,
    scalar: 1.1,
    colors: ['#A78BFA', '#F472B6', '#FBBF24', '#34D399', '#60A5FA'],
  }
  confetti({ ...defaults, particleCount: 80, origin: { x: 0.15, y: 0.9 }, angle: 60 })
  confetti({ ...defaults, particleCount: 80, origin: { x: 0.85, y: 0.9 }, angle: 120 })
  // Short follow-up burst for extra delight.
  setTimeout(() => {
    if (!motionOK()) return
    confetti({
      ...defaults,
      particleCount: 60,
      origin: { x: 0.5, y: 0.3 },
      spread: 120,
      startVelocity: 35,
    })
  }, 300)
}

// Small tap-sized burst — use for in-UI moments like earning a badge.
// Anchored at a DOM element if provided, otherwise the top of the viewport.
export function celebrateAt(el) {
  if (!motionOK()) return
  const rect = el?.getBoundingClientRect?.()
  const x = rect ? (rect.left + rect.width / 2) / window.innerWidth : 0.5
  const y = rect ? (rect.top + rect.height / 2) / window.innerHeight : 0.15

  confetti({
    particleCount: 40,
    spread: 60,
    startVelocity: 30,
    ticks: 90,
    origin: { x, y },
    zIndex: 9999,
    scalar: 0.85,
    colors: ['#FBBF24', '#F472B6', '#A78BFA', '#34D399'],
  })
}

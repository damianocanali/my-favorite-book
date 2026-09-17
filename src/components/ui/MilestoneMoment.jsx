import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import GameBanner from './GameBanner'
import Mascot from './Mascot'

// A milestone beat: the mascot pops in beside a banner, holds, and goes.
//
// These fire at the moments that currently pass in silence — a page
// finished, halfway through a book, the last page written. The child gets
// no signal today that any of those happened, so the middle of a book
// feels like nothing is happening even though it is.
//
// Deliberately non-blocking, unlike WelcomeBackMoment: it sits in a corner
// and never covers the editor. A child mid-sentence must not have to
// dismiss anything.

export default function MilestoneMoment({ milestone, onDone }) {
  // Portalled for the same stacking-context reason as the other overlays:
  // inside `<main className="relative z-10">` this would render beneath
  // the z-40 tab bar. It keeps its exit animation, unlike the blocking
  // layers — it is pointer-events-none, so a stranded one is a cosmetic
  // annoyance rather than a locked app.
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence onExitComplete={onDone}>
      {milestone && (
        <motion.div
          key={milestone.id}
          className="pointer-events-none fixed inset-x-0 bottom-24 z-[55] flex flex-col items-center gap-2 px-4"
          initial={{ opacity: 0, y: 40, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          role="status"
          aria-live="polite"
        >
          <Mascot mood={milestone.mood ?? 'cheer'} size={84} />
          <div className="rounded-2xl border-2 border-[#FFD60A] bg-gradient-to-br from-[#4A1E7A] to-[#7A2E96] px-5 py-2.5 text-center shadow-glow-modal">
            <p className="font-heading text-base font-extrabold text-[#FFE68A]">{milestone.title}</p>
            {milestone.sub && (
              <p className="font-body text-xs text-white/80">{milestone.sub}</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

/** The full-width banner variant, for the big ones (book finished). */
export function MilestoneBanner({ show, text, sub }) {
  return <GameBanner show={show} text={text} sub={sub} />
}

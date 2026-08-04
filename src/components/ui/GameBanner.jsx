import { motion, AnimatePresence } from 'motion/react'

// The "announcement" beat from casual games: chunky extruded lettering on a
// ribbon that springs in, holds, and springs out. Used for WELCOME BACK,
// PAGE 3, BOOK DONE — the moments that currently pass by silently.
//
// Palette is deliberately ours (cosmic purple + gold), not the beach-game
// reference's bright flat look: this has to sit on the existing nebula
// background, and restyling the whole app to match a reference screenshot
// is a far bigger job than adding the moments.
//
// Text is stroked by stacking offset copies behind a gradient fill —
// -webkit-text-stroke thins glyphs and clips badly at large sizes.

const STROKE_OFFSETS = [
  [-2, -2], [2, -2], [-2, 2], [2, 2],
  [0, -3], [0, 3], [-3, 0], [3, 0],
]

export default function GameBanner({ show, text, sub, onDone }) {
  return (
    <AnimatePresence onExitComplete={onDone}>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 top-[22%] z-[70] flex justify-center px-4"
          initial={{ opacity: 0, scale: 0.55, y: -20, rotate: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: -30 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        >
          <div className="relative">
            {/* Ribbon */}
            <div
              className="rounded-[26px] border-[3px] border-[#FFD60A] px-8 py-4 text-center shadow-glow-modal"
              style={{
                background: 'linear-gradient(135deg, #4A1E7A 0%, #7A2E96 100%)',
              }}
            >
              <div className="relative inline-block">
                {/* Stroke pass */}
                {STROKE_OFFSETS.map(([x, y], i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="absolute inset-0 font-heading text-3xl font-extrabold uppercase tracking-wide sm:text-4xl"
                    style={{ color: '#3A1163', transform: `translate(${x}px, ${y}px)` }}
                  >
                    {text}
                  </span>
                ))}
                {/* Gold fill */}
                <span
                  className="relative font-heading text-3xl font-extrabold uppercase tracking-wide sm:text-4xl"
                  style={{
                    backgroundImage: 'linear-gradient(180deg, #FFE68A 0%, #FFD60A 45%, #FF9F0A 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {text}
                </span>
              </div>

              {sub && (
                <p className="mt-1 font-body text-sm font-semibold text-white/85">{sub}</p>
              )}
            </div>

            {/* Little gold tails, so it reads as a ribbon rather than a box */}
            <div className="absolute -left-3 top-1/2 h-5 w-6 -translate-y-1/2 rotate-45 rounded-sm bg-[#FFD60A]" />
            <div className="absolute -right-3 top-1/2 h-5 w-6 -translate-y-1/2 rotate-45 rounded-sm bg-[#FFD60A]" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Gamepad2 } from 'lucide-react'

// The games and the example book, grouped under one header slot.
//
// They were six competing buttons on the landing page, which buried the
// one action the app exists for. A dropdown rather than three more header
// links because the header already carries a logo, per-page actions,
// Pricing, mute and the account block — three more items overflow a
// 430px phone.

const ITEMS = [
  { to: '/blanks', emoji: '🧩', label: 'Story Blanks', hint: 'Fill in the gaps' },
  { to: '/build', emoji: '🧲', label: 'Story Builder', hint: 'Drag pictures into a story' },
  { to: '/example', emoji: '📖', label: 'See an Example', hint: 'A finished book' },
]

export default function PlayMenu({ linkClass }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const location = useLocation()
  const active = ITEMS.some((i) => i.to === location.pathname)

  // Close on route change, so tapping an item doesn't leave the menu
  // hanging over the page it just navigated to.
  useEffect(() => { setOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onPointer = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={linkClass(active || open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Play: games and example book"
      >
        <Gamepad2 size={18} />
        <span className="hidden font-body text-sm font-semibold sm:inline">Play</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Games"
            className="absolute right-0 top-[calc(100%+8px)] z-30 w-64 overflow-hidden rounded-2xl border border-white/15 ios-material shadow-glow-modal"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/10"
              >
                <span className="text-2xl leading-none" aria-hidden>{item.emoji}</span>
                <span className="min-w-0">
                  <span className="block font-heading text-sm font-bold text-white">{item.label}</span>
                  <span className="block font-body text-xs text-white/55">{item.hint}</span>
                </span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useCheckInStore } from '../../stores/useCheckInStore'
import { FEELINGS, NEEDS } from '../../lib/checkIn'
import Mascot from './Mascot'

// The two-step check-in. Portalled for the same reason WelcomeBackMoment is:
// AppShell puts page content inside a stacking context, so a sheet rendered
// inline cannot cover the header and tab bar.
//
// Unlike MilestoneMoment this DOES take pointer events and does NOT
// auto-dismiss — it is waiting for an answer. The backdrop, Escape, and an
// explicit Close button all reach `dismiss()`, so a child is never trapped.

function Tile({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      // min-w-0 overrides the grid track's default content-based minimum —
      // without it a single long, unbreakable Italian word (e.g.
      // "Preoccupazione", 14 characters, no spaces to wrap on) forces its
      // whole column wider than the sheet, pushing the grid past the modal
      // edge instead of wrapping inside the tile.
      className="flex min-w-0 flex-col items-center gap-2 rounded-2xl glass border border-white/15 px-3 py-3 text-white transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-galaxy-primary"
    >
      {children}
      {/* w-full so the label actually takes the tile's width instead of
          shrink-to-fit sizing (the default for a non-stretched flex child),
          and break-words so that width constraint can break a word like
          "Preoccupazione" across lines instead of overflowing it. Sized and
          worded for the Italian strings, which are consistently longer than
          the English ones. */}
      <span className="w-full break-words text-center font-body text-sm font-semibold leading-tight">
        {label}
      </span>
    </button>
  )
}

export default function CheckInSheet() {
  const { t } = useTranslation()
  const current = useCheckInStore((s) => s.current)
  const pickFeeling = useCheckInStore((s) => s.pickFeeling)
  const pickNeed = useCheckInStore((s) => s.pickNeed)
  const dismiss = useCheckInStore((s) => s.dismiss)

  // Escape is the keyboard equivalent of the backdrop click — another way
  // out that doesn't depend on being able to read the Close button.
  useEffect(() => {
    if (!current) return
    const onKey = (e) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, dismiss])

  if (!current) return null

  const isFeelingStep = current.step === 'feeling'
  const items = isFeelingStep ? FEELINGS : NEEDS
  const prefix = isFeelingStep ? 'checkin:feeling.' : 'checkin:need.'
  const choose = isFeelingStep ? pickFeeling : pickNeed
  const title = t(isFeelingStep ? 'checkin:title.feeling' : 'checkin:title.need')

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={dismiss}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="w-full max-w-md rounded-modal bg-gradient-to-br from-[#38246B] to-[#662E80] p-6 shadow-glow-modal"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex justify-center">
            <Mascot mood="welcome" size={72} />
          </div>
          <h2 className="mb-5 text-center font-heading text-xl font-bold text-white">
            {title}
          </h2>
          <div className={`grid gap-3 ${isFeelingStep ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {items.map((item) => (
              <Tile key={item.id} label={t(`${prefix}${item.id}`)} onClick={() => choose(item.id)}>
                {/* Placeholder until the ten mascot-style illustrations land.
                    Swapping this for <img src={art[item.id]}/> is the only
                    change the art drop needs. */}
                <span aria-hidden="true" className="text-3xl">·</span>
              </Tile>
            ))}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="mt-5 w-full py-2 font-body text-sm text-white/60 transition-colors hover:text-white"
          >
            {t('common:actions.close')}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

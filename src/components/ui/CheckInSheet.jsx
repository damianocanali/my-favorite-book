import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
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
  const panelRef = useRef(null)
  // Keyed on open/closed rather than on `current` itself — `current` gets a
  // new object identity on every step (feeling -> need), and re-running a
  // capture-and-restore effect on each of those would yank focus out to the
  // trigger and back in between steps instead of only at the real open/close.
  const isOpen = current != null

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

  // aria-modal="true" is a hint to assistive tech, not an enforcement
  // mechanism — it does not stop Tab from walking straight past the sheet
  // into the page underneath. Moving focus onto the panel when it opens,
  // and giving it back to whatever had it before, is what actually keeps a
  // keyboard/screen-reader user inside the dialog. This is not a full focus
  // trap (Tab can still leave via the backdrop's DOM order) — the three
  // exits are meant to work, only the starting point was wrong.
  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused = document.activeElement
    panelRef.current?.focus()
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [isOpen])

  // Moving focus is what actually announces a step to a screen reader — the
  // heading text and aria-label change from "How are you doing?" to "What
  // would help?" when a feeling is picked, but text changing under an
  // already-focused element is silent to AT unless something tells it to
  // look again. Keyed on current?.step, separately from the isOpen effect
  // above: that effect's capture-and-restore must only run at genuine
  // open/close, not on every step (re-running it on step change would
  // capture the panel itself as "previously focused" and restore focus to
  // the dialog instead of the invoking button when the sheet finally
  // closes). Re-focusing the same element re-announces its updated
  // accessible name in most screen readers, which is exactly what a step
  // change needs and an open/close doesn't already cover.
  useEffect(() => {
    if (!current) return
    panelRef.current?.focus()
  }, [current?.step])

  if (!current) return null

  const isFeelingStep = current.step === 'feeling'
  const items = isFeelingStep ? FEELINGS : NEEDS
  const prefix = isFeelingStep ? 'checkin:feeling.' : 'checkin:need.'
  const choose = isFeelingStep ? pickFeeling : pickNeed
  const title = t(isFeelingStep ? 'checkin:title.feeling' : 'checkin:title.need')

  return createPortal(
    // No AnimatePresence here: `if (!current) return null` above unmounts
    // this whole tree synchronously (the BookFinishedModal pattern), so an
    // `exit` animation would never get the chance to run anyway — it was
    // dead machinery that just invited someone to "fix" it later.
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={dismiss}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-modal bg-gradient-to-br from-[#38246B] to-[#662E80] p-6 shadow-glow-modal focus:outline-none"
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
          className="mt-5 w-full py-2 font-body text-sm text-white/60 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-galaxy-primary"
        >
          {t('common:actions.close')}
        </button>
      </motion.div>
    </motion.div>,
    document.body
  )
}

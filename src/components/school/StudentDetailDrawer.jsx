import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import BooksPanelContent from './BooksPanelContent'
import CheckInsPanelContent from './CheckInsPanelContent'
import { NudgeChip } from './StudentsTable'

const TAB_IDS = ['books', 'checkins']

// Row click on the teacher dashboard's students table/cards opens this
// (Task D2): ONE dialog (portal, role="dialog", focus captured on open and
// restored on close, Escape alongside Close) whose Books/Check-ins tabs
// swap which panel is visible. Both panels mount once, for the drawer's
// whole lifetime, and switching tabs only toggles which one is hidden —
// not which is mounted — so a tab switch never remounts the dialog itself
// (no re-announce to a screen reader) and never re-fetches or re-scrolls a
// panel the teacher already looked at.
//
// Standard ARIA tabs keyboard pattern: ArrowLeft/ArrowRight move both the
// selected tab and focus together (roving tabindex — the active tab is the
// only one in the Tab order).
function Tabs({ active, onChange }) {
  const { t } = useTranslation()
  const refs = { books: useRef(null), checkins: useRef(null) }

  function onKeyDown(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const i = TAB_IDS.indexOf(active)
    const delta = e.key === 'ArrowRight' ? 1 : -1
    const next = TAB_IDS[(i + delta + TAB_IDS.length) % TAB_IDS.length]
    onChange(next)
    refs[next].current?.focus()
  }

  const tab = (id, label) => (
    <button
      ref={refs[id]}
      type="button"
      role="tab"
      aria-selected={active === id}
      tabIndex={active === id ? 0 : -1}
      onKeyDown={onKeyDown}
      onClick={() => onChange(id)}
      className={`px-3 py-1.5 rounded-full font-body text-xs font-semibold transition-colors ${
        active === id ? 'bg-white/[0.14] text-galaxy-text' : 'text-galaxy-text-muted hover:text-galaxy-text'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div role="tablist" className="flex items-center gap-1 rounded-full bg-white/5 p-1 shrink-0">
      {tab('books', t('school:teacher.dashboard.drawer.tab_books'))}
      {tab('checkins', t('school:teacher.dashboard.drawer.tab_checkins'))}
    </div>
  )
}

export default function StudentDetailDrawer({ classId, student, nudge = null, onNudge, onClose }) {
  const { t } = useTranslation()
  const panelRef = useRef(null)
  const [tab, setTab] = useState('books')

  useEffect(() => {
    const previouslyFocused = document.activeElement
    panelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const heading = t('school:teacher.dashboard.drawer.heading', { name: student.display_name })

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto glass rounded-2xl p-6 border border-galaxy-text-muted/10 focus:outline-none"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-heading text-lg font-bold text-galaxy-text truncate">{heading}</h2>
          <Tabs active={tab} onChange={setTab} />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common:actions.close')}
            className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {onNudge && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              type="button"
              onClick={onNudge}
              aria-label={t('school:nudges.teacher.button_one_aria', { name: student.display_name })}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full bg-galaxy-secondary/15 text-galaxy-secondary font-body text-sm font-semibold hover:bg-galaxy-secondary/25 transition-colors"
            >
              <span aria-hidden="true">👋</span> {t('school:nudges.teacher.button')}
            </button>
            {nudge && (
              <span className="flex items-center gap-2 font-body text-xs text-galaxy-text-muted">
                {t('school:nudges.teacher.last_nudge')} <NudgeChip nudge={nudge} />
              </span>
            )}
          </div>
        )}

        {/* Both panels stay mounted for the drawer's whole lifetime —
            `hidden` only toggles CSS display, never React's mount tree —
            so switching tabs is instant and never re-fetches or resets
            either panel's own state (e.g. Books' open-book sub-view). */}
        <div role="tabpanel" hidden={tab !== 'books'}>
          <BooksPanelContent classId={classId} student={student} />
        </div>
        <div role="tabpanel" hidden={tab !== 'checkins'}>
          <CheckInsPanelContent classId={classId} student={student} />
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// The full-size preview of a library sheet (teacher round 6B): the real
// printed sheet, large — the width of the screen on a phone (scroll down
// for the rest), up to its true size on a wide screen — in an OPAQUE
// full-screen dialog (the owner asked for no see-through modals). The rest
// of the page goes `inert` while it's open (inert.js, as CustomizePanel), so
// Tab stays inside; Esc closes; the arrow keys and the Previous / Next
// buttons step through the current (filtered) list. Actions: Print,
// Customize and, for a signed-in teacher, "Assign to my class".
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, ChevronLeft, ChevronRight, Printer, SlidersHorizontal, ClipboardList } from 'lucide-react'
import { ScaledSheet, SHEET_WIDTH_PX } from './WorksheetThumbnail'
import { useElementWidth } from '../../hooks/useElementWidth'
import { enterInertBackground, exitInertBackground } from '../../lib/worksheets/inert.js'
import { schoolKey } from '../../lib/worksheets/templates.js'
import { assignWorksheetHref } from '../school/assignIntent.js'

export default function WorksheetPreview({
  template, list, sheetProps, teacherMode = false, onNavigate, onClose, onPrint, onCustomize,
}) {
  const { t } = useTranslation()
  const panelRef = useRef(null)
  const stageRef = useRef(null)
  const prevRef = useRef(null)
  const nextRef = useRef(null)
  const stageWidth = useElementWidth(stageRef)
  const index = list.findIndex((x) => x.id === template.id)
  const prev = index > 0 ? list[index - 1] : null
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null

  useEffect(() => {
    const previouslyFocused = document.activeElement
    enterInertBackground(document)
    panelRef.current?.focus()
    return () => {
      exitInertBackground(document)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') return onClose()
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return
      if (e.key === 'ArrowLeft' && prev) onNavigate(prev.id)
      if (e.key === 'ArrowRight' && next) onNavigate(next.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onNavigate, onClose])

  // Stepping to the first / last sheet disables the button that was just
  // pressed: focus moves to the other one (or the dialog) instead of
  // falling out to <body>.
  useEffect(() => {
    const active = document.activeElement
    const lost = !active || active === document.body
    if ((active === prevRef.current || lost) && !prev && prevRef.current?.disabled) {
      ;(next ? nextRef.current : panelRef.current)?.focus()
    } else if ((active === nextRef.current || lost) && !next && nextRef.current?.disabled) {
      ;(prev ? prevRef.current : panelRef.current)?.focus()
    }
  }, [prev, next])

  const sheetWidth = Math.min(SHEET_WIDTH_PX, stageWidth)
  const btn = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-semibold transition-colors'

  return createPortal(
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ws-preview-title"
      // print:hidden — printing from here prints the sheet portal, never this.
      className={`fixed inset-0 z-[70] flex flex-col bg-galaxy-bg-light focus:outline-none print:hidden ${teacherMode ? 'teacher-ui' : ''}`}
    >
      <div className="shrink-0 border-b border-galaxy-text-muted/15 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="ws-preview-title" className="font-heading text-lg font-bold text-galaxy-text break-words">
              {t(schoolKey(template.id, 'title'))}
            </h2>
            <p className="text-xs font-body text-galaxy-text-muted">
              {t(`school:worksheet.categories.${template.category}`)} · {t(`school:worksheet.grades.${template.gradeBand}`)}
            </p>
            <p className="text-sm font-body text-galaxy-text-muted mt-0.5">{t(schoolKey(template.id, 'description'))}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('school:worksheet.library.close_preview')}
            className="p-2 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4">
        <div ref={stageRef} className="max-w-4xl mx-auto flex justify-center">
          {sheetWidth > 0 && (
            <div className="rounded-lg overflow-hidden shadow-lg border border-black/10">
              <ScaledSheet width={sheetWidth} templateId={template.id} {...sheetProps} />
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-galaxy-text-muted/15 px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <button
              ref={prevRef}
              type="button"
              disabled={!prev}
              onClick={() => prev && onNavigate(prev.id)}
              aria-label={t('school:worksheet.library.previous')}
              title={t('school:worksheet.library.previous')}
              className={`${btn} text-galaxy-text border border-galaxy-text-muted/25 disabled:opacity-40 min-w-[44px]`}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              ref={nextRef}
              type="button"
              disabled={!next}
              onClick={() => next && onNavigate(next.id)}
              aria-label={t('school:worksheet.library.next')}
              title={t('school:worksheet.library.next')}
              className={`${btn} text-galaxy-text border border-galaxy-text-muted/25 disabled:opacity-40 min-w-[44px]`}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 ml-auto">
            <button type="button" onClick={onCustomize} className={`${btn} text-galaxy-text border border-galaxy-text-muted/25 hover:border-galaxy-secondary/50`}>
              <SlidersHorizontal size={14} aria-hidden="true" /> {t('worksheets:actions.customize')}
            </button>
            <button type="button" onClick={onPrint} className={`${btn} text-white font-bold btn-fill-primary`}>
              <Printer size={15} aria-hidden="true" /> {t('worksheets:actions.print')}
            </button>
            {teacherMode && (
              <Link to={assignWorksheetHref(template.id)} className={`${btn} text-galaxy-secondary border border-galaxy-secondary/40 hover:bg-galaxy-secondary/10`}>
                <ClipboardList size={15} aria-hidden="true" /> {t('school:worksheet.library.assign')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

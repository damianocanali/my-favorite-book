// The Customize side panel (brief §2): no account needed, nothing sent to
// a server — every field here lives only in WorksheetsPage's component
// state and is gone on refresh. Same modal chrome as AssignmentForm.jsx
// (bg-galaxy-bg-light rather than `.glass`, since this also sits over
// content that would otherwise show through a translucent panel).
import { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer } from 'lucide-react'
import { parseNameList, MAX_NAMES } from '../../lib/worksheets/names.js'
import { enterInertBackground, exitInertBackground } from '../../lib/worksheets/inert.js'

export default function CustomizePanel({ t, template, values, onChange, onPrint, onClose }) {
  const panelRef = useRef(null)
  const names = parseNameList(values.namesRaw)

  // Review round 1: #root goes `inert` for as long as this panel is open —
  // see inert.js's own comment for why that's preferred over hand-rolling a
  // Tab/Shift+Tab cycle. Paired enter/exit, with exit repeated on both the
  // Escape/close path and unmount, same belt-and-suspenders as
  // SignInCards.jsx's print-mode cleanup.
  useEffect(() => {
    const previouslyFocused = document.activeElement
    enterInertBackground(document)
    panelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      exitInertBackground(document)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // No names pasted yet still prints 1 (default) copy. i18next resolves the
  // _one/_other plural form itself from `count` (both keys exist in
  // worksheets.json) — review round 1 removed the manual singular/plural
  // branch this used to hand-roll alongside it.
  const copyCount = names.length || 1
  const copyLabel = t('customize.prefill_count', { count: copyCount })

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-end bg-black/60 px-4 py-4">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('customize.heading')}
        className="w-full max-w-sm max-h-full overflow-y-auto bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-text-muted/10 focus:outline-none space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-galaxy-text truncate">
            {t('customize.heading')} — {t(template.titleKey)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('customize.close')}
            className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1">
          <label htmlFor="ws-prompt" className="text-galaxy-text-muted text-sm font-body font-semibold">
            {t('customize.title_label')}
          </label>
          <p className="text-xs text-galaxy-text-muted">{t('customize.title_hint')}</p>
          <textarea
            id="ws-prompt"
            value={values.prompt}
            onChange={(e) => onChange({ prompt: e.target.value })}
            maxLength={200}
            rows={2}
            className="w-full px-3 py-2.5 glass border border-white/15 rounded-xl text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="ws-class" className="text-galaxy-text-muted text-sm font-body font-semibold">
              {t('customize.class_label')}
            </label>
            <input
              id="ws-class"
              type="text"
              value={values.className}
              onChange={(e) => onChange({ className: e.target.value })}
              maxLength={60}
              className="w-full px-3 py-2.5 glass border border-white/15 rounded-xl text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="ws-teacher" className="text-galaxy-text-muted text-sm font-body font-semibold">
              {t('customize.teacher_label')}
            </label>
            <input
              id="ws-teacher"
              type="text"
              value={values.teacherName}
              onChange={(e) => onChange({ teacherName: e.target.value })}
              maxLength={60}
              className="w-full px-3 py-2.5 glass border border-white/15 rounded-xl text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body"
            />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-galaxy-text-muted text-sm font-body font-semibold">{t('customize.sheet_language')}</p>
          <div className="flex gap-2" role="group" aria-label={t('customize.sheet_language')}>
            {['en', 'it'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onChange({ sheetLocale: code })}
                aria-pressed={values.sheetLocale === code}
                className={`px-3 py-2 rounded-xl text-sm font-body font-semibold border transition-colors ${
                  values.sheetLocale === code
                    ? 'bg-galaxy-primary text-white border-galaxy-primary'
                    : 'text-galaxy-text border-galaxy-text-muted/30 hover:border-galaxy-text-muted/50'
                }`}
              >
                {code === 'en' ? 'English' : 'Italiano'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="ws-names" className="text-galaxy-text-muted text-sm font-body font-semibold">
            {t('customize.prefill_heading')}
          </label>
          <p className="text-xs text-galaxy-text-muted">{t('customize.prefill_hint')}</p>
          <textarea
            id="ws-names"
            value={values.namesRaw}
            onChange={(e) => onChange({ namesRaw: e.target.value })}
            placeholder={t('customize.prefill_placeholder')}
            rows={4}
            maxLength={MAX_NAMES * 41}
            className="w-full px-3 py-2.5 glass border border-white/15 rounded-xl text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body resize-none"
          />
          <p className="text-xs text-galaxy-text-muted">{copyLabel}</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-body font-semibold text-sm text-galaxy-text-muted hover:text-galaxy-text transition-colors"
          >
            {t('customize.close')}
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors"
          >
            <Printer size={16} /> {t('actions.print')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// The Customize editor (brief §2; live preview, owner request 2026-10):
// no account needed, nothing sent to a server — every field here lives only
// in WorksheetsPage's component state and is gone on refresh.
//
// Two panes: the REAL sheet (WorksheetSheet, drawn by LiveSheet with the
// same sheetTranslators() and the same values the print job gets, so what
// is previewed is exactly what prints) and the form. Every keystroke
// redraws the sheet.
//   - md and up: a wide opaque dialog, the sheet on the left scaled to fit
//     the pane (whole page in view), the form on the right.
//   - phone: an "Edit | Preview" switch; the preview fits the width and
//     scrolls down.
// Opaque (bg-galaxy-bg-light, never `.glass`): it sits over the library.
import { useRef, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, ChevronLeft, ChevronRight } from 'lucide-react'
import i18next, { loadLocale } from '../../i18n/index.js'
import WorksheetSheet from './sheets.jsx'
import { ScaledPage, fitSheetWidth } from './WorksheetThumbnail'
import { useElementSize, useMediaQuery } from '../../hooks/useElementWidth'
import { parseNameList, MAX_NAMES } from '../../lib/worksheets/names.js'
import { MAX_PROMPT_LENGTH } from '../../lib/worksheets/params.js'
import { enterInertBackground, exitInertBackground } from '../../lib/worksheets/inert.js'
import { sheetTranslators, isSheetLocaleReady, previewCopyIndex } from '../../lib/worksheets/sheetLocale.js'

/// One copy of the sheet as it will print, scaled to `width` px. `locale`
/// must already be loaded (CustomizePanel waits for it).
export function LiveSheet({ templateId, locale, values, studentName = '', width }) {
  const sheetT = useMemo(() => sheetTranslators(i18next, locale), [locale])
  if (!(width > 0)) return null
  return (
    <div className="shadow-xl ring-1 ring-black/10 rounded-sm overflow-hidden shrink-0" data-testid="customize-live-sheet">
      <ScaledPage width={width}>
        <WorksheetSheet
          templateId={templateId}
          {...sheetT}
          prompt={values.prompt}
          className={values.className}
          teacherName={values.teacherName}
          studentName={studentName}
        />
      </ScaledPage>
    </div>
  )
}

/// "Copy 3 of 24 · Maya" with ‹ › — flips the preview through the copies.
/// Screen readers hear the new copy only when ‹ or › is pressed (a separate
/// live region), not on every keystroke in the names box.
export function CopyPager({ t, names, index, onIndex }) {
  const [announcement, setAnnouncement] = useState('')
  if (!names.length) return null
  const label = (i) => t('customize.preview_copy', { n: i + 1, total: names.length, name: names[i] })
  const go = (i) => {
    onIndex(i)
    setAnnouncement(label(i))
  }
  const btn = 'p-2 rounded-lg text-galaxy-text border border-galaxy-text-muted/25 disabled:opacity-40 min-w-[40px] min-h-[40px] flex items-center justify-center'
  return (
    <div className="flex items-center justify-center gap-2 min-w-0" data-testid="customize-copy-pager">
      <button type="button" className={btn} disabled={index <= 0} onClick={() => go(index - 1)} aria-label={t('customize.prev_copy')}>
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <p className="text-sm font-body text-galaxy-text truncate min-w-0">{label(index)}</p>
      <button type="button" className={btn} disabled={index >= names.length - 1} onClick={() => go(index + 1)} aria-label={t('customize.next_copy')}>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      <p className="sr-only" aria-live="polite" data-testid="customize-copy-announce">{announcement}</p>
    </div>
  )
}

/// The draft lives HERE, not in WorksheetsPage, so a keystroke re-renders
/// only this panel and never the 33-card library behind it. The page gets
/// the values back on Print and on close (it remembers the teacher name and
/// sheet language for the next sheet).
export default function CustomizePanel({ t, template, initialValues, onPrint, onClose, teacherMode = false }) {
  const panelRef = useRef(null)
  const stageRef = useRef(null)
  const [values, setValues] = useState(initialValues)
  const onChange = (patch) => setValues((v) => ({ ...v, ...patch }))
  const valuesRef = useRef(values)
  valuesRef.current = values
  const close = () => onClose(valuesRef.current)
  const names = parseNameList(values.namesRaw)
  const [copy, setCopy] = useState(0)
  // Keep the stored copy inside the list when names are removed.
  useEffect(() => {
    setCopy((c) => Math.min(c, Math.max(0, names.length - 1)))
  }, [names.length])
  const copyIndex = previewCopyIndex(names, copy)
  const [view, setView] = useState('edit') // the phone's Edit | Preview switch
  const wide = useMediaQuery('(min-width: 768px)')
  const stage = useElementSize(stageRef)
  const sheetWidth = fitSheetWidth(stage, { fitHeight: wide })

  // The preview draws in the sheet language only once its catalogue is in
  // memory; until then the previous language's render stays up (with a
  // small spinner) — never raw keys. Same loadLocale the print job awaits.
  // A failed load (offline, a stale chunk) says so instead of spinning forever.
  const [readyLocale, setReadyLocale] = useState(() => (isSheetLocaleReady(i18next, values.sheetLocale) ? values.sheetLocale : 'en'))
  const [localeFailed, setLocaleFailed] = useState(false)
  const [localeAttempt, setLocaleAttempt] = useState(0) // bumped by Try again
  useEffect(() => {
    let live = true
    setLocaleFailed(false)
    if (isSheetLocaleReady(i18next, values.sheetLocale)) setReadyLocale(values.sheetLocale)
    else {
      loadLocale(values.sheetLocale).then(
        () => { if (live) setReadyLocale(values.sheetLocale) },
        () => { if (live) setLocaleFailed(true) },
      )
    }
    return () => { live = false }
  }, [values.sheetLocale, localeAttempt])
  const loadingLocale = readyLocale !== values.sheetLocale && !localeFailed

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
      if (e.key === 'Escape') close()
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

  const field = 'w-full px-3 py-2.5 glass border border-white/15 rounded-xl text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body'
  const tab = (id) => `flex-1 px-3 py-2 rounded-lg text-sm font-body font-semibold transition-colors ${
    view === id ? 'bg-galaxy-primary text-white' : 'text-galaxy-text-muted hover:text-galaxy-text'
  }`

  return createPortal(
    <div className={`fixed inset-0 z-[70] flex items-center justify-center bg-black/60 md:px-4 md:py-4 print:hidden ${teacherMode ? 'teacher-ui' : ''}`}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('customize.heading')}
        className="w-full max-w-6xl h-full md:h-[calc(100dvh-2rem)] flex flex-col bg-galaxy-bg-light rounded-none md:rounded-2xl border border-galaxy-text-muted/10 focus:outline-none overflow-hidden"
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 md:px-6 pt-4 pb-3 border-b border-galaxy-text-muted/15">
          <h2 className="font-heading text-lg font-bold text-galaxy-text truncate min-w-0">
            {t('customize.heading')} — {t(`school:worksheet.templates.${template.id}.title`)}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={t('customize.close')}
            className="p-2 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Phone only: Edit | Preview. */}
        <div className="md:hidden shrink-0 px-4 pt-3">
          <div className="flex gap-1 p-1 rounded-xl border border-galaxy-text-muted/25" role="group" aria-label={t('customize.preview_label')}>
            <button type="button" className={tab('edit')} aria-pressed={view === 'edit'} onClick={() => setView('edit')}>{t('customize.edit_tab')}</button>
            <button type="button" className={tab('preview')} aria-pressed={view === 'preview'} onClick={() => setView('preview')}>{t('customize.preview_tab')}</button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <section
            aria-label={t('customize.preview_label')}
            className={`${view === 'preview' ? 'flex' : 'hidden'} md:flex flex-1 min-w-0 min-h-0 flex-col bg-galaxy-bg md:border-r border-galaxy-text-muted/15`}
          >
            <div className="shrink-0 px-4 pt-3 space-y-2">
              <p className="text-xs font-body text-galaxy-text-muted text-center">{t('customize.preview_hint')}</p>
              <CopyPager t={t} names={names} index={copyIndex} onIndex={setCopy} />
            </div>
            <div className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden md:overflow-hidden p-4">
              <div ref={stageRef} className="w-full md:h-full flex justify-center items-start">
                <LiveSheet
                  templateId={template.id}
                  locale={readyLocale}
                  values={values}
                  studentName={copyIndex >= 0 ? names[copyIndex] : ''}
                  width={sheetWidth}
                />
              </div>
              {localeFailed && (
                <div className="absolute top-6 left-6 right-6 flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-galaxy-bg-light border border-red-400/60" role="alert">
                  <p className="flex-1 min-w-0 text-sm font-body text-red-300">{t('customize.preview_locale_error')}</p>
                  <button
                    type="button"
                    onClick={() => setLocaleAttempt((n) => n + 1)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-body font-semibold text-galaxy-text border border-galaxy-text-muted/30 hover:border-galaxy-text-muted/50"
                  >
                    {t('customize.preview_retry')}
                  </button>
                </div>
              )}
              {loadingLocale && (
                <div className="absolute top-6 right-6 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-galaxy-bg-light border border-galaxy-text-muted/25" role="status">
                  <span className="w-3.5 h-3.5 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <span className="sr-only">{t('customize.preview_loading')}</span>
                </div>
              )}
            </div>
          </section>

          <div className={`${view === 'edit' ? 'block' : 'hidden'} md:block md:w-[22rem] lg:w-[24rem] shrink-0 min-h-0 overflow-y-auto px-4 md:px-6 py-4 space-y-4`}>
            <div className="space-y-1">
              <label htmlFor="ws-prompt" className="text-galaxy-text-muted text-sm font-body font-semibold">
                {t('customize.title_label')}
              </label>
              <p className="text-xs text-galaxy-text-muted">{t('customize.title_hint')}</p>
              <textarea
                id="ws-prompt"
                value={values.prompt}
                onChange={(e) => onChange({ prompt: e.target.value })}
                maxLength={MAX_PROMPT_LENGTH}
                rows={2}
                className={`${field} resize-none`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 min-w-0">
                <label htmlFor="ws-class" className="text-galaxy-text-muted text-sm font-body font-semibold">
                  {t('customize.class_label')}
                </label>
                <input
                  id="ws-class"
                  type="text"
                  value={values.className}
                  onChange={(e) => onChange({ className: e.target.value })}
                  maxLength={60}
                  className={field}
                />
              </div>
              <div className="space-y-1 min-w-0">
                <label htmlFor="ws-teacher" className="text-galaxy-text-muted text-sm font-body font-semibold">
                  {t('customize.teacher_label')}
                </label>
                <input
                  id="ws-teacher"
                  type="text"
                  value={values.teacherName}
                  onChange={(e) => onChange({ teacherName: e.target.value })}
                  maxLength={60}
                  className={field}
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
                className={`${field} resize-none`}
              />
              <p className="text-xs text-galaxy-text-muted">{copyLabel}</p>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap items-center justify-end gap-2 px-4 md:px-6 py-3 border-t border-galaxy-text-muted/15">
          <button
            type="button"
            onClick={close}
            className="px-4 py-2.5 rounded-xl font-body font-semibold text-sm text-galaxy-text-muted hover:text-galaxy-text transition-colors"
          >
            {t('customize.close')}
          </button>
          <button
            type="button"
            onClick={() => onPrint(values)}
            disabled={localeFailed}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={16} /> {t('actions.print')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

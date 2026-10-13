// The assign form's live preview (owner request 2026-10): the worksheet as
// the class will get it, redrawn on every keystroke of a box prompt, the
// acrostic word, the title or the instructions. Two looks, both the real
// renderers rather than a copy:
//   - "On screen": WorksheetFillBody, exactly what a child's WorksheetFill
//     draws (read-only, inert: no read-aloud, dictation or word help);
//   - "Printed": AssignmentWorksheetSheet, the printable blank — the same
//     one-page layout, or the full-wrap list when a prompt is too long for
//     its two-line label.
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18next from '../../i18n/index.js'
import { WorksheetFillTitle, WorksheetFillBoxes } from './WorksheetFillBody'
import { AssignmentWorksheetSheet } from '../worksheets/AssignmentSheet'
import { ScaledPage, fitSheetWidth } from '../worksheets/WorksheetThumbnail'
import { useElementWidth } from '../../hooks/useElementWidth'
import { fillLayout } from './worksheetUi'
import { cleanAcrosticWord } from '../../../lib/school/worksheets.js'

/// The form's draft worksheet as the saved assignment will carry it (the
/// acrostic word cleaned the way the API cleans it; an unusable one = the
/// child picks the word).
export function previewWorksheet(draft) {
  return {
    templateId: draft.templateId,
    prompts: draft.prompts ?? {},
    word: draft.templateId === 'acrostic' ? cleanAcrosticWord(draft.word ?? '') || null : null,
  }
}

export default function AssignPreview({ worksheet: draft, title, prompt, initialMode = 'screen', width: fixedWidth = null }) {
  const { t, i18n } = useTranslation()
  const [mode, setMode] = useState(initialMode)
  const stageRef = useRef(null)
  const measured = useElementWidth(stageRef)
  const width = fixedWidth ?? fitSheetWidth({ width: measured, height: 0 })
  const worksheet = useMemo(() => previewWorksheet(draft), [draft])
  const layout = useMemo(() => fillLayout(worksheet), [worksheet])
  const shownTitle = title?.trim() || t(`school:worksheet.templates.${worksheet.templateId}.title`, { defaultValue: t('school:worksheet.teacher.chip') })
  const lang = i18n.language === 'it' ? 'it' : 'en'

  const seg = (id) => `flex-1 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-body font-semibold transition-colors ${
    mode === id ? 'bg-galaxy-primary text-white' : 'text-galaxy-text-muted hover:text-galaxy-text'
  }`

  return (
    <section aria-label={t('school:worksheet.teacher.preview_heading')} className="space-y-3" data-testid="assign-preview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-galaxy-text text-sm font-body font-semibold">{t('school:worksheet.teacher.preview_heading')}</p>
          <p className="text-galaxy-text-muted text-xs font-body">{t('school:worksheet.teacher.preview_hint')}</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl border border-galaxy-text-muted/25 w-full sm:w-auto" role="group" aria-label={t('school:worksheet.teacher.preview_heading')}>
          <button type="button" className={seg('screen')} aria-pressed={mode === 'screen'} onClick={() => setMode('screen')}>{t('school:worksheet.teacher.preview_screen')}</button>
          <button type="button" className={seg('paper')} aria-pressed={mode === 'paper'} onClick={() => setMode('paper')}>{t('school:worksheet.teacher.preview_paper')}</button>
        </div>
      </div>

      <div ref={stageRef} className="w-full min-w-0">
        {mode === 'screen' ? (
          // The child's own full-screen backdrop, scaled down only by width.
          <div inert className="rounded-2xl bg-galaxy-bg border border-galaxy-text-muted/15 p-4 space-y-4 select-none" data-testid="assign-preview-screen">
            <WorksheetFillTitle templateId={worksheet.templateId} title={shownTitle} prompt={prompt} />
            <WorksheetFillBoxes layout={layout} worksheet={worksheet} answers={{}} preview />
          </div>
        ) : width > 0 && (
          <div className="flex justify-center" data-testid="assign-preview-paper">
            <div className="shadow-xl ring-1 ring-black/10 rounded-sm overflow-hidden">
              <ScaledPage width={width}>
                <AssignmentWorksheetSheet
                  t={t}
                  tSheet={i18next.getFixedT(lang, 'worksheets')}
                  title={shownTitle}
                  worksheet={worksheet}
                  answers={null}
                />
              </ScaledPage>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

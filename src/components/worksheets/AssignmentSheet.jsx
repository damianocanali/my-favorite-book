// A worksheet ASSIGNMENT on paper (spec 2026-10-01 §2): the assignment's
// own boxes and the teacher's prompts, blank for a paper day or filled
// with a child's hand-in. Printed through the free /worksheets library's
// print system — the same `.worksheet-sheet` page, WorksheetHeader (Name /
// Date) and footer, in a `.worksheets-print` portal under the
// print-worksheets mode (printMode.js) — so it inherits that system's
// "sheet is a sibling of #root" print fix instead of growing another.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import i18next from '../../i18n/index.js'
import WorksheetHeader from './WorksheetHeader'
import WorksheetFooter from './WorksheetFooter'
import { enterWorksheetsPrintMode, exitWorksheetsPrintMode } from '../school/printMode.js'
import { fillLayout, BOX_LINES } from '../school/worksheetUi.js'

function Lines({ count }) {
  return (
    <div className="space-y-4 pt-2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => <div key={i} className="border-b border-black h-4" />)}
    </div>
  )
}

function Answer({ text }) {
  return <p className="text-sm whitespace-pre-wrap break-words border-b border-black/40 pb-1 min-h-[1.25rem]">{text}</p>
}

/**
 * One sheet. `t`: the site translator (school namespace for the template's
 * own title); `tSheet`: worksheets-namespace translator for the shared
 * header/footer. `answers` null = a blank sheet.
 */
export function AssignmentWorksheetSheet({ t, tSheet, title, studentName = '', className = '', worksheet, answers = null }) {
  const filled = !!answers
  const layout = fillLayout(worksheet, answers?.word ?? '')
  return (
    <div className={`worksheet-sheet font-body flex flex-col ${filled ? 'worksheet-sheet-flow' : ''}`} data-testid="assignment-sheet">
      <h1 className="text-2xl font-heading font-bold text-center">{title}</h1>
      <p className="text-xs text-center text-black/70 mb-2">{t(`school:worksheet.templates.${worksheet.templateId}.title`)}</p>
      <WorksheetHeader t={tSheet} className={className} teacherName="" studentName={studentName} />
      <div className="worksheet-body flex-1 min-h-0 flex flex-col gap-3">
        {layout.map((box) => {
          if (box.type === 'word') {
            const word = worksheet.word || answers?.word || ''
            return (
              <div key={box.id} className="flex flex-col gap-1">
                <p className="font-bold text-sm">{box.prompt}</p>
                {word
                  ? <p className="text-xl font-bold tracking-[0.3em]">{word}</p>
                  : <Lines count={1} />}
              </div>
            )
          }
          if (box.type === 'letters') {
            // No word yet (the child picks it on paper): eight lines, letter space blank.
            const rows = box.letters.length ? box.letters : Array.from({ length: 8 }, (_, i) => ({ id: `line_${i + 1}`, letter: '' }))
            return (
              <div key={box.id} className="flex flex-col gap-1">
                <p className="font-bold text-sm">{box.prompt}</p>
                {rows.map((l) => (
                  <div key={l.id} className="flex items-end gap-2">
                    <span className="w-6 text-lg font-bold">{l.letter}</span>
                    <div className="flex-1">
                      {filled ? <Answer text={answers[l.id] ?? ''} /> : <div className="border-b border-black h-5" />}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
          return (
            <div key={box.id} className="flex flex-col gap-1">
              <p className="font-bold text-sm">{box.prompt}</p>
              {filled ? <Answer text={answers[box.id] ?? ''} /> : <Lines count={BOX_LINES[box.size] ?? 3} />}
            </div>
          )
        })}
      </div>
      <WorksheetFooter t={tSheet} templateId={worksheet.templateId.replace(/_/g, '-')} />
    </div>
  )
}

/**
 * Prints `job` = { title, className?, worksheet, sheets: [{ studentName,
 * answers }] } once mounted, then calls onDone. Mount it only while there
 * is a job.
 */
export default function AssignmentWorksheetPrint({ job, onDone }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'it' ? 'it' : 'en'

  useEffect(() => {
    const done = () => {
      exitWorksheetsPrintMode(document)
      onDone?.()
    }
    window.addEventListener('afterprint', done)
    // After React has committed the sheets into the portal (see
    // WorksheetsPage for why not in the click handler).
    enterWorksheetsPrintMode(document)
    window.print()
    return () => {
      window.removeEventListener('afterprint', done)
      exitWorksheetsPrintMode(document)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job])

  return createPortal(
    <div className="worksheets-print">
      {job.sheets.map((s, i) => (
        <AssignmentWorksheetSheet
          key={i}
          t={t}
          tSheet={i18next.getFixedT(lang, 'worksheets')}
          title={job.title}
          className={job.className ?? ''}
          studentName={s.studentName ?? ''}
          worksheet={job.worksheet}
          answers={s.answers ?? null}
        />
      ))}
    </div>,
    document.body
  )
}

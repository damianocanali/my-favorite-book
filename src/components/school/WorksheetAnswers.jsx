// A worksheet hand-in, read-only, for the teacher's review (spec
// 2026-10-01 §2): each box's prompt — as the child saw it, frozen in the
// hand-in — with the child's answer underneath. The grade panel and
// feedback follow it in AssignmentReview, unchanged.
import { useTranslation } from 'react-i18next'
import { fillLayout, snapshotPrompts } from './worksheetUi'

function AnswerText({ text }) {
  const { t } = useTranslation()
  return text?.trim()
    ? <p className="font-body text-galaxy-text whitespace-pre-wrap break-words">{text}</p>
    : <p className="font-body text-galaxy-text-muted text-sm italic">{t('school:worksheet.teacher.no_answer')}</p>
}

export default function WorksheetAnswers({ worksheet, answers = {} }) {
  const { t } = useTranslation()
  const layout = fillLayout({ templateId: worksheet.templateId, prompts: snapshotPrompts(worksheet), word: worksheet.word }, answers.word ?? '')
  return (
    <section className="space-y-3" aria-label={t('school:worksheet.teacher.answers_heading')}>
      <p className="text-xs font-body font-semibold text-galaxy-secondary uppercase tracking-wide">
        {t(`school:worksheet.templates.${worksheet.templateId}.title`)}
      </p>
      {layout.map((box) => (
        <div key={box.id} className="rounded-xl border border-galaxy-text-muted/15 bg-white/[0.03] p-3 space-y-1">
          <p className="font-body text-sm font-semibold text-galaxy-text-muted">{box.prompt}</p>
          {box.type === 'word' && <p className="font-heading text-lg font-bold tracking-[0.25em] text-galaxy-text">{worksheet.word || answers.word || '—'}</p>}
          {box.type === 'box' && <AnswerText text={answers[box.id]} />}
          {box.type === 'letters' && (
            <ul className="space-y-1">
              {box.letters.map((l) => (
                <li key={l.id} className="flex gap-3 items-baseline">
                  <span className="font-heading font-bold text-galaxy-secondary w-5 shrink-0">{l.letter}</span>
                  <AnswerText text={answers[l.id]} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  )
}

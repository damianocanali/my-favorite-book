// The worksheet half of the new/edit assignment form (spec 2026-10-01 §2):
// choose a template (cards with a small preview of its boxes), then edit
// the prompts, pre-filled in the teacher's language. Controlled: the
// parent (AssignmentForm) owns `value` = { templateId, prompts, word }.
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import { WORKSHEET_TEMPLATES, PROMPT_TEXT_MAX, ACROSTIC_WORD_MAX } from '../../../lib/school/worksheets.js'
import { defaultPrompts } from './worksheetUi'

const SIZE_HEIGHT = { small: 'h-2', medium: 'h-4', large: 'h-6' }

function TemplateCard({ template, selected, onPick }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={() => onPick(template.id)}
      aria-pressed={selected}
      className={`text-left rounded-xl p-3 border transition-colors flex flex-col gap-2 ${selected ? 'border-galaxy-secondary bg-galaxy-secondary/10' : 'border-galaxy-text-muted/20 hover:border-galaxy-secondary/50'}`}
    >
      {/* A tiny picture of the sheet: one bar per box, sized like the box. */}
      <div className="rounded-md bg-white/90 p-2 space-y-1" aria-hidden="true">
        {template.boxes.map((b) => (
          <div key={b.id} className={`rounded-sm border border-black/40 ${SIZE_HEIGHT[b.size]}`} />
        ))}
      </div>
      <span className="font-body font-semibold text-sm text-galaxy-text">{t(`school:worksheet.templates.${template.id}.title`)}</span>
      <span className="font-body text-xs text-galaxy-text-muted">{t(`school:worksheet.templates.${template.id}.description`)}</span>
    </button>
  )
}

export default function WorksheetPicker({ value, onChange, canChangeTemplate = true }) {
  const { t } = useTranslation()

  function pick(templateId) {
    if (value?.templateId === templateId) return
    onChange({ templateId, prompts: defaultPrompts(t, templateId), word: '' }, { picked: true })
  }

  if (!value?.templateId) {
    return (
      <div className="space-y-2">
        <p className="text-galaxy-text-muted text-sm font-body font-semibold">{t('school:worksheet.teacher.choose_template')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {WORKSHEET_TEMPLATES.map((tpl) => <TemplateCard key={tpl.id} template={tpl} selected={false} onPick={pick} />)}
        </div>
      </div>
    )
  }

  const template = WORKSHEET_TEMPLATES.find((x) => x.id === value.templateId)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-body font-semibold text-galaxy-text text-sm">{t(`school:worksheet.templates.${value.templateId}.title`)}</p>
        {canChangeTemplate && (
          <button
            type="button"
            onClick={() => onChange({ templateId: null, prompts: {}, word: '' })}
            className="text-xs font-body font-semibold text-galaxy-secondary hover:text-galaxy-text transition-colors"
          >
            {t('school:worksheet.teacher.change_template')}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-galaxy-text-muted text-sm font-body font-semibold">{t('school:worksheet.teacher.prompts_heading')}</p>
          <p className="text-galaxy-text-muted text-xs font-body">{t('school:worksheet.teacher.prompts_hint')}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...value, prompts: defaultPrompts(t, value.templateId) })}
          className="shrink-0 flex items-center gap-1 text-xs font-body font-semibold text-galaxy-text-muted hover:text-galaxy-text transition-colors"
        >
          <RotateCcw size={12} aria-hidden="true" /> {t('school:worksheet.teacher.reset_prompts')}
        </button>
      </div>

      <ol className="space-y-2">
        {template.boxes.map((b, i) => (
          <li key={b.id} className="space-y-1">
            <label htmlFor={`ws-prompt-${b.id}`} className="text-galaxy-text-muted text-xs font-body">
              {t('school:worksheet.teacher.box_label', { number: i + 1 })}
            </label>
            <input
              id={`ws-prompt-${b.id}`}
              type="text"
              value={value.prompts?.[b.id] ?? ''}
              maxLength={PROMPT_TEXT_MAX}
              onChange={(e) => onChange({ ...value, prompts: { ...value.prompts, [b.id]: e.target.value } })}
              className="w-full px-3 py-2 glass border border-white/15 rounded-xl text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body text-sm"
            />
          </li>
        ))}
      </ol>

      {value.templateId === 'acrostic' && (
        <div className="space-y-1">
          <label htmlFor="ws-acrostic-word" className="text-galaxy-text-muted text-sm font-body font-semibold">
            {t('school:worksheet.teacher.acrostic_word_label')}
          </label>
          <input
            id="ws-acrostic-word"
            type="text"
            value={value.word ?? ''}
            maxLength={ACROSTIC_WORD_MAX}
            onChange={(e) => onChange({ ...value, word: e.target.value })}
            className="w-full px-3 py-2 glass border border-white/15 rounded-xl text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body uppercase tracking-widest"
          />
          <p className="text-galaxy-text-muted text-xs font-body">{t('school:worksheet.teacher.acrostic_word_hint')}</p>
        </div>
      )}
    </div>
  )
}

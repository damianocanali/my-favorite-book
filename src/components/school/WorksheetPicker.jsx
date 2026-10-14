// The worksheet half of the new/edit assignment form (spec 2026-10-01 §2):
// choose a template from the worksheet library (teacher round 6B: the same
// 33 sheets, shelves, grade filter and search as /worksheets, compact), then
// edit the prompts, pre-filled in the teacher's language. Controlled: the
// parent (AssignmentForm) owns `value` = { templateId, prompts, word }.
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import { WORKSHEET_TEMPLATES, PROMPT_TEXT_MAX, ACROSTIC_WORD_MAX } from '../../../lib/school/worksheets.js'
import { filterTemplates, groupByCategory, hasActiveFilters } from '../../lib/worksheets/library.js'
import LibraryFilters, { LibraryEmpty } from '../worksheets/LibraryFilters'
import { defaultPrompts } from './worksheetUi'
import WorksheetThumbnail from '../worksheets/WorksheetThumbnail'
import { useElementWidth } from '../../hooks/useElementWidth'

// iPad round 7: the sheet drawn as its page (the library's own thumbnail,
// rendered once near the viewport), as wide as the card; the name and what
// it's for kept to two lines each with the room reserved, so every card in
// the chooser is the same size.
function CardThumbnail({ templateId }) {
  const { t } = useTranslation(['worksheets', 'checkin', 'games', 'school'])
  const ref = useRef(null)
  const width = useElementWidth(ref)
  const sheetProps = {
    t,
    tSchool: t,
    tCheckin: (key, opts) => t(`checkin:${key}`, opts),
    tGames: (key, opts) => t(`games:${key}`, opts),
  }
  return (
    <div ref={ref} className="w-full" aria-hidden="true">
      <WorksheetThumbnail lazy width={width} templateId={templateId} {...sheetProps} />
    </div>
  )
}

// The title's button is stretched over the whole card (::after), as on the
// library's cards, so the page thumbnail isn't block content in a <button>.
function TemplateCard({ template, selected, onPick }) {
  const { t } = useTranslation()
  return (
    <div className={`relative rounded-xl p-3 border transition-colors flex flex-col gap-2 h-full min-w-0 ${selected ? 'border-galaxy-secondary bg-galaxy-secondary/10' : 'border-galaxy-text-muted/20 hover:border-galaxy-secondary/50'}`}>
      <CardThumbnail templateId={template.id} />
      <button
        type="button"
        onClick={() => onPick(template.id)}
        aria-pressed={selected}
        className="text-left font-body font-semibold text-sm text-galaxy-text line-clamp-2 min-h-[2.5rem] after:absolute after:inset-0 after:rounded-xl after:content-[''] focus:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-galaxy-secondary"
      >
        {t(`school:worksheet.templates.${template.id}.title`)}
      </button>
      <span className="font-body text-xs text-galaxy-text-muted line-clamp-2 min-h-[2rem]">{t(`school:worksheet.templates.${template.id}.description`)}</span>
      <span className="font-body text-[10px] font-semibold text-galaxy-secondary mt-auto">{t(`school:worksheet.grades.${template.gradeBand}`)}</span>
    </div>
  )
}

export default function WorksheetPicker({ value, onChange, canChangeTemplate = true }) {
  const { t } = useTranslation()
  const [filters, setFilters] = useState({ q: '', cat: null, grade: null })
  const changeFilters = (patch) => setFilters((f) => ({ ...f, ...patch }))

  function pick(templateId) {
    if (value?.templateId === templateId) return
    onChange({ templateId, prompts: defaultPrompts(t, templateId), word: '' }, { picked: true })
  }

  if (!value?.templateId) {
    const results = filterTemplates(filters, t)
    const grid = (list) => (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {list.map((tpl) => <TemplateCard key={tpl.id} template={tpl} selected={false} onPick={pick} />)}
      </div>
    )
    return (
      <div className="space-y-3">
        <p className="text-galaxy-text-muted text-sm font-body font-semibold">{t('school:worksheet.teacher.choose_template')}</p>
        <LibraryFilters compact value={filters} onChange={changeFilters} idPrefix="ws-picker" />
        {results.length === 0 ? (
          <LibraryEmpty compact value={filters} onChange={changeFilters} />
        ) : hasActiveFilters(filters) ? grid(results) : (
          <div className="space-y-4">
            {groupByCategory(results).map((g) => (
              <section key={g.category} aria-label={t(`school:worksheet.categories.${g.category}`)} className="space-y-1.5">
                <p className="font-heading text-sm font-bold text-galaxy-text">{t(`school:worksheet.categories.${g.category}`)}</p>
                {grid(g.templates)}
              </section>
            ))}
          </div>
        )}
      </div>
    )
  }

  const template = WORKSHEET_TEMPLATES.find((x) => x.id === value.templateId)
  // A template this build doesn't know (editing a newer assignment): its
  // own prompts are the boxes.
  const boxes = template?.boxes ?? Object.keys(value.prompts ?? {}).map((id) => ({ id }))
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-body font-semibold text-galaxy-text text-sm">{t(`school:worksheet.templates.${value.templateId}.title`, { defaultValue: t('school:worksheet.teacher.chip') })}</p>
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
        {boxes.map((b, i) => (
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
            // Same rule as the API's: the word locks once the assignment
            // isn't a draft (canChangeTemplate is that same condition).
            disabled={!canChangeTemplate}
            onChange={(e) => onChange({ ...value, word: e.target.value })}
            className="w-full px-3 py-2 glass border border-white/15 rounded-xl text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body uppercase tracking-widest disabled:opacity-60"
          />
          <p className="text-galaxy-text-muted text-xs font-body">
            {t(canChangeTemplate ? 'school:worksheet.teacher.acrostic_word_hint' : 'school:worksheet.teacher.acrostic_word_locked')}
          </p>
        </div>
      )}
    </div>
  )
}

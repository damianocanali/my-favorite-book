// The worksheet library's search box, shelf chips and grade filter (teacher
// round 6B). Controlled and stateless: the /worksheets page keeps the values
// in the URL, the assign picker in its own state. `compact` = the picker's
// smaller version inside the assignment form.
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { WORKSHEET_CATEGORIES } from '../../../lib/school/worksheets.js'
import { QUERY_MAX } from '../../lib/worksheets/library.js'

function Chip({ selected, onClick, children, compact }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border font-body font-semibold transition-colors ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
        selected
          ? 'bg-galaxy-primary text-white border-galaxy-primary'
          : 'text-galaxy-text border-galaxy-text-muted/30 hover:border-galaxy-text-muted/60'
      }`}
    >
      {children}
    </button>
  )
}

export default function LibraryFilters({ value, onChange, compact = false, idPrefix = 'ws-library' }) {
  const { t } = useTranslation()
  const { q, cat, grade } = value
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="relative">
        <label htmlFor={`${idPrefix}-search`} className="sr-only">{t('school:worksheet.library.search_label')}</label>
        <Search size={compact ? 14 : 16} className="absolute left-3 top-1/2 -translate-y-1/2 text-galaxy-text-muted pointer-events-none" aria-hidden="true" />
        <input
          id={`${idPrefix}-search`}
          type="search"
          value={q}
          maxLength={QUERY_MAX}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder={t('school:worksheet.library.search_placeholder')}
          autoComplete="off"
          className={`w-full pl-9 pr-9 glass border border-white/15 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted focus:border-galaxy-primary focus:outline-none font-body ${compact ? 'py-2 text-sm' : 'py-2.5'}`}
        />
        {q && (
          <button
            type="button"
            onClick={() => onChange({ q: '' })}
            aria-label={t('school:worksheet.library.clear_search')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('school:worksheet.library.category_label')}>
        <Chip compact={compact} selected={!cat} onClick={() => onChange({ cat: null })}>
          {t('school:worksheet.library.all_categories')}
        </Chip>
        {WORKSHEET_CATEGORIES.map((c) => (
          <Chip key={c} compact={compact} selected={cat === c} onClick={() => onChange({ cat: cat === c ? null : c })}>
            {t(`school:worksheet.categories.${c}`)}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('school:worksheet.library.grade_label')}>
        <span className={`font-body font-semibold text-galaxy-text-muted mr-1 ${compact ? 'text-xs' : 'text-sm'}`} aria-hidden="true">
          {t('school:worksheet.library.grade_label')}
        </span>
        <Chip compact={compact} selected={!grade} onClick={() => onChange({ grade: null })}>
          {t('school:worksheet.library.all_grades')}
        </Chip>
        {['k2', 'g35'].map((g) => (
          <Chip key={g} compact={compact} selected={grade === g} onClick={() => onChange({ grade: grade === g ? null : g })}>
            {t(`school:worksheet.grades.${g}`)}
          </Chip>
        ))}
      </div>
    </div>
  )
}

/// "No worksheet matches…" with the way back.
export function LibraryEmpty({ value, onChange, compact = false }) {
  const { t } = useTranslation()
  const searched = !!value.q.trim()
  return (
    <div className={`text-center rounded-2xl border border-dashed border-galaxy-text-muted/30 ${compact ? 'p-4' : 'p-8'}`} role="status">
      <p className="font-body text-galaxy-text">
        {searched
          ? t('school:worksheet.library.no_results', { query: value.q.trim() })
          : t('school:worksheet.library.no_results_filters')}
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {searched && (
          <button
            type="button"
            onClick={() => onChange({ q: '' })}
            className="px-3 py-1.5 rounded-xl text-sm font-body font-semibold text-galaxy-secondary border border-galaxy-secondary/40 hover:bg-galaxy-secondary/10"
          >
            {t('school:worksheet.library.clear_search')}
          </button>
        )}
        <button
          type="button"
          onClick={() => onChange({ q: '', cat: null, grade: null })}
          className="px-3 py-1.5 rounded-xl text-sm font-body font-semibold text-galaxy-text-muted hover:text-galaxy-text"
        >
          {t('school:worksheet.library.show_all')}
        </button>
      </div>
    </div>
  )
}

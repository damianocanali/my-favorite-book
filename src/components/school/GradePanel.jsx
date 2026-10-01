import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, X, Check, Plus, ChevronDown } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { teacherErrorText } from './teacherErrors'
import { relativeTime } from './relativeTime'
import {
  LEVELS, SKILLS, TIP_SKILLS, TIPS_MAX, TIP_TEXT_MAX, LEVEL_EMOJI, LEVEL_TONE, tipLabel, gradeProblem,
} from './gradingUi'

// "🌿 Growing" as a small pill (review list, history, levels over time).
export function LevelChip({ level, className = '' }) {
  const { t } = useTranslation()
  if (!LEVELS.includes(level)) return null
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-body font-semibold text-galaxy-text ${LEVEL_TONE[level]} ${className}`}>
      <span aria-hidden="true">{LEVEL_EMOJI[level]}</span>
      {t(`school:grading.levels.${level}`)}
    </span>
  )
}

export function SentBackChip({ className = '' }) {
  const { t } = useTranslation()
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-body font-semibold bg-amber-400/15 text-amber-200 border-amber-400/40 ${className}`}>
      {t('school:grading.teacher.sent_back')}
    </span>
  )
}

// The grade for the version on screen: four big level buttons, the tip
// library by skill plus a custom tip (≤3 in all), Send back to revise, and
// the earlier versions' grades. Prefilled from this version's grade, so a
// re-grade edits it. Stickers/comments stay in FeedbackPanel below it.
// iPad: TeacherGradePanel. API: POST /api/school/grades.
export default function GradePanel({ classId, submissionId, version, grades = [], onSaved, locale }) {
  const { t } = useTranslation()
  const current = grades.find((g) => g.version === version) ?? null
  const earlier = grades.filter((g) => g.version !== version)

  const [level, setLevel] = useState(current?.level ?? null)
  const [tips, setTips] = useState(current?.tips ?? [])
  const [custom, setCustom] = useState('')
  const [returned, setReturned] = useState(!!current?.returned)
  const [openSkill, setOpenSkill] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const full = tips.length >= TIPS_MAX
  const hasKey = (key) => tips.some((x) => x.key === key)

  function toggleKey(key) {
    setSaved(false)
    setTips((prev) => (prev.some((x) => x.key === key) ? prev.filter((x) => x.key !== key) : prev.length >= TIPS_MAX ? prev : [...prev, { key }]))
  }

  function withCustom(list) {
    const text = custom.trim()
    if (!text || list.length >= TIPS_MAX || list.some((x) => x.text === text)) return list
    return [...list, { text }]
  }

  function addCustom() {
    setTips((prev) => withCustom(prev))
    setCustom('')
    setSaved(false)
  }

  async function handleSave() {
    // A typed tip that wasn't added yet still counts.
    const list = withCustom(tips)
    if (list !== tips) {
      setTips(list)
      setCustom('')
    }
    const problem = gradeProblem({ level, tips: list, returned })
    if (problem) return setError(t(problem))
    setSaving(true)
    setError(null)
    setSaved(false)
    const res = await schoolFetch('/api/school/grades', {
      method: 'POST',
      body: JSON.stringify({ classId, submissionId, version, level, tips: list, returned }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      onSaved?.(res.data.grade)
    } else {
      setError(teacherErrorText(t, res.code || 'generic'))
    }
  }

  return (
    <div className="space-y-4 border-t border-galaxy-text-muted/10 pt-4">
      <h3 className="font-heading text-sm font-bold text-galaxy-text">{t('school:grading.teacher.heading')}</h3>

      <fieldset className="space-y-2">
        <legend className="text-xs font-body font-semibold text-galaxy-text-muted mb-2">{t('school:grading.teacher.level_label')}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {LEVELS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={level === id}
              onClick={() => { setLevel(id); setSaved(false) }}
              className={`min-h-[76px] flex flex-col items-center justify-center gap-1 rounded-xl border transition-colors ${
                level === id ? `${LEVEL_TONE[id]} border-2` : 'border-galaxy-text-muted/20 hover:border-galaxy-secondary/40'
              }`}
            >
              <span aria-hidden="true" className="text-3xl leading-none">{LEVEL_EMOJI[id]}</span>
              <span className="text-sm font-body font-semibold text-galaxy-text">{t(`school:grading.levels.${id}`)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <p className="text-xs font-body font-semibold text-galaxy-text-muted">{t('school:grading.teacher.tips_label')}</p>
        {tips.length > 0 && (
          <ul className="space-y-1.5">
            {tips.map((tip) => (
              <li key={tip.key ?? `t:${tip.text}`} className="flex items-start gap-2 rounded-lg bg-white/[0.05] px-2.5 py-2 text-sm font-body text-galaxy-text">
                <Lightbulb size={14} className="text-amber-300 mt-0.5 shrink-0" aria-hidden="true" />
                <span className="flex-1 min-w-0">{tipLabel(t, tip) ?? tip.key}</span>
                <button
                  type="button"
                  onClick={() => { setTips((prev) => prev.filter((x) => x !== tip)); setSaved(false) }}
                  aria-label={t('school:grading.teacher.remove_tip')}
                  className="p-1 rounded text-galaxy-text-muted hover:text-galaxy-text shrink-0"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {full ? (
          <p className="text-xs font-body text-galaxy-text-muted">{t('school:grading.teacher.tips_full')}</p>
        ) : (
          <>
            <div className="space-y-1">
              {SKILLS.map((skill) => {
                const open = openSkill === skill
                return (
                  <div key={skill} className="rounded-lg border border-galaxy-text-muted/10">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenSkill(open ? null : skill)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-body font-semibold text-galaxy-text"
                    >
                      {t(`school:grading.skills.${skill}`)}
                      <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <ul className="px-2 pb-2 space-y-1">
                        {TIP_SKILLS[skill].map((tip) => {
                          const key = `${skill}.${tip}`
                          const on = hasKey(key)
                          return (
                            <li key={key}>
                              <button
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggleKey(key)}
                                className={`w-full flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm font-body transition-colors ${
                                  on ? 'bg-galaxy-secondary/20 text-galaxy-text' : 'text-galaxy-text hover:bg-white/[0.05]'
                                }`}
                              >
                                {on ? <Check size={14} className="text-galaxy-secondary mt-0.5 shrink-0" aria-hidden="true" /> : <Plus size={14} className="text-galaxy-text-muted mt-0.5 shrink-0" aria-hidden="true" />}
                                {t(`school:grading.tips.${key}`)}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-1">
                <label htmlFor={`custom-tip-${submissionId}`} className="sr-only">{t('school:grading.teacher.custom_placeholder')}</label>
                <input
                  id={`custom-tip-${submissionId}`}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
                  maxLength={TIP_TEXT_MAX}
                  placeholder={t('school:grading.teacher.custom_placeholder')}
                  className="w-full px-3 py-2 glass border border-white/15 rounded-xl text-sm text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body"
                />
                <p className="text-right text-xs font-body text-galaxy-text-muted">{custom.length}/{TIP_TEXT_MAX}</p>
              </div>
              <button
                type="button"
                disabled={!custom.trim()}
                onClick={addCustom}
                className="px-3 py-2 rounded-xl text-sm font-body font-semibold text-galaxy-secondary bg-galaxy-secondary/15 hover:bg-galaxy-secondary/25 transition-colors disabled:opacity-40"
              >
                {t('school:grading.teacher.custom_add')}
              </button>
            </div>
          </>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={returned}
          onChange={(e) => { setReturned(e.target.checked); setSaved(false) }}
          className="mt-1 w-4 h-4 accent-cyan-400"
        />
        <span className="font-body">
          <span className="block text-sm text-galaxy-text">{t('school:grading.teacher.return_label')}</span>
          <span className="block text-xs text-galaxy-text-muted">{t('school:grading.teacher.return_hint')}</span>
        </span>
      </label>

      {error && <p className="text-red-400 text-sm font-body">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors disabled:opacity-60"
        >
          {saving ? t('school:grading.teacher.saving') : returned ? t('school:grading.teacher.save_return') : t('school:grading.teacher.save')}
        </button>
        {saved && (
          <span role="status" className="inline-flex items-center gap-1 text-xs font-body font-semibold text-emerald-300">
            <Check size={14} aria-hidden="true" /> {t('school:grading.teacher.saved')}
          </span>
        )}
      </div>

      {earlier.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-galaxy-text-muted/10">
          <p className="text-xs font-body font-semibold text-galaxy-text-muted">{t('school:grading.teacher.history')}</p>
          <ul className="space-y-2">
            {earlier.map((g) => (
              <li key={g.id} className="text-sm font-body">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-galaxy-text-muted tabular-nums">v{g.version}</span>
                  <LevelChip level={g.level} />
                  {g.returned && <SentBackChip />}
                  <span className="text-xs text-galaxy-text-muted">{relativeTime(g.updated_at ?? g.created_at, locale)}</span>
                </div>
                {(g.tips ?? []).map((tip) => {
                  const label = tipLabel(t, tip)
                  return label ? <p key={tip.key ?? `t:${tip.text}`} className="pl-7 text-xs text-galaxy-text-muted">{label}</p> : null
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

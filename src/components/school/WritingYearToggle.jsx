import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookHeart } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { wyErrorText } from './writingYearUi'

// "Add to Writing Year" under the grade panel (spec §3). On adds the graded
// hand-in to the child's year-end book (approving it if the child had
// suggested it); off removes it. Only offered once the hand-in is graded —
// the server refuses an ungraded one too. iPad: WritingYearToggle.swift.
export default function WritingYearToggle({ classId, submissionId, graded }) {
  const { t } = useTranslation()
  const [item, setItem] = useState(undefined) // undefined while loading, null when not in it
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let live = true
    setItem(undefined)
    schoolFetch(`/api/school/writing-year?classId=${encodeURIComponent(classId)}&submissionId=${encodeURIComponent(submissionId)}`)
      .then((res) => { if (live) setItem(res.ok ? res.data?.item ?? null : null) })
    return () => { live = false }
  }, [classId, submissionId])

  const on = !!item?.approved

  async function toggle() {
    setBusy(true)
    setError(null)
    const res = on
      ? await schoolFetch('/api/school/writing-year', { method: 'POST', body: JSON.stringify({ classId, action: 'remove', itemId: item.id }) })
      : await schoolFetch('/api/school/writing-year', { method: 'POST', body: JSON.stringify({ classId, action: 'add', submissionId }) })
    setBusy(false)
    if (!res.ok) return setError(wyErrorText(t, res.code))
    setItem(on ? null : { id: res.data.item.id, approved: true })
  }

  if (item === undefined) return null
  return (
    <div className="border-t border-galaxy-text-muted/10 pt-4 space-y-1">
      <label className={`flex items-start gap-3 ${graded ? 'cursor-pointer' : 'opacity-60'}`}>
        <input
          type="checkbox"
          checked={on}
          disabled={!graded || busy}
          onChange={toggle}
          className="mt-1 w-4 h-4 accent-cyan-400"
        />
        <span className="font-body">
          <span className="flex items-center gap-1.5 text-sm text-galaxy-text">
            <BookHeart size={14} className="text-galaxy-secondary" aria-hidden="true" />
            {t('school:writing_year.teacher.toggle_label')}
          </span>
          <span className="block text-xs text-galaxy-text-muted">
            {!graded
              ? t('school:writing_year.teacher.toggle_needs_grade')
              : item && !item.approved
                ? t('school:writing_year.teacher.toggle_waiting')
                : t('school:writing_year.teacher.toggle_hint')}
          </span>
        </span>
      </label>
      {error && <p className="text-red-400 text-xs font-body">{error}</p>}
    </div>
  )
}

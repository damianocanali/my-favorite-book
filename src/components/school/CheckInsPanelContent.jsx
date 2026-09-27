import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { schoolFetch } from '../../lib/schoolApi'
import { teacherErrorText } from './teacherErrors'
import { relativeTime } from './relativeTime'
import FeelingIcon from './FeelingIcon'

// The content (no dialog chrome) behind a student's check-in history:
// GET /api/school/student-checkins, last 30 days, as a simple dated list —
// no totals, no ranking (owner decision D7). Mounted by
// StudentDetailDrawer alongside BooksPanelContent inside ONE dialog shell
// (see that file's own comment for why this isn't its own portal/dialog).
export default function CheckInsPanelContent({ classId, student }) {
  const { t, i18n } = useTranslation()

  const [checkins, setCheckins] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await schoolFetch(
      `/api/school/student-checkins?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(student.id)}`
    )
    setLoading(false)
    if (res.ok) setCheckins(res.data?.checkins ?? [])
    else setError(res.code || 'generic')
  }, [classId, student.id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-red-400 text-sm font-body">{teacherErrorText(t, error)}</p>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors"
        >
          {t('common:actions.retry')}
        </button>
      </div>
    )
  }

  if (checkins.length === 0) {
    return (
      <p className="text-galaxy-text-muted font-body text-sm text-center py-8">
        {t('school:teacher.dashboard.drawer.checkins_empty')}
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {checkins.map((c, i) => {
        const feelingLabel = t(`checkin:feeling.${c.feeling}`)
        const needLabel = c.need ? t(`checkin:need.${c.need}`) : null
        const when = relativeTime(c.created_at, i18n.language)
        const line = needLabel
          ? t('school:teacher.dashboard.drawer.checkin_item_with_need', { feeling: feelingLabel, need: needLabel, when })
          : t('school:teacher.dashboard.drawer.checkin_item', { feeling: feelingLabel, when })
        return (
          <li key={i} className="flex items-center gap-3 glass rounded-xl p-3 border border-galaxy-text-muted/10">
            <FeelingIcon id={c.feeling} size={28} />
            {needLabel && <FeelingIcon id={c.need} size={20} />}
            <p className="font-body text-sm text-galaxy-text">{line}</p>
          </li>
        )
      })}
    </ul>
  )
}

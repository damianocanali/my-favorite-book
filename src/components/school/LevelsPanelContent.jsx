import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { schoolFetch } from '../../lib/schoolApi'
import { teacherErrorText } from './teacherErrors'
import { relativeTime } from './relativeTime'
import { LevelChip, SentBackChip } from './GradePanel'

// A student's levels over time (GET /api/school/grades?classId&studentId):
// every graded hand-in version, oldest first. A plain list — no chart, no
// average, no ranking. Mounted by StudentDetailDrawer next to Books and
// Check-ins. iPad: TeacherLevelsOverTime.
export default function LevelsPanelContent({ classId, student }) {
  const { t, i18n } = useTranslation()
  const [grades, setGrades] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await schoolFetch(
      `/api/school/grades?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(student.id)}`
    )
    if (res.ok) setGrades(res.data?.grades ?? [])
    else setError(res.code || 'generic')
  }, [classId, student.id])

  useEffect(() => {
    load()
  }, [load])

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

  if (grades === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (grades.length === 0) {
    return <p className="text-galaxy-text-muted font-body text-sm text-center py-8">{t('school:grading.teacher.no_grades')}</p>
  }

  return (
    <ul className="space-y-2">
      {grades.map((g) => (
        <li key={g.id} className="flex flex-wrap items-center gap-3 glass rounded-xl p-3 border border-galaxy-text-muted/10">
          <div className="flex-1 min-w-0">
            <p className="font-body text-sm text-galaxy-text truncate">{g.assignment_title}</p>
            <p className="font-body text-xs text-galaxy-text-muted">
              v{g.version} · {relativeTime(g.updated_at ?? g.created_at, i18n.language)}
            </p>
          </div>
          {g.returned && <SentBackChip />}
          <LevelChip level={g.level} />
        </li>
      ))}
    </ul>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { teacherErrorText } from './teacherErrors'
import { relativeTime } from './relativeTime'
import FeelingIcon from './FeelingIcon'

// The dashboard's student detail drawer's "Check-ins" tab (Task D2):
// GET /api/school/student-checkins, last 30 days, as a simple dated list —
// no totals, no ranking (owner decision D7). Same modal chrome as
// StudentBooks (its sibling tab) so switching tabs reads as one dialog:
// portal, role="dialog", focus moved onto the panel and given back on
// close, Escape alongside the Close button.
export default function StudentCheckIns({ classId, student, onClose, headerExtra }) {
  const { t, i18n } = useTranslation()
  const panelRef = useRef(null)

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

  useEffect(() => {
    const previouslyFocused = document.activeElement
    panelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const heading = t('school:teacher.student_books.heading', { name: student.display_name })

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto glass rounded-2xl p-6 border border-galaxy-text-muted/10 focus:outline-none"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-heading text-lg font-bold text-galaxy-text truncate">{heading}</h2>
          {headerExtra}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common:actions.close')}
            className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
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
        ) : checkins.length === 0 ? (
          <p className="text-galaxy-text-muted font-body text-sm text-center py-8">
            {t('school:teacher.dashboard.drawer.checkins_empty')}
          </p>
        ) : (
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
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}

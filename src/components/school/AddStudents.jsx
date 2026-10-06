// The roster-paste form: a teacher drops in one name per line (or a
// spreadsheet column, comma-separated), previews the cleaned-up list, and
// posts it in one batch. On success it hands the newly created students —
// including their one-time-visible pictures — up to the parent so it can
// show SignInCards; this component keeps no picture data of its own beyond
// the single render that follows submission.
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus } from 'lucide-react'
import { parseRosterText } from './rosterText'
import { schoolFetch } from '../../lib/schoolApi'
import { teacherErrorText } from './teacherErrors'
import { useIsBillingAdmin } from '../../hooks/useIsBillingAdmin'
import { forBillingRole } from './billingCopy'
import { isLicenseUsable } from '../../../lib/school/license.js'

export default function AddStudents({ classId, license, onCreated }) {
  const { t } = useTranslation()
  const billingAdmin = useIsBillingAdmin()
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [lastResult, setLastResult] = useState(null) // { count, skipped }

  const names = useMemo(() => parseRosterText(text), [text])
  const blocked = !isLicenseUsable(license)

  async function handleSubmit() {
    if (names.length === 0 || submitting) return
    setSubmitting(true)
    setError(null)
    setLastResult(null)
    const res = await schoolFetch('/api/school/students', {
      method: 'POST',
      body: JSON.stringify({ classId, students: names.map((name) => ({ name })) }),
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.code || 'generic')
      return
    }
    const created = res.data?.created ?? []
    const skipped = res.data?.skipped ?? []
    setText('')
    setLastResult({ count: created.length, skipped })
    if (created.length > 0) onCreated(created)
  }

  if (blocked) {
    return (
      <div className="glass rounded-2xl p-6 border border-amber-500/20 space-y-2">
        <h2 className="font-heading text-lg font-bold text-galaxy-text flex items-center gap-2">
          <UserPlus size={18} className="text-galaxy-secondary" /> {t('school:teacher.add_students.heading')}
        </h2>
        <p className="text-amber-300 text-sm font-body">{t(forBillingRole('school:teacher.add_students.license_blocked', billingAdmin))}</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-4">
      <h2 className="font-heading text-lg font-bold text-galaxy-text flex items-center gap-2">
        <UserPlus size={18} className="text-galaxy-secondary" /> {t('school:teacher.add_students.heading')}
      </h2>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('school:teacher.add_students.placeholder')}
        rows={6}
        className="w-full px-4 py-3 glass border border-white/15 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/40 focus:border-galaxy-primary focus:outline-none font-body resize-y"
      />

      {error && <p className="text-red-400 text-sm font-body">{teacherErrorText(t, error, { billingAdmin })}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={names.length === 0 || submitting}
        className="px-4 py-2.5 rounded-xl font-body font-bold text-white btn-fill-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting
          ? t('school:teacher.add_students.submitting')
          : t('school:teacher.add_students.preview_count', { count: names.length })}
      </button>

      {lastResult && (
        <div className="space-y-2 pt-2 border-t border-galaxy-text-muted/10">
          <p className="text-emerald-300 text-sm font-body">
            {t('school:teacher.add_students.success', { count: lastResult.count })}
          </p>
          {lastResult.skipped.length > 0 && (
            <div>
              <p className="text-galaxy-text-muted text-xs font-body font-semibold uppercase tracking-wide mb-1">
                {t('school:teacher.add_students.skipped_heading')}
              </p>
              <ul className="space-y-0.5">
                {lastResult.skipped.map((s, i) => (
                  <li key={`${s.name}-${i}`} className="text-galaxy-text-muted text-sm font-body">
                    {t('school:teacher.add_students.skipped_line', {
                      name: s.name,
                      reason: teacherErrorText(t, s.code, { standalone: false, billingAdmin }),
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

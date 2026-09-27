// Mon–Sun school-hours editor plus the class's US time zone. Purely a form
// over its props — the actual PATCH /api/school/classes call lives in
// TeacherClassPage (via the `onSave` prop) so this component never talks to
// the network directly and stays easy to reason about.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { DEFAULT_SCHOOL_HOURS, validateSchoolHours } from '../../../lib/school/hours.js'

const DAYS = [1, 2, 3, 4, 5, 6, 7]
const DEFAULT_SPAN = DEFAULT_SCHOOL_HOURS[1]

// The US zones the brief calls out, in the order a teacher would scan them
// west-to-east... actually east-to-west, coast first since that's where
// most schools are.
const US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
]

function buildState(hours) {
  const enabled = {}
  const spans = {}
  for (const d of DAYS) {
    const span = hours?.[d]
    enabled[d] = !!span
    spans[d] = span ?? DEFAULT_SPAN
  }
  return { enabled, spans }
}

export default function SchoolHoursEditor({ classId, schoolHours, timezone, onSave }) {
  const { t } = useTranslation()
  const initial = buildState(schoolHours)
  const [enabled, setEnabled] = useState(initial.enabled)
  const [spans, setSpans] = useState(initial.spans)
  const [tz, setTz] = useState(timezone)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // The class's current zone might not be one of the seven US zones this
  // select offers (data from before this list existed, or a manual DB
  // edit) — keep it selectable rather than silently swapping it out from
  // under the teacher the moment this form renders.
  const zoneOptions = US_TIMEZONES.includes(timezone) ? US_TIMEZONES : [timezone, ...US_TIMEZONES]

  function toggleDay(day) {
    setEnabled((prev) => ({ ...prev, [day]: !prev[day] }))
  }

  function updateSpan(day, index, value) {
    setSpans((prev) => {
      const span = [...prev[day]]
      span[index] = value
      return { ...prev, [day]: span }
    })
  }

  async function handleSave() {
    const school_hours = Object.fromEntries(DAYS.filter((d) => enabled[d]).map((d) => [d, spans[d]]))
    if (!validateSchoolHours(school_hours)) {
      setError('bad_hours')
      return
    }
    setSaving(true)
    setError(null)
    const res = await onSave({ id: classId, school_hours, timezone: tz })
    setSaving(false)
    if (!res?.ok) setError(res?.code || 'generic')
  }

  return (
    <div className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-4">
      <div className="flex items-center gap-2">
        <Clock size={18} className="text-galaxy-secondary" />
        <h2 className="font-heading text-lg font-bold text-galaxy-text">{t('school:teacher.hours.heading')}</h2>
      </div>
      <p className="text-galaxy-text-muted font-body text-sm -mt-2">{t('school:teacher.hours.hint')}</p>

      <div className="space-y-1">
        {DAYS.map((day) => (
          <div key={day} className="flex flex-wrap items-center gap-3 py-1.5">
            <label className="flex items-center gap-2 w-36 shrink-0 font-body text-sm text-galaxy-text">
              <input
                type="checkbox"
                checked={enabled[day]}
                onChange={() => toggleDay(day)}
                className="w-4 h-4 accent-galaxy-secondary"
              />
              {t(`school:teacher.hours.days.${day}`)}
            </label>
            <input
              type="time"
              aria-label={`${t(`school:teacher.hours.days.${day}`)} ${t('school:teacher.hours.start_label')}`}
              value={spans[day][0]}
              disabled={!enabled[day]}
              onChange={(e) => updateSpan(day, 0, e.target.value)}
              className="px-2 py-1.5 glass border border-white/15 rounded-lg text-galaxy-text font-body text-sm disabled:opacity-40 focus:border-galaxy-primary focus:outline-none"
            />
            <span className="text-galaxy-text-muted" aria-hidden="true">–</span>
            <input
              type="time"
              aria-label={`${t(`school:teacher.hours.days.${day}`)} ${t('school:teacher.hours.end_label')}`}
              value={spans[day][1]}
              disabled={!enabled[day]}
              onChange={(e) => updateSpan(day, 1, e.target.value)}
              className="px-2 py-1.5 glass border border-white/15 rounded-lg text-galaxy-text font-body text-sm disabled:opacity-40 focus:border-galaxy-primary focus:outline-none"
            />
          </div>
        ))}
      </div>

      <div className="space-y-1 pt-2">
        <label className="text-galaxy-text-muted text-sm font-body font-semibold">{t('school:teacher.hours.timezone_label')}</label>
        <select
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className="w-full px-3 py-2.5 glass border border-white/15 rounded-xl text-galaxy-text font-body focus:border-galaxy-primary focus:outline-none"
        >
          {zoneOptions.map((z) => (
            <option key={z} value={z} className="bg-galaxy-bg text-galaxy-text">
              {t(`school:teacher.hours.timezones.${z}`, { defaultValue: z })}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-400 text-sm font-body">{t(`school:teacher.errors.${error}`)}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2.5 rounded-xl font-body font-bold text-white btn-fill-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? t('common:state.saving') : t('school:teacher.hours.save')}
      </button>
    </div>
  )
}

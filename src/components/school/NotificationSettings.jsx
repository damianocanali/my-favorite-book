import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { schoolFetch } from '../../lib/schoolApi'

const SUMMARY = ['daily', 'weekly', 'off']

// Account page, teachers only: the summary email cadence and how urgent
// "I need a grown-up" asks reach them. Each change saves on its own.
export default function NotificationSettings() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [status, setStatus] = useState(null) // 'saved' | 'error' | null

  useEffect(() => {
    let live = true
    schoolFetch('/api/school/notification-settings').then((res) => {
      if (!live) return
      if (res.ok) setSettings(res.data)
      else setLoadError(true)
    })
    return () => {
      live = false
    }
  }, [])

  async function save(patch) {
    const previous = settings
    setSettings({ ...settings, ...patch })
    setStatus(null)
    const res = await schoolFetch('/api/school/notification-settings', { method: 'PUT', body: JSON.stringify(patch) })
    if (res.ok) {
      setSettings(res.data)
      setStatus('saved')
    } else {
      setSettings(previous)
      setStatus('error')
    }
  }

  const summaryLabel = {
    daily: t('school:notifications.settings.summary_daily'),
    weekly: t('school:notifications.settings.summary_weekly'),
    off: t('school:notifications.settings.summary_off'),
  }

  return (
    <div className="mt-4 glass rounded-2xl p-4 border border-galaxy-text-muted/10 space-y-4">
      <h3 className="font-heading text-base font-semibold text-galaxy-text">{t('school:notifications.settings.title')}</h3>
      {loadError && <p className="text-red-400 font-body text-sm">{t('school:notifications.settings.load_error')}</p>}
      {settings && (
        <>
          <fieldset>
            <legend className="font-body text-sm text-galaxy-text-muted mb-2">{t('school:notifications.settings.summary_label')}</legend>
            <div className="flex flex-wrap gap-2">
              {SUMMARY.map((value) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-xl border px-3 py-1.5 font-body text-sm transition-colors ${
                    settings.summary === value
                      ? 'border-galaxy-secondary text-galaxy-text'
                      : 'border-galaxy-text-muted/30 text-galaxy-text-muted hover:text-galaxy-text'
                  }`}
                >
                  <input
                    type="radio"
                    name="notification-summary"
                    value={value}
                    checked={settings.summary === value}
                    onChange={() => save({ summary: value })}
                    className="sr-only"
                  />
                  {summaryLabel[value]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="font-body text-sm text-galaxy-text-muted mb-2">{t('school:notifications.settings.urgent_label')}</legend>
            <label className="flex items-center gap-2 font-body text-sm text-galaxy-text">
              <input
                type="checkbox"
                checked={settings.push_urgent}
                onChange={(e) => save({ push_urgent: e.target.checked })}
                className="h-4 w-4 accent-galaxy-secondary"
              />
              {t('school:notifications.settings.push_urgent')}
            </label>
            <label className="flex items-center gap-2 font-body text-sm text-galaxy-text">
              <input
                type="checkbox"
                checked={settings.email_urgent}
                onChange={(e) => save({ email_urgent: e.target.checked })}
                className="h-4 w-4 accent-galaxy-secondary"
              />
              {t('school:notifications.settings.email_urgent')}
            </label>
          </fieldset>

          <p aria-live="polite" className="font-body text-xs min-h-[1rem]">
            {status === 'saved' && <span className="text-emerald-400">{t('school:notifications.settings.saved')}</span>}
            {status === 'error' && <span className="text-red-400">{t('school:notifications.settings.error')}</span>}
          </p>
          <p className="font-body text-xs text-galaxy-text-muted">{t('school:notifications.disclaimer')}</p>
        </>
      )}
    </div>
  )
}

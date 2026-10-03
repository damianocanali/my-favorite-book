// A permanent-delete confirmation: the teacher retypes the exact name shown
// (a child's, a class's) before the red button enables. The API checks the
// same thing (lib/school/confirmName.js), so this is the friendly half of
// the guard, not the guard itself.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { namesMatch } from '../../../lib/school/confirmName.js'
import { teacherErrorText } from './teacherErrors'

export default function TypedConfirmDialog({ heading, body, prompt, expected, confirmLabel, onCancel, onConfirm }) {
  const { t } = useTranslation()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const ok = namesMatch(typed, expected)

  async function handleConfirm() {
    if (!ok || busy) return
    setBusy(true)
    setError(null)
    const res = await onConfirm(typed)
    setBusy(false)
    if (!res?.ok) setError(res?.code || 'generic')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true" aria-labelledby="typed-confirm-heading">
      <div className="w-full max-w-sm glass rounded-2xl p-6 border border-red-500/30 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={22} className="text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
          <h3 id="typed-confirm-heading" className="font-heading text-lg font-bold text-galaxy-text">{heading}</h3>
        </div>
        <p className="font-body text-sm text-galaxy-text">{body}</p>
        <div className="space-y-1">
          <label htmlFor="typed-confirm-input" className="text-galaxy-text-muted text-sm font-body font-semibold">
            {prompt}
          </label>
          <input
            id="typed-confirm-input"
            type="text"
            autoComplete="off"
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            className="w-full px-3 py-2.5 glass border border-white/15 rounded-xl text-galaxy-text focus:border-red-400 focus:outline-none font-body"
          />
        </div>
        {error && <p className="text-red-400 text-sm font-body" role="alert">{teacherErrorText(t, error)}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-xl font-body text-sm text-galaxy-text-muted hover:text-galaxy-text transition-colors"
          >
            {t('common:actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!ok || busy}
            className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? t('school:teacher.data.deleting') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'
import { readReferralCode, dismissReferralCode, CODE_EVENT } from '../../lib/atlasReferral'

// The small, dismissible note a family sees after arriving from Atlas Mind
// Academy while signed out: the code to type into the iPhone/iPad app.
// Nothing personal in it; never shown to a signed-in account.
export default function AtlasCodeNote({ className = '' }) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [code, setCode] = useState(() => readReferralCode())

  useEffect(() => {
    const update = () => setCode(readReferralCode())
    window.addEventListener(CODE_EVENT, update)
    return () => window.removeEventListener(CODE_EVENT, update)
  }, [])

  if (user || !code) return null
  return (
    <div role="note" className={`relative z-10 w-full max-w-md mx-auto rounded-xl border border-galaxy-secondary/40 bg-galaxy-bg-light/90 px-4 py-3 pr-10 text-sm font-body text-galaxy-text ${className}`}>
      <p>{t('auth:atlas_code.note', { code })}</p>
      <button
        type="button"
        onClick={() => { dismissReferralCode(); setCode(null) }}
        aria-label={t('auth:atlas_code.dismiss')}
        className="absolute top-2 right-2 p-1 rounded-md text-galaxy-text-muted hover:text-galaxy-text"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

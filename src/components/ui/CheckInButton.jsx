import { useTranslation } from 'react-i18next'
import { useCheckInStore } from '../../stores/useCheckInStore'
import Mascot from './Mascot'

// Always available, never rate-limited. This is the one that matters for a
// child who is actually struggling — the automatic prompt waits for a
// breakpoint, but a child in difficulty should never have to wait.

export default function CheckInButton({ className = '' }) {
  const { t } = useTranslation()
  const open = useCheckInStore((s) => s.open)

  return (
    <button
      type="button"
      onClick={() => open('button')}
      aria-label={t('checkin:button.aria')}
      className={`flex items-center gap-2 rounded-full glass border border-white/15 px-3 py-2 text-white/80 transition-colors hover:text-white ${className}`}
    >
      <Mascot mood="idle" size={22} />
      <span className="hidden font-body text-xs font-semibold sm:inline">
        {t('checkin:button.label')}
      </span>
    </button>
  )
}

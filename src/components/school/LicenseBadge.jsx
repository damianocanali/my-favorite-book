// A small pill summarizing a class's license state, used on the teacher
// dashboard's class cards and on the class page header. Never shows a
// price or a "buy" call to action itself — that copy lives in the pages
// that actually block an action (AddStudents, the create-class flow).
import { useTranslation } from 'react-i18next'
import { trialDaysLeft } from './rosterText'
import { isLicenseUsable } from '../../../lib/school/license.js'

export default function LicenseBadge({ license, now = new Date(), className = '' }) {
  const { t } = useTranslation()

  // key/count decide the copy; tone decides the color. A trial with days
  // left and an active/comped license all read as "good news" (ok); a
  // trial that ran out or a lapsed license are "needs attention" (warn);
  // no license at all is neutral (muted) — a brand-new class briefly has
  // no license row while its trial insert is still in flight.
  let key = 'none'
  let tone = 'muted'
  let count

  if (license) {
    if (license.status === 'trial') {
      const days = trialDaysLeft(license, now)
      if (days > 0) {
        key = 'trial_days'
        count = days
        tone = 'ok'
      } else {
        key = 'trial_ended'
        tone = 'warn'
      }
    } else if (license.status === 'comped') {
      key = 'comped'
      tone = 'ok'
    } else if (isLicenseUsable(license, now)) {
      key = 'active'
      tone = 'ok'
    } else {
      key = 'expired'
      tone = 'warn'
    }
  }

  const label = key === 'trial_days'
    ? t('school:teacher.license.trial_days', { count })
    : t(`school:teacher.license.${key}`)

  const toneClasses = {
    ok: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    warn: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    muted: 'bg-galaxy-text-muted/10 text-galaxy-text-muted border-galaxy-text-muted/20',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-body font-semibold border whitespace-nowrap ${toneClasses[tone]} ${className}`}
    >
      {label}
    </span>
  )
}

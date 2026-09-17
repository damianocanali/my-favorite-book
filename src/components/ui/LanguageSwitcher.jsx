// The app's single language control.
//
// A native <select> on purpose: VoiceOver, keyboard and the iOS/Android
// wheel picker all work with zero extra code, which a custom dropdown would
// have to reimplement badly. Option labels are deliberately NOT translated —
// someone hunting for Italian is looking for the word "Italiano", not for
// whatever the current locale calls that language.
import { useTranslation } from 'react-i18next'
import { useLocale } from '../../i18n/useLocale'

// `hideLabel` keeps the <label> in the accessibility tree but out of sight,
// for hosts (like the Account page) that already render their own heading.
export default function LanguageSwitcher({ id = 'language-select', className = '', hideLabel = false }) {
  const { t } = useTranslation()
  const { locale, setLocale, switching, supported, labels } = useLocale()

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={hideLabel ? 'sr-only' : 'block text-galaxy-text-muted font-body text-sm mb-2'}
      >
        {t('common:language.label')}
      </label>
      <select
        id={id}
        value={locale}
        disabled={switching}
        aria-label={t('common:language.aria_label')}
        onChange={(e) => setLocale(e.target.value)}
        className="px-4 py-2.5 rounded-2xl glass border border-galaxy-text-muted/30 text-galaxy-text hover:border-galaxy-text-muted/60 focus:border-galaxy-primary focus:outline-none transition-colors font-body text-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {supported.map((code) => (
          <option key={code} value={code} className="bg-galaxy-bg text-galaxy-text">
            {labels[code] ?? code}
          </option>
        ))}
      </select>
    </div>
  )
}

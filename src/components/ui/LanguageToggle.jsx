// Header language control.
//
// A one-tap toggle rather than a dropdown, because we ship exactly two
// languages: a <select> for a binary choice costs an extra tap and a popover
// for no benefit. The label always names the language you would switch TO —
// "Italiano" while you are reading English — so the control says what it does
// rather than what it is.
//
// DELIBERATELY NOT FLAGS. Flags are countries, not languages: there is no
// correct flag for English, Italian is also spoken in Switzerland and San
// Marino, Windows has no flag glyphs at all (Chrome/Edge there render the raw
// "GB"/"IT" codes), and a screen reader announces a flag as "flag: Italy",
// never as a language control. The language's own name is what people scan
// for, and it is what W3C, GOV.UK, Apple and Google all use.
//
// If a third language is ever added, replace this with LanguageSwitcher (the
// native <select>) — a toggle stops making sense past two.
import { Languages } from 'lucide-react'
import { useLocale } from '../../i18n/useLocale'

export default function LanguageToggle({ className = '' }) {
  const { locale, setLocale, switching, supported, labels } = useLocale()

  // The language that isn't the current one.
  const next = supported.find((code) => code !== locale) ?? supported[0]
  const nextLabel = labels[next] ?? next

  if (!next || next === locale) return null

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      disabled={switching}
      // Spelled out for assistive tech, because "Italiano" alone doesn't say
      // what pressing it does. lang={next} makes the screen reader pronounce
      // the language name in that language instead of mangling it in English.
      aria-label={`Switch to ${nextLabel}`}
      title={`Switch to ${nextLabel}`}
      className={`flex items-center gap-1.5 rounded-full p-2 text-white/60 transition-colors hover:text-white disabled:opacity-50 ${className}`}
    >
      <Languages size={18} aria-hidden="true" />
      <span lang={next} className="hidden font-body text-sm font-semibold sm:inline">
        {nextLabel}
      </span>
    </button>
  )
}

// Locale-aware formatting. Every date, number and price in the UI should come
// through here.
//
// Before this existed the app had three different date behaviours at once:
// hardcoded 'en-US' (OrdersListPage, and BackMatterPages — which is printed
// permanently into a paid book), bare toLocaleDateString() following the
// browser (ClassroomPage), and hand-built "$x.xx" strings. That inconsistency
// is visible on adjacent screens.
import i18next from './index.js'

function activeLocale() {
  return i18next.language || 'en'
}

/// `style` mirrors Intl's dateStyle: 'short' | 'medium' | 'long' | 'full'.
export function formatDate(value, style = 'medium') {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(activeLocale(), { dateStyle: style }).format(d)
}

export function formatNumber(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return ''
  return new Intl.NumberFormat(activeLocale()).format(n)
}

/// Money is stored in minor units (cents) everywhere in this codebase.
/// Intl places the symbol and picks the separator per locale, so Italian
/// renders "39,99 $" / "6,99 €" rather than the hand-built "$39.99".
export function formatMoneyCents(cents, currency = 'USD') {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return ''
  return new Intl.NumberFormat(activeLocale(), {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

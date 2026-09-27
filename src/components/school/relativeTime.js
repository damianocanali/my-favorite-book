// Shared by RosterTable (last sign-in) and StudentBooks (book updated_at) —
// pulled out rather than duplicated once a second caller needed the exact
// same "3 hours ago" / "yesterday" formatting.
export function relativeTime(iso, locale) {
  if (!iso) return null
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const divisions = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Infinity, unit: 'year' },
  ]
  let duration = diffSec
  for (const { amount, unit } of divisions) {
    if (Math.abs(duration) < amount) return rtf.format(Math.round(duration), unit)
    duration /= amount
  }
  return null
}

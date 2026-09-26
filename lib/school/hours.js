// School hours decide whether an urgent "I need a grown-up" is pushed to the
// teacher now or held for the morning (spec §12.2). Keys are ISO weekdays
// ("1" = Monday … "7" = Sunday); values are ["HH:MM", "HH:MM"], start
// inclusive, end exclusive, in the class's own time zone.
const DAY = ['08:00', '15:30']
export const DEFAULT_SCHOOL_HOURS = { 1: DAY, 2: DAY, 3: DAY, 4: DAY, 5: DAY }

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export function validateSchoolHours(h) {
  if (!h || typeof h !== 'object' || Array.isArray(h)) return false
  return Object.entries(h).every(([day, span]) =>
    /^[1-7]$/.test(day) &&
    Array.isArray(span) && span.length === 2 &&
    HHMM.test(span[0]) && HHMM.test(span[1]) && span[0] < span[1]
  )
}

const WEEKDAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

export function isWithinSchoolHours(hours, timeZone, date = new Date()) {
  let parts
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date)
  } catch {
    return false // unknown time zone: never claim someone is there
  }
  const get = (type) => parts.find((p) => p.type === type)?.value
  const span = hours?.[WEEKDAY[get('weekday')]]
  if (!span) return false
  const now = `${get('hour')}:${get('minute')}`
  return now >= span[0] && now < span[1]
}

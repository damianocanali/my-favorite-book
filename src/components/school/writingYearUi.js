// Pure helpers behind "My Writing Year" on the web (teacher
// WritingYearSection/WritingYearChild/ClassPrintFlow, student MyWritingYear).
// API: api/school/writing-year.js. iPad: WritingYear*.swift.
import { ADDRESS_FIELD_NAMES, ABOUT_FIELDS } from '../../../lib/school/writingYear.js'

export { ADDRESS_FIELD_NAMES, ABOUT_FIELDS }

/// A copy of `list` with the element at `from` moved to `to`.
export function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

/// Error copy for a server code; unknown codes read as generic.
export function wyErrorText(t, code) {
  return t(`school:writing_year.errors.${code || 'generic'}`, { defaultValue: t('school:writing_year.errors.generic') })
}

// The happy path, in order, for the status timeline.
export const STATUS_STEPS = ['requested', 'approved', 'submitted', 'in_production', 'shipped']

/// How far along the timeline a request is (-1 for canceled/failed).
export const statusStep = (status) => STATUS_STEPS.indexOf(status)

/// The request that still counts for this school year (not canceled), if any.
export function liveRequest(requests, year) {
  return (requests ?? []).find((r) => r.school_year === year && r.status !== 'canceled') ?? null
}

/// The empty address form.
export const emptyAddress = (country = 'US') =>
  Object.fromEntries(ADDRESS_FIELD_NAMES.map((f) => [f, f === 'country_code' ? country : '']))

export const REQUIRED_ADDRESS = ADDRESS_FIELD_NAMES.filter((f) => f !== 'address_line2' && f !== 'state_code')

/// Approved pieces first in book order, then the child's waiting suggestions.
export function splitItems(items) {
  const sorted = [...(items ?? [])].sort((a, b) => a.position - b.position)
  return { approved: sorted.filter((i) => i.approved), waiting: sorted.filter((i) => !i.approved) }
}

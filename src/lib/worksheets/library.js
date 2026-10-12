// The worksheet library's search and filters (teacher round 6B), shared by
// the public /worksheets page and the teacher's assign picker. Pure: the
// caller passes its translator, so the match runs on the current language's
// title, description, sheet heading, keywords and category name.
import {
  WORKSHEET_TEMPLATES, WORKSHEET_CATEGORIES, matchesGrade,
} from '../../../lib/school/worksheets.js'

export const QUERY_MAX = 60
const GRADE_FILTERS = ['k2', 'g35']

/// Lower case, accents off, spaces collapsed: "Città" and "citta" match.
export function normalizeSearch(s) {
  return String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/// Everything a search can match for one template, normalized.
export function searchText(template, t) {
  const k = (f) => t(`school:worksheet.templates.${template.id}.${f}`)
  return normalizeSearch([
    k('title'), k('description'), k('heading'), k('keywords'),
    t(`school:worksheet.categories.${template.category}`),
  ].join(' '))
}

/// The templates matching every word of `q`, on shelf `cat`, for `grade`
/// (any of them empty = no filter), in catalogue order.
export function filterTemplates({ q = '', cat = null, grade = null } = {}, t, templates = WORKSHEET_TEMPLATES) {
  const words = normalizeSearch(q).split(' ').filter(Boolean)
  return templates.filter((tpl) => {
    if (cat && tpl.category !== cat) return false
    if (!matchesGrade(tpl, grade)) return false
    if (!words.length) return true
    const text = searchText(tpl, t)
    return words.every((w) => text.includes(w))
  })
}

/// The templates shelf by shelf, empty shelves left out.
export function groupByCategory(templates) {
  return WORKSHEET_CATEGORIES
    .map((category) => ({ category, templates: templates.filter((t) => t.category === category) }))
    .filter((g) => g.templates.length)
}

/// ?q=&cat=&grade= — anything unknown is dropped, the query is capped.
export function parseLibraryParams(searchParams) {
  const q = String(searchParams?.get?.('q') ?? '').slice(0, QUERY_MAX)
  const cat = searchParams?.get?.('cat')
  const grade = searchParams?.get?.('grade')
  return {
    q,
    cat: WORKSHEET_CATEGORIES.includes(cat) ? cat : null,
    grade: GRADE_FILTERS.includes(grade) ? grade : null,
  }
}

/// `searchParams` with the filters in `patch` applied (null / '' removes
/// one); every other parameter is kept.
export function withLibraryParams(searchParams, patch) {
  const next = new URLSearchParams(searchParams)
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === '') next.delete(k)
    else next.set(k, String(v))
  }
  return next
}

export const hasActiveFilters = ({ q, cat, grade }) => !!(normalizeSearch(q) || cat || grade)

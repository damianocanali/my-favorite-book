// "Assign a worksheet" from the worksheet library (/worksheets) — owner
// feedback round 5, and round 6B's "Assign to my class" on a sheet's
// preview. The link walks the teacher to a class
// (/teacher/classes?assign=worksheet[&template=<id>] → each class link keeps
// the intent) and opens that class's New assignment form already on "A
// worksheet" — and, when the link names one, on that worksheet with its
// prompts filled in. Pure so the URL handling is unit-testable without a DOM.
import { resolveTemplateId } from '../../../lib/school/worksheets.js'

export const ASSIGN_WORKSHEET = 'worksheet'

/** @param {URLSearchParams} searchParams @returns {'worksheet' | null} */
export function assignIntent(searchParams) {
  return searchParams?.get?.('assign') === ASSIGN_WORKSHEET ? ASSIGN_WORKSHEET : null
}

/** The worksheet the intent names (?template=, aliases resolved), or null. */
export function assignTemplate(searchParams) {
  if (!assignIntent(searchParams)) return null
  return resolveTemplateId(searchParams.get('template'))
}

/** Where the library's "Assign a worksheet" goes. */
export const ASSIGN_WORKSHEET_HREF = `/teacher/classes?assign=${ASSIGN_WORKSHEET}`

/** "Assign to my class" for one sheet. */
export function assignWorksheetHref(templateId) {
  const id = resolveTemplateId(templateId)
  return id ? `${ASSIGN_WORKSHEET_HREF}&template=${id}` : ASSIGN_WORKSHEET_HREF
}

/** A class link from the class list, carrying the intent when there is one. */
export function classHref(classId, intent = null, templateId = null) {
  const base = `/teacher/class/${classId}`
  if (intent !== ASSIGN_WORKSHEET) return base
  const id = resolveTemplateId(templateId)
  return id ? `${base}?assign=${ASSIGN_WORKSHEET}&template=${id}` : `${base}?assign=${ASSIGN_WORKSHEET}`
}

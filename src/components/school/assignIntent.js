// "Assign a worksheet" from the printable library (/worksheets) — owner
// feedback round 5. The library's printables and the assignable templates
// are different sets, so the link doesn't pick a template: it walks the
// teacher to a class (/teacher/classes?assign=worksheet → each class link
// keeps the intent) and opens that class's New assignment form already on
// "A worksheet", where WorksheetPicker shows the templates. Pure so the
// URL handling is unit-testable without a DOM.
export const ASSIGN_WORKSHEET = 'worksheet'

/** @param {URLSearchParams} searchParams @returns {'worksheet' | null} */
export function assignIntent(searchParams) {
  return searchParams?.get?.('assign') === ASSIGN_WORKSHEET ? ASSIGN_WORKSHEET : null
}

/** Where the library's "Assign a worksheet" goes. */
export const ASSIGN_WORKSHEET_HREF = `/teacher/classes?assign=${ASSIGN_WORKSHEET}`

/** A class link from the class list, carrying the intent when there is one. */
export function classHref(classId, intent = null) {
  const base = `/teacher/class/${classId}`
  return intent === ASSIGN_WORKSHEET ? `${base}?assign=${ASSIGN_WORKSHEET}` : base
}

// Which class the teacher dashboard's class switcher shows, remembered
// across visits. Same get/set-plus-pure-decision split as src/lib/
// viewMode.js, for the same reason: the decision itself (does the
// remembered id still apply?) is unit-testable without a DOM.
const KEY = 'mybooklab-dashboard-class'

/** @returns {string | null} */
export function getRememberedClassId() {
  try {
    return localStorage.getItem(KEY) || null
  } catch {
    return null
  }
}

/** @param {string} classId */
export function setRememberedClassId(classId) {
  if (!classId) return
  try {
    localStorage.setItem(KEY, classId)
  } catch {
    // Private browsing / storage blocked: the choice just won't be
    // remembered next time, which is a minor inconvenience, not a bug.
  }
}

/**
 * The class id the switcher should show right now: the remembered one, if
 * it's still one of this teacher's classes, else the first class in server
 * order. A remembered id can go stale — the class was removed, or this is
 * a different teacher account on a shared device — and falling back
 * silently to "no class selected" would show an empty dashboard for a
 * teacher who very much has classes.
 * @param {Array<{id: string}>} classes
 * @param {string | null} rememberedId
 * @returns {string | null} null only when there are no classes at all
 */
export function pickClassId(classes, rememberedId) {
  if (!classes.length) return null
  if (rememberedId && classes.some((c) => c.id === rememberedId)) return rememberedId
  return classes[0].id
}

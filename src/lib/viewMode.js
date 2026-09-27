// Whether a teacher-and-parent account is currently browsing as a teacher
// or as a family, persisted across visits so switching to "family view" to
// help with a kid's book doesn't get undone by the next page load.
//
// Pure and localStorage-only (no React, no zustand) so the read/write and
// the branching logic that decides teacher mode are unit-testable without a
// DOM — same convention as src/components/school/rosterText.js.
const KEY = 'mybooklab-view'

/**
 * The remembered view: 'teacher' unless the visitor explicitly chose
 * 'family' last time. Any other stored value (never written by setViewMode,
 * but localStorage can be edited by hand or hold a stale value from a
 * future release) also falls back to 'teacher' — the safer default, since
 * failing the other way would silently show a signed-in teacher the
 * consumer "Create a book" home instead of their classes.
 * @returns {'teacher' | 'family'}
 */
export function getViewMode() {
  try {
    return localStorage.getItem(KEY) === 'family' ? 'family' : 'teacher'
  } catch {
    return 'teacher'
  }
}

/**
 * @param {'teacher' | 'family'} mode
 */
export function setViewMode(mode) {
  if (mode !== 'teacher' && mode !== 'family') return
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // Private browsing / storage blocked: the choice just won't be
    // remembered next time, which is a minor inconvenience, not a bug.
  }
}

// A teacher trying "Preview the kids' app" (TeacherDashboardPage) needs the
// ordinary consumer chrome on /bookshelf, not their own Dashboard/Classes/
// Account nav — but this is a one-tab, in-session detour, not a standing
// preference like viewMode, so it lives in sessionStorage (gone the moment
// this tab closes) rather than alongside the localStorage view choice.
const PREVIEW_KEY = 'mybooklab-preview-kids'

/** @returns {boolean} */
export function isPreviewingKids() {
  try {
    return sessionStorage.getItem(PREVIEW_KEY) === '1'
  } catch {
    return false
  }
}

export function enterKidsPreview() {
  try {
    sessionStorage.setItem(PREVIEW_KEY, '1')
  } catch {
    // Private browsing / storage blocked: the banner just won't appear,
    // which is a minor inconvenience, not a bug — the preview link still
    // navigates either way.
  }
}

export function exitKidsPreview() {
  try {
    sessionStorage.removeItem(PREVIEW_KEY)
  } catch {
    // ignore
  }
}

/**
 * Whether the signed-in account should see the teacher dashboard/nav right
 * now. A class (student) account never does, no matter what viewMode says —
 * this only ever applies to a teacher who is also a parent choosing which
 * home they want. Also false while auth is still hydrating (`loading`) —
 * `isTeacher` is a false negative for a moment on every load (it depends on
 * `user`, which starts null), and treating that gap as "definitely not a
 * teacher" would be an accident of timing rather than a real fact, even
 * though it happens to produce the same false today — and false while
 * previewing the kids' app, so that detour shows the ordinary consumer
 * chrome instead of the teacher nav it just backed out of.
 * @param {{isTeacher: boolean, viewMode: 'teacher' | 'family', isStudent: boolean, loading?: boolean, previewingKids?: boolean}} args
 * @returns {boolean}
 */
export function computeTeacherMode({ isTeacher, viewMode, isStudent, loading = false, previewingKids = false }) {
  if (loading || previewingKids) return false
  return Boolean(isTeacher) && viewMode !== 'family' && !isStudent
}

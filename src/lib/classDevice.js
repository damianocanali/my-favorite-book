// A class browser: a teacher has set this browser up for one of their
// classes (TeacherClassPage → "Set up this browser for this class"), so when
// nobody is signed in, /login and the app's signed-out entry go straight to
// /class at that class's name list and children never type the code.
// Web counterpart of the iOS ClassDeviceStore.
//
// Explicit and teacher-controlled — replacing the old implicit memory
// ('mybooklab-signin-who' and the remembered class code), which sent the
// next person after any sign-out into the last person's flow. Sign-out and
// a failing code never clear it; a teacher removes it.
//
// localStorage, not anything secret: the class code is printed on every
// sign-in card in the room and only opens the name list; each child still
// needs their pictures. Every access is try/catch'd — private browsing or a
// blocked storage just means "not set up", never a thrown error.

export const CLASS_DEVICE_KEY = 'mybooklab-class-device'

/** The old implicit memory, deleted once at app start (see purgeLegacySignInMemory). */
export const LEGACY_KEYS = ['mybooklab-signin-who', 'mybooklab-class-code']

const CODE_RE = /^[A-Z0-9]{6}$/

/**
 * @param {unknown} value
 * @returns {{classId: string, code: string, name: string} | null} a clean
 *   record, or null if `value` isn't a whole, well-formed one.
 */
export function validateClassDevice(value) {
  if (!value || typeof value !== 'object') return null
  const { classId, code, name } = /** @type {Record<string, unknown>} */ (value)
  if (typeof classId !== 'string' || !classId) return null
  if (typeof code !== 'string' || !CODE_RE.test(code.toUpperCase())) return null
  return { classId, code: code.toUpperCase(), name: typeof name === 'string' ? name : '' }
}

/** @returns {{classId: string, code: string, name: string} | null} */
export function readClassDevice() {
  try {
    const raw = localStorage.getItem(CLASS_DEVICE_KEY)
    if (!raw) return null
    return validateClassDevice(JSON.parse(raw))
  } catch {
    return null
  }
}

/**
 * @param {{classId: string, code: string, name?: string}} device
 * @returns {boolean} whether it was saved
 */
export function writeClassDevice(device) {
  const clean = validateClassDevice(device)
  if (!clean) return false
  try {
    localStorage.setItem(CLASS_DEVICE_KEY, JSON.stringify(clean))
    return true
  } catch {
    return false
  }
}

export function clearClassDevice() {
  try {
    localStorage.removeItem(CLASS_DEVICE_KEY)
  } catch {
    // ignore — see file header
  }
}

/** Forget the old implicit "who" and class-code memory. Idempotent. */
export function purgeLegacySignInMemory() {
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}

/**
 * Where a signed-out visitor to /login or the app's signed-out entry ('/')
 * should be sent instead, if anywhere.
 *
 * @param {{ device: object | null, signedIn: boolean, choose?: boolean }} args
 *   `choose` is /login?choose=1 — "Not in <class>?" asked for the ordinary
 *   chooser on purpose, so it must not bounce straight back.
 * @returns {string | null} '/class' or null (stay put)
 */
export function signedOutRedirect({ device, signedIn, choose = false }) {
  if (signedIn || choose || !device) return null
  return '/class'
}

/** Roster / sign-in codes that mean "this class can't be signed into right now" (roster.js 404 / 423). */
const UNAVAILABLE = new Set(['class_not_found', 'class_resting', 'sign_in_closed', 'class_paused'])

/** @param {string | null | undefined} code */
export function isClassUnavailable(code) {
  return UNAVAILABLE.has(code)
}

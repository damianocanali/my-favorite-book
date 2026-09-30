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

/** Session-only: "Not in <class>?" was chosen in this tab (see signedOutRedirect). */
export const CLASS_DEVICE_SKIP_KEY = 'mybooklab-class-device-skip'

// Same shape as the server's CODE_RE (lib/school/crypto.js).
const CODE_RE = /^[A-Z0-9]{6,8}$/

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

/**
 * What children see for the class: its name, or its code when it has none.
 * @param {{name?: string, code: string} | null} device
 */
export function classDeviceLabel(device) {
  if (!device) return ''
  return device.name?.trim() ? device.name : device.code
}

/** "Not in <class>?": let this tab reach /login and / as usual. */
export function setClassDeviceSkip() {
  try {
    sessionStorage.setItem(CLASS_DEVICE_SKIP_KEY, '1')
  } catch {
    // ignore
  }
}

export function clearClassDeviceSkip() {
  try {
    sessionStorage.removeItem(CLASS_DEVICE_SKIP_KEY)
  } catch {
    // ignore
  }
}

export function readClassDeviceSkip() {
  try {
    return sessionStorage.getItem(CLASS_DEVICE_SKIP_KEY) === '1'
  } catch {
    return false
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
 * @param {{ device: object | null, signedIn: boolean, choose?: boolean, skip?: boolean, next?: string | null }} args
 *   `choose` is /login?choose=1 and `skip` the session flag set by
 *   "Not in <class>?": the visitor asked for the ordinary chooser/landing
 *   on purpose, so they must not bounce straight back. `next` (already
 *   sanitised by the caller) rides along so it survives the detour.
 * @returns {string | null} '/class[?next=…]' or null (stay put)
 */
export function signedOutRedirect({ device, signedIn, choose = false, skip = false, next = null }) {
  if (signedIn || choose || skip || !device) return null
  return next ? `/class?next=${encodeURIComponent(next)}` : '/class'
}

/**
 * Where "Not in <class>?" goes: the chooser, carrying `next` along.
 * @param {string | null} next already sanitised
 */
export function chooserPath(next = null) {
  return next ? `/login?choose=1&next=${encodeURIComponent(next)}` : '/login?choose=1'
}

/** Codes that mean the connection or the server, not the class. */
const NETWORK = new Set([undefined, null, 'network', 'upstream', 'not_configured'])

/** @param {string | null | undefined} code */
export function isNetworkFailure(code) {
  return NETWORK.has(code)
}

/** Roster / sign-in codes that mean "this class can't be signed into right now" (roster.js 404 / 423). */
const UNAVAILABLE = new Set(['class_not_found', 'class_resting', 'sign_in_closed', 'class_paused'])

/** @param {string | null | undefined} code */
export function isClassUnavailable(code) {
  return UNAVAILABLE.has(code)
}

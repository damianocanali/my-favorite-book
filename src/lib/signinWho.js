// Remembers which chooser card a visitor last picked on /login — 'kid',
// 'family' or 'teacher' — so a returning visitor skips straight back to
// that choice's form (LoginPage) instead of the "Who's signing in?"
// chooser every time. Same try/catch idiom as schoolApi.js's
// rememberClassCode/recallClassCode: private browsing or a full storage
// quota just means the choice isn't remembered, never a thrown error.
const KEY = 'mybooklab-signin-who'

const VALID = new Set(['kid', 'family', 'teacher'])

/**
 * @returns {'kid'|'family'|'teacher'|null} the remembered choice, or null if
 * there isn't one, storage is unavailable, or the stored value isn't one of
 * the three known choices (a stale/corrupted value is treated the same as
 * no value at all, rather than being surfaced as one of the three forms).
 */
export function getRememberedWho() {
  try {
    const value = localStorage.getItem(KEY)
    return VALID.has(value) ? value : null
  } catch {
    return null
  }
}

/**
 * @param {'kid'|'family'|'teacher'} who
 */
export function setRememberedWho(who) {
  if (!VALID.has(who)) return
  try {
    localStorage.setItem(KEY, who)
  } catch {
    // ignore — see file header
  }
}

/**
 * Forgets the remembered choice. Used by /class's "Grown-up? Sign in
 * here" escape hatch: a remembered 'kid' choice sends /login straight to
 * /class (see LoginPage), which would otherwise strand a parent or
 * teacher on a device that last remembered 'kid' with no way back to the
 * chooser short of editing the URL by hand.
 */
export function clearRememberedWho() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore — see file header
  }
}

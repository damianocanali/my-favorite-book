// The routes that get AppShell's "focused" auth layout: no bottom tab bar
// and no Pricing/Play/Sign Up chrome in the header — just the logo,
// language toggle and a Back link. Every one of these is a route someone
// can land on signed-out, mid auth flow, where the full app chrome is
// either irrelevant (Pricing on a sign-in screen) or actively unsafe (a
// child on /class tapping through to Pricing).
//
// Kept here rather than inlined in AppShell so the decision has exactly
// one source of truth (per the brief: "route list in one place") and is
// unit-testable without rendering the shell.
export const FOCUSED_AUTH_ROUTES = ['/login', '/signup', '/class', '/reset-password', '/auth/callback']

/**
 * @param {string} pathname e.g. location.pathname
 * @returns {boolean}
 */
export function isFocusedAuthRoute(pathname) {
  return FOCUSED_AUTH_ROUTES.includes(pathname)
}

// Validates the `?next=` query param ProtectedRoute attaches when it
// bounces a signed-out visitor to /login, so LoginPage can send them back
// to where they were headed after they sign in. The param travels through
// the URL bar, so it's attacker-controlled input, not app state — a plain
// link to /login?next=https://evil.com would otherwise turn our own
// sign-in page into an open redirect, and react-router's navigate() falls
// back to a real cross-origin window.location.assign for anything it
// can't push() to.
//
// A leading-slash-and-not-"//" prefix check used to be the whole guard
// here, but that's not enough: a browser's URL parser treats a leading
// backslash the same as a forward slash ("/\evil.com" and "/\/evil.com"
// both become protocol-relative to evil.com, exactly like "//evil.com"),
// so a naive prefix check waves those through as if they were an
// ordinary same-site path. Resolving against a fixed, otherwise-
// unreachable placeholder origin and comparing origins afterwards is the
// only way to ask the same question a browser actually asks when it
// navigates: "where does this really point?" — rather than pattern-
// matching on the input's spelling.
export function safeNext(next) {
  if (typeof next !== 'string') return null
  if (!next.startsWith('/')) return null
  const u = new URL(next, 'https://app.invalid')
  return u.origin === 'https://app.invalid' ? u.pathname + u.search + u.hash : null
}

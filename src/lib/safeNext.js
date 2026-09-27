// Validates the `?next=` query param ProtectedRoute attaches when it
// bounces a signed-out visitor to /login, so LoginPage can send them back
// to where they were headed after they sign in. The param travels through
// the URL bar, so it's attacker-controlled input, not app state — a plain
// link to /login?next=https://evil.com (or //evil.com, which a browser
// also treats as off-site) would otherwise turn our own sign-in page into
// an open redirect. Only a same-site relative path — starts with "/", not
// "//" — is accepted; anything else is ignored in favour of the existing
// role-based default.
export function safeNext(next) {
  if (typeof next !== 'string') return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  return next
}

// Guards an async result against two races: a call whose result arrives
// after something newer has superseded it (a second call started, or
// whatever the result would update was dismissed/closed in the meantime)
// must be ignored rather than silently overwriting more current state.
//
// Used by CheckInHost.jsx for its 'grownup' help ask — see the comment
// there for the concrete bug this exists to prevent: a slow askForHelp()
// promise resolving after the child already closed the "waiting" screen
// must not reopen it (which would also steal focus back and could start
// polling again), and a second ask started before the first's promise
// settles must not have its own state clobbered by the first ask's
// now-stale late arrival.
//
// Deliberately a single ever-incrementing counter, not a "reset the
// counter itself to 0/null, then increment again" scheme: resetting the
// COUNTER on clear() can reissue a token value a still-in-flight call
// already holds (ask #1 gets 1, is cleared, ask #2 also gets 1 — because
// the counter restarted from 0 — and ask #1's late resolve then reads as
// "still current"), which reopens exactly the bug this exists to prevent.
// clear() only invalidates the currently-accepted token; it never rewinds
// the counter, so every token `next()` ever returns is unique for the
// lifetime of this instance. tests/request-token.test.js pins that
// specific scenario.
export function createRequestToken() {
  let seq = 0
  let current = null
  return {
    /// Call once per new request. Returns the token to capture in a
    /// closure and check later; also becomes the only token `isCurrent`
    /// will accept as true until the next `next()` or `clear()`.
    next() {
      current = ++seq
      return current
    },
    /// Whether `token` (a value a previous `next()` call returned) is
    /// still the one currently allowed to act. False for a stale token, or
    /// after `clear()`.
    isCurrent(token) {
      return current === token
    },
    /// Invalidates whatever token is current — nothing will read
    /// `isCurrent` as true again until the next `next()`. Call this
    /// whenever whatever the request was updating is dismissed, closed, or
    /// reset, independent of whether the request has resolved yet.
    clear() {
      current = null
    },
  }
}

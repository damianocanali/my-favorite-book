import { useEffect, useRef, useState } from 'react'
import { useCheckInStore } from '../../stores/useCheckInStore'
import { useAccessibilityStore } from '../../stores/useAccessibilityStore'
import CheckInSheet from './CheckInSheet'
import BreakScreen from './BreakScreen'
import HelpScreen from './HelpScreen'

// Mounted once in App.jsx beside MilestoneHost. Owns both the sheet and what
// happens after an answer, so no screen has to know the difference between
// "quiet" and "help".

export default function CheckInHost() {
  const entries = useCheckInStore((s) => s.entries)
  const setFocusMode = useAccessibilityStore((s) => s.setFocusMode)
  const [breaking, setBreaking] = useState(false)
  const [helping, setHelping] = useState(false)

  // `entries` is newest-first, so the entry to react to is entries[0]. But
  // this store is persisted, and zustand's persist middleware hydrates
  // localStorage synchronously (getItem is plain and sync, and persist's
  // "thenable" wrapper runs its .then() inline rather than on a microtask)
  // — so on the very first render `entries` can already be full of LAST
  // session's data, not this one's. An effect that reacts to any truthy
  // "latest" would replay that old answer on every app relaunch: reopen
  // the app after picking "break" yesterday and it opens straight into the
  // break screen; reopen after "quiet" and focus mode silently re-locks
  // itself on every load, even after someone turned it back off since.
  //
  // So "new" has to mean "landed while this host was watching", not merely
  // "different from the previous render". A ref seeded with whatever is
  // newest AT MOUNT — a real entry's `at`, or null if there is none — draws
  // that line: anything at-or-before the seed is old news to skip, anything
  // after it is live and gets a reaction.
  const seenAtRef = useRef(entries[0]?.at ?? null)

  const latest = entries[0]
  useEffect(() => {
    const at = latest?.at
    // Nothing to react to, or it's the entry already accounted for (the
    // mount baseline above, or one this effect already handled). Comparing
    // by `at` rather than by `need`/`feeling` is what lets two check-ins in
    // a row that land on the same need — "break" twice — both still get a
    // reaction; comparing by need alone would see no change the second
    // time and silently do nothing.
    if (!at || at === seenAtRef.current) return
    seenAtRef.current = at

    if (!latest.need) return // dismissed at the feeling step — nothing to respond to
    if (latest.need === 'quiet') setFocusMode(true)
    if (latest.need === 'break') setBreaking(true)
    // The editor owns Story Buddy and doesn't yet expose a handle for
    // opening it from outside itself, so 'help' can't actually open it here
    // — that's a real lift, not a quick wire-up. It must not be silent
    // either way: a child who says they're struggling and gets nothing
    // back learns the tile does nothing. HelpScreen tells them where to
    // find it instead. 'keep_going' needs nothing — the sheet already
    // closed.
    if (latest.need === 'help') setHelping(true)
  }, [latest?.at, latest?.need, setFocusMode])

  return (
    <>
      <CheckInSheet />
      {/* BreakScreen's copy tells the child "Your story is saved" without
          this component — or anything else on this path — calling any kind
          of save. It's true only because useBookStore wraps its state in
          zustand's persist middleware under the key
          'my-favorite-book-current', so the draft is already sitting in
          localStorage before a child ever taps "Take a break". If that
          store's persistence is ever removed or its key renamed without
          this copy changing too, the reassurance becomes a lie told to a
          child. tests/checkin-savepoint.test.js pins the persistence this
          depends on. */}
      {breaking && <BreakScreen onDone={() => setBreaking(false)} />}
      {helping && <HelpScreen onDone={() => setHelping(false)} />}
    </>
  )
}

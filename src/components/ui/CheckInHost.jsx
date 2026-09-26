import { useEffect, useRef, useState } from 'react'
import { useCheckInStore } from '../../stores/useCheckInStore'
import { useAccessibilityStore } from '../../stores/useAccessibilityStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { shareCheckIn, askForHelp } from '../../lib/schoolShare'
import CheckInSheet from './CheckInSheet'
import BreakScreen from './BreakScreen'
import HelpScreen from './HelpScreen'
import TeacherHelpScreen from '../school/TeacherHelpScreen'

// Mounted once in App.jsx beside MilestoneHost. Owns both the sheet and what
// happens after an answer, so no screen has to know the difference between
// "quiet" and "help".

export default function CheckInHost() {
  const entries = useCheckInStore((s) => s.entries)
  const setFocusMode = useAccessibilityStore((s) => s.setFocusMode)
  const user = useAuthStore((s) => s.user)
  const [breaking, setBreaking] = useState(false)
  const [helping, setHelping] = useState(false)
  // The result of an 'I need a grown-up' ask, once askForHelp resolves —
  // null while there is nothing to show. Not the raw promise: TeacherHelpScreen
  // renders one of three fixed end-states (failed / out-of-hours / in-hours,
  // see its own comment), and it expects the already-resolved shape askForHelp
  // returns, not a pending one this component would otherwise have to invent
  // copy for.
  const [teacherHelp, setTeacherHelp] = useState(null)

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

    // Owner decision D7: for a class (student) account, a copy of this
    // check-in also reaches the teacher. shareCheckIn no-ops (and never
    // fetches) for anyone else, so this call is always safe to make
    // unconditionally — fire-and-forget, per schoolShare.js's own contract:
    // any failure is console.warn'd inside it, never surfaced here.
    shareCheckIn(latest, user)

    if (!latest.need) return // dismissed at the feeling step — nothing to respond to
    if (latest.need === 'quiet') setFocusMode(true)
    if (latest.need === 'break') setBreaking(true)
    // The editor owns Story Buddy and doesn't yet expose a handle for
    // opening it from outside itself, so 'help'/'help_book' can't actually
    // open it here — that's a real lift, not a quick wire-up. It must not
    // be silent either way: a child who says they're struggling and gets
    // nothing back learns the tile does nothing. HelpScreen tells them
    // where to find it instead. 'keep_going' needs nothing — the sheet
    // already closed.
    if (latest.need === 'help') setHelping(true)
    if (latest.need === 'help_book') {
      askForHelp('book', user)
      setHelping(true)
    }
    // 'grownup' (student-only, see STUDENT_NEEDS) additionally tells the
    // teacher directly, via a real, separate request — not just the
    // shareCheckIn copy above — and shows TeacherHelpScreen instead of the
    // generic HelpScreen so the child sees whether that ask actually went
    // anywhere.
    if (latest.need === 'grownup') {
      askForHelp('grownup', user).then((result) => setTeacherHelp(result))
    }
  }, [latest?.at, latest?.need, setFocusMode, user])

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
      {teacherHelp && (
        <TeacherHelpScreen
          ok={teacherHelp.ok}
          id={teacherHelp.id}
          inHours={teacherHelp.inHours}
          onDone={() => setTeacherHelp(null)}
        />
      )}
    </>
  )
}

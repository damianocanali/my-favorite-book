import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { useCheckInStore } from '../src/stores/useCheckInStore'

// The single most likely future regression in this feature is someone
// syncing it — "so parents can see how their child is doing" is a reasonable
// thing to ask for and a serious thing to build. Synced, these entries become
// a wellbeing record about a named child: sensitive data under GDPR, a DPIA
// trigger, and a reason for the child to answer dishonestly.
//
// Two guards: no network call at runtime, and no network-shaped code in the
// source. The second catches it even if the call sits behind a condition the
// first never reaches.

const SRC = 'src'

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (['.js', '.jsx'].includes(extname(p))) out.push(p)
  }
  return out
}

// Every file that imports the check-in store or its pure-logic helpers,
// discovered rather than hand-maintained — the previous version of this
// guard was a literal array of paths, which made the next file that starts
// importing useCheckInStore or lib/checkIn invisible to it by default.
//
// Matched against `path + '\n' + content`, not content alone: an importer's
// source spells out the literal text "useCheckInStore" or "lib/checkIn" in
// its import specifier, which content-matching catches directly, but the
// two files that DEFINE the store and the lib don't import themselves —
// they're picked up because their own path ("src/stores/useCheckInStore.js",
// "src/lib/checkIn.js") satisfies the same pattern.
const IMPORTER_PATTERN = /useCheckInStore|lib\/checkIn/

// BreakScreen.jsx and HelpScreen.jsx are deliberately NOT swept in here,
// even though they're the screens a breakpoint/help check-in opens: both
// are purely presentational, taking only `onDone` as a prop, and hold no
// entry data of their own — CheckInHost reads pickFeeling/pickNeed/the
// entry array from useCheckInStore before ever rendering these screens.
// Neither imports useCheckInStore or lib/checkIn, so they correctly fall
// outside IMPORTER_PATTERN. Leave the pattern as-is: widening it to catch
// files like these — which can never hold entry data and so can never
// legitimately trip OFFENDER_PATTERN — buys nothing, and the day one of
// them picks up an unrelated fetch (an image asset, say) and false-positives,
// the tempting "fix" is to loosen OFFENDER_PATTERN instead, which weakens
// the fence for the files that actually do touch entry data.
function discoverCheckInFiles() {
  return walk(SRC).filter((f) => IMPORTER_PATTERN.test(`${f}\n${readFileSync(f, 'utf8')}`))
}

// A floor, not the ceiling: discoverCheckInFiles() is expected to find more
// than this once the rest of the art/constellation UI lands. This exists
// only so a bug in the walk (wrong extension filter, wrong root) that made
// discovery come back empty or suspiciously small fails loudly instead of
// the test suite quietly having nothing left to check.
const REQUIRED_FLOOR = [
  'src/lib/checkIn.js',
  'src/stores/useCheckInStore.js',
  'src/components/ui/CheckInSheet.jsx',
  'src/components/ui/CheckInHost.jsx',
  'src/components/ui/CheckInButton.jsx',
  'src/components/ui/FeelingConstellation.jsx',
]

// The original pattern only caught fetch/apiFetch//api. This app also talks
// to the server via supabase.from(...).insert(...) and supabase.rpc(...)
// (see src/stores/useRewardsStore.js) — the realistic "let parents see it"
// change would sail straight through a pattern that only knows about fetch.
// Extended to the other shapes a browser can use to reach a network.
//
// "supabase" is matched as `supabase.from(`/`supabase.rpc(` rather than as
// a bare identifier: discovery now correctly finds src/stores/useAuthStore.js
// (it imports useCheckInStore to clear entries on sign-out — the exact kind
// of importer this guard used to miss), and that file's *legitimate*
// supabase.auth.signOut()/getSession()/onAuthStateChange() calls are
// unrelated to check-in data — auth session management, not a table read or
// write. A bare "supabase" match would flag that real, safe code on every
// run. `.from(`/`.rpc(` is supabase-js's actual data-access surface — the
// part capable of reading or writing a table row — and is exactly what the
// proof below (`supabase.from('check_ins').insert({})`) exercises.
const OFFENDER_PATTERN = /['"`]\/api\/|apiFetch|fetch\s*\(|supabase\s*\.\s*(from|rpc)\s*\(|sendBeacon|XMLHttpRequest|axios|WebSocket|EventSource/

function findOffenders(files) {
  return files.filter((f) => {
    const src = readFileSync(f, 'utf8')
    // Ignore the explanatory comments, which legitimately name these terms.
    const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    return OFFENDER_PATTERN.test(code)
  })
}

describe('check-in data never leaves the device', () => {
  beforeEach(() => useCheckInStore.setState({ current: null, entries: [], lastPromptedAt: null }))

  it('makes no network call when a check-in completes', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchSpy)

    useCheckInStore.getState().open('breakpoint')
    useCheckInStore.getState().pickFeeling('angry')
    useCheckInStore.getState().pickNeed('break')
    await new Promise((r) => setTimeout(r, 0))

    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('discovery finds a non-empty set of check-in files, a superset of the known floor', () => {
    // Guards the guard: if discoverCheckInFiles() ever came back empty (or
    // missing files it obviously should find), every assertion below it
    // would pass vacuously over zero files, and this feature's most
    // important regression fence would be silently disarmed.
    const discovered = discoverCheckInFiles()
    expect(discovered.length).toBeGreaterThan(0)
    for (const f of REQUIRED_FLOOR) {
      expect(discovered).toContain(f)
    }
  })

  it('has no network-call pattern in any discovered check-in source file', () => {
    const offenders = findOffenders(discoverCheckInFiles())
    expect(offenders, `check-in files must not talk to the server:\n${offenders.join('\n')}`).toEqual([])
  })
})

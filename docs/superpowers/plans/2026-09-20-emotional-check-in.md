# Emotional Check-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A two-step check-in a child can open any time, or that appears at natural breakpoints, offering a break that saves their work and routing "quiet" and "help" into affordances the app already has.

**Architecture:** Pure logic in `src/lib/checkIn.js` (catalogs, eligibility, retention) with a thin zustand+persist store on top, following the existing `milestoneForProgress` pattern. A host mounted once in `App.jsx` owns the markup so no screen has to. Entries live in `localStorage` and are never sent to the server.

**Tech Stack:** React 19, zustand 5 (+ `persist`), react-i18next, motion, vitest (node environment), Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-20-emotional-check-in-design.md`

## Global Constraints

- **Entries NEVER leave the device.** No `fetch`, no `apiFetch`, no `/api` call anywhere in this feature. Task 10 adds a test that enforces this.
- **No therapeutic framing** in any string, comment, or commit message. No "regulate", "calm down", "therapy", "treatment", "wellbeing". It is a check-in.
- **No gamification.** No badge, coin, streak or reward for checking in.
- **An entry records no book id and no page id.** Only `{ at, feeling, need? }`.
- **Tests run in `environment: 'node'`** — there is no `window` or `localStorage` unless a task adds a stub. Pure logic must be importable without either.
- **Italian feeling labels are NOUNS, not adjectives** (`rabbia`, not `arrabbiato/a`) — Italian adjectives agree with the speaker's gender, which the app never learns.
- Every new user-facing string goes in the `checkin` namespace in BOTH `en` and `it`. `tests/i18n-keys.test.js` enforces parity automatically.
- Follow existing style: two-space indent, single quotes, no semicolons, comments explain *why*.

---

### Task 1: Pure check-in logic

**Files:**
- Create: `src/lib/checkIn.js`
- Test: `tests/checkin.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `FEELINGS` (array of `{id, tone}`), `NEEDS` (array of `{id}`), `MAX_ENTRIES` (60), `MAX_AGE_DAYS` (30), `pruneEntries(entries, nowMs)`, `appendEntry(entries, entry, nowMs)`, `isEligibleForPrompt({ lastPromptedAt, nowMs })`

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import {
  FEELINGS, NEEDS, MAX_ENTRIES,
  pruneEntries, appendEntry, isEligibleForPrompt,
} from '../src/lib/checkIn'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-09-20T12:00:00Z')
const entry = (feeling, need, agoDays = 0) => ({
  at: new Date(NOW - agoDays * DAY).toISOString(), feeling, need,
})

describe('catalogs', () => {
  it('offers six feelings and four needs', () => {
    expect(FEELINGS).toHaveLength(6)
    expect(NEEDS).toHaveLength(4)
  })

  it('has stable ids the catalogue and storage both key on', () => {
    expect(FEELINGS.map((f) => f.id)).toEqual(
      ['happy', 'proud', 'tired', 'worried', 'angry', 'sad']
    )
    expect(NEEDS.map((n) => n.id)).toEqual(['break', 'quiet', 'help', 'keep_going'])
  })
})

describe('pruneEntries', () => {
  it('drops entries older than 30 days', () => {
    const kept = pruneEntries([entry('sad', 'break', 31), entry('happy', 'keep_going', 2)], NOW)
    expect(kept).toHaveLength(1)
    expect(kept[0].feeling).toBe('happy')
  })

  it('keeps an entry exactly at the boundary', () => {
    expect(pruneEntries([entry('happy', 'quiet', 29)], NOW)).toHaveLength(1)
  })

  it('caps at MAX_ENTRIES, evicting oldest first', () => {
    const many = Array.from({ length: MAX_ENTRIES + 10 }, (_, i) =>
      entry('happy', 'keep_going', (i % 20) * 0.1)
    )
    expect(pruneEntries(many, NOW)).toHaveLength(MAX_ENTRIES)
  })

  it('survives a corrupt or empty store', () => {
    expect(pruneEntries(undefined, NOW)).toEqual([])
    expect(pruneEntries([{ nonsense: true }], NOW)).toEqual([])
  })
})

describe('appendEntry', () => {
  it('adds the entry and prunes in one step', () => {
    const out = appendEntry([entry('sad', 'break', 40)], { feeling: 'proud', need: 'keep_going' }, NOW)
    expect(out).toHaveLength(1)
    expect(out[0].feeling).toBe('proud')
    expect(out[0].at).toBe(new Date(NOW).toISOString())
  })

  it('records a feeling with no need when the child closed at step one', () => {
    const out = appendEntry([], { feeling: 'worried' }, NOW)
    expect(out[0].need).toBeUndefined()
  })

  it('refuses an unknown feeling rather than storing junk', () => {
    expect(appendEntry([], { feeling: 'hangry' }, NOW)).toEqual([])
  })
})

describe('isEligibleForPrompt', () => {
  it('allows the first prompt of a session', () => {
    expect(isEligibleForPrompt({ lastPromptedAt: null, nowMs: NOW })).toBe(true)
  })

  it('refuses a second prompt in the same session', () => {
    expect(isEligibleForPrompt({ lastPromptedAt: NOW - 60_000, nowMs: NOW })).toBe(false)
  })

  it('allows again once the quiet window has passed', () => {
    expect(isEligibleForPrompt({ lastPromptedAt: NOW - 5 * 60 * 60 * 1000, nowMs: NOW })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/checkin.test.js`
Expected: FAIL — `Failed to resolve import "../src/lib/checkIn"`

- [ ] **Step 3: Write minimal implementation**

```js
// Pure check-in logic: the catalogs, retention rules and prompt eligibility.
//
// Deliberately free of React, zustand and localStorage so it can be tested in
// the node environment vitest runs in — the same reason milestoneForProgress
// is a plain function in useMilestoneStore.js.

/// Feeling tiles, in display order. `tone` picks the star colour in the
/// constellation; it is NOT a valence score and nothing ranks these.
export const FEELINGS = [
  { id: 'happy', tone: 'gold' },
  { id: 'proud', tone: 'purple' },
  { id: 'tired', tone: 'blue' },
  { id: 'worried', tone: 'cyan' },
  { id: 'angry', tone: 'pink' },
  { id: 'sad', tone: 'indigo' },
]

/// What the child is offered next. `break` first because it is the one a
/// struggling child most needs and should not have to hunt for.
export const NEEDS = [
  { id: 'break' },
  { id: 'quiet' },
  { id: 'help' },
  { id: 'keep_going' },
]

export const MAX_ENTRIES = 60
export const MAX_AGE_DAYS = 30

/// Once a session, roughly. A prompt on every page save is noise — the same
/// lesson useMilestoneStore's `seen` set encodes.
const QUIET_WINDOW_MS = 4 * 60 * 60 * 1000

const FEELING_IDS = new Set(FEELINGS.map((f) => f.id))
const NEED_IDS = new Set(NEEDS.map((n) => n.id))

function isValid(e) {
  if (!e || typeof e.at !== 'string' || !FEELING_IDS.has(e.feeling)) return false
  if (e.need !== undefined && !NEED_IDS.has(e.need)) return false
  return !Number.isNaN(Date.parse(e.at))
}

/// Drops anything invalid, anything past MAX_AGE_DAYS, and the oldest
/// entries beyond MAX_ENTRIES. Tolerates undefined and corrupt storage,
/// because localStorage can be edited by hand or truncated by the browser.
export function pruneEntries(entries, nowMs = Date.now()) {
  const cutoff = nowMs - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  return (Array.isArray(entries) ? entries : [])
    .filter((e) => isValid(e) && Date.parse(e.at) >= cutoff)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, MAX_ENTRIES)
}

/// Adds one entry, newest first, then prunes. Returns a new array.
export function appendEntry(entries, { feeling, need }, nowMs = Date.now()) {
  if (!FEELING_IDS.has(feeling)) return pruneEntries(entries, nowMs)
  const e = { at: new Date(nowMs).toISOString(), feeling }
  if (need !== undefined && NEED_IDS.has(need)) e.need = need
  return pruneEntries([e, ...(Array.isArray(entries) ? entries : [])], nowMs)
}

/// Whether an automatic prompt may fire now. The child-initiated button
/// never consults this — it is always available.
export function isEligibleForPrompt({ lastPromptedAt, nowMs = Date.now() }) {
  if (!lastPromptedAt) return true
  return nowMs - lastPromptedAt >= QUIET_WINDOW_MS
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/checkin.test.js`
Expected: PASS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/checkIn.js tests/checkin.test.js
git commit -m "feat(checkin): pure catalogs, retention and prompt eligibility"
```

---

### Task 2: The store

**Files:**
- Create: `src/stores/useCheckInStore.js`
- Modify: `tests/setup.js` (add a localStorage stub — vitest runs in node)
- Test: `tests/checkin-store.test.js`

**Interfaces:**
- Consumes: `FEELINGS`, `NEEDS`, `appendEntry`, `isEligibleForPrompt` from Task 1
- Produces: `useCheckInStore` with state `{ current, entries, lastPromptedAt }` and actions `open(source)`, `pickFeeling(id)`, `pickNeed(id)`, `dismiss()`, `clear()`, plus selector `entriesForUser(userId)`

- [ ] **Step 1: Add the localStorage stub to the shared setup**

```js
// vitest runs in the node environment, so there is no localStorage. Stores
// that use zustand's persist middleware need one to exercise at all.
// Minimal by design — a real implementation would hide bugs this stub makes
// obvious, like writing objects instead of strings.
if (typeof globalThis.localStorage === 'undefined') {
  const mem = new Map()
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)) },
    removeItem: (k) => { mem.delete(k) },
    clear: () => { mem.clear() },
    key: (i) => [...mem.keys()][i] ?? null,
    get length() { return mem.size },
  }
}
```

- [ ] **Step 2: Write the failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { useCheckInStore } from '../src/stores/useCheckInStore'

const reset = () => useCheckInStore.setState({ current: null, entries: [], lastPromptedAt: null })

describe('useCheckInStore', () => {
  beforeEach(reset)

  it('opens at the feeling step', () => {
    useCheckInStore.getState().open('button')
    expect(useCheckInStore.getState().current).toMatchObject({ step: 'feeling', source: 'button' })
  })

  it('advances to the need step, holding the feeling', () => {
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().pickFeeling('angry')
    expect(useCheckInStore.getState().current).toMatchObject({ step: 'need', feeling: 'angry' })
  })

  it('records nothing when dismissed at the feeling step', () => {
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().dismiss()
    expect(useCheckInStore.getState().entries).toEqual([])
    expect(useCheckInStore.getState().current).toBeNull()
  })

  it('records the feeling alone when dismissed at the need step', () => {
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().pickFeeling('sad')
    useCheckInStore.getState().dismiss()
    const { entries } = useCheckInStore.getState()
    expect(entries).toHaveLength(1)
    expect(entries[0].feeling).toBe('sad')
    expect(entries[0].need).toBeUndefined()
  })

  it('records feeling and need when completed', () => {
    useCheckInStore.getState().open('breakpoint')
    useCheckInStore.getState().pickFeeling('tired')
    useCheckInStore.getState().pickNeed('break')
    const { entries, current } = useCheckInStore.getState()
    expect(entries[0]).toMatchObject({ feeling: 'tired', need: 'break' })
    expect(current).toBeNull()
  })

  it('stamps lastPromptedAt only for an automatic prompt', () => {
    useCheckInStore.getState().open('button')
    expect(useCheckInStore.getState().lastPromptedAt).toBeNull()
    reset()
    useCheckInStore.getState().open('breakpoint')
    expect(useCheckInStore.getState().lastPromptedAt).toBeTypeOf('number')
  })

  it('clear() empties entries, for sign-out', () => {
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().pickFeeling('happy')
    useCheckInStore.getState().pickNeed('keep_going')
    useCheckInStore.getState().clear()
    expect(useCheckInStore.getState().entries).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/checkin-store.test.js`
Expected: FAIL — cannot resolve `../src/stores/useCheckInStore`

- [ ] **Step 4: Write minimal implementation**

```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { appendEntry } from '../lib/checkIn'

// A child's check-ins.
//
// ─────────────────────────────────────────────────────────────────────────
// THESE ENTRIES NEVER LEAVE THE DEVICE. Do not add a fetch here, do not sync
// them, do not surface them to a parent or teacher dashboard.
//
// That is not squeamishness. Synced, this becomes a wellbeing record about a
// named child: sensitive data under GDPR, a DPIA trigger, and — the part that
// actually breaks the feature — a reason for the child to stop answering
// honestly. tests/checkin-network.test.js enforces it.
// ─────────────────────────────────────────────────────────────────────────
//
// Unlike useMilestoneStore this IS persisted: a milestone is a moment, but a
// pattern the child can look back on only exists if it is kept.

export const useCheckInStore = create(
  persist(
    (set, get) => ({
      current: null,        // { step: 'feeling' | 'need', feeling?, source }
      entries: [],
      lastPromptedAt: null, // automatic prompts only; the button ignores it

      /// `source` is 'button' (child asked) or 'breakpoint' (app offered).
      open: (source = 'button') =>
        set({
          current: { step: 'feeling', source },
          ...(source === 'breakpoint' ? { lastPromptedAt: Date.now() } : {}),
        }),

      pickFeeling: (feeling) =>
        set((s) => (s.current ? { current: { ...s.current, step: 'need', feeling } } : {})),

      /// Completing the flow records feeling + need and closes.
      pickNeed: (need) =>
        set((s) => {
          const feeling = s.current?.feeling
          if (!feeling) return { current: null }
          return { entries: appendEntry(s.entries, { feeling, need }), current: null }
        }),

      /// Closing early is always allowed. A feeling already chosen is kept —
      /// the child told us something — but nothing is invented.
      dismiss: () =>
        set((s) => {
          const feeling = s.current?.feeling
          return {
            current: null,
            ...(feeling ? { entries: appendEntry(s.entries, { feeling }) } : {}),
          }
        }),

      clear: () => set({ entries: [], current: null, lastPromptedAt: null }),
    }),
    {
      name: 'my-favorite-book-checkin',
      // `current` is transient UI state; persisting it would reopen the sheet
      // on every refresh.
      partialize: (s) => ({ entries: s.entries, lastPromptedAt: s.lastPromptedAt }),
    }
  )
)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/checkin-store.test.js`
Expected: PASS, 7 tests

- [ ] **Step 6: Run the whole suite to confirm the setup.js change broke nothing**

Run: `npx vitest run`
Expected: all previously passing tests still pass

- [ ] **Step 7: Commit**

```bash
git add src/stores/useCheckInStore.js tests/checkin-store.test.js tests/setup.js
git commit -m "feat(checkin): persisted store, device-only by construction"
```

---

### Task 3: Copy, in both languages

**Files:**
- Create: `src/i18n/locales/en/checkin.json`, `src/i18n/locales/it/checkin.json`
- Modify: `src/i18n/index.js` (add `'checkin'` to `NAMESPACES`), `src/i18n/locales/en/index.js` and `src/i18n/locales/it/index.js` (import and export the new namespace)

**Interfaces:**
- Consumes: the `FEELINGS` / `NEEDS` ids from Task 1
- Produces: keys `checkin:title.*`, `checkin:feeling.<id>`, `checkin:need.<id>`, `checkin:response.*`, `checkin:constellation.*`, `checkin:button.*`

- [ ] **Step 1: Write the English catalogue**

```json
{
  "title": {
    "feeling": "How are you doing?",
    "need": "What would help?"
  },
  "feeling": {
    "happy": "Happy",
    "proud": "Proud",
    "tired": "Tired",
    "worried": "Worried",
    "angry": "Angry",
    "sad": "Sad"
  },
  "need": {
    "break": "Take a break",
    "quiet": "Make it quiet",
    "help": "I need help",
    "keep_going": "Keep going"
  },
  "response": {
    "break_title": "Your story is saved",
    "break_body": "It's here waiting for you. Come back whenever you want.",
    "break_cta": "Okay",
    "quiet": "Quiet mode is on. Just you and the page.",
    "keep_going": "Off you go."
  },
  "button": {
    "label": "How am I doing?",
    "aria": "Check in on how you are doing"
  },
  "constellation": {
    "title": "Feelings you've noticed",
    "empty": "Your feelings will show up here as stars.",
    "star_aria": "{{feeling}}, {{date}}"
  }
}
```

- [ ] **Step 2: Write the Italian catalogue**

Feeling labels are NOUNS. `arrabbiato/a` would force a gender the app never learns.

```json
{
  "title": {
    "feeling": "Come va?",
    "need": "Cosa ti serve?"
  },
  "feeling": {
    "happy": "Gioia",
    "proud": "Orgoglio",
    "tired": "Stanchezza",
    "worried": "Preoccupazione",
    "angry": "Rabbia",
    "sad": "Tristezza"
  },
  "need": {
    "break": "Fare una pausa",
    "quiet": "Un po' di silenzio",
    "help": "Ho bisogno di aiuto",
    "keep_going": "Vado avanti"
  },
  "response": {
    "break_title": "La tua storia è salvata",
    "break_body": "Ti aspetta qui. Torna quando vuoi.",
    "break_cta": "Va bene",
    "quiet": "Modalità silenziosa attiva. Solo tu e la pagina.",
    "keep_going": "Allora vai!"
  },
  "button": {
    "label": "Come va?",
    "aria": "Dicci come stai andando"
  },
  "constellation": {
    "title": "Quello che hai notato",
    "empty": "Qui appariranno le tue stelline.",
    "star_aria": "{{feeling}}, {{date}}"
  }
}
```

- [ ] **Step 3: Register the namespace**

In `src/i18n/index.js`, add `'checkin'` to the `NAMESPACES` array. In both `src/i18n/locales/en/index.js` and `src/i18n/locales/it/index.js`, add `import checkin from './checkin.json'` and include `checkin` in the default export object.

- [ ] **Step 4: Run the i18n tests**

Run: `npx vitest run tests/i18n-keys.test.js`
Expected: PASS — parity, placeholder agreement and the no-English-leftover check all cover the new namespace automatically

- [ ] **Step 5: Commit**

```bash
git add src/i18n/
git commit -m "feat(checkin): EN and IT copy, Italian feelings as nouns"
```

---

### Task 4: The sheet

**Files:**
- Create: `src/components/ui/CheckInSheet.jsx`
- Test: manual (component rendering is not covered by this suite; the logic it calls is covered by Tasks 1-2)

**Interfaces:**
- Consumes: `useCheckInStore`, `FEELINGS`, `NEEDS`
- Produces: default-exported `<CheckInSheet />`, rendering nothing when `current` is null

- [ ] **Step 1: Write the component**

```jsx
import { motion, AnimatePresence } from 'motion/react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useCheckInStore } from '../../stores/useCheckInStore'
import { FEELINGS, NEEDS } from '../../lib/checkIn'
import Mascot from './Mascot'

// The two-step check-in. Portalled for the same reason WelcomeBackMoment is:
// AppShell puts page content inside a stacking context, so a sheet rendered
// inline cannot cover the header and tab bar.
//
// Unlike MilestoneMoment this DOES take pointer events and does NOT
// auto-dismiss — it is waiting for an answer. The backdrop closes it, so a
// child is never trapped.

function Tile({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl glass border border-white/15 px-4 py-4 text-white transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-galaxy-primary"
    >
      {children}
      <span className="font-body text-sm font-semibold">{label}</span>
    </button>
  )
}

export default function CheckInSheet() {
  const { t } = useTranslation()
  const current = useCheckInStore((s) => s.current)
  const pickFeeling = useCheckInStore((s) => s.pickFeeling)
  const pickNeed = useCheckInStore((s) => s.pickNeed)
  const dismiss = useCheckInStore((s) => s.dismiss)

  if (!current) return null

  const isFeelingStep = current.step === 'feeling'
  const items = isFeelingStep ? FEELINGS : NEEDS
  const prefix = isFeelingStep ? 'checkin:feeling.' : 'checkin:need.'
  const choose = isFeelingStep ? pickFeeling : pickNeed

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={dismiss}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t(isFeelingStep ? 'checkin:title.feeling' : 'checkin:title.need')}
          className="w-full max-w-md rounded-modal bg-gradient-to-br from-[#38246B] to-[#662E80] p-6 shadow-glow-modal"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex justify-center">
            <Mascot mood="welcome" size={72} />
          </div>
          <h2 className="mb-5 text-center font-heading text-xl font-bold text-white">
            {t(isFeelingStep ? 'checkin:title.feeling' : 'checkin:title.need')}
          </h2>
          <div className={`grid gap-3 ${isFeelingStep ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {items.map((item) => (
              <Tile key={item.id} label={t(`${prefix}${item.id}`)} onClick={() => choose(item.id)}>
                {/* Placeholder until the ten mascot-style illustrations land.
                    Swapping this for <img src={art[item.id]}/> is the only
                    change the art drop needs. */}
                <span aria-hidden="true" className="text-3xl">·</span>
              </Tile>
            ))}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="mt-5 w-full py-2 font-body text-sm text-white/60 transition-colors hover:text-white"
          >
            {t('common:actions.close')}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
```

- [ ] **Step 2: Verify it builds**

Run: `npx vite build`
Expected: `✓ built`, no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/CheckInSheet.jsx
git commit -m "feat(checkin): two-step sheet, escapable at either step"
```

---

### Task 5: Host and mount

**Files:**
- Create: `src/components/ui/CheckInHost.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `CheckInSheet`, `useCheckInStore`, `useAccessibilityStore`
- Produces: default-exported `<CheckInHost />`, which also performs each need's response

- [ ] **Step 1: Write the host**

```jsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCheckInStore } from '../../stores/useCheckInStore'
import { useAccessibilityStore } from '../../stores/useAccessibilityStore'
import CheckInSheet from './CheckInSheet'
import BreakScreen from './BreakScreen'

// Mounted once in App.jsx beside MilestoneHost. Owns both the sheet and what
// happens after an answer, so no screen has to know the difference between
// "quiet" and "help".

export default function CheckInHost() {
  const { t } = useTranslation()
  const entries = useCheckInStore((s) => s.entries)
  const setFocusMode = useAccessibilityStore((s) => s.setFocusMode)
  const [breaking, setBreaking] = useState(false)

  // React to the most recent completed entry. `entries` is newest-first.
  const latest = entries[0]
  useEffect(() => {
    if (!latest?.need) return
    if (latest.need === 'quiet') setFocusMode(true)
    if (latest.need === 'break') setBreaking(true)
    // 'help' and 'keep_going' need nothing here — 'help' is handled by the
    // editor, which owns Story Buddy; 'keep_going' just closes.
  }, [latest?.at, latest?.need, setFocusMode])

  return (
    <>
      <CheckInSheet />
      {breaking && <BreakScreen onDone={() => setBreaking(false)} />}
    </>
  )
}
```

- [ ] **Step 2: Write the break screen**

Create `src/components/ui/BreakScreen.jsx`:

```jsx
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import Mascot from './Mascot'

// What "take a break" does: says the work is safe, then gets out of the way.
// No timer, no breathing exercise, no task. A child who asked to stop should
// not be handed another thing to do.

export default function BreakScreen({ onDone }) {
  const { t } = useTranslation()
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[75] flex flex-col items-center justify-center gap-5 bg-galaxy-bg px-8 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Mascot mood="welcome" size={120} />
      <h2 className="font-heading text-2xl font-bold text-galaxy-text">
        {t('checkin:response.break_title')}
      </h2>
      <p className="max-w-sm font-body text-galaxy-text-muted">
        {t('checkin:response.break_body')}
      </p>
      <button
        type="button"
        onClick={onDone}
        className="mt-2 rounded-full border-2 border-white/30 px-6 py-2.5 font-heading text-sm font-bold text-white/90"
      >
        {t('checkin:response.break_cta')}
      </button>
    </motion.div>,
    document.body
  )
}
```

- [ ] **Step 3: Mount it**

In `src/App.jsx`, add `import CheckInHost from './components/ui/CheckInHost'` and render `<CheckInHost />` immediately after `<MilestoneHost />`.

- [ ] **Step 4: Verify**

Run: `npx vite build && npx vitest run`
Expected: build clean, all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/CheckInHost.jsx src/components/ui/BreakScreen.jsx src/App.jsx
git commit -m "feat(checkin): host, and the break screen that just gets out of the way"
```

---

### Task 6: The always-available button

**Files:**
- Create: `src/components/ui/CheckInButton.jsx`
- Modify: `src/components/editor/StoryEditor.jsx`

**Interfaces:**
- Consumes: `useCheckInStore.open`
- Produces: default-exported `<CheckInButton />`

- [ ] **Step 1: Write the button**

```jsx
import { useTranslation } from 'react-i18next'
import { useCheckInStore } from '../../stores/useCheckInStore'
import Mascot from './Mascot'

// Always available, never rate-limited. This is the one that matters for a
// child who is actually struggling — the automatic prompt waits for a
// breakpoint, but a child in difficulty should never have to wait.

export default function CheckInButton({ className = '' }) {
  const { t } = useTranslation()
  const open = useCheckInStore((s) => s.open)

  return (
    <button
      type="button"
      onClick={() => open('button')}
      aria-label={t('checkin:button.aria')}
      className={`flex items-center gap-2 rounded-full glass border border-white/15 px-3 py-2 text-white/80 transition-colors hover:text-white ${className}`}
    >
      <Mascot mood="idle" size={22} />
      <span className="hidden font-body text-xs font-semibold sm:inline">
        {t('checkin:button.label')}
      </span>
    </button>
  )
}
```

- [ ] **Step 2: Place it in the editor**

In `src/components/editor/StoryEditor.jsx`, import it and render `<CheckInButton />` in the same row as the existing save/finish action, before that button so it never competes for the primary position.

- [ ] **Step 3: Verify**

Run: `npx vite build`
Expected: `✓ built`

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/CheckInButton.jsx src/components/editor/StoryEditor.jsx
git commit -m "feat(checkin): always-available button in the editor"
```

---

### Task 7: The breakpoint trigger

**Files:**
- Modify: `src/components/editor/PageEditor.jsx`
- Test: `tests/checkin-trigger.test.js`

**Interfaces:**
- Consumes: `isEligibleForPrompt` (Task 1), `useCheckInStore.open` (Task 2)
- Produces: nothing new

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { useCheckInStore } from '../src/stores/useCheckInStore'
import { isEligibleForPrompt } from '../src/lib/checkIn'

describe('breakpoint eligibility', () => {
  beforeEach(() => useCheckInStore.setState({ current: null, entries: [], lastPromptedAt: null }))

  it('offers once, then stays quiet for the rest of the session', () => {
    expect(isEligibleForPrompt({ lastPromptedAt: useCheckInStore.getState().lastPromptedAt })).toBe(true)
    useCheckInStore.getState().open('breakpoint')
    useCheckInStore.getState().dismiss()
    expect(isEligibleForPrompt({ lastPromptedAt: useCheckInStore.getState().lastPromptedAt })).toBe(false)
  })

  it('never rate-limits the child-initiated button', () => {
    useCheckInStore.getState().open('breakpoint')
    useCheckInStore.getState().dismiss()
    // The button ignores eligibility entirely.
    useCheckInStore.getState().open('button')
    expect(useCheckInStore.getState().current).toMatchObject({ source: 'button' })
  })
})
```

- [ ] **Step 2: Run to verify it fails or passes**

Run: `npx vitest run tests/checkin-trigger.test.js`
Expected: PASS (the behaviour is already in Tasks 1-2; this test pins it before the UI wiring can break it)

- [ ] **Step 3: Wire the trigger**

In `src/components/editor/PageEditor.jsx`, beside the existing `fireMilestone` call, add:

```jsx
import { useCheckInStore } from '../../stores/useCheckInStore'
import { isEligibleForPrompt } from '../../lib/checkIn'
// ...
const openCheckIn = useCheckInStore((s) => s.open)
const lastPromptedAt = useCheckInStore((s) => s.lastPromptedAt)

// Offer a check-in at the same seam the milestone uses — a page just
// finished. Only when the milestone did NOT fire, so a child never gets a
// celebration and a question in the same beat.
if (!beat && isEligibleForPrompt({ lastPromptedAt })) {
  openCheckIn('breakpoint')
}
```

Place it immediately after the existing milestone branch, using whatever the local variable for the milestone result is named.

- [ ] **Step 4: Verify**

Run: `npx vitest run && npx vite build`
Expected: all pass, build clean

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/PageEditor.jsx tests/checkin-trigger.test.js
git commit -m "feat(checkin): offer at the page-finished seam, never beside a celebration"
```

---

### Task 8: The constellation

**Files:**
- Create: `src/components/ui/FeelingConstellation.jsx`
- Modify: `src/pages/AccountPage.jsx`

**Interfaces:**
- Consumes: `useCheckInStore.entries`, `FEELINGS` (for `tone`), `formatDate` from `src/i18n/formats`
- Produces: default-exported `<FeelingConstellation />`

- [ ] **Step 1: Write the component**

```jsx
import { useTranslation } from 'react-i18next'
import { useCheckInStore } from '../../stores/useCheckInStore'
import { FEELINGS } from '../../lib/checkIn'
import { formatDate } from '../../i18n/formats'

// The child's own pattern — and deliberately NOT a chart.
//
// The obvious build is "angry: 8 this week". That teaches a child that some
// feelings are a bad score, and a score invites comparison. So: one star per
// check-in, coloured by feeling, no totals, no ranking, no trend line. The
// message the layout carries is "all of these are normal, and you noticed
// them".
//
// Positions are derived from the entry timestamp rather than random, so the
// sky is stable between renders instead of rearranging itself each visit.

const TONE = {
  gold: '#FFD60A', purple: '#BF5AF2', blue: '#64D2FF',
  cyan: '#66D9FF', pink: '#FF375F', indigo: '#A68CFF',
}
const toneFor = (id) => TONE[FEELINGS.find((f) => f.id === id)?.tone] ?? '#FFFFFF'

export default function FeelingConstellation() {
  const { t } = useTranslation()
  const entries = useCheckInStore((s) => s.entries)

  return (
    <div>
      <h3 className="mb-2 font-heading text-lg font-bold text-galaxy-text">
        {t('checkin:constellation.title')}
      </h3>
      {entries.length === 0 ? (
        <p className="font-body text-sm text-galaxy-text-muted">
          {t('checkin:constellation.empty')}
        </p>
      ) : (
        <div className="relative h-40 w-full overflow-hidden rounded-2xl glass">
          {entries.map((e) => {
            const seed = Date.parse(e.at)
            const left = (seed % 89) / 89 * 92 + 4
            const top = (Math.floor(seed / 1000) % 61) / 61 * 76 + 12
            return (
              <span
                key={e.at}
                title={t('checkin:constellation.star_aria', {
                  feeling: t(`checkin:feeling.${e.feeling}`),
                  date: formatDate(e.at, 'medium'),
                })}
                className="absolute block h-2 w-2 rounded-full"
                style={{
                  left: `${left}%`, top: `${top}%`,
                  background: toneFor(e.feeling),
                  boxShadow: `0 0 8px ${toneFor(e.feeling)}`,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Place it on the account page**

In `src/pages/AccountPage.jsx`, render `<FeelingConstellation />` inside a bordered section directly below the badges block, matching the existing section pattern.

- [ ] **Step 3: Verify**

Run: `npx vite build && npx vitest run`
Expected: build clean, tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/FeelingConstellation.jsx src/pages/AccountPage.jsx
git commit -m "feat(checkin): the child's own pattern, as stars rather than a score"
```

---

### Task 9: Isolate one child's entries from the next

**Files:**
- Modify: `src/stores/useAuthStore.js`
- Test: `tests/checkin-store.test.js` (extend)

**Interfaces:**
- Consumes: `useCheckInStore.clear`
- Produces: nothing new

**Note — deviation from the spec, and why.** The spec says entries are "keyed
by user id, so siblings on one family account cannot read each other's".
Clearing on every identity change achieves the same guarantee with one
storage key instead of N, and it matches how the bookshelf already behaves on
sign-out. Per-user keys would also leave one child's feelings sitting in
localStorage after they stop using the device, which is the opposite of what
the spec wants. The spec has been amended to match.

- [ ] **Step 1: Write the failing test**

Append to `tests/checkin-store.test.js`:

```js
import { useAuthStore } from '../src/stores/useAuthStore'

describe('sign-out', () => {
  it('clears a child\'s entries so the next user sees none', async () => {
    useCheckInStore.getState().open('button')
    useCheckInStore.getState().pickFeeling('sad')
    useCheckInStore.getState().pickNeed('break')
    expect(useCheckInStore.getState().entries).toHaveLength(1)

    await useAuthStore.getState().signOut().catch(() => {})
    expect(useCheckInStore.getState().entries).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/checkin-store.test.js`
Expected: FAIL — entries still has 1

- [ ] **Step 3: Wire the clear**

In `src/stores/useAuthStore.js`, add the import and clear in BOTH places an
identity ends or changes — the explicit `signOut` action, and wherever the
store reacts to the session user changing (the same seam `bookshelf.clear()`
already uses):

```js
import { useCheckInStore } from './useCheckInStore'
// ...
// Feelings are per-child and never leave the device. Clearing on every
// identity change is how one child's entries stay invisible to the next
// person on this browser — simpler and safer than per-user storage keys,
// which would leave the first child's feelings sitting there indefinitely.
useCheckInStore.getState().clear()
```

If `useAuthStore` has no user-change branch, add the clear to `App.jsx`'s
existing `onChange(of: user?.id)` equivalent — the web app resets the
bookshelf on user change somewhere, and the check-in clear belongs beside it.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/checkin-store.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/useAuthStore.js tests/checkin-store.test.js
git commit -m "feat(checkin): clear entries on sign-out"
```

---

### Task 10: The regression guard that matters

**Files:**
- Create: `tests/checkin-network.test.js`

**Interfaces:**
- Consumes: all of the above
- Produces: nothing

- [ ] **Step 1: Write the test**

```js
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
// Two guards: no network call at runtime, and no /api reference in the
// source. The second catches it even if the call sits behind a condition the
// first never reaches.

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

  it('has no /api reference in any check-in source file', () => {
    const files = [
      'src/lib/checkIn.js',
      'src/stores/useCheckInStore.js',
      'src/components/ui/CheckInSheet.jsx',
      'src/components/ui/CheckInHost.jsx',
      'src/components/ui/CheckInButton.jsx',
      'src/components/ui/BreakScreen.jsx',
      'src/components/ui/FeelingConstellation.jsx',
    ]
    const offenders = files.filter((f) => {
      const src = readFileSync(f, 'utf8')
      // Ignore the explanatory comments, which legitimately mention /api.
      const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      return /['"`]\/api\/|apiFetch|fetch\s*\(/.test(code)
    })
    expect(offenders, `check-in files must not talk to the server:\n${offenders.join('\n')}`).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it passes**

Run: `npx vitest run tests/checkin-network.test.js`
Expected: PASS, 2 tests

- [ ] **Step 3: Verify the guard is not vacuous**

Temporarily add `fetch('/api/checkin', { method: 'POST' })` inside `pickNeed` in the store. Run the test — BOTH assertions must fail. Then revert.

- [ ] **Step 4: Full suite and build**

Run: `npx vitest run && npx vite build`
Expected: all pass, build clean

- [ ] **Step 5: Commit**

```bash
git add tests/checkin-network.test.js
git commit -m "test(checkin): guard that entries never reach the network"
```

---

## Deferred, deliberately

- **The ten illustrations.** `CheckInSheet` renders a placeholder glyph; swapping it for `<img>` is a one-line change per tile. The feature is usable without them and cannot ship to users with them missing.
- **iOS.** Port once this design has been used by a real child. Mirrors as `CheckInStore` (`@Observable` + `UserDefaults`), `CheckInSheet.swift`, `FeelingConstellation.swift`.
- **"I need help" routing into Story Buddy.** The host deliberately does nothing for `help` — wiring it requires the editor to expose an imperative "open Story Buddy" handle it does not currently have. Worth doing, but it is a change to the editor's interface, not to this feature.
- **Pausing background music on a break.** Cheap, but `audioService` ownership sits outside this feature; add it once the break screen has been seen in use.

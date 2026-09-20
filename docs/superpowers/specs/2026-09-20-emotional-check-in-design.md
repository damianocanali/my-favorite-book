# Emotional check-in — design

**Status:** approved in brainstorm, not yet implemented
**Platforms:** web first, iOS follows once the design has been used by a real child

## Context

The idea came from a playground AAC communication board ("Let's Play!" by
Boardmaker) — a panel of picture symbols that lets non-speaking and
minimally-verbal children communicate at the park. Its feelings sit in their
own colour band, so a child can find "angry" without reading, and one symbol
in the verbs band is simply "rest".

My Book Lab's audience is children roughly 6–12, many of them ADHD or
dyslexic, doing something genuinely hard: writing. The gap this fills is that
a frustrated seven-year-old will not go hunting through a toolbar for focus
mode or the writing assistant. They will, however, tap a face that looks like
how they feel.

So the feature is a check-in that offers a **doorway into affordances the app
already has**, plus one new one (a break that saves your work and gets out of
the way). It is explicitly not a wellbeing product.

## What this is not

Stated up front because every one of these is a plausible-sounding
"improvement" that would make the feature worse or unshippable:

- **Not therapy, and never described as such.** No claim that it helps a child
  regulate emotions, improves wellbeing, or supports ADHD or dyslexia.
  MDCG 2019-11 Rev.1 carries a worked example of software "intended to treat"
  a childhood condition qualifying as a medical device under the EU MDR. A
  check-in is a product feature; an efficacy claim is a regulatory event.
- **Not synced.** Entries never leave the device. See Storage.
- **Not gamified.** No badges, streaks, points or rewards for checking in.
  Rewarding emotional honesty teaches a child to report the answer that pays.
- **Not measured.** No mood scores, no charts, no counts. See Pattern view.
- **Not a guided exercise.** No breathing timers or grounding tasks. That is
  the piece closest to a therapeutic intervention and it is out of scope
  unless a clinician reviews it.
- **Not tied to content.** An entry records no book and no page. See Data.

## Architecture

Follows the existing moment pattern — a store any screen can fire, and a host
mounted once that owns the markup — but as a **parallel subsystem**, not an
extension of `useMilestoneStore`.

The two have opposite lifecycles, and the milestone code says so in its own
comments: `MilestoneHost` auto-dismisses after 2.8s and `MilestoneMoment` is
`pointer-events-none`, specifically so a child mid-sentence never has to deal
with it. A check-in must wait for input and accept taps. Generalising one host
to serve both would fight a deliberate design rather than reuse it.

**New files (web):**

| File | Purpose |
|---|---|
| `src/stores/useCheckInStore.js` | State, persistence, trigger eligibility |
| `src/components/ui/CheckInHost.jsx` | Mounted once in `App.jsx` beside `MilestoneHost` |
| `src/components/ui/CheckInSheet.jsx` | The two-step sheet |
| `src/components/ui/CheckInButton.jsx` | Permanent mascot button in the editor |
| `src/components/account/FeelingConstellation.jsx` | The child's own pattern |
| `src/i18n/locales/{en,it}/checkin.json` | New namespace (~30 keys) |

**Modified:**

| File | Change |
|---|---|
| `src/App.jsx` | Mount `CheckInHost` beside `MilestoneHost` |
| `src/components/editor/PageEditor.jsx` | The breakpoint. It already imports `useMilestoneStore` and fires on page progress (line 22) — the check-in hooks the SAME seam rather than inventing a second notion of "a page just finished". |
| `src/components/editor/StoryEditor.jsx` | The permanent mascot button, near the existing save/finish action |
| `src/pages/AccountPage.jsx` | The constellation, below badges |
| `src/stores/useAuthStore.js` | Clear entries on sign-out |

**iOS**, once the web design has settled: `CheckInStore` (`@Observable` +
`UserDefaults`, matching `RewardsStore`), `CheckInSheet.swift`,
`FeelingConstellation.swift`. No shared client code — this codebase has never
shared any between web and native, and introducing that here would be a larger
change than the feature.

## Data

An entry is three fields:

```js
{ at: '2026-09-20T14:22:00Z', feeling: 'angry', need: 'break' }
```

No free text, no book id, no page id. Deliberate: the moment a feeling can be
tied to a specific page, the app holds a record of *what upset this child* —
a different and far heavier artefact than "how am I doing lately", and one
that invites exactly the parent-dashboard feature we chose not to build.

`feeling` ∈ happy | proud | tired | worried | angry | sad
`need` ∈ break | keep_going | quiet | help
`need` may be absent when the child closed after step 1.

## Storage

- **`localStorage` only. Never posted to `/api`.** This is the single most
  important constraint in the design and the store carries a comment saying
  so, because "let parents see it" is the obvious next request and it is the
  change that turns this into sensitive data about a child under GDPR,
  triggers a DPIA, and — more practically — makes children answer dishonestly.
- Keyed by user id, so siblings on one family account cannot read each other's.
- Capped by BOTH rules, whichever bites first: keep at most 60 entries, and
  drop any entry older than 30 days. Unbounded localStorage growth is a real
  bug and no child needs a year of history.
- Cleared on sign-out and on account deletion, alongside the existing resets.

**A deliberate asymmetry, worth stating in the privacy policy:** a child's
books sync across their devices; their feelings never leave the one they were
typed on.

## Flow

Two steps, escapable at either. A child can close without answering and
nothing is recorded. Forced emotional disclosure is worse than no check-in —
a child who feels cornered learns to dismiss it on sight.

**Step 1 — "How are you doing?"** Six tiles.
**Step 2 — "What would help?"** Four tiles.

| Need | Response | Status |
|---|---|---|
| Take a break | Save the book, then a calm screen: *"Your story is saved and waiting."* No timer, no task. | new, small |
| Make it quiet | Enable `focusMode` | reuses `useAccessibilityStore` |
| I need help | Open Story Buddy / sentence starters | reuses existing |
| Keep going | Close with one warm line | trivial |

Three of the four route into things that already exist. That is the core of
why the feature is worth building: it is a doorway, not a module.

## Triggers

- **Breakpoints only** — page saved, illustration finished, book completed.
  Never during typing.
- **At most once per session**, following the precedent in
  `useMilestoneStore`, whose `seen` set exists because a beat on every edit is
  noise.
- **A permanent mascot button in the editor**, unlimited and never
  interrupting. This is the one that matters for a child who is actually
  struggling, and the reason "random" was rejected: interrupting an ADHD child
  who has finally reached flow is actively harmful.

## Pattern view

The obvious version of this is harmful. A panel reading *"angry: 8 this week"*
teaches a child that some feelings are a bad score; counts invite comparison
and comparison invites shame.

Instead: **no counts, no charts, no streaks.** Each check-in is one star in a
small constellation on the cosmic background the app already uses, coloured by
feeling. Tapping a star says when it was and nothing else. The layout's
message is *all of these are normal, and you noticed them*.

Lives on the Account page below the badges. Never surfaced in a celebration,
never mentioned by the mascot, never shown unprompted.

## Art

Ten illustrations in the mascot's style: six feelings, four needs. Custom
rather than an existing symbol set, which resolves a licensing problem worth
recording:

- **ARASAAC** — the set Italian schools and *logopedisti* actually use, and
  the best fit on familiarity — is **CC BY-NC-SA**. The NC excludes commercial
  products, and this app sells subscriptions, coins and printed books.
  Commercial use needs written authorisation from the Gobierno de Aragón.
- **Mulberry Symbols** is CC BY-SA 4.0 and does permit commercial use, with
  attribution and share-alike on any derived symbol.
- Custom art sidesteps both, is the studio's own IP, and matches the existing
  visual identity — at the cost of the AAC familiarity that inspired the idea.

`MASCOT-ASSET.md` and `scripts/slice-mascot.py` document how the existing five
poses were produced. **This is the critical-path dependency:** the code can
land behind a flag; the feature cannot ship without the art.

## Copy

~30 strings × EN/IT, in a new `checkin` namespace.

**Italian requires a content decision, not a translation.** Feeling words are
adjectives that agree with the speaker's gender, and the app never learns it —
*"sei arrabbiato/a"* is exactly the construction the Italian review already
flagged as broken. The tiles therefore carry **nouns**: *rabbia*, *tristezza*,
*stanchezza*, *preoccupazione*. Gender-invariant, and they read as naming a
feeling rather than labelling the child, which is better copy in both
languages.

## Testing

`tests/checkin.test.js`, against the store as plain functions:

- fires at most once per session at a breakpoint
- the permanent button is never rate-limited
- dismissing at step 1 records nothing
- dismissing at step 2 records the feeling with no `need`
- the cap evicts oldest first
- sign-out clears entries
- entries are keyed by user; a second user sees none of the first's
- **`/api` is never called with entry data** — the regression guard for the
  tempting future change

Plus i18n parity, which the existing `tests/i18n-keys.test.js` covers
automatically once the namespace is added.

## Open questions

- Where exactly the permanent button sits in the editor without competing with
  Story Buddy and Draw. A layout question, best answered against the real UI.
- Whether "take a break" should also pause background music. Probably yes;
  cheap to add, trivial to remove.

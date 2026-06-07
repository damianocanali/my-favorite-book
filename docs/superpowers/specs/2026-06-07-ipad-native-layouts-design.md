# iPad-Native Layouts for My Book Lab

**Date:** 2026-06-07
**Target:** `ios-native/MyBookLab` (SwiftUI, deployment target iOS 17)
**Status:** Approved design

## Goal

Make the native SwiftUI app (shipping as 2.0.0) feel **designed for iPad**, not merely
compatible with it. Kids will use this app mostly on iPads. Every feature must look
intentional on iPad screens (11" and 13") in **both portrait and landscape**, while the
iPhone layout stays unchanged.

This is an iPad-**native** effort: adaptive multi-column layouts that use the bigger
screen, plus two genuine layout redesigns (the reader and the hero). The bottom `TabView`
shell is kept.

## Current state (what's already fine)

- `TARGETED_DEVICE_FAMILY = "1,2"` — already builds for iPhone + iPad.
- All four orientations enabled on iPad in `Info.plist` (`UISupportedInterfaceOrientations~ipad`).
- `UIRequiresFullScreen: true` — single-window, no Split View multitasking. **Kept.**
- Every screen uses `NavigationStack` (not the old `NavigationView`), so no janky forced
  split-view on iPad.
- No `UIScreen.main` hardcoding anywhere.
- `GalleryView` already uses an `.adaptive` grid.
- `SignInView` already defines and uses a `contentColumn(maxWidth:)` helper — the pattern
  to spread everywhere.

## The core insight

Almost every iPad defect is one of two kinds:

- **(a)** content stretches edge-to-edge on a 13" screen (forms, lists, cards, reader text).
- **(b)** grids/sizes are hardcoded for iPhone width (column counts, frame widths/heights).

The fix is a **small set of shared adaptive primitives applied consistently**, plus two
layout redesigns that earn the larger screen.

## Critical technical constraint: size class can't detect iPad orientation

On iPad, **both portrait and landscape report `horizontalSizeClass == .regular`**. Size
class alone cannot distinguish iPad portrait from iPad landscape. Two distinct signals are
used deliberately:

- **`horizontalSizeClass == .regular`** → "this is an iPad (or big-iPhone landscape)."
  Use for: wider grid column counts, constrained content columns, larger tap targets,
  larger preview sizes.
- **Aspect ratio via `GeometryReader` (`width > height`)** → "landscape right now."
  Use for: the two-page reader spread and the side-by-side hero, which are
  *orientation*-driven, not size-class-driven.

Do not use `horizontalSizeClass` to drive the reader spread or hero side-by-side layout —
it would be wrong in iPad portrait.

## Components

### 1. Shared primitives — new file `Views/Adaptive.swift`

- Move `contentColumn(maxWidth:)` out of `SignInView` into a shared `View` extension so
  there is a single source of truth. `SignInView` keeps calling it unchanged.
- Width tokens (no magic numbers scattered across views):
  - `form` = 640 — checkout, account, order detail, sign-in, wizard steps.
  - `reading` = 720 — lists and single-column reading content.
  - Grids stay full-bleed but gain sensible adaptive min/max and a centered outer max width.
- A small `@Environment(\.horizontalSizeClass)`-driven helper meaning "is this a
  regular-width (iPad-ish) context," to keep per-view branches readable.

The `contentColumn` modifier centers content and caps its width; on iPhone it is
effectively full-width, on iPad it produces a readable centered column.

### 2. Reader redesign — `BookDetailView` (highest-priority feature)

The reader is a paged `TabView` of cream "book cards" (cover, pages, end). Today each page
card stacks a fixed `height: 240` image over text, leaving large empty cream space on iPad.

- **Landscape (GeometryReader `width > height`):** two-page **spread** inside one cream
  card — illustration fills the left half, story text + page-number badge on the right
  half. Picture-book feel.
- **Portrait:** keep the stacked image-over-text card, but replace the fixed `height: 240`
  image with an aspect-ratio box so the illustration scales up on iPad.
- Cover card and end card scale their art/typography up on regular width.
- Read-aloud (`AVSpeechSynthesizer`), page swiping, page controls, and the toolbar are
  unchanged in behavior.

### 3. Hero redesign — `HeroLanding`

Full-screen hero (glowing logo halo, gradient wordmark, "Create a Book" CTA), shown as the
Bookshelf empty/landing state.

- **Landscape (aspect `width > height`):** logo on the left, wordmark + CTA on the right,
  filling the width instead of a tall, mostly-empty centered column.
- **Portrait:** keep the centered vertical stack, but scale logo halo (was fixed 380),
  logo image (was fixed 160), and title font (was fixed 56) up on regular width rather
  than using iPhone-fixed sizes. CTA button max width relaxed on iPad.

### 4. Consistent application across remaining views

| View | Change |
|---|---|
| **BookshelfView** | `booksPerRow` (fixed 5) and `spineWidth` (fixed 44) become size-class-driven — ~8–10 spines and wider spines on iPad; skeleton loader rows match the computed count; remove the nested inner `ScrollView`; constrain the example card to a max width. |
| **GalleryView** | Keep `.adaptive` grid; tune min/max so cards aren't sparse on 13"; center the grid within an outer max width. |
| **CreateBookView** (wizard) | Constrain each step to the `form` column; emoji grids (fixed 4 and 5 columns) become adaptive/size-class-driven; grow the page-text editor (`minHeight: 160`), illustration box (`height: 200`), and cover preview (`200×200`) on iPad; offer `[.medium, .large]` detents on the parental-gate sheet. |
| **PrintOrderView** | Wrap the form in the `form` column; **remove the hardcoded `State` field `width: 90`**; lay out City/State/ZIP/Phone as a two-column grid in landscape, stacked in portrait. |
| **AccountView** | Wrap signed-in content in the `form` column so the profile/coins/music/rows cards don't sprawl; signed-out state likewise constrained. |
| **OrdersListView** | Wrap the list in the `reading` column so order cards and status pills stay visually grouped. |
| **OrderDetailView** | Wrap content in the `form` column so the status timeline, summary rows, and shipping address don't stretch. |
| **PaywallView** | Plan cards become an adaptive grid (side-by-side on wide screens); size `presentationDetents([.medium, .large])`. |
| **CoinStoreView** | Art-style cards become an adaptive grid (2–3 per row on iPad) within a centered max width. |
| **AvatarEditorView** | Emoji grid (fixed 5 columns) becomes adaptive; avatar preview (fixed 160) scales up on iPad; cap the photo-picker button width. |
| **AvatarView** | Reusable component already takes a `size:` parameter — callers pass a larger size on iPad where it matters (e.g. account profile). No change to the component's API required. |

## Data flow / behavior

No data, networking, persistence, store, or model changes. This work is **purely
presentational** — layout containers, size-class/aspect branches, grid definitions, and
frame sizing. All stores (`AuthStore`, `BookshelfStore`, etc.), services (`APIClient`,
`AudioService`, `SpeechSpeaker`), and models are untouched. Behavior (navigation, audio
crossfades, read-aloud, purchases, sign-in) is unchanged.

## Error handling

No new error paths. Existing empty/error/loading states (Bookshelf skeleton, OrdersList
empty/error, reader empty state, AsyncImage failure placeholders) are preserved and simply
inherit the new adaptive containers.

## iPhone preservation guarantee (hard requirement)

Keeping the iPhone app exactly as good as it is today is a **non-negotiable gate**, equal
in priority to the iPad work. The design preserves iPhone *by construction*, not by
coincidence:

- iPhone **portrait** is always `horizontalSizeClass == .compact`. Every iPad branch is
  gated on `.regular` width (or a landscape aspect check), so on iPhone portrait each
  adaptive branch resolves to the **identical code path that ships today**. The goal is a
  literal no-op on iPhone portrait, verified by screenshot diff.
- `contentColumn(maxWidth:)` caps width; at iPhone widths the cap is never reached, so it
  is visually a no-op.
- Adaptive grids produce today's column counts at iPhone widths.

Two cases that need explicit attention (not assumption):

- **Max/Plus iPhones in landscape** report `regular` width and will therefore adopt the
  iPad-ish treatment (constrained columns, wider grids). This is generally an improvement,
  but each such branch must be eyeballed on a Max-phone landscape simulator to confirm it
  reads well, not broken.
- The **reader spread** is aspect-driven and will trigger in **iPhone landscape**. A
  side-by-side spread there must be checked to confirm it isn't cramped; if it is, gate the
  spread to also require a minimum width so small phones in landscape fall back to stacked.

## Testing / verification

- Build to the **iPad Pro 13"** and **iPad mini** simulators.
- Screenshot every tab (Books, Gallery, Create, Orders, Account) plus the reader and hero
  in **both portrait and landscape**. Confirm nothing stretches edge-to-edge, clips, or
  looks sparse.
- **iPhone regression gate:** screenshot key iPhone screens on a standard iPhone (e.g.
  iPhone 15) in **portrait** and confirm pixel-equivalence with the pre-change build —
  portrait must be unchanged. Then check a **Max iPhone in landscape** and a standard
  iPhone in landscape (reader especially) to confirm the `regular`-width / aspect branches
  read well and nothing regresses.
- Confirm read-aloud, page swiping, sign-in, and the create wizard still function on both
  iPad and iPhone.

## Out of scope (YAGNI)

- No sidebar / `NavigationSplitView` — bottom tabs are kept.
- No Split View / Slide Over multitasking — `UIRequiresFullScreen: true` stays.
- No Stage Manager or external-display handling.
- No model, store, service, or API changes.
- No new dependencies.

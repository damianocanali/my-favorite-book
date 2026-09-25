# Mascot artwork — what is wrong and what it needs

The mascot looked small, inconsistent and sometimes cut off. None of that was
styling. The assets themselves are damaged, and this records exactly how, so the
next person does not re-diagnose it.

All five poses came from slicing one delivered sheet with
`scripts/slice-mascot.py`. **That sheet was never committed and is not on disk**,
so nothing here can be re-cut — the fixes below work from the sliced files, and
what could not be recovered needs redrawing.

## What was wrong

### 1. Rendered into a square frame — fixed

Both platforms drew the mascot into a `size × size` box. The poses are not
square and are not even a consistent shape, so the same `size` produced visibly
different mascots:

| Pose | Aspect | Filled a 112×112 box |
|---|---|---|
| welcoming, cheering | 0.66 | **66%** |
| badge-glow | 0.67 | 67% |
| badge (as sliced) | 1.18 | 85% |
| welcome-back | 1.02 | 98% |

That is the "too small" complaint: asking for 112 got you 74 points of mascot.
It also meant he changed size whenever the mood changed.

**Fixed** by sizing on height and letting width follow the art, on web and iOS.
He is a standing character; his height is what should stay put.

### 2. `badge.png` contained two sprites — fixed

The sheet had five poses plus a small head sprite. The slicer segments by
connected regions of opaque pixels, and the badge's glow bridged the mascot to
the head beside it, so both were written out as one 412×350 "pose". Every badge
moment has been rendering a stray floating head.

**Fixed** by splitting at the thinnest column between them (x=297, 18 opaque
pixels). `badge.png` is now a clean 297×348, and the head was recovered as
`head.png` — useful wherever a full body at 40pt is unreadable.

### 3. The glow cross-fade was two different poses — fixed

`MASCOT-ASSET.md` describes `badge-glow.png` as "a lit second frame, cross-faded
over the base to make it glow". It is not. It is a **different pose** — different
stance, different arm, badge in the other hand — sliced from a different cell.
Cross-fading them morphed the mascot instead of lighting him, and the two
rendered 37pt apart in width besides.

**Fixed** by removing the cross-fade. The bloom is now a real shadow on the pose,
which cannot misalign.

### 4. `frames/badge` draws the wrong badge — fixed

The animated frame set that `badge` and `proud` actually played shows the mascot
holding a **blank purple shield**, not the gold star the static pose draws — at
161×256 against the static pose's 297×348. Wrong artwork, and the lower
resolution of the two.

**Fixed** by dropping that frame set. Those moods now use the static pose with
CSS/SwiftUI motion. `frames/cheering` is good and is still used.

## What still needs art

### `welcome-back.png` is cropped at the knees

The pose is cut off mid-thigh — the slicer split it horizontally and kept only
the top. The legs are not in the file and the sheet is gone, so this cannot be
recovered.

`frames/welcome-back` animates the same cropped pose, so it was dropped too.

**Right now** the `welcome` mood points at `welcoming.png`, which is complete.
That is a stopgap: the welcome-back pose (arms spread wide, no cap) is a
genuinely different and warmer greeting, and the app is poorer without it.

**To fix:** redraw that one pose, full body with feet, on a transparent
background, and drop it in as `public/mascot/welcome-back.png` plus the
`MascotWelcomeBack` imageset. Then point `welcome` back at it.

### The frame sets and the static poses are different drawings

`frames/cheering` has a **blue** scarf and a visible backpack. The static
`cheering.png` has a **teal** scarf and no backpack. They were produced
separately and the character drifted.

Not urgent — only one frame set survives — but worth knowing before commissioning
more animation, because the same drift will happen again unless whoever draws
them works from a single reference.

## If you re-slice anything

`scripts/slice-mascot.py` has one fix already (reading order came from each
sprite's own top edge, which mislabels a row that mixes heights). Two hazards
remain and are worth knowing:

- **Sprites that touch merge.** Leave generous transparent gutters, and keep
  decorative glow away from neighbouring cells.
- **Trimming destroys alignment.** Each sprite is cropped to its own bounds, so
  two frames meant to overlay come out different sizes. If a sheet ever carries
  real animation frames, they must be padded to a shared canvas.

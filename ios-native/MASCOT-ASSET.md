# Adding the mascot artwork

The mascot has **five drawn poses**, each mapped to a mood with its own
motion. Until the files exist, every pose falls back to an emoji, so the
app builds and behaves correctly with no artwork present.

## Slicing the pose sheet

The art arrives as one sheet with all five poses and a caption under each.
Do not cut it by hand — run:

```bash
pip install Pillow
python3 scripts/slice-mascot.py path/to/sheet.png
```

It finds the poses by connected transparent regions (so it survives being
re-exported at any size), drops the captions, trims each to its own
bounds, and writes:

```
public/mascot/welcoming.png      → moods: wave, idle, think
public/mascot/cheering.png       → mood:  cheer
public/mascot/welcome-back.png   → mood:  welcome
public/mascot/badge.png          → moods: badge, proud
public/mascot/badge-glow.png     → lit second frame, cross-faded to glow
public/mascot/head.png           → optional small head sprite
public/mascot.png                → generic fallback
```

That is the whole web job. No code change.

## iOS

Open `Assets.xcassets` in Xcode and drag each sliced PNG onto the 1x/2x/3x
wells of its imageset:

| File | Imageset |
|---|---|
| `welcoming.png` | `MascotWelcoming` |
| `cheering.png` | `MascotCheering` |
| `welcome-back.png` | `MascotWelcomeBack` |
| `badge.png` | `MascotBadge` |
| `badge-glow.png` | `MascotBadgeGlow` |

The imagesets already exist with empty slots. Dropping files into the
folders in Finder is *not* enough — `Contents.json` has to name them, and
only the catalog editor writes that. Export around 336x336 px for 3x; one
file in the 3x well is fine and iOS scales it down.

## How each pose is animated

| Mood | Pose | Motion |
|---|---|---|
| `wave` | Welcoming | rocks side to side, looping |
| `welcome` | Welcoming Back | slow breath + float, looping |
| `cheer` | Cheering | bounces with a slight squash, **twice then stops** |
| `badge` / `proud` | Presenting Badge | gentle float, with the glow frame cross-fading over it |
| `think` | Welcoming (reused) | slight tilt and hover |
| `idle` | Welcoming (reused) | gentle float |

A cheer that loops forever stops reading as a cheer, which is why that one
is a burst. All motion is skipped under Reduce Motion on both platforms.

## Where each pose shows up

- **Welcoming Back** — the welcome-back moment after sign-in
- **Welcoming** — the Story Blanks intro
- **Cheering** — milestone beats (first page, halfway)
- **Presenting Badge** — the badge popup, and the "every page done" beat

## Animated poses (frame sequences)

Two poses ship as drawn animations rather than stills, produced from the
source clips in `public/mascot/`:

```bash
python3 scripts/video-to-frames.py public/mascot/Welcome.mp4 welcome-back
python3 scripts/video-to-frames.py public/mascot/badge_achieved.mp4 badge
```

That writes `public/mascot/frames/<name>/frame-00.png ...` plus a
manifest. Where a pose has frames, `Mascot` plays them at 12fps and drops
its code-driven motion — the drawing already carries the movement, and
translating a playing clip around looks seasick.

Why frames and not video: MP4/H.264 has no alpha, WebM-with-alpha is
unsupported in Safari, HEVC-with-alpha is Safari-only. A numbered PNG
sequence is the one format that plays identically on web and in SwiftUI
with no decoder.

The script keys the backdrop out per frame by flood-filling from the
borders (so eyes and highlights survive), crops every frame to one shared
bounding box (per-frame crops make the character jitter), downscales to
256px, and quantises to 128 colours — 92 KB to 18 KB a frame with no
visible difference at render size.

Under Reduce Motion the sequence does not play; the still PNG shows
instead. Verified in a browser.

**iOS has no frame playback yet** — `Mascot.swift` still shows the still
pose for these moods. The frames are portable, so wiring
`UIImage.animatedImage(with:duration:)` is the remaining step.

### A note on sourcing

The first `cheering.mp4` was a Lovepik stock preview with the watermark
still tiled across it, and was deleted rather than keyed — stripping it
would have been circumventing a licensing control on a commercial
product. The replacement clip is clean and is what ships.

The replacement did carry a small static generator glyph in the
bottom-right corner. It is not part of the animation (identical pixels in
every frame) and sits far from the figure, so `drop_islands` removes it as
a stray blob. If the generating tool's terms require its mark to stay on
free-tier output, check that before shipping.

### Picking the right segment

A supplied clip is often a montage. The replacement cheer is 10s of three
shots, and sampling evenly across all of it produced frames from different
poses that flickered rather than animated. `--range=1.1-2.0` selects the
fist-pump beat.

Its last frame is also nowhere near its first, so a straight loop snapped.
The `cheer` pose sets `pingPong: true`, which plays 0->15->0 — seamless by
construction, and an arm pump reversing is what a real cheer does.

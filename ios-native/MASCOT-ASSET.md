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

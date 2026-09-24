#!/usr/bin/env python3
"""Slice the check-in pose sheet into the ten tile illustrations.

Companion to slice-mascot.py, sharing its segmentation exactly — that code
was debugged against a real flattened export and is not worth reinventing.
Only the output directory, the expected pose count and the names differ.

    pip install Pillow
    python3 scripts/slice-checkin.py path/to/checkin-sheet.png

Ten poses on a transparent background, a caption under each, matched by
position in reading order, top row then bottom:

    happy · proud · tired · worried · angry      (row 1)
    sad · break · quiet · help · keep_going      (row 2)

Writes public/checkin/<id>.png for each. Those filenames are the contract
src/lib/checkInArt.js reads; nothing else needs changing when the art lands.

The brief that produced the sheet is docs/CHECKIN-ART-BRIEF.md.
"""

import sys
from collections import deque
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

OUT_DIR = Path("public/checkin")
ALPHA_FLOOR = 24        # below this a pixel counts as background
MIN_CAPTION_RATIO = 0.35  # a region under this fraction of the tallest is a caption

# Flattened exports lose the alpha channel and bake the editor's
# transparency checkerboard in as real pixels. Those squares are light and
# neutral-grey; so is plain white. The artwork is either saturated or dark,
# so "light AND near-neutral" separates them cleanly.
BG_MIN_CHANNEL = 175   # all channels above this = light
BG_MAX_SPREAD = 38     # max-min below this = neutral, not a colour


def looks_like_background(px):
    r, g, b = px[0], px[1], px[2]
    return min(r, g, b) >= BG_MIN_CHANNEL and (max(r, g, b) - min(r, g, b)) <= BG_MAX_SPREAD


def strip_flat_background(img):
    """Knock out a baked-in white/checkerboard background.

    Flood-fills inward from the borders rather than testing every pixel, so
    light pixels *inside* the character — eyes, teeth, the badge's shine —
    survive. A blanket colour test would punch holes straight through them.
    """
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    q = deque()

    def consider(x, y):
        i = y * w + x
        if seen[i]:
            return
        seen[i] = 1
        if looks_like_background(px[x, y]):
            q.append((x, y))

    for x in range(w):
        consider(x, 0)
        consider(x, h - 1)
    for y in range(h):
        consider(0, y)
        consider(w - 1, y)

    cleared = 0
    while q:
        x, y = q.popleft()
        px[x, y] = (255, 255, 255, 0)
        cleared += 1
        if x > 0: consider(x - 1, y)
        if x < w - 1: consider(x + 1, y)
        if y > 0: consider(x, y - 1)
        if y < h - 1: consider(x, y + 1)

    return cleared


def columns_with_ink(mask, x0, x1, y0, y1):
    """Return True for each x in [x0,x1) that has any opaque pixel in the band."""
    return [any(mask[y][x] for y in range(y0, y1)) for x in range(x0, x1)]


def runs(flags, offset=0):
    """Turn a boolean list into (start, end) runs of True."""
    out, start = [], None
    for i, f in enumerate(flags):
        if f and start is None:
            start = i
        elif not f and start is not None:
            out.append((start + offset, i + offset))
            start = None
    if start is not None:
        out.append((start + offset, len(flags) + offset))
    return out


def main(sheet_path):
    # Output paths are repo-relative, so running this from anywhere else
    # would quietly scatter PNGs into the wrong directory.
    if not Path("public").is_dir() or not Path("package.json").is_file():
        sys.exit(
            "Run this from the repo root (the folder containing package.json "
            "and public/).\n  cd /path/to/my-favorite-book\n"
            "  python3 scripts/slice-mascot.py <sheet.png>"
        )
    if not Path(sheet_path).is_file():
        sys.exit(f"No such file: {sheet_path}")

    img = Image.open(sheet_path).convert("RGBA")
    w, h = img.size

    # A flattened export has essentially no transparency. Detect that from
    # the corners and the overall alpha range rather than trusting the file
    # extension — a .png can be either.
    extrema = img.getchannel("A").getextrema()
    corners = [img.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    opaque_corners = sum(1 for c in corners if c[3] > 200)
    if extrema[0] > 200 or opaque_corners >= 3:
        cleared = strip_flat_background(img)
        pct = 100 * cleared / (w * h)
        print(f"background was flattened — removed {cleared} px ({pct:.0f}% of the sheet)")
        if pct < 5:
            print("WARNING: barely anything was removed. If the background is a "
                  "dark or coloured fill rather than white/checkerboard, this "
                  "script cannot separate it — re-export with transparency.")

    alpha = img.getchannel("A").load()
    mask = [[alpha[x, y] > ALPHA_FLOOR for x in range(w)] for y in range(h)]

    # Split into horizontal bands (rows of sprites + caption strips).
    row_has_ink = [any(mask[y]) for y in range(h)]
    bands = runs(row_has_ink)
    if not bands:
        sys.exit("No opaque pixels found — is the background actually transparent?")

    tallest = max(b - a for a, b in bands)
    sprite_bands = [(a, b) for a, b in bands if (b - a) >= tallest * MIN_CAPTION_RATIO]
    print(f"sheet {w}x{h}: {len(bands)} bands, {len(sprite_bands)} look like sprite rows")

    # Within each sprite band, split into columns.
    #
    # Keep the band index with each box. Reading order is (row, x), and the
    # row is already known here — deriving it later from the sprite's own top
    # edge gets it wrong whenever a row mixes heights: a short pose sitting on
    # the same baseline as a tall one starts lower down the sheet and can fall
    # into the next row's bucket, silently swapping two names. Bottom-aligned
    # poses of unequal height are the normal case on a real sheet, so this has
    # to come from the band, not from the pixels.
    boxes = []
    for band_index, (y0, y1) in enumerate(sprite_bands):
        col_flags = columns_with_ink(mask, 0, w, y0, y1)
        for x0, x1 in runs(col_flags):
            # Trim to the exact bounds of this sprite.
            sub = img.crop((x0, y0, x1, y1))
            bbox = sub.getbbox()
            if not bbox:
                continue
            cx0, cy0, cx1, cy1 = bbox
            boxes.append((band_index, (x0 + cx0, y0 + cy0, x0 + cx1, y0 + cy1)))

    boxes.sort(key=lambda entry: (entry[0], entry[1][0]))
    boxes = [b for _, b in boxes]
    heights = [b[3] - b[1] for b in boxes]
    big = max(heights) if heights else 0
    poses = [b for b, ht in zip(boxes, heights) if ht >= big * 0.5]
    minis = [b for b, ht in zip(boxes, heights) if ht < big * 0.5]

    print(f"found {len(poses)} full poses, {len(minis)} small sprite(s)")
    if len(poses) != 10:
        print(f"WARNING: expected 10 full poses, found {len(poses)}. "
              "Check the output before using it — a pose that touches its "
              "neighbour merges into one region, and a pose drawn much "
              "shorter than the rest can be mistaken for a caption.")

    # Reading order, and the exact ids src/lib/checkInArt.js expects.
    names = ["happy", "proud", "tired", "worried", "angry",
             "sad", "break", "quiet", "help", "keep_going"]
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for name, box in zip(names, poses):
        out = OUT_DIR / f"{name}.png"
        img.crop(box).save(out)
        bw, bh = box[2] - box[0], box[3] - box[1]
        print(f"  {out}  {bw}x{bh}")

    if minis:
        print(f"  ignored {len(minis)} region(s) too short to be a pose "
              "(captions, or stray marks)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

#!/usr/bin/env python3
"""Slice the mascot pose sheet into individual transparent PNGs.

The artwork arrives as one sheet: five poses on a transparent background
with a text caption under each. This finds the poses, drops the captions,
trims each to its own bounds, and writes the files the app expects.

    pip install Pillow
    python3 scripts/slice-mascot.py path/to/sheet.png

Poses are matched by position, reading order, top row then bottom:

    welcoming · cheering · welcome-back        (row 1)
    badge · badge-glow                         (row 2)

The small head-only sprite that sits between the two row-2 poses is
written as head.png and is not required by the app.

Nothing is guessed about pixel offsets — the sheet is segmented by finding
connected regions of non-transparent pixels, so it survives being
re-exported at a different size. Captions are dropped by discarding
regions far shorter than the tallest one.
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

OUT_DIR = Path("public/mascot")
ALPHA_FLOOR = 24        # below this a pixel counts as background
MIN_CAPTION_RATIO = 0.35  # a region under this fraction of the tallest is a caption


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
    img = Image.open(sheet_path).convert("RGBA")
    w, h = img.size
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
    boxes = []
    for y0, y1 in sprite_bands:
        col_flags = columns_with_ink(mask, 0, w, y0, y1)
        for x0, x1 in runs(col_flags):
            # Trim to the exact bounds of this sprite.
            sub = img.crop((x0, y0, x1, y1))
            bbox = sub.getbbox()
            if not bbox:
                continue
            cx0, cy0, cx1, cy1 = bbox
            boxes.append((x0 + cx0, y0 + cy0, x0 + cx1, y0 + cy1))

    boxes.sort(key=lambda b: (b[1] // max(1, tallest // 2), b[0]))
    heights = [b[3] - b[1] for b in boxes]
    big = max(heights) if heights else 0
    poses = [b for b, ht in zip(boxes, heights) if ht >= big * 0.5]
    minis = [b for b, ht in zip(boxes, heights) if ht < big * 0.5]

    print(f"found {len(poses)} full poses, {len(minis)} small sprite(s)")
    if len(poses) != 5:
        print("WARNING: expected 5 full poses. Check the output before using it.")

    names = ["welcoming", "cheering", "welcome-back", "badge", "badge-glow"]
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for name, box in zip(names, poses):
        out = OUT_DIR / f"{name}.png"
        img.crop(box).save(out)
        bw, bh = box[2] - box[0], box[3] - box[1]
        print(f"  {out}  {bw}x{bh}")

    for box in minis[:1]:
        out = OUT_DIR / "head.png"
        img.crop(box).save(out)
        print(f"  {out}  {box[2]-box[0]}x{box[3]-box[1]}  (optional)")

    if len(poses) >= 1:
        # The generic fallback the component reaches for before the emoji.
        img.crop(poses[0]).save("public/mascot.png")
        print("  public/mascot.png  (generic fallback = first pose)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

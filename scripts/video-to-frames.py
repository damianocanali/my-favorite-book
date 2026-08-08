#!/usr/bin/env python3
"""Turn a mascot animation clip into transparent PNG frames.

    python3 scripts/video-to-frames.py public/mascot/Welcome.mp4 welcome-back

Writes public/mascot/frames/<name>/frame-00.png ... and a manifest.json.

Why frames and not video: MP4/H.264 has no alpha channel, WebM-with-alpha
is unsupported in Safari, and HEVC-with-alpha is Safari-only. A numbered
PNG sequence is the one format that plays identically on the web and in
SwiftUI with no decoder, which matters because this mascot ships on both.

Three things this does that a plain ffmpeg call does not:

  * Keys out the flat backdrop per frame by flood-filling inward from the
    borders, so light pixels *inside* the character (eyes, teeth, the
    badge's shine) survive. A blanket colour test punches holes in them.

  * Crops every frame to ONE shared bounding box — the union across all
    frames — instead of each frame's own bounds. Per-frame cropping makes
    the character jitter as its silhouette changes.

  * Samples evenly across the clip and downscales, because a 5-second
    30fps clip is 150 frames and this renders at ~112pt.
"""

import json
import shutil
import subprocess
import sys
from collections import deque
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

DEFAULT_FRAMES = 16
DEFAULT_MAX_PX = 256
# Cartoon art quantises almost losslessly and PNG's palette mode is far
# smaller than truecolour: 92 KB -> 18 KB per frame at render size, with
# no visible difference once composited. Worth it at 16 frames a clip.
PALETTE_COLOURS = 128
# The clips sit on a near-white backdrop; h264 adds a few units of noise,
# so the light threshold is looser than the still-image slicer's.
BG_MIN_CHANNEL = 168
BG_MAX_SPREAD = 42


def ffmpeg_bin():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass
    found = shutil.which("ffmpeg")
    if not found:
        sys.exit("ffmpeg not found. Install it, or `pip install imageio-ffmpeg`.")
    return found


def looks_like_background(px):
    r, g, b = px[0], px[1], px[2]
    return min(r, g, b) >= BG_MIN_CHANNEL and (max(r, g, b) - min(r, g, b)) <= BG_MAX_SPREAD


def strip_background(img):
    """Flood-fill the backdrop away from the borders inward."""
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

    while q:
        x, y = q.popleft()
        px[x, y] = (255, 255, 255, 0)
        if x > 0: consider(x - 1, y)
        if x < w - 1: consider(x + 1, y)
        if y > 0: consider(x, y - 1)
        if y < h - 1: consider(x, y + 1)

    return img


def union(a, b):
    if a is None:
        return b
    if b is None:
        return a
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def main(video, name, count=DEFAULT_FRAMES, max_px=DEFAULT_MAX_PX):
    if not Path("public").is_dir() or not Path("package.json").is_file():
        sys.exit("Run this from the repo root (the folder with package.json).")
    src = Path(video)
    if not src.is_file():
        sys.exit(f"No such file: {video}")

    ff = ffmpeg_bin()
    out_dir = Path("public/mascot/frames") / name
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    tmp = Path("/tmp/_mascot_frames")
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir()

    # Grab every frame first, then sample — cheaper to reason about than
    # computing an fps filter, and these clips are only a few seconds.
    subprocess.run(
        [ff, "-hide_banner", "-loglevel", "error", "-i", str(src),
         str(tmp / "raw-%04d.png")],
        check=True,
    )
    raw = sorted(tmp.glob("raw-*.png"))
    if not raw:
        sys.exit("ffmpeg produced no frames.")

    step = max(1, len(raw) // count)
    picked = raw[::step][:count]
    print(f"{src.name}: {len(raw)} frames -> sampling {len(picked)}")

    # Pass 1: key out the backdrop and find the shared crop box.
    keyed, box = [], None
    for p in picked:
        img = strip_background(Image.open(p).convert("RGBA"))
        keyed.append(img)
        box = union(box, img.getbbox())

    if box is None:
        sys.exit("Every frame came out empty — the backdrop may not be light.")

    bw, bh = box[2] - box[0], box[3] - box[1]
    scale = min(1.0, max_px / max(bw, bh))
    size = (max(1, round(bw * scale)), max(1, round(bh * scale)))
    print(f"  shared crop {bw}x{bh} -> output {size[0]}x{size[1]}")

    # Pass 2: crop all frames identically so the character doesn't jitter.
    total = 0
    for i, img in enumerate(keyed):
        frame = img.crop(box)
        if scale < 1.0:
            frame = frame.resize(size, Image.LANCZOS)
        # FASTOCTREE keeps the alpha channel; the default median-cut does not.
        frame = frame.quantize(colors=PALETTE_COLOURS, method=Image.FASTOCTREE)
        dest = out_dir / f"frame-{i:02d}.png"
        frame.save(dest, optimize=True)
        total += dest.stat().st_size

    manifest = {
        "name": name,
        "frames": len(keyed),
        "width": size[0],
        "height": size[1],
        "source": src.name,
        "sourceFps": 30,
        "suggestedFps": 12,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"  wrote {len(keyed)} frames + manifest.json  ({total/1024:.0f} KB total)")
    shutil.rmtree(tmp)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    n = int(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_FRAMES
    main(sys.argv[1], sys.argv[2], n)

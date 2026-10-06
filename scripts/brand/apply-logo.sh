#!/usr/bin/env bash
# Swap the brand art in one command:
#
#   scripts/brand/apply-logo.sh <logo-with-title.png> <icon-square.png>
#
#   logo-with-title  the full illustrated logo with the "My Book Lab" lettering
#                    (hero / sign-in / landing art). Square works best: the web
#                    <AppLogo> and the iOS "AppLogo" image are drawn in square
#                    frames, so a non-square logo is letterboxed (iOS, .fit) or
#                    squashed (web <img width=height>).
#   icon-square      the square app icon, at least 1024x1024, art edge to edge
#                    (iOS rounds the corners itself — do not pre-round it).
#
# Regenerates every derived size with sips, from the matching source:
#   - web logo (public/logo.png) and iOS AppLogo   <- logo-with-title
#   - web icons, og:image, favicons, iOS AppIcon + its "Classic" picker
#     preview, legacy Capacitor iOS/Android launcher icons <- icon-square
#   - 16/32/48 px favicons <- a CENTRE CROP of icon-square (CROP, default 0.62):
#     a detailed scene is mush at 16 px, so the small sizes zoom in on the
#     subject instead of shrinking the whole picture.
#
# App-store icons must be opaque: anything going into an .appiconset or an
# Android launcher is flattened (alpha dropped) and checked afterwards.
#
# Env:  CROP=0.62        fraction of the icon kept for the 16-48 px favicons
#       ANDROID_BG=FFFFFF hex pad colour for the adaptive-icon foreground
#                          (must match res/values/ic_launcher_background.xml)
#       DRY_RUN=1        print what would be written, write nothing
#
# This only rewrites image files. index.html, AppLogo.jsx etc. are unchanged;
# see the brand report for the follow-up code edits.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
  exit 64
fi
LOGO=$1
ICON=$2
CROP=${CROP:-0.62}
ANDROID_BG=${ANDROID_BG:-FFFFFF}
DRY_RUN=${DRY_RUN:-0}

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
command -v sips >/dev/null || { echo "sips not found (macOS only)" >&2; exit 69; }

dims() { sips -g pixelWidth -g pixelHeight "$1" | awk '/pixelWidth/{w=$2}/pixelHeight/{h=$2}END{print w" "h}'; }
has_alpha() { sips -g hasAlpha "$1" | awk '/hasAlpha/{print $2}'; }

for f in "$LOGO" "$ICON"; do
  [[ -f $f ]] || { echo "missing: $f" >&2; exit 66; }
done
read -r IW IH < <(dims "$ICON")
if [[ $IW -ne $IH ]]; then echo "icon must be square (got ${IW}x${IH})" >&2; exit 65; fi
if [[ $IW -lt 1024 ]]; then echo "icon must be >= 1024 px (got $IW)" >&2; exit 65; fi
read -r LW LH < <(dims "$LOGO")
[[ $LW -eq $LH ]] || echo "warning: logo is ${LW}x${LH}, not square — check <AppLogo> and iOS AppLogo framing" >&2

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Opaque copy of the icon. sips has no "drop alpha" switch: if the source has
# alpha, go through PIL when available (lossless), else a quality-100 JPEG.
ICON_OPAQUE=$TMP/icon-opaque.png
if [[ $(has_alpha "$ICON") == yes ]]; then
  if python3 -c 'import PIL' 2>/dev/null; then
    python3 - "$ICON" "$ICON_OPAQUE" <<'PY'
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA')
bg = Image.new('RGB', im.size, (0, 0, 0))
bg.paste(im, mask=im.split()[3])
bg.save(sys.argv[2], optimize=True)
PY
  else
    sips -s format jpeg -s formatOptions 100 "$ICON" --out "$TMP/icon.jpg" >/dev/null
    sips -s format png "$TMP/icon.jpg" --out "$ICON_OPAQUE" >/dev/null
  fi
else
  sips -s format png "$ICON" --out "$ICON_OPAQUE" >/dev/null
fi

# Centre crop for the tiny favicons.
CROP_PX=$(awk -v w="$IW" -v c="$CROP" 'BEGIN{printf "%d", w*c}')
ICON_CROP=$TMP/icon-crop.png
sips -c "$CROP_PX" "$CROP_PX" "$ICON_OPAQUE" --out "$ICON_CROP" >/dev/null

WRITTEN=()
emit() {  # emit <source> <size> <dest>
  local src=$1 size=$2 dest=$3
  WRITTEN+=("$dest (${size}px)")
  [[ $DRY_RUN == 1 ]] && return
  mkdir -p "$(dirname "$dest")"
  sips -z "$size" "$size" -s format png "$src" --out "$dest" >/dev/null
}
emit_fit() {  # emit_fit <source> <max> <dest> — keeps aspect ratio
  local src=$1 max=$2 dest=$3
  WRITTEN+=("$dest (fit ${max}px)")
  [[ $DRY_RUN == 1 ]] && return
  mkdir -p "$(dirname "$dest")"
  sips -Z "$max" -s format png "$src" --out "$dest" >/dev/null
}

# ── Logo with title ────────────────────────────────────────────────────────
# Was a 2000 px / 7 MB PNG loaded on every page; 1024 covers the largest use
# (landing hero) at 3x.
emit_fit "$LOGO" 1024 public/logo.png
emit_fit "$LOGO" 1024 ios-native/MyBookLab/Assets.xcassets/AppLogo.imageset/logo.png

# ── Square icon: web ───────────────────────────────────────────────────────
emit "$ICON_OPAQUE" 1024 public/icon-1024.png      # og:image, twitter:image, apple-touch-icon
emit "$ICON_OPAQUE" 512  public/favicon-512.png
emit "$ICON_OPAQUE" 192  public/favicon-192.png     # <link rel=icon>, push notification icon (sw.js)
emit "$ICON_OPAQUE" 180  public/apple-touch-icon.png
emit "$ICON_OPAQUE" 256  public/logo-mark.png       # for <AppLogo> at 24-56 px (see report)
emit "$ICON_CROP"   48   public/favicon-48.png
emit "$ICON_CROP"   32   public/favicon-32.png
emit "$ICON_CROP"   16   public/favicon-16.png

# ── Square icon: native iOS (the shipping app) ──────────────────────────────
emit "$ICON_OPAQUE" 1024 ios-native/MyBookLab/Assets.xcassets/AppIcon.appiconset/icon-1024.png
emit "$ICON_OPAQUE" 216  ios-native/MyBookLab/Assets.xcassets/AppIconPreview.imageset/preview.png  # "Classic" in the icon picker

# ── Square icon: legacy Capacitor shells (still tracked, still Canva art) ───
emit "$ICON_OPAQUE" 1024 ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
for pair in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  d=${pair%%:*}; s=${pair##*:}
  emit "$ICON_OPAQUE" "$s" "android/app/src/main/res/mipmap-$d/ic_launcher.png"
  emit "$ICON_OPAQUE" "$s" "android/app/src/main/res/mipmap-$d/ic_launcher_round.png"
done
# Adaptive-icon foreground: 108dp canvas, art inside the 72dp safe zone (2/3).
for pair in mdpi:108 hdpi:162 xhdpi:216 xxhdpi:324 xxxhdpi:432; do
  d=${pair%%:*}; s=${pair##*:}
  inner=$(( s * 2 / 3 ))
  dest="android/app/src/main/res/mipmap-$d/ic_launcher_foreground.png"
  WRITTEN+=("$dest (${s}px, art ${inner}px on #$ANDROID_BG)")
  [[ $DRY_RUN == 1 ]] && continue
  sips -z "$inner" "$inner" -s format png "$ICON_OPAQUE" --out "$TMP/fg.png" >/dev/null
  sips -p "$s" "$s" --padColor "$ANDROID_BG" "$TMP/fg.png" --out "$dest" >/dev/null
done

# ── Verify ─────────────────────────────────────────────────────────────────
printf '%s\n' "${WRITTEN[@]}"
[[ $DRY_RUN == 1 ]] && { echo "(dry run — nothing written)"; exit 0; }

fail=0
for f in ios-native/MyBookLab/Assets.xcassets/AppIcon.appiconset/icon-1024.png \
         ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png \
         android/app/src/main/res/mipmap-*/ic_launcher*.png; do
  if [[ $(has_alpha "$f") == yes ]]; then echo "ALPHA in $f" >&2; fail=1; fi
done
read -r w h < <(dims ios-native/MyBookLab/Assets.xcassets/AppIcon.appiconset/icon-1024.png)
[[ $w == 1024 && $h == 1024 ]] || { echo "AppIcon is ${w}x${h}" >&2; fail=1; }
[[ $fail == 0 ]] && echo "OK — ${#WRITTEN[@]} files written, store icons opaque."
exit $fail

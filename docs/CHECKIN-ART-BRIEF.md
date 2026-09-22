# Check-in illustrations — art brief

Ten drawings of the existing mascot, one per check-in tile. This is the only
thing standing between the check-in feature and a real child using it: the code
is merged and tested, and every tile currently falls back to a coloured dot.

## The character

Match the five existing poses exactly — same boy, same outfit, same line weight.

| Reference | File |
|---|---|
| Neutral, full body, clearest read of the costume | `public/mascot/welcoming.png` |
| Expression and motion range | `public/mascot/cheering.png` |
| Remaining poses | `public/mascot/welcome-back.png`, `badge.png`, `badge-glow.png` |

Both references are already uploaded to the Canva account as
*"My Book Lab mascot — welcoming (style reference)"* and
*"…— cheering (expression reference)"*.

**The character:** a boy of about eight. Tousled mid-brown hair. Green tunic
with a yellow-trimmed strap, teal neck scarf, brown belt and satchel, red
shorts, brown boots with tan cuffs. A green cap he sometimes holds rather than
wears. Warm brown eyes, broad friendly face.

**The style:** flat cartoon with a dark brown outline of even weight, soft cel
shading, no gradients, no outer glow. Full body, feet included, facing the
viewer or three-quarters. **Transparent background** — this is load-bearing, see
*Delivery*.

## The ten poses

Six feelings, then four needs. The feeling tiles are what a child taps to say
how they are, so each has to read at a glance at 48px, without text, to someone
who cannot yet read.

**Draw the feeling, not a diagnosis.** These name a feeling the child is having;
they are not labels for the child. Keep every one of them kind — a child
tapping *angry* or *sad* should not meet a picture that looks like it is
disappointed in them.

### Feelings

| # | id | Pose |
|---|---|---|
| 1 | `happy` | Standing lightly on the balls of his feet, arms loose and open, easy broad smile. Bright and uncomplicated — this is the baseline everything else reads against. |
| 2 | `proud` | Chest out, hands on hips, chin slightly lifted, warm grin. Pleased with himself, **not** boastful or smug. |
| 3 | `tired` | Shoulders down, one hand rubbing an eye, other arm hanging. Eyes half-closed, small soft mouth. Sleepy, **not** sad — the difference is the rubbed eye and the relaxed mouth. |
| 4 | `worried` | Both hands together near his chest, slight lean back, eyebrows raised toward the middle, small uncertain mouth. Anxious, **not** frightened — no wide eyes, no recoil. |
| 5 | `angry` | Feet planted, fists down at his sides, brows low and drawn in, mouth a firm straight line. Cross and holding it in. **Not** shouting, **not** aggressive, no steam, no red face. |
| 6 | `sad` | Head tipped down, arms limp, mouth turned down, eyes lowered. Quietly sad. **No tears** — a crying face is a bigger feeling than the tile is asking about. |

### Needs

These are offered *after* a feeling, as "what would help?". Each should look
like an invitation.

| # | id | Pose |
|---|---|---|
| 7 | `break` | Sitting down, leaning back on both hands, one leg out, head tilted up, eyes closed, content. Resting, **not** asleep. |
| 8 | `quiet` | Standing, one finger raised to his lips, eyes soft and friendly, slight smile. Gentle "shh" — inviting calm, **not** shushing the viewer. |
| 9 | `help` | One arm raised with an open palm, the other holding the satchel strap, hopeful expectant look. Asking for a hand — **not** distressed, **not** waving goodbye. |
| 10 | `keep_going` | Mid-stride walking forward, one fist gently pumped, determined cheerful expression. Carrying on. Distinct from `happy` by the forward motion. |

## Sheet layout

Deliver **one sheet**, because `scripts/slice-checkin.py` cuts it automatically.
Do not send ten separate files unless you skip the script entirely.

```
happy · proud · tired · worried · angry          (row 1)
sad · break · quiet · help · keep_going          (row 2)
```

- Five across, two down, in exactly that reading order.
- A caption under each pose with its id. Captions must be **clearly shorter**
  than the poses — the slicer discards any region under 35% of the tallest
  one's height.
- **Generous transparent gutters** between poses. Two poses whose pixels touch
  merge into one region and the slicer will find nine poses instead of ten.
- Each pose around 320×460 px or larger. Bigger is fine; the app scales down.

## Delivery

**Transparent PNG.** If the background is flattened the script tries to strip a
flat white or checkerboard fill, but that is a rescue path, not the intent — it
can bite into light parts of the artwork. Export with real alpha.

Then:

```bash
pip install Pillow
python3 scripts/slice-checkin.py path/to/checkin-sheet.png
```

It writes `public/checkin/happy.png` … `public/checkin/keep_going.png` and
prints each file with its dimensions. Check that list against the table above —
the script maps sheet position to filename, so a pose drawn out of order gets
the wrong name silently.

**That is the whole job. No code change.** `src/lib/checkInArt.js` already reads
those exact paths, and the tiles swap from the fallback dot to the drawing as
soon as the files exist.

### iOS

Not yet. The check-in shipped web-first by design — the spec calls for the
design to be used by a real child before it is ported. When it is, the same
PNGs go into `Assets.xcassets` imagesets, following the pattern in
`ios-native/MASCOT-ASSET.md`.

## If you generate these rather than draw them

Character consistency across ten images is the hard part, and it is where
general-purpose design tools fall down — they will produce ten pleasant
characters rather than ten poses of *this* character. Use a model with genuine
character-reference support, feed it `welcoming.png` as the reference, and
generate the sheet as one image rather than ten separate ones so the style
cannot drift between them.

Whatever produces them, check all ten against the references side by side
before slicing. The costume details that drift first are the yellow strap trim,
the teal scarf, and the boot cuffs.

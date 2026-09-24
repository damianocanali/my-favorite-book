// Art for the ten check-in tiles: six feelings, four needs.
//
// The art is OPTIONAL by design. Until the illustrations exist, every tile
// falls back to the mascot's own silhouette tinted by the feeling's tone, the
// same way Mascot.jsx falls back to an emoji before its poses are drawn. That
// keeps the feature shippable and testable with no artwork present, and means
// the art drop is a pure asset change with no code edit.
//
// Drop the sliced PNGs into public/checkin/ and they light up automatically:
//
//     public/checkin/happy.png      public/checkin/break.png
//     public/checkin/proud.png      public/checkin/quiet.png
//     public/checkin/tired.png      public/checkin/help.png
//     public/checkin/worried.png    public/checkin/keep_going.png
//     public/checkin/angry.png
//     public/checkin/sad.png
//
// Produce that set by running scripts/slice-checkin.py over the delivered
// pose sheet — do not cut it by hand. See docs/CHECKIN-ART-BRIEF.md.

import { FEELINGS, NEEDS } from './checkIn'

/// Where a tile's illustration lives. Vite serves public/ from the root, so
/// this is a plain runtime URL rather than an import — which is the point:
/// adding a file must not require a rebuild of this module.
export function artUrl(id) {
  return `/checkin/${id}.png`
}

/// Every id that needs a drawing, in the order they appear on the sheet.
/// Reading order matters: scripts/slice-checkin.py maps sheet position to
/// filename by this list, so changing it changes what the slicer produces.
export const ART_IDS = [...FEELINGS.map((f) => f.id), ...NEEDS.map((n) => n.id)]

/// The tone each feeling carries, reused to tint the fallback so the tiles
/// still read as six distinct things before the art lands. Needs have no tone
/// in FEELINGS, so they fall back to the app's primary.
const TONE_HEX = {
  gold: '#f5c451',
  purple: '#a78bfa',
  blue: '#60a5fa',
  cyan: '#22d3ee',
  pink: '#f472b6',
  indigo: '#818cf8',
}

export function toneFor(id) {
  const feeling = FEELINGS.find((f) => f.id === id)
  return TONE_HEX[feeling?.tone] ?? '#a78bfa'
}

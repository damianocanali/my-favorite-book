import { useState } from 'react'
import { artUrl, toneFor } from '../../lib/checkInArt'

// A single check-in tile's art, sized down for a roster row or a dated
// list rather than the full check-in sheet. Same optional-art contract as
// CheckInSheet's own TileArt: until public/checkin/<id>.png exists the
// <img> errors and this falls back to a tinted dot, so the dashboard never
// shows a broken-image icon while the artwork is still being produced.
//
// `id` is either a feeling id (FEELINGS) or a need id (NEEDS/STUDENT_NEEDS)
// — checkInArt.artUrl/toneFor already handle both (aliasing help_book/
// grownup to the 'help' art and falling back to the app's primary tint for
// anything that isn't a feeling).
//
// Purely decorative: the caller wraps this in the element that actually
// carries the accessible name (feeling + need + time), per owner decision
// D7 — no totals or rankings, just "what and when".
export default function FeelingIcon({ id, size = 22, className = '' }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        aria-hidden="true"
        className={`inline-block shrink-0 rounded-full opacity-80 ${className}`}
        style={{ backgroundColor: toneFor(id), width: size, height: size }}
      />
    )
  }

  return (
    <img
      src={artUrl(id)}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      className={`inline-block shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

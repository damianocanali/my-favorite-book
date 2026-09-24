// A book seen edge-on, standing on the shelf.
//
// Ported from the iOS BookSpine (ios-native/MyBookLab/Views/BookshelfView.swift)
// so both platforms show the same object: a coloured spine with gilded bands
// top and bottom, the title running up it, a sparkle, and a faint ridge
// suggesting the spine's curve.
//
// Two things the iOS file records as bugs it already hit, kept here:
//
//   "No tilt — tilt was breaking the bounding box and bleeding into neighbor
//    cells." The spine stands straight; depth comes from the shadow and the
//    gradient, not from rotating it.
//
//   The rotated title's hit area overflowed onto the next book, so taps opened
//   the wrong one. iOS locked the tap shape with contentShape(Rectangle()); the
//   DOM equivalent is that the rotated text is inside a fixed-size, overflow
//   hidden box and is pointer-events-none, so only the spine's own rectangle is
//   clickable.

import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Matches the iOS spineWidth: 44pt on phone, 56pt on iPad.
export const SPINE_W = 44
export const SPINE_W_LG = 56

// iOS varies the height per position so a row doesn't read as a picket fence.
const HEIGHT_VARIATION = [0, 8, -6, 4, -3]
const BASE_HEIGHT = 168

export function spineHeight(indexInRow) {
  return BASE_HEIGHT + HEIGHT_VARIATION[indexInRow % HEIGHT_VARIATION.length]
}

export default function BookSpine({ book, indexInRow = 0, onClick, onDelete }) {
  const { t } = useTranslation()
  const colors = book.colors ?? { cover: '#8B5CF6', accent: '#06B6D4', text: '#F1F5F9' }
  const height = spineHeight(indexInRow)

  return (
    <span className="group/spine relative inline-flex shrink-0">
      {/* Delete. A sibling of the spine, never a child: the spine is itself a
          <button>, and nesting one button inside another is invalid HTML that
          browsers resolve by hoisting the inner one out of the parent, which
          breaks both hit areas.

          Hover- and focus-revealed, which is how this control has always
          behaved on the shelf. That leaves touch devices without a delete —
          a gap that predates the spines, and one worth closing separately
          rather than inventing a long-press here. */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          aria-label={t('gallery:spine.delete_aria', { title: book.title })}
          className="absolute -right-1 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-lg transition-opacity hover:bg-red-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white group-hover/spine:opacity-100"
        >
          <Trash2 size={10} />
        </button>
      )}

      <button
        type="button"
        onClick={onClick}
        // The label carries what the spine shows plus what tapping does, because
        // the title is rendered rotated and a screen reader should not have to
        // infer either from the visual arrangement.
        aria-label={t('gallery:spine.open_aria', { title: book.title, author: book.authorName })}
        style={{ height, backgroundColor: colors.cover }}
        className="group relative w-11 shrink-0 cursor-pointer overflow-hidden rounded-[3px] shadow-[1px_2px_4px_rgba(0,0,0,0.4)] transition-transform duration-150 hover:-translate-y-2.5 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-galaxy-primary lg:w-14"
      >
        {/* Spine shading: lighter at the left edge, falling off to the right, so
          the surface reads as curved rather than as a flat bar. */}
        <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.14), rgba(0,0,0,0) 45%, rgba(0,0,0,0.22))',
        }}
        />

        {/* Gilded bands. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1.5 h-1.5" style={{ backgroundColor: colors.accent, opacity: 0.6 }} />
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-1.5 h-1.5" style={{ backgroundColor: colors.accent, opacity: 0.6 }} />

        {/* Ridge. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-2.5 left-1/2 w-px bg-white/10" />

        {/* Title, drawn into a horizontal box and rotated so it runs up the
          spine. The box is sized from the spine's own dimensions — width from
          its height, height from its width — which is what keeps the rotated
          text inside the spine instead of spilling over its neighbours. */}
        <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 flex items-center justify-center"
        style={{
          width: height - 28,
          height: SPINE_W_LG - 12,
          transform: 'translate(-50%, -50%) rotate(-90deg)',
        }}
        >
        <span
          className="line-clamp-2 px-1 text-center font-heading text-[11px] font-extrabold leading-tight"
          style={{ color: colors.text }}
        >
          {book.title}
        </span>
        </span>

        {/* Sparkle, as on the iOS spine. */}
        <span aria-hidden="true" className="pointer-events-none absolute right-1 top-1 text-[9px] text-yellow-300">✦</span>
      </button>
    </span>
  )
}

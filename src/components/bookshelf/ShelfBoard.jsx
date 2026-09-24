// The wooden plank a row of books stands on.
//
// Ported from the iOS shelf (ios-native/MyBookLab/Views/BookshelfView.swift,
// `shelfBoard`) so both platforms read as the same object: a three-stop brown
// gradient, faint grain lines, and a soft purple underglow that keeps it
// cosmic rather than literal.
//
// One board renders per book cell, not per row. The grid has no horizontal
// gap — books are spaced by padding inside their own cell instead — so the
// boards of adjacent cells butt up against each other and read as one
// continuous plank. That is what lets this work at every breakpoint without
// JavaScript measuring the viewport to decide where a row ends.

// Matches the iOS gradient stops exactly.
const WOOD_TOP = '#6B452A'
const WOOD_MID = '#523419'
const WOOD_BOTTOM = '#734D2E'

export default function ShelfBoard() {
  return (
    <div className="relative h-3 select-none" aria-hidden="true">
      <div
        className="h-full w-full overflow-hidden shadow-[0_3px_4px_rgba(0,0,0,0.4)]"
        style={{
          backgroundImage: `linear-gradient(to bottom, ${WOOD_TOP}, ${WOOD_MID}, ${WOOD_BOTTOM})`,
        }}
      >
        {/* Grain. iOS draws ten 1px lines 2pt apart; a repeating gradient is
            the same effect without ten elements per board per book. */}
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, rgba(0,0,0,0.04) 0 1px, transparent 1px 3px)',
          }}
        />
      </div>

      {/* Underglow, sitting below the plank and blurred. Pointer-events-none
          because it overhangs the board and would otherwise swallow clicks
          aimed at the row beneath. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-full h-6 blur-lg"
        style={{
          backgroundImage: 'linear-gradient(to bottom, rgba(168,85,247,0.25), transparent)',
        }}
      />
    </div>
  )
}

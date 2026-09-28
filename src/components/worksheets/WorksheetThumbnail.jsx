// The grid's thumbnail (brief §1: "a thumbnail (live mini-render of the
// sheet, not an image file)") — the real WorksheetSheet, laid out at its
// actual physical size and scaled down with a CSS transform inside a
// fixed-size, overflow-hidden wrapper. Because it's the same component the
// print job uses (sheets.jsx), the thumbnail can never drift out of sync
// with what actually prints.
import WorksheetSheet from './sheets.jsx'

// CSS treats 1in as a fixed 96px on screen regardless of real device DPI —
// this is only ever used to compute a scale factor, not an on-paper size.
const PX_PER_IN = 96
const SHEET_WIDTH_PX = 8.5 * PX_PER_IN
const SHEET_HEIGHT_PX = 11 * PX_PER_IN

export default function WorksheetThumbnail({ templateId, t, tCheckin, tGames, width = 150 }) {
  const scale = width / SHEET_WIDTH_PX
  const height = SHEET_HEIGHT_PX * scale

  return (
    <div
      className="overflow-hidden rounded-lg border border-black/10 bg-white shrink-0"
      style={{ width, height }}
      aria-hidden="true"
    >
      <div
        style={{
          width: SHEET_WIDTH_PX,
          height: SHEET_HEIGHT_PX,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <WorksheetSheet templateId={templateId} t={t} tCheckin={tCheckin} tGames={tGames} />
      </div>
    </div>
  )
}

// The grid's thumbnail: the real WorksheetSheet, laid out at its actual
// physical size and scaled down with a CSS transform inside a fixed-size,
// overflow-hidden wrapper. Because it's the same component the print job
// uses (sheets.jsx), the thumbnail can never drift out of sync with what
// actually prints.
//
// `lazy` (the 33-sheet library grid): the sheet is only rendered once the
// card comes near the viewport (IntersectionObserver), then stays — so
// opening the page doesn't lay out 33 full pages and 33 QR codes at once.
import { useEffect, useRef, useState } from 'react'
import WorksheetSheet from './sheets.jsx'

// CSS treats 1in as a fixed 96px on screen regardless of real device DPI —
// this is only ever used to compute a scale factor, not an on-paper size.
const PX_PER_IN = 96
export const SHEET_WIDTH_PX = 8.5 * PX_PER_IN
export const SHEET_HEIGHT_PX = 11 * PX_PER_IN

/// A sheet scaled to `width` px (its height follows the Letter ratio).
export function ScaledSheet({ width, ...sheetProps }) {
  const scale = width / SHEET_WIDTH_PX
  return (
    <div className="overflow-hidden bg-white" style={{ width, height: SHEET_HEIGHT_PX * scale }}>
      <div style={{ width: SHEET_WIDTH_PX, height: SHEET_HEIGHT_PX, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <WorksheetSheet {...sheetProps} />
      </div>
    </div>
  )
}

export default function WorksheetThumbnail({ width = 150, lazy = false, ...sheetProps }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(!lazy)

  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true)
        io.disconnect()
      }
    }, { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-lg border border-black/10 bg-white shrink-0"
      style={{ width, height: SHEET_HEIGHT_PX * (width / SHEET_WIDTH_PX) }}
      aria-hidden="true"
    >
      {visible && width > 0 && <ScaledSheet width={width} {...sheetProps} />}
    </div>
  )
}

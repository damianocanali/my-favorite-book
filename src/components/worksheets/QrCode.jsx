// Renders a QR code as plain SVG <rect>s from src/lib/worksheets/qr.js's
// module coordinates — no dangerouslySetInnerHTML, matching the rest of
// this codebase. qrcode-generator itself is only ever reached through the
// dynamic import() inside computeQrModules, so it's fetched as its own
// chunk the first time a sheet actually renders one — never paid for by a
// page that doesn't visit /worksheets.
import { useEffect, useState } from 'react'
import { computeQrModules } from '../../lib/worksheets/qr.js'

export default function QrCode({ text, size = 72, className = '' }) {
  const [modules, setModules] = useState(null)

  useEffect(() => {
    let cancelled = false
    setModules(null)
    computeQrModules(text).then((m) => {
      if (!cancelled) setModules(m)
    })
    return () => {
      cancelled = true
    }
  }, [text])

  // Reserve the same footprint before the module data resolves so the sheet
  // layout doesn't jump once it does.
  if (!modules) return <div aria-hidden="true" style={{ width: size, height: size }} className={className} />

  const cell = size / modules.size
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="QR code linking to mybooklab.app"
      className={className}
    >
      <rect width="100%" height="100%" fill="white" />
      {modules.cells.map(([row, col]) => (
        <rect key={`${row}-${col}`} x={col * cell} y={row * cell} width={cell} height={cell} fill="black" />
      ))}
    </svg>
  )
}

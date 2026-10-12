// The one-page Letter layout of a worksheet (teacher round 6B), in inches.
// Pure: GenericSheetBody (src/components/worksheets/sheets.jsx) draws every
// block at exactly the height computed here, and
// tests/worksheets-print-layout.test.js checks that every template's body
// fits BODY_BUDGET_IN — so no sheet can quietly spill onto a second page
// (the .worksheet-sheet page is a fixed 8.5 x 11in with overflow hidden).
//
// The page: 0.5in margins, then the big title, the Name / Date header (with
// the optional class / teacher line), the optional "Today's prompt" line
// (two lines at most), the body, and the footer with its QR code. The
// chrome heights are generous upper bounds of what those pieces render at.
import { getTemplate } from '../../../lib/school/worksheets.js'

export const SHEET_IN = { width: 8.5, height: 11, margin: 0.5 }
export const CHROME_IN = { title: 0.5, header: 0.75, prompt: 0.75, footer: 0.8 }
export const BODY_BUDGET_IN = Number(
  (SHEET_IN.height - 2 * SHEET_IN.margin - Object.values(CHROME_IN).reduce((a, n) => a + n, 0)).toFixed(2),
)

/// A box's label (its prompt, two lines at most), one ruled line, the gap
/// between blocks, and the gap between a drawing panel and its lines.
export const LABEL_IN = 0.4
export const LINE_IN = 0.34
export const GAP_IN = 0.14
export const DRAW_GAP_IN = 0.08
/// Ruled lines per box size when the template doesn't say.
export const DEFAULT_LINES = { small: 1, medium: 3, large: 6 }
/// The acrostic's letter rows on paper when the template doesn't say.
const LETTER_ROWS = 8

const round = (n) => Math.round(n * 1000) / 1000

/// { rows: [{ height, boxes: [{ id, size, perLetter, lines, drawIn, height }] }],
///   picture: { at, height, blockHeight } | null, height } — `height` is
/// the whole body. Null for an unknown template.
export function printLayout(templateOrId) {
  const template = typeof templateOrId === 'string' ? getTemplate(templateOrId) : templateOrId
  if (!template) return null
  const print = template.print ?? {}
  const byId = new Map(template.boxes.map((b) => [b.id, b]))
  const rowIds = print.rows ?? template.boxes.map((b) => [b.id])

  const rows = rowIds.map((ids) => {
    const boxes = ids.map((id) => {
      const box = byId.get(id)
      const lines = print.lines?.[id] ?? (box.perLetter ? LETTER_ROWS : DEFAULT_LINES[box.size])
      const drawIn = print.drawIn?.[id] ?? 0
      const height = round(LABEL_IN + (drawIn ? drawIn + DRAW_GAP_IN : 0) + lines * LINE_IN)
      return { id, size: box.size, perLetter: !!box.perLetter, lines, drawIn, height }
    })
    return { height: Math.max(...boxes.map((b) => b.height)), boxes }
  })

  const picture = print.picture
    ? { at: print.picture.at, height: print.picture.height, blockHeight: round(LABEL_IN + print.picture.height) }
    : null
  const blocks = rows.length + (picture ? 1 : 0)
  const height = round(rows.reduce((a, r) => a + r.height, 0) + (picture?.blockHeight ?? 0) + GAP_IN * (blocks - 1))
  return { rows, picture, height }
}

/// Every box id the layout places, in row order (each exactly once when
/// the template's rows are right).
export const layoutBoxIds = (layout) => layout.rows.flatMap((r) => r.boxes.map((b) => b.id))

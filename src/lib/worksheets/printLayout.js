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

// ── Teacher prompts as labels ───────────────────────────────────────────
// A label is two lines of bold text-sm at most (LABEL_IN). Calibrated in
// Chrome with a worst-case mix of long EN and IT words (and capitals): two
// lines held 170 characters at full width (7.5in), 82 at half (3.65in) and
// 48 at a third (2.37in). 10.5 characters per inch per line stays under all
// three: 156 / 76 / 48.
export const LABEL_CHARS_PER_IN = 10.5
const ROW_GAP_IN = 0.2
const WRITING_WIDTH_IN = SHEET_IN.width - 2 * SHEET_IN.margin

/// How many characters fit in a box's two-line label, for a row of `n`.
export function labelCharLimit(boxesInRow) {
  const width = (WRITING_WIDTH_IN - ROW_GAP_IN * (boxesInRow - 1)) / boxesInRow
  return Math.floor(width * LABEL_CHARS_PER_IN) * 2
}

/// Whether every prompt in `labels` fits its box's label on the one-page
/// layout (an assignment's prompts can be up to 300 characters). When one
/// doesn't, a blank assignment prints in the full-wrapping list instead.
export function labelsFit(templateId, labels = {}) {
  const layout = printLayout(templateId)
  if (!layout) return false
  return layout.rows.every((row) => row.boxes.every((b) =>
    String(labels[b.id] ?? '').length <= labelCharLimit(row.boxes.length)))
}

// ── The hand-made bodies ────────────────────────────────────────────────
// sentence_starters, book_report, feelings_checkin and word_web aren't laid
// out from boxes, but their blocks are drawn at these fixed heights too
// (sheets.jsx reads them), with only the drawing box allowed to grow into
// leftover room — so their minimum height is a plain sum, checked against
// BODY_BUDGET_IN like every generic body.
export const BESPOKE_IN = {
  sentence_starters: { prompt: LABEL_IN, rows: 8, row: 0.72 },
  book_report: {
    titleRow: LABEL_IN + LINE_IN, about: LABEL_IN + 3 * LINE_IN, favoriteRow: LABEL_IN + 3 * LINE_IN,
    stars: 0.4, pictureLabel: LABEL_IN, pictureMin: 1.2,
  },
  // Six feelings in rows of three; the four needs as chips, room for two rows.
  feelings_checkin: {
    heading: LABEL_IN, circle: 1, circleGap: 0.15, circleRows: 2, needHeading: LABEL_IN, chips: 1,
    pictureLabel: LABEL_IN, pictureMin: 0.6, whyRow: LABEL_IN + 2 * LINE_IN,
  },
  word_web: { web: 6 },
}

/// The minimum height of a hand-made body, in inches (blocks + gaps).
export function bespokeHeight(name) {
  const b = BESPOKE_IN[name]
  if (!b) return null
  const sum = (xs) => round(xs.reduce((a, n) => a + n, 0) + GAP_IN * (xs.length - 1))
  switch (name) {
    case 'sentence_starters': return sum([b.prompt, b.rows * b.row])
    case 'book_report': return sum([b.titleRow, b.about, b.favoriteRow, b.stars, b.pictureLabel + b.pictureMin])
    case 'feelings_checkin': return sum([
      b.heading, b.circleRows * b.circle + (b.circleRows - 1) * b.circleGap, b.needHeading, b.chips,
      b.pictureLabel + b.pictureMin, b.whyRow,
    ])
    case 'word_web': return b.web
    default: return null
  }
}

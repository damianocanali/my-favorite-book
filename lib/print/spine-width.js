// Lulu standard: 60# uncoated cream is 0.0025"/page. Hardcover binding board adds 0.06".
// Verify against Lulu's spine calculator before going live.
const PAGES_PER_INCH = 0.0025
const HARDCOVER_BOARD_INCHES = 0.06

export function spineWidthInches({ format, pageCount }) {
  if (!Number.isInteger(pageCount) || pageCount <= 0) {
    throw new Error(`Invalid pageCount: ${pageCount}`)
  }
  const paper = pageCount * PAGES_PER_INCH
  const total = format === 'hardcover' ? paper + HARDCOVER_BOARD_INCHES : paper
  return Math.round(total * 1000) / 1000
}

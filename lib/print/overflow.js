// The last guard against a clipped printed page. The Writing Year layout
// is paginated by estimate (lib/print/writing-year-html.js), and every
// page hides its overflow — so after Chromium lays the document out, every
// page is measured, and a page whose content doesn't fit is a refusal
// (409 with the page numbers), never a quietly clipped PDF.

/// Runs IN THE BROWSER (page.evaluate): one measurement per element
/// matching `selector`, in document order. Self-contained on purpose.
export function measurePages(selector) {
  return Array.from(document.querySelectorAll(selector)).map((sec) => {
    const box = sec.getBoundingClientRect()
    const cs = getComputedStyle(sec)
    const innerBottom = box.bottom - parseFloat(cs.paddingBottom || '0') - parseFloat(cs.borderBottomWidth || '0')
    const innerRight = box.right - parseFloat(cs.paddingRight || '0') - parseFloat(cs.borderRightWidth || '0')
    let contentBottom = box.top
    let contentRight = box.left
    for (const el of sec.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      contentBottom = Math.max(contentBottom, r.bottom)
      contentRight = Math.max(contentRight, r.right)
      // A box that clips its own text (ellipsis rows are allowed to).
      if (el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'visible' && el.clientHeight > 0) {
        contentBottom = Math.max(contentBottom, r.top + el.scrollHeight)
      }
    }
    return {
      scrollHeight: sec.scrollHeight, clientHeight: sec.clientHeight,
      scrollWidth: sec.scrollWidth, clientWidth: sec.clientWidth,
      contentBottom, innerBottom, contentRight, innerRight,
    }
  })
}

/// 1-based numbers of the pages whose content doesn't fit (1px tolerance
/// for sub-pixel rounding).
export function findOverflowingPages(measures, tolerance = 1) {
  const out = []
  measures.forEach((m, i) => {
    if (
      m.scrollHeight > m.clientHeight + tolerance ||
      m.scrollWidth > m.clientWidth + tolerance ||
      m.contentBottom > m.innerBottom + tolerance ||
      m.contentRight > m.innerRight + tolerance
    ) out.push(i + 1)
  })
  return out
}

export class PageOverflowError extends Error {
  constructor(pages, what = 'page') {
    super(`Text does not fit on ${what} ${pages.join(', ')}`)
    this.name = 'PageOverflowError'
    this.pages = pages
  }
}

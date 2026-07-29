import { useRef, useState, useCallback, useEffect } from 'react'
import { motion } from 'motion/react'
import HTMLFlipBook from 'react-pageflip'
import React from 'react'
import BookCover from './BookCover'
import BookPage, { BookPageIllustration, BookPageText } from './BookPage'
import PageFlipControls from './PageFlipControls'
import { buildBackMatterPages } from './BackMatterPages'
import { isNative } from '../../capacitor'

const BookPageWrapper = React.forwardRef(({ children }, ref) => (
  <div ref={ref} className="bg-white">
    {children}
  </div>
))
BookPageWrapper.displayName = 'BookPageWrapper'

const PAGE_ASPECT = 3 / 4 // width / height

// Everything between the measuring probe and the bottom of the safe area:
// the probe→book gap (12), the book→controls gap (12), the 48px control
// buttons, and the fixed tab bar plus home indicator, with a few px spare.
const CONTROLS_H = 68
// Tab bar (72) + home indicator + real breathing room. At a tighter
// value the arrows ended up flush against the tab bar — 2px of clearance
// on a 694px-tall window, and clipped entirely on slightly shorter ones.
const TABBAR_H = 96
// Floor for very short screens. Below this the book is unreadable, so we
// let the page scroll instead of shrinking further.
const MIN_BOOK_H = 240

/**
 * Sizes the book so the book AND its flip controls fit on screen together.
 *
 * The old version subtracted a fixed 160px from the window height, which
 * ignored both the page's own heading block and the bottom tab bar — so
 * the controls ended up below the fold and you had to scroll down to
 * flip, then back up to read. Instead we measure where the reader
 * actually starts in the viewport, so it adapts to whatever sits above
 * it on any given page.
 */
function sizeFrom(bookW, bookH) {
  const w = Math.floor(bookW)
  const h = Math.floor(bookH)
  return {
    width: w,
    height: h,
    minWidth: w,
    maxWidth: w,
    minHeight: h,
    maxHeight: h,
  }
}

/**
 * Two-up (illustration | text) only when there's genuinely room for it —
 * a spread is twice as wide as a single page, so on a phone it would make
 * both halves tiny. Below this the reader falls back to one combined page.
 */
function canSpread() {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= 820
}

function useFittedBookSize(containerRef, spread) {
  // Seeded synchronously so the first render already has usable numbers —
  // react-pageflip needs real dimensions, it can't take null.
  const [dimensions, setDimensions] = useState(() => {
    if (typeof window === 'undefined') return sizeFrom(300, 400)
    const viewportH = window.visualViewport?.height ?? window.innerHeight
    const h = Math.max(MIN_BOOK_H, viewportH - 200 - CONTROLS_H - TABBAR_H)
    const w = Math.min(h * PAGE_ASPECT, Math.max(200, window.innerWidth - 40))
    return sizeFrom(w, w / PAGE_ASPECT > h ? h : w / PAGE_ASPECT)
  })

  // `containerRef` points at a zero-height, full-width sentinel sitting
  // exactly where the book starts. Measuring THAT (rather than the book's
  // own wrapper, which shrinks to fit its content) gives a stable read of
  // both the available width and the reader's offset — measuring the
  // wrapper fed the book's size back into itself and pinned it at the
  // minimum.
  const measure = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const viewportH = window.visualViewport?.height ?? window.innerHeight
    const topInViewport = el.getBoundingClientRect().top
    const available = viewportH - topInViewport - CONTROLS_H - TABBAR_H

    let bookH = Math.max(MIN_BOOK_H, available)
    let bookW = bookH * PAGE_ASPECT

    // A spread is two pages wide, so it needs 2x the width budget. It's
    // also allowed to break out of the page's narrow text column (the
    // book is centred, so overflowing that column reads as intentional)
    // — otherwise max-w-3xl would squeeze the spread back down.
    const pagesWide = spread ? 2 : 1
    const maxW = spread
      ? Math.max(320, Math.min(window.innerWidth - 32, 1180))
      : Math.max(200, el.clientWidth - 16)

    if (bookW * pagesWide > maxW) {
      bookW = maxW / pagesWide
      bookH = bookW / PAGE_ASPECT
    }
    // Don't let the book grow past a comfortable reading height.
    bookH = Math.min(bookH, 760)
    bookW = bookH * PAGE_ASPECT

    const next = sizeFrom(bookW, bookH)
    setDimensions((prev) =>
      prev && prev.width === next.width && prev.height === next.height ? prev : next
    )
  }, [containerRef, spread])

  useEffect(() => {
    // Re-measure across a few frames: the first paint happens before
    // webfonts and the hero image settle, and the reader's offset moves
    // when they do.
    measure()
    const raf = requestAnimationFrame(measure)
    const t1 = setTimeout(measure, 150)
    const t2 = setTimeout(measure, 600)

    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t1)
      clearTimeout(t2)
      ro.disconnect()
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [measure, containerRef])

  return dimensions
}

export default function BookPreview({ book, includeBackMatter = false }) {
  const flipBookRef = useRef(null)
  const containerRef = useRef(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [spread, setSpread] = useState(canSpread)
  const dims = useFittedBookSize(containerRef, spread)

  useEffect(() => {
    const onResize = () => setSpread(canSpread())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onFlip = useCallback((e) => {
    setCurrentPage(e.data)
  }, [])

  const onInit = useCallback((e) => {
    setTotalPages(e.data.pages)
  }, [])

  // Arrow keys turn pages on desktop, matching the on-screen controls.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (t instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return
      if (e.key === 'ArrowLeft') flipBookRef.current?.pageFlip()?.flipPrev()
      if (e.key === 'ArrowRight') flipBookRef.current?.pageFlip()?.flipNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!book) return null

  // Back-matter pages mirror the printed book exactly. When shown, the
  // back-matter promo page closes the book; we skip the simple "The End"
  // back cover to avoid a duplicate ending.
  const backMatterPages = includeBackMatter
    ? buildBackMatterPages(book).map(({ Component, key }) => (
        <BookPageWrapper key={`bm-${key}`}>
          <Component book={book} />
        </BookPageWrapper>
      ))
    : []

  const allPages = [
    // Cover
    <BookPageWrapper key="cover">
      <BookCover book={book} />
    </BookPageWrapper>,
    // Story pages. In spread mode each story page becomes TWO flip pages
    // so the open book reads illustration-left / text-right, the way a
    // printed picture book does. showCover puts the cover alone on the
    // right, so pages 1&2, 3&4 … pair up — keeping each illustration
    // beside its own text.
    ...book.pages.flatMap((page) =>
      spread
        ? [
            <BookPageWrapper key={`${page.id}-art`}>
              <BookPageIllustration page={page} book={book} />
            </BookPageWrapper>,
            <BookPageWrapper key={`${page.id}-text`}>
              <BookPageText page={page} book={book} />
            </BookPageWrapper>,
          ]
        : [
            <BookPageWrapper key={page.id}>
              <BookPage page={page} book={book} />
            </BookPageWrapper>,
          ]
    ),
    ...backMatterPages,
    // Simple back cover — omitted when full back matter is rendered
    ...(includeBackMatter
      ? []
      : [
          <BookPageWrapper key="back">
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: book.colors?.cover ?? '#8B5CF6' }}
            >
              <div className="text-center">
                <p className="text-5xl mb-4">⭐</p>
                <p
                  className="font-heading text-2xl font-bold"
                  style={{ color: book.colors?.text ?? '#F1F5F9' }}
                >
                  The End
                </p>
                <p
                  className="font-body text-base mt-2 opacity-80"
                  style={{ color: book.colors?.text ?? '#F1F5F9' }}
                >
                  by {book.authorName}
                </p>
              </div>
            </div>
          </BookPageWrapper>,
        ]),
  ]

  return (
    <motion.div
      className="flex w-full flex-col items-center gap-3"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Zero-height, full-width probe: see useFittedBookSize. */}
      <div ref={containerRef} className="h-0 w-full" aria-hidden="true" />

      {/* Explicit size here stops react-pageflip's size="stretch" from
          resolving width:100% against a shrink-to-fit parent and
          collapsing the book to its minimum. */}
      {/* The explicit size stops react-pageflip's size="stretch" from
          collapsing against a shrink-to-fit parent. react-pageflip rounds
          its own block width, so it can come out a little narrower than
          this box — centre it, or that difference shows up as the whole
          book sitting off to the left. */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: dims.width * (spread ? 2 : 1), height: dims.height }}
      >
        {/* Cosmic glow behind book */}
        <div
          className="absolute -inset-8 rounded-3xl blur-2xl opacity-20"
          style={{
            background: `radial-gradient(circle, ${book.colors?.cover ?? '#8B5CF6'}, transparent)`,
          }}
        />

        <div className="relative shadow-2xl rounded-lg overflow-hidden">
          <HTMLFlipBook
            // Switching between spread and single changes both the page
            // count and portrait mode; react-pageflip only reads those at
            // init, so remount it rather than leave a stale layout.
            key={spread ? 'spread' : 'single'}
            ref={flipBookRef}
            width={dims.width}
            height={dims.height}
            size="stretch"
            minWidth={dims.minWidth}
            maxWidth={dims.maxWidth}
            minHeight={dims.minHeight}
            maxHeight={dims.maxHeight}
            showCover={true}
            flippingTime={800}
            usePortrait={!spread}
            startPage={0}
            drawShadow={true}
            maxShadowOpacity={0.3}
            onFlip={onFlip}
            onInit={onInit}
            className="book-flip"
            style={{}}
            startZIndex={0}
            autoSize={true}
            clickEventForward={true}
            useMouseEvents={true}
            mobileScrollSupport={false}
          >
            {allPages}
          </HTMLFlipBook>
        </div>
      </div>

      {/* Controls */}
      <PageFlipControls
        flipBookRef={flipBookRef}
        currentPage={currentPage}
        totalPages={totalPages || allPages.length}
      />
    </motion.div>
  )
}

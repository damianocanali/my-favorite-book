import { useRef, useState, useCallback, useEffect } from 'react'
import { motion } from 'motion/react'
import HTMLFlipBook from 'react-pageflip'
import React from 'react'
import BookCover from './BookCover'
import BookPage from './BookPage'
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
const CONTROLS_H = 76
const TABBAR_H = 84
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

function useFittedBookSize(containerRef) {
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

    const maxW = Math.max(200, el.clientWidth - 16)
    if (bookW > maxW) {
      bookW = maxW
      bookH = bookW / PAGE_ASPECT
    }
    // Desktop: don't blow the book up to full-screen height.
    if (window.innerWidth >= 1024) {
      bookH = Math.min(bookH, 720)
      bookW = bookH * PAGE_ASPECT
    }

    const next = sizeFrom(bookW, bookH)
    setDimensions((prev) =>
      prev && prev.width === next.width && prev.height === next.height ? prev : next
    )
  }, [containerRef])

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
  const dims = useFittedBookSize(containerRef)

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
    // Story pages
    ...book.pages.map((page) => (
      <BookPageWrapper key={page.id}>
        <BookPage page={page} book={book} />
      </BookPageWrapper>
    )),
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
      <div className="relative" style={{ width: dims.width, height: dims.height }}>
        {/* Cosmic glow behind book */}
        <div
          className="absolute -inset-8 rounded-3xl blur-2xl opacity-20"
          style={{
            background: `radial-gradient(circle, ${book.colors?.cover ?? '#8B5CF6'}, transparent)`,
          }}
        />

        <div className="relative shadow-2xl rounded-lg overflow-hidden">
          <HTMLFlipBook
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
            usePortrait={true}
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

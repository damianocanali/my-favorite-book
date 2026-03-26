import { useRef, useState, useCallback, useEffect } from 'react'
import { motion } from 'motion/react'
import HTMLFlipBook from 'react-pageflip'
import React from 'react'
import BookCover from './BookCover'
import BookPage from './BookPage'
import PageFlipControls from './PageFlipControls'
import { isNative } from '../../capacitor'

const BookPageWrapper = React.forwardRef(({ children }, ref) => (
  <div ref={ref} className="bg-white">
    {children}
  </div>
))
BookPageWrapper.displayName = 'BookPageWrapper'

function useBookDimensions() {
  const [dimensions, setDimensions] = useState(() => calcDimensions())

  function calcDimensions() {
    const w = window.innerWidth
    const h = window.innerHeight

    if (isNative) {
      // Fullscreen on mobile — use nearly all available space
      const maxW = w - 16
      const maxH = h - 120 // leave room for controls
      const aspect = 3 / 4
      let bookW = maxW
      let bookH = bookW / aspect
      if (bookH > maxH) {
        bookH = maxH
        bookW = bookH * aspect
      }
      return {
        width: Math.floor(bookW),
        height: Math.floor(bookH),
        minWidth: Math.floor(bookW * 0.9),
        maxWidth: Math.floor(bookW),
        minHeight: Math.floor(bookH * 0.9),
        maxHeight: Math.floor(bookH),
      }
    }

    // Web — much bigger than before, responsive to viewport
    if (w >= 1280) {
      return { width: 520, height: 690, minWidth: 460, maxWidth: 600, minHeight: 610, maxHeight: 800 }
    }
    if (w >= 768) {
      return { width: 440, height: 580, minWidth: 380, maxWidth: 540, minHeight: 500, maxHeight: 720 }
    }
    // Small screens (mobile web)
    const maxW = w - 32
    const maxH = h - 160
    const aspect = 3 / 4
    let bookW = Math.min(maxW, 400)
    let bookH = bookW / aspect
    if (bookH > maxH) {
      bookH = maxH
      bookW = bookH * aspect
    }
    return {
      width: Math.floor(bookW),
      height: Math.floor(bookH),
      minWidth: Math.floor(bookW * 0.85),
      maxWidth: Math.floor(bookW),
      minHeight: Math.floor(bookH * 0.85),
      maxHeight: Math.floor(bookH),
    }
  }

  useEffect(() => {
    const onResize = () => setDimensions(calcDimensions())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return dimensions
}

export default function BookPreview({ book }) {
  const flipBookRef = useRef(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const dims = useBookDimensions()

  const onFlip = useCallback((e) => {
    setCurrentPage(e.data)
  }, [])

  const onInit = useCallback((e) => {
    setTotalPages(e.data.pages)
  }, [])

  if (!book) return null

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
    // Back cover
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
  ]

  return (
    <motion.div
      className="flex flex-col items-center gap-4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Book container with decorative shadow */}
      <div className="relative">
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

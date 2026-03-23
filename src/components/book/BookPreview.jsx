import { useRef, useState, useCallback } from 'react'
import { motion } from 'motion/react'
import HTMLFlipBook from 'react-pageflip'
import React from 'react'
import BookCover from './BookCover'
import BookPage from './BookPage'
import PageFlipControls from './PageFlipControls'

const BookPageWrapper = React.forwardRef(({ children }, ref) => (
  <div ref={ref} className="bg-white">
    {children}
  </div>
))
BookPageWrapper.displayName = 'BookPageWrapper'

export default function BookPreview({ book }) {
  const flipBookRef = useRef(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

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
          <p className="text-4xl mb-4">⭐</p>
          <p
            className="font-heading text-xl font-bold"
            style={{ color: book.colors?.text ?? '#F1F5F9' }}
          >
            The End
          </p>
          <p
            className="font-body text-sm mt-2 opacity-80"
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
      className="flex flex-col items-center gap-6"
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
            width={320}
            height={420}
            size="stretch"
            minWidth={280}
            maxWidth={500}
            minHeight={370}
            maxHeight={660}
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

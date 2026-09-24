// The book leaving the shelf: it lifts out, turns to face you as it comes
// forward, then the cover swings open before the reader takes over.
//
// This is a transition, not a screen. It owns no state the reader needs and
// hands off by calling onDone — the caller navigates. Keeping the navigation
// outside means a dropped frame or an interrupted animation can never strand a
// child on a decorative overlay: onDone fires from a timer, not from an
// animation callback that might not arrive.

import { useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

// Total time before the reader takes over. Long enough to read as a book
// opening, short enough that a child opening ten books in a row is not waiting
// on it. iOS's cheer animation makes the same trade by bursting twice rather
// than looping.
const DURATION_MS = 820

export default function BookOpenTransition({ book, onDone }) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const colors = book?.colors ?? { cover: '#8B5CF6', accent: '#06B6D4', text: '#F1F5F9' }

  useEffect(() => {
    // Reduced motion skips the whole thing rather than playing it faster — a
    // book flying at the viewer is exactly the kind of movement the setting
    // exists to suppress.
    const ms = reduceMotion ? 0 : DURATION_MS
    const id = setTimeout(onDone, ms)
    return () => clearTimeout(id)
  }, [onDone, reduceMotion])

  if (reduceMotion) return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center [perspective:1200px]"
      // Decorative: the reader that follows announces the book. aria-hidden
      // stops a screen reader reading a title that is about to be replaced,
      // and pointer-events-none stops it swallowing a tap.
      aria-hidden="true"
    >
      {/* The dim is its own layer with an animated opacity. Tweening the
          container's backgroundColor from a fully transparent rgba() never
          visibly darkened — verified in the browser. */}
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.55 }}
        transition={{ duration: 0.3 }}
      />

      <motion.div
        className="relative"
        style={{ transformStyle: 'preserve-3d', width: 168, height: 232 }}
        // Starts edge-on and small, as it sits on the shelf; arrives facing the
        // viewer and large, as if picked up.
        initial={{ rotateY: -78, scale: 0.42, y: 40 }}
        animate={{ rotateY: 0, scale: 1, y: 0 }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* The pages behind the cover, revealed as it opens. */}
        <div
          className="absolute inset-0 rounded-r-lg rounded-l-sm bg-[#FBF7EE] shadow-2xl"
          style={{ transform: 'translateZ(-1px)' }}
        >
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="font-heading text-sm font-bold text-[#3B2B5B]">{book?.title}</p>
            <p className="font-body text-[11px] text-[#6B5B8B]">
              {t('gallery:spine.by_author', { author: book?.authorName })}
            </p>
          </div>
        </div>

        {/* The cover, hinged on its left edge. It swings open only after the
            book has finished coming forward, which is why this has its own
            delay rather than sharing the parent's transition. */}
        <motion.div
          className="absolute inset-0 overflow-hidden rounded-r-lg rounded-l-sm"
          style={{ backgroundColor: colors.cover, transformOrigin: 'left center', backfaceVisibility: 'hidden' }}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: -100 }}
          // Timing verified frame by frame in a browser. The first pass began
          // the swing at 0.42s over 0.3s with an ease-in-out, which meant the
          // cover was still visibly shut at 430ms and had already passed 90°
          // — where backface-visibility hides it — by 620ms. The opening
          // itself was never on screen. It now starts earlier, runs longer,
          // and moves through the middle of the swing at a near-constant rate.
          transition={{ duration: 0.44, delay: 0.3, ease: [0.34, 0, 0.36, 1] }}
        >
          <span
            className="absolute inset-x-0 top-2 h-1.5"
            style={{ backgroundColor: colors.accent, opacity: 0.6 }}
          />
          <span
            className="absolute inset-x-0 bottom-2 h-1.5"
            style={{ backgroundColor: colors.accent, opacity: 0.6 }}
          />
          <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center">
            <span className="text-2xl">{book?.characters?.[0]?.emoji}</span>
            <span className="font-heading text-sm font-bold leading-tight" style={{ color: colors.text }}>
              {book?.title}
            </span>
          </div>
        </motion.div>
      </motion.div>
    </div>,
    document.body
  )
}

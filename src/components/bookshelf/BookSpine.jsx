import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Trash2, Pencil, Printer } from 'lucide-react'

// How thick the book looks, in px. Also the width of the spine face.
const SPINE_DEPTH = 26
// How far the book is turned. The iOS shelf notes that tilt "was breaking the
// bounding box and bleeding into neighbor cells" — a CSS rotateY does not
// change the layout box, but it does overlap visually, so this stays modest
// and the grid keeps padding between cells.
const REST_ANGLE = 30

export default function BookSpine({ book, onClick, onEdit, onDelete, onOrderPrint }) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const colors = book.colors ?? { cover: '#8B5CF6', accent: '#06B6D4', text: '#F1F5F9' }

  return (
    <div className="relative group">
      <motion.button
        onClick={onClick}
        // perspective is NOT set here: it applies to an element's children, so
        // on the rotating element itself the turn renders perfectly flat.
        // Bookshelf.jsx puts it on the cell that contains this button. Verified
        // by rendering both ways — at 900px on this element the books looked
        // like plain cards.
        className="w-full cursor-pointer"
        // rotateY is animated by motion rather than set in CSS, because motion
        // writes the whole `transform` property and a CSS transform here would
        // simply be overwritten on first hover.
        style={{ transformStyle: 'preserve-3d' }}
        initial={false}
        animate={{ rotateY: REST_ANGLE }}
        whileHover={{ rotateY: 0, scale: 1.05, y: -5 }}
        whileFocus={{ rotateY: 0, scale: 1.05, y: -5 }}
        whileTap={{ scale: 0.98 }}
        // Matches the mascot's rule: motion is skipped under Reduce Motion, so
        // the book snaps between states instead of swinging.
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 24 }}
      >
        {/* The spine face: a real surface hinged off the cover's left edge and
            folded back 90°, so turning the book reveals it. A gradient strip
            painted on the flat cover would foreshorten with the cover and read
            as a stripe, not an edge.

            transformOrigin left + rotateY(-90deg) swings it away from the
            viewer; without preserve-3d on the parent it would collapse flat.
            aria-hidden because the cover already carries the title and author,
            and a screen reader has no use for the book's thickness. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-full overflow-hidden rounded-l-xl"
          style={{
            width: `${SPINE_DEPTH}px`,
            // Hinge on the cover's left edge and fold straight back.
            // rotateY(+90°) about that origin maps the strip's far edge from
            // (w,0,0) to (0,0,-w) — negative z is away from the viewer — so the
            // spine extends behind the cover, which is where a real book's
            // spine is. rotateY(-90°) would send it out through the screen.
            // REST_ANGLE is positive for the matching reason: rotating the book
            // by +φ sends its left edge to +z, bringing the spine into view.
            transformOrigin: 'left center',
            transform: 'rotateY(90deg)',
            backgroundImage: `linear-gradient(to right, ${colors.cover}, ${colors.accent}80)`,
          }}
        >
          {/* Gilded bands, top and bottom, as on the iOS spine. */}
          <div className="absolute inset-x-0 top-1.5 h-1" style={{ backgroundColor: colors.accent }} />
          <div className="absolute inset-x-0 bottom-1.5 h-1" style={{ backgroundColor: colors.accent }} />
          {/* The ridge suggesting the spine's curve — iOS draws the same 1px line. */}
          <div className="absolute inset-y-2 left-1/2 w-px bg-white/10" />
        </div>

        {/* Book cover */}
        <div
          className="relative w-full aspect-[3/4] rounded-xl overflow-hidden shadow-lg"
          style={{ backgroundColor: colors.cover, transform: 'translateZ(0)' }}
        >

          {/* Content */}
          <div className="flex flex-col items-center justify-center h-full px-6">
            {/* Characters */}
            <div className="flex gap-1 mb-3">
              {book.characters?.slice(0, 3).map((char) => (
                <span key={char.id} className="text-xl">
                  {char.emoji}
                </span>
              ))}
            </div>

            {/* Title */}
            <h3
              className="font-heading text-sm font-bold text-center leading-tight mb-2"
              style={{ color: colors.text }}
            >
              {book.title}
            </h3>

            {/* Divider */}
            <div
              className="w-8 h-0.5 mb-2 opacity-50"
              style={{ backgroundColor: colors.text }}
            />

            {/* Author */}
            <p
              className="font-body text-xs opacity-70"
              style={{ color: colors.text }}
            >
              {book.authorName}
            </p>

            {/* Page count */}
            <p
              className="font-body text-[10px] mt-2 opacity-50"
              style={{ color: colors.text }}
            >
              {t('gallery:spine.pages', { count: book.pages?.length ?? 0 })}
            </p>
          </div>

          {/* Light falloff. A turned surface that keeps a flat fill still reads
              as a flat card however far it is rotated; the darkening toward the
              hinge is what sells the turn. Pointer-events-none so it never eats
              a tap meant for the cover. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(0,0,0,0.28), rgba(0,0,0,0) 38%, rgba(255,255,255,0.10))',
            }}
          />

          {/* Bottom decoration */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1.5"
            style={{ backgroundColor: colors.accent + '50' }}
          />
        </div>
      </motion.button>

      {/* Edit button */}
      <motion.button
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        className="absolute -top-2 -left-2 w-7 h-7 bg-galaxy-secondary text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg z-10"
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
      >
        <Pencil size={12} />
      </motion.button>

      {/* Delete button */}
      <motion.button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg z-10"
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
      >
        <Trash2 size={12} />
      </motion.button>

      {/* Order print button */}
      {onOrderPrint && (
        <motion.button
          onClick={(e) => {
            e.stopPropagation()
            onOrderPrint()
          }}
          className="absolute -bottom-2 -right-2 w-7 h-7 bg-galaxy-primary text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg z-10"
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          aria-label={t('gallery:spine.order_print_aria')}
          title={t('gallery:spine.order_print_title')}
        >
          <Printer size={12} />
        </motion.button>
      )}
    </div>
  )
}

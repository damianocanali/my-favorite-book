import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { BookOpen, Star, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { apiFetch } from '../lib/api'
import { useAuthStore } from '../stores/useAuthStore'

// Floating emojis in the background
const FLOATERS = [
  { emoji: '📖', x: '8%', y: '12%', delay: 0, duration: 6 },
  { emoji: '⭐', x: '88%', y: '8%', delay: 1, duration: 5 },
  { emoji: '🦄', x: '5%', y: '55%', delay: 0.5, duration: 7 },
  { emoji: '🌈', x: '92%', y: '45%', delay: 2, duration: 6 },
  { emoji: '✨', x: '15%', y: '85%', delay: 1.5, duration: 5 },
  { emoji: '🚀', x: '85%', y: '80%', delay: 0.8, duration: 7 },
]

function FloatingEmoji({ emoji, x, y, delay, duration }) {
  return (
    <motion.div
      className="absolute text-3xl sm:text-4xl pointer-events-none select-none opacity-20"
      style={{ left: x, top: y }}
      animate={{
        y: [0, -15, 0],
        rotate: [0, 8, -8, 0],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration,
        repeat: Infinity,
        delay,
        ease: 'easeInOut',
      }}
    >
      {emoji}
    </motion.div>
  )
}

function BookCard({ book, index, currentUserId, onRemoved }) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const isOwner = currentUserId && book.user_id === currentUserId

  const handleRemove = async (e) => {
    e.preventDefault()
    setRemoving(true)
    try {
      const res = await apiFetch('/api/publish-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unpublish', slug: book.slug, userId: currentUserId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onRemoved(book.slug)
    } catch (err) {
      alert(`Could not remove book: ${err.message}`)
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  const totalReactions = Object.values(book.reaction_counts || {}).reduce((s, n) => s + n, 0)
  const topStickers = Object.entries(book.reaction_counts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s]) => s)

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.08,
        type: 'spring',
        stiffness: 200,
        damping: 20,
      }}
    >
      <Link to={`/view/${book.slug}`} className="block group">
        <motion.div
          className="relative bg-galaxy-bg-light rounded-2xl border border-galaxy-text-muted/10 overflow-hidden"
          whileHover={{ scale: 1.03, y: -4 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {/* Book cover preview */}
          <div
            className="h-48 sm:h-56 flex items-center justify-center relative overflow-hidden"
            style={{ backgroundColor: book.cover_color || '#8B5CF6' }}
          >
            {/* Shimmer effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

            <div className="text-center relative z-10">
              {book.cover_emoji && (
                <motion.span
                  className="text-5xl sm:text-6xl block mb-2"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, delay: index * 0.3 }}
                >
                  {book.cover_emoji}
                </motion.span>
              )}
              <h3 className="font-heading text-lg sm:text-xl font-bold text-white px-4 leading-tight drop-shadow-md">
                {book.title}
              </h3>
            </div>

            {/* Featured sparkle */}
            {book.featured && (
              <motion.div
                className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-400/20 border border-yellow-400/40 backdrop-blur-sm"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                <span className="text-yellow-400 text-[10px] font-bold font-body">FEATURED</span>
              </motion.div>
            )}
          </div>

          {/* Book info */}
          <div className="p-4">
            <p className="text-galaxy-text-muted font-body text-sm">
              by <span className="text-galaxy-text font-semibold">{book.author_name}</span>
              {book.author_age && <span className="text-galaxy-text-muted">, age {book.author_age}</span>}
            </p>

            {totalReactions > 0 && (
              <motion.div
                className="flex items-center gap-1.5 mt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.08 + 0.3 }}
              >
                <div className="flex -space-x-1">
                  {topStickers.map((s) => (
                    <span key={s} className="text-sm">{s}</span>
                  ))}
                </div>
                <span className="text-galaxy-text-muted font-body text-xs">
                  {totalReactions} sticker{totalReactions === 1 ? '' : 's'}
                </span>
              </motion.div>
            )}

            {/* Owner remove button */}
            {isOwner && (
              <div className="mt-3 pt-3 border-t border-galaxy-text-muted/10">
                {confirmRemove ? (
                  <div className="flex items-center gap-2">
                    <span className="text-galaxy-text-muted font-body text-xs">Remove?</span>
                    <button
                      onClick={handleRemove}
                      disabled={removing}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-body font-semibold hover:bg-red-500/20 transition-colors"
                    >
                      {removing ? <Loader2 size={10} className="animate-spin" /> : 'Yes'}
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); setConfirmRemove(false) }}
                      className="text-galaxy-text-muted text-xs font-body hover:text-galaxy-text transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.preventDefault(); setConfirmRemove(true) }}
                    className="flex items-center gap-1.5 text-galaxy-text-muted hover:text-red-400 transition-colors text-xs font-body"
                  >
                    <Trash2 size={12} /> Remove from gallery
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </Link>
    </motion.div>
  )
}

export default function GalleryPage() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    async function fetchBooks() {
      try {
        const res = await apiFetch('/api/publish-book?recent=true')
        if (res.ok) setBooks(await res.json())
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    fetchBooks()
  }, [])

  const handleRemoved = (slug) => setBooks((prev) => prev.filter((b) => b.slug !== slug))

  const featured = books.filter((b) => b.featured)
  const recent = books.filter((b) => !b.featured)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 relative min-h-[60vh]">
      {/* Floating background emojis */}
      {FLOATERS.map((f, i) => (
        <FloatingEmoji key={i} {...f} />
      ))}

      {/* Header */}
      <motion.div
        className="text-center mb-10 relative z-10"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <motion.div
          className="w-20 h-20 mx-auto mb-4 rounded-full bg-yellow-400/20 flex items-center justify-center border border-yellow-400/30"
          animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Sparkles size={36} className="text-yellow-400" />
        </motion.div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-galaxy-text mb-2">
          Book Gallery
        </h1>
        <motion.p
          className="text-galaxy-text-muted font-body text-lg max-w-md mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Amazing stories written by young authors just like you!
        </motion.p>
      </motion.div>

      {/* Loading */}
      <AnimatePresence>
        {loading && (
          <motion.div
            className="flex flex-col items-center justify-center py-20 gap-4"
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 size={36} className="text-galaxy-primary" />
            </motion.div>
            <p className="text-galaxy-text-muted font-body text-sm animate-pulse">
              Loading amazing stories...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!loading && books.length === 0 && (
        <motion.div
          className="text-center py-16 relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <motion.p
            className="text-7xl mb-4"
            animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            📚
          </motion.p>
          <h2 className="font-heading text-xl font-bold text-galaxy-text mb-2">
            The gallery is getting ready!
          </h2>
          <p className="text-galaxy-text-muted font-body mb-6">
            Be the first to publish a book and share it with the world!
          </p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-galaxy-primary text-white font-body font-semibold hover:bg-galaxy-primary/80 transition-colors text-lg"
            >
              <BookOpen size={20} /> Start Writing
            </Link>
          </motion.div>
        </motion.div>
      )}

      {/* Featured section */}
      {featured.length > 0 && (
        <motion.div
          className="mb-12 relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-5">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Star size={22} className="text-yellow-400 fill-yellow-400" />
            </motion.div>
            <h2 className="font-heading text-xl font-bold text-galaxy-text">Featured Stories</h2>
            <motion.span
              className="text-lg"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
            >
              ✨
            </motion.span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featured.map((book, i) => (
              <BookCard key={book.slug} book={book} index={i} currentUserId={user?.id} onRemoved={handleRemoved} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Recently Published section */}
      {recent.length > 0 && (
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-5">
            <BookOpen size={20} className="text-galaxy-primary" />
            <h2 className="font-heading text-xl font-bold text-galaxy-text">Recently Published</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recent.map((book, i) => (
              <BookCard key={book.slug} book={book} index={i + featured.length} currentUserId={user?.id} onRemoved={handleRemoved} />
            ))}
          </div>
        </motion.div>
      )}

      {/* CTA */}
      {books.length > 0 && (
        <motion.div
          className="text-center mt-12 relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <motion.p
            className="text-galaxy-text-muted font-body text-sm mb-3"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            Want your book in the gallery? Publish it from your preview page!
          </motion.p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-galaxy-primary text-white font-body font-semibold hover:bg-galaxy-primary/80 transition-colors"
            >
              <BookOpen size={18} /> Write Your Story
            </Link>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

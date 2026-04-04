import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { BookOpen, Star, Loader2, Sparkles } from 'lucide-react'
import { apiFetch } from '../lib/api'

function BookCard({ book, index }) {
  const totalReactions = Object.values(book.reaction_counts || {}).reduce((s, n) => s + n, 0)
  const topSticker = Object.entries(book.reaction_counts || {})
    .sort((a, b) => b[1] - a[1])[0]?.[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Link
        to={`/view/${book.slug}`}
        className="block group"
      >
        <div className="relative bg-galaxy-bg-light rounded-2xl border border-galaxy-text-muted/10 overflow-hidden hover:border-galaxy-primary/40 transition-all hover:shadow-glow-purple">
          {/* Book cover preview */}
          <div
            className="h-44 sm:h-52 flex items-center justify-center relative"
            style={{ backgroundColor: book.cover_color || '#8B5CF6' }}
          >
            <div className="text-center">
              {book.cover_emoji && (
                <span className="text-5xl sm:text-6xl block mb-2">{book.cover_emoji}</span>
              )}
              <h3 className="font-heading text-lg sm:text-xl font-bold text-white px-4 leading-tight drop-shadow-md">
                {book.title}
              </h3>
            </div>

            {/* Featured badge */}
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-400/20 border border-yellow-400/40">
              <Star size={12} className="text-yellow-400 fill-yellow-400" />
              <span className="text-yellow-400 text-[10px] font-bold font-body">FEATURED</span>
            </div>
          </div>

          {/* Book info */}
          <div className="p-4">
            <p className="text-galaxy-text-muted font-body text-sm">
              by <span className="text-galaxy-text font-semibold">{book.author_name}</span>
              {book.author_age && <span className="text-galaxy-text-muted">, age {book.author_age}</span>}
            </p>

            {totalReactions > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                {topSticker && <span className="text-sm">{topSticker}</span>}
                <span className="text-galaxy-text-muted font-body text-xs">
                  {totalReactions} sticker{totalReactions === 1 ? '' : 's'}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export default function GalleryPage() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const res = await apiFetch('/api/publish-book?featured=true')
        if (res.ok) {
          const data = await res.json()
          setBooks(data)
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    fetchFeatured()
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        className="text-center mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-400/20 flex items-center justify-center border border-yellow-400/30">
          <Sparkles size={32} className="text-yellow-400" />
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-galaxy-text mb-2">
          Featured Books
        </h1>
        <p className="text-galaxy-text-muted font-body text-lg max-w-md mx-auto">
          Amazing stories written by young authors just like you!
        </p>
      </motion.div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="text-galaxy-primary animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && books.length === 0 && (
        <motion.div
          className="text-center py-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-6xl mb-4">📚</p>
          <h2 className="font-heading text-xl font-bold text-galaxy-text mb-2">
            The gallery is getting ready!
          </h2>
          <p className="text-galaxy-text-muted font-body mb-6">
            Amazing stories are being added soon. Why not write the first featured book?
          </p>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-galaxy-primary text-white font-body font-semibold hover:bg-galaxy-primary/80 transition-colors"
          >
            <BookOpen size={18} /> Start Writing
          </Link>
        </motion.div>
      )}

      {/* Book grid */}
      {books.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {books.map((book, i) => (
            <BookCard key={book.slug} book={book} index={i} />
          ))}
        </div>
      )}

      {/* CTA */}
      {books.length > 0 && (
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-galaxy-text-muted font-body text-sm mb-3">
            Want your book featured here?
          </p>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-galaxy-primary text-white font-body font-semibold hover:bg-galaxy-primary/80 transition-colors"
          >
            <BookOpen size={18} /> Write Your Story
          </Link>
        </motion.div>
      )}
    </div>
  )
}

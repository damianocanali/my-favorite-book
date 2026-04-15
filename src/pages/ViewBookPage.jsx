import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { BookOpen, Share2, Loader2, ArrowLeft, Trash2 } from 'lucide-react'
import { apiFetch } from '../lib/api'
import BookPreview from '../components/book/BookPreview'
import { useAuthStore } from '../stores/useAuthStore'

const STICKERS = ['❤️', '⭐', '😍', '🎉', '👏', '🦄', '🌈', '🔥', '💎', '🫶']

export default function ViewBookPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [book, setBook] = useState(null)
  const [publishedUserId, setPublishedUserId] = useState(null)
  const [reactions, setReactions] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [justReacted, setJustReacted] = useState(null)
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    async function fetchBook() {
      try {
        const res = await apiFetch(`/api/publish-book?slug=${slug}`)
        if (!res.ok) throw new Error('Book not found')
        const data = await res.json()
        setBook(data.book_data)
        setPublishedUserId(data.user_id)
        setReactions(data.reaction_counts || {})
      } catch {
        setError('This book could not be found. It may have been removed.')
      } finally {
        setLoading(false)
      }
    }
    fetchBook()
  }, [slug])

  const handleRemove = async () => {
    setRemoving(true)
    try {
      const res = await apiFetch('/api/unpublish-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, userId: user.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      navigate('/gallery')
    } catch (err) {
      alert(`Failed to remove: ${err.message}`)
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  const handleReaction = async (sticker) => {
    setJustReacted(sticker)
    // Optimistic update
    setReactions((prev) => ({ ...prev, [sticker]: (prev[sticker] || 0) + 1 }))
    setTimeout(() => setJustReacted(null), 1200)

    try {
      const res = await apiFetch('/api/react-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, sticker }),
      })
      if (res.ok) {
        const data = await res.json()
        setReactions(data.reaction_counts)
      }
    } catch {
      // Silent fail — optimistic update stays
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: book?.title || 'My Favorite Book', url })
        return
      } catch { /* user cancelled */ }
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const totalReactions = Object.values(reactions).reduce((sum, n) => sum + n, 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={40} className="text-galaxy-primary animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-6xl mb-4">📖</p>
          <h1 className="font-heading text-2xl font-bold text-galaxy-text mb-2">Book Not Found</h1>
          <p className="text-galaxy-text-muted font-body mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-galaxy-primary text-white font-body font-semibold hover:bg-galaxy-primary/80 transition-colors"
          >
            <ArrowLeft size={16} /> Go Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-6">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/gallery"
              className="text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="min-w-0">
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-galaxy-text truncate">
                {book.title}
              </h1>
              <p className="text-galaxy-text-muted font-body text-sm">
                by {book.authorName}{book.authorAge ? `, age ${book.authorAge}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user && publishedUserId === user.id && (
              confirmRemove ? (
                <div className="flex items-center gap-2">
                  <span className="text-galaxy-text-muted font-body text-xs">Remove from gallery?</span>
                  <button
                    onClick={handleRemove}
                    disabled={removing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-body font-semibold"
                  >
                    {removing ? <Loader2 size={14} className="animate-spin" /> : 'Yes, remove'}
                  </button>
                  <button
                    onClick={() => setConfirmRemove(false)}
                    className="text-galaxy-text-muted hover:text-galaxy-text transition-colors text-sm font-body"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemove(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-galaxy-bg-light border border-galaxy-text-muted/20 text-galaxy-text-muted hover:text-red-400 hover:border-red-400/40 transition-colors text-sm font-body"
                >
                  <Trash2 size={16} />
                  Remove
                </button>
              )
            )}
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-galaxy-bg-light border border-galaxy-text-muted/20 text-galaxy-text-muted hover:text-galaxy-text hover:border-galaxy-primary/40 transition-colors text-sm font-body"
            >
              <Share2 size={16} />
              {copied ? 'Link Copied!' : 'Share'}
            </button>
          </div>
        </div>
      </div>

      {/* Book Viewer */}
      <div className="flex justify-center mb-8">
        <BookPreview book={book} />
      </div>

      {/* Sticker Reactions */}
      <motion.div
        className="max-w-lg mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-center text-galaxy-text font-heading font-bold text-base mb-1">
          Leave a Sticker! 🎉
        </p>
        <p className="text-center text-galaxy-text-muted font-body text-sm mb-3">
          {totalReactions > 0
            ? `${totalReactions} sticker${totalReactions === 1 ? '' : 's'} so far — keep them coming!`
            : 'Tap a sticker to show this author some love!'}
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          {STICKERS.map((sticker) => (
            <motion.button
              key={sticker}
              onClick={() => handleReaction(sticker)}
              className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-galaxy-bg-light border border-galaxy-text-muted/10 hover:border-galaxy-primary/40 hover:bg-galaxy-primary/5 transition-colors"
              whileHover={{ scale: 1.15, rotate: [0, -10, 10, 0] }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <span className="text-2xl">{sticker}</span>
              {reactions[sticker] > 0 && (
                <span className="text-galaxy-text-muted font-body text-[10px] font-bold">
                  {reactions[sticker]}
                </span>
              )}

              {/* Burst animation when reacted */}
              <AnimatePresence>
                {justReacted === sticker && (
                  <>
                    {[...Array(5)].map((_, i) => (
                      <motion.span
                        key={i}
                        className="absolute text-xl pointer-events-none"
                        initial={{ opacity: 1, x: 0, y: 0, scale: 0.5 }}
                        animate={{
                          opacity: 0,
                          x: (Math.random() - 0.5) * 80,
                          y: -20 - Math.random() * 40,
                          scale: 0.8 + Math.random() * 0.6,
                          rotate: (Math.random() - 0.5) * 90,
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 + Math.random() * 0.4 }}
                      >
                        {sticker}
                      </motion.span>
                    ))}
                  </>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* CTA */}
      <div className="text-center mt-8 mb-4">
        <p className="text-galaxy-text-muted font-body text-sm mb-3">
          Want to create your own book?
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-galaxy-primary text-white font-body font-semibold hover:bg-galaxy-primary/80 transition-colors"
        >
          <BookOpen size={18} /> Start Writing
        </Link>
      </div>
    </div>
  )
}

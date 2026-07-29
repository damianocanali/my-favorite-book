import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { BookOpen, Share2, Loader2, ArrowLeft, Trash2, X } from 'lucide-react'
import { apiFetch, apiFetchAuthed } from '../lib/api'
import BookPreview from '../components/book/BookPreview'
import PageActions from '../components/layout/PageActions'
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
      const res = await apiFetchAuthed('/api/publish-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unpublish', slug }),
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
    <div className="min-h-screen px-4 py-3 sm:py-6">
      {/* Actions go in the nav bar (same treatment as PreviewPage) so the
          book keeps the vertical space; every button is one .toolbar-btn
          box so they line up. */}
      <PageActions>
        <Link to="/gallery" className="toolbar-btn" title="Back to gallery">
          <ArrowLeft size={15} />
          <span className="toolbar-btn__label">Gallery</span>
        </Link>

        {user && publishedUserId === user.id && (
          confirmRemove ? (
            <>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="toolbar-btn toolbar-btn--danger"
                title="Confirm removal from the gallery"
              >
                {removing ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                <span className="toolbar-btn__label">Yes, remove</span>
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="toolbar-btn"
                title="Keep in gallery"
              >
                <span className="toolbar-btn__label">Cancel</span>
                <X size={15} className="lg:hidden" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="toolbar-btn"
              title="Remove from gallery"
            >
              <Trash2 size={15} />
              <span className="toolbar-btn__label">Remove</span>
            </button>
          )
        )}

        <button onClick={handleShare} className="toolbar-btn toolbar-btn--primary" title="Share this book">
          <Share2 size={15} />
          <span className="toolbar-btn__label">{copied ? 'Link Copied!' : 'Share'}</span>
        </button>
      </PageActions>

      {/* Title — one compact line, as on the preview screen */}
      <div className="text-center mb-3">
        <h1 className="font-heading text-xl font-bold text-galaxy-text">
          {book.title}
          <span className="ml-2 font-body text-sm font-normal text-galaxy-text-muted">
            by {book.authorName}
            {book.authorAge ? `, age ${book.authorAge}` : ''}
          </span>
        </h1>
      </div>

      {/* Book Viewer */}
      <div className="flex justify-center">
        <BookPreview book={book} />
      </div>

      {/* Sticker Reactions. The reader is sized to fill the screen down to
          the tab bar, so anything after it starts exactly at the fold —
          without this margin the sticker row rendered underneath the fixed
          tab bar. Pushing it clear puts it just below the fold, where a
          short scroll reveals it properly. */}
      <motion.div
        className="max-w-lg mx-auto mt-28 sm:mt-32"
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
              className="relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl glass border border-galaxy-text-muted/10 hover:border-galaxy-primary/40 hover:bg-galaxy-primary/5 transition-colors"
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

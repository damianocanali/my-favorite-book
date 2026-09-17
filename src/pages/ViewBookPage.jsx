import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Share2, Loader2, ArrowLeft, Trash2, X } from 'lucide-react'
import { apiFetch, apiFetchAuthed } from '../lib/api'
import { formatNumber } from '../i18n/formats'
import BookPreview from '../components/book/BookPreview'
import PageActions from '../components/layout/PageActions'
import { useAuthStore } from '../stores/useAuthStore'

const STICKERS = ['❤️', '⭐', '😍', '🎉', '👏', '🦄', '🌈', '🔥', '💎', '🫶']

export default function ViewBookPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
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
        setError(t('gallery:view.not_found_body'))
      } finally {
        setLoading(false)
      }
    }
    fetchBook()
    // `t` is deliberately not a dep: re-running this would refetch the book
    // on every language change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      alert(t('gallery:view.remove_failed', { message: err.message }))
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
          <h1 className="font-heading text-2xl font-bold text-galaxy-text mb-2">{t('gallery:view.not_found_title')}</h1>
          <p className="text-galaxy-text-muted font-body mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-galaxy-primary text-white font-body font-semibold hover:bg-galaxy-primary/80 transition-colors"
          >
            <ArrowLeft size={16} /> {t('gallery:view.go_home')}
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
        <Link to="/gallery" className="toolbar-btn" title={t('gallery:view.back_title')}>
          <ArrowLeft size={15} />
          <span className="toolbar-btn__label">{t('gallery:view.back_label')}</span>
        </Link>

        {user && publishedUserId === user.id && (
          confirmRemove ? (
            <>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="toolbar-btn toolbar-btn--danger"
                title={t('gallery:view.confirm_remove_title')}
              >
                {removing ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                <span className="toolbar-btn__label">{t('gallery:view.confirm_remove_label')}</span>
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="toolbar-btn"
                title={t('gallery:view.cancel_remove_title')}
              >
                <span className="toolbar-btn__label">{t('common:actions.cancel')}</span>
                <X size={15} className="lg:hidden" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="toolbar-btn"
              title={t('gallery:actions.remove_from_gallery')}
            >
              <Trash2 size={15} />
              <span className="toolbar-btn__label">{t('gallery:view.remove_label')}</span>
            </button>
          )
        )}

        <button onClick={handleShare} className="toolbar-btn toolbar-btn--primary" title={t('gallery:view.share_title')}>
          <Share2 size={15} />
          <span className="toolbar-btn__label">{copied ? t('gallery:view.share_copied') : t('gallery:view.share')}</span>
        </button>
      </PageActions>

      {/* Title — one compact line, as on the preview screen */}
      <div className="text-center mb-3">
        <h1 className="font-heading text-xl font-bold text-galaxy-text">
          {book.title}
          <span className="ml-2 font-body text-sm font-normal text-galaxy-text-muted">
            {book.authorAge
              ? t('gallery:byline.plain_with_age', { name: book.authorName, age: book.authorAge })
              : t('gallery:byline.plain', { name: book.authorName })}
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
          {t('gallery:view.sticker_prompt')}
        </p>
        <p className="text-center text-galaxy-text-muted font-body text-sm mb-3">
          {totalReactions > 0
            ? t('gallery:view.sticker_count', { count: totalReactions })
            : t('gallery:view.sticker_empty')}
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
                  {formatNumber(reactions[sticker])}
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
          {t('gallery:view.own_book_cta')}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-galaxy-primary text-white font-body font-semibold hover:bg-galaxy-primary/80 transition-colors"
        >
          <BookOpen size={18} /> {t('gallery:actions.start_writing')}
        </Link>
      </div>
    </div>
  )
}

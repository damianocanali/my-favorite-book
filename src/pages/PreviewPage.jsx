import { useState } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Edit3, Printer, FileDown, Send, X, Shield, Globe, Check, Loader2 } from 'lucide-react'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { useBookStore } from '../stores/useBookStore'
import { useSubscription } from '../hooks/useSubscription'
import { useAuthStore } from '../stores/useAuthStore'
import BookPreview from '../components/book/BookPreview'
import PageActions from '../components/layout/PageActions'
import PrintableBook from '../components/print/PrintableBook'
import SubmitToClassModal from '../components/classroom/SubmitToClassModal'
import BookFinishedModal from '../components/print/BookFinishedModal'
import SparkleButton from '../components/ui/SparkleButton'
import { isNative } from '../capacitor'
import { apiFetchAuthed } from '../lib/api'
import { useRewardsStore } from '../stores/useRewardsStore'
import { celebrateBig } from '../lib/celebrate'

export default function PreviewPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const getBook = useBookshelfStore((state) => state.getBook)
  const loadBook = useBookStore((state) => state.loadBook)
  const setStep = useBookStore((state) => state.setStep)
  const [searchParams] = useSearchParams()
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const earnBadge = useRewardsStore((s) => s.earnBadge)
  const [publishing, setPublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState(null)
  const [finishedOpen, setFinishedOpen] = useState(searchParams.get('celebrate') === '1')
  const { plan } = useSubscription()
  const user = useAuthStore((s) => s.user)

  const book = getBook(bookId)

  const handleEdit = () => {
    loadBook(book)
    setStep(7)
    navigate('/create')
  }

  const handlePrint = () => {
    if (!plan.pdfExport) {
      navigate('/pricing')
      return
    }
    window.print()
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      const res = await apiFetchAuthed('/api/publish-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const appOrigin = import.meta.env.VITE_API_BASE_URL || window.location.origin
      const fullUrl = `${appOrigin}/view/${data.slug}`
      setPublishedUrl(fullUrl)
      if (navigator.clipboard) navigator.clipboard.writeText(fullUrl)
      // Shipping a book is the headline moment — blast confetti.
      celebrateBig()
      earnBadge('published_book')
    } catch {
      alert(t('editor:preview.publish_failed'))
    } finally {
      setPublishing(false)
    }
  }

  if (!book) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <p className="text-galaxy-text-muted font-body text-xl mb-4">
          {t('editor:preview.not_found')}
        </p>
        <SparkleButton onClick={() => navigate('/bookshelf')} variant="secondary">
          {t('editor:preview.back_to_bookshelf')}
        </SparkleButton>
      </div>
    )
  }

  return (
    <div className={isNative ? 'py-2 px-2 flex flex-col h-[calc(100dvh-60px)]' : 'py-3 px-4'}>
      {/* Actions live in the nav bar so the book gets the vertical space.
          Every button shares .toolbar-btn, so they're all the same height
          and radius — Edit used to be a SparkleButton and stood out. */}
      <PageActions>
        <button
          onClick={() => navigate('/bookshelf')}
          className="toolbar-btn"
          title={t('editor:preview.bookshelf_title')}
        >
          <ArrowLeft size={15} />
          <span className="toolbar-btn__label">{t('editor:preview.bookshelf')}</span>
        </button>

        <button
          onClick={() => setShowSubmitModal(true)}
          className="toolbar-btn toolbar-btn--cyan"
          title={t('editor:preview.submit_title')}
        >
          <Send size={15} />
          <span className="toolbar-btn__label">{t('editor:preview.submit')}</span>
        </button>

        {user && !publishedUrl && (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="toolbar-btn toolbar-btn--primary"
            title={t('editor:preview.publish_title')}
          >
            {publishing ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />}
            <span className="toolbar-btn__label">
              {publishing ? t('editor:preview.publishing') : t('editor:preview.publish')}
            </span>
          </button>
        )}
        {publishedUrl && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(publishedUrl)
              if (navigator.share) navigator.share({ title: book.title, url: publishedUrl })
            }}
            className="toolbar-btn toolbar-btn--green"
            title={t('editor:preview.copy_link_title')}
          >
            <Check size={15} />
            <span className="toolbar-btn__label">{t('editor:preview.share_link')}</span>
          </button>
        )}

        <button
          onClick={() => navigate(`/order/${book.id}`)}
          className="toolbar-btn"
          title={t('editor:preview.order_print_title')}
        >
          <Printer size={15} />
          <span className="toolbar-btn__label">{t('common:actions.print')}</span>
        </button>

        {!isNative && (
          <button
            onClick={handlePrint}
            className="toolbar-btn"
            title={plan.pdfExport ? t('editor:preview.pdf_title') : t('editor:preview.pdf_locked_title')}
          >
            <FileDown size={15} />
            <span className="toolbar-btn__label">
              {plan.pdfExport ? t('editor:preview.pdf') : t('editor:preview.pdf_locked')}
            </span>
          </button>
        )}

        <button onClick={handleEdit} className="toolbar-btn toolbar-btn--primary" title={t('editor:preview.edit_title')}>
          <Edit3 size={15} />
          <span className="toolbar-btn__label">{t('common:actions.edit')}</span>
        </button>
      </PageActions>

      {/* Title — one compact line so it costs the book as little as possible */}
      <motion.div
        className={`text-center ${isNative ? 'mb-2' : 'mb-3'}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className={`font-heading font-bold text-galaxy-text ${isNative ? 'text-lg' : 'text-xl'}`}>
          {book.title}
          <span className="ml-2 font-body text-sm font-normal text-galaxy-text-muted">
            {t('editor:book.by_author', { author: book.authorName })}
          </span>
        </h1>
      </motion.div>

      {/* Book preview */}
      <div className={isNative ? 'flex-1 flex items-center justify-center' : ''}>
        <BookPreview book={book} />
      </div>

      {/* Published celebration */}
      <AnimatePresence>
        {publishedUrl && (
          <motion.div
            className="max-w-md mx-auto mt-6 relative"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            {/* Sparkle particles */}
            {['⭐', '✨', '🎉', '🌟', '💫'].map((emoji, i) => (
              <motion.span
                key={i}
                className="absolute text-2xl pointer-events-none"
                style={{ left: `${20 + i * 15}%`, top: '-10px' }}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -40 - Math.random() * 30, x: (Math.random() - 0.5) * 60 }}
                transition={{ duration: 1.2, delay: i * 0.1 }}
              >
                {emoji}
              </motion.span>
            ))}
            <div className="bg-green-400/10 border border-green-400/30 rounded-2xl px-5 py-4 text-center">
              <p className="font-heading text-lg font-bold text-green-400 mb-1">
                {t('editor:preview.published_title')}
              </p>
              <p className="text-galaxy-text-muted font-body text-xs mb-3">
                {t('editor:preview.published_body')}
              </p>
              <div className="flex items-center gap-2 bg-galaxy-bg rounded-xl px-3 py-2 border border-galaxy-text-muted/10">
                <p className="text-galaxy-text font-body text-xs truncate flex-1">{publishedUrl}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(publishedUrl)
                    if (navigator.share) navigator.share({ title: book.title, url: publishedUrl })
                  }}
                  className="shrink-0 px-3 py-1 rounded-lg bg-green-400/20 text-green-400 text-xs font-body font-semibold hover:bg-green-400/30 transition-colors"
                >
                  {t('common:actions.copy')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tip */}
      {!isNative && !publishedUrl && (
        <motion.p
          className="text-center text-galaxy-text-muted text-sm font-body mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          {t('editor:preview.flip_hint')}
        </motion.p>
      )}

      {/* Hidden print layout — only visible during window.print() */}
      <PrintableBook book={book} />

      {/* Guest sign-up nudge */}
      <AnimatePresence>
        {!user && !nudgeDismissed && !isNative && (
          <motion.div
            // Sits above the tab bar AND the flip controls — at the old
            // 1.5rem it landed right on top of the page arrows.
            className="fixed bottom-[calc(9rem+var(--sab,0px))] left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ delay: 1.2, type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div className="glass border border-galaxy-primary/40 rounded-2xl px-5 py-4 shadow-glow flex items-start gap-3">
              <Shield size={20} className="text-galaxy-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-galaxy-text font-body text-sm font-semibold mb-0.5">
                  {t('editor:preview.guest_nudge_title')}
                </p>
                <p className="text-galaxy-text-muted font-body text-xs">
                  {t('editor:preview.guest_nudge_body')}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <Link
                    to="/signup"
                    className="px-4 py-1.5 rounded-full bg-galaxy-primary text-white text-xs font-body font-semibold hover:bg-galaxy-primary/80 transition-colors"
                  >
                    {t('editor:preview.guest_nudge_signup')}
                  </Link>
                  <Link
                    to="/login"
                    className="text-galaxy-text-muted text-xs font-body hover:text-galaxy-text transition-colors"
                  >
                    {t('auth:shared.sign_in')}
                  </Link>
                </div>
              </div>
              <button
                onClick={() => setNudgeDismissed(true)}
                className="text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit to class modal */}
      {showSubmitModal && (
        <SubmitToClassModal book={book} onClose={() => setShowSubmitModal(false)} />
      )}

      <BookFinishedModal
        open={finishedOpen}
        book={book}
        onClose={() => setFinishedOpen(false)}
      />
    </div>
  )
}

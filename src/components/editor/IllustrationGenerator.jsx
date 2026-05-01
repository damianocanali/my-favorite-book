import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ImageIcon, Loader2, RefreshCw, Trash2, Lock, Wand2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useBookStore } from '../../stores/useBookStore'
import { useRewardsStore } from '../../stores/useRewardsStore'
import { useSubscription } from '../../hooks/useSubscription'
import { generatePageIllustration, editPageIllustration } from '../../services/imageGenerator'

// Hard cap on regenerations per page across all users. Cost-protection
// safety net: a page is a small artifact and 5 retries is far more than
// any legitimate iteration needs. To start over, the user clears the
// illustration (resets the counter to 0).
const MAX_REGENS_PER_PAGE = 5

export default function IllustrationGenerator({ page }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tweakOpen, setTweakOpen] = useState(false)
  const [tweakText, setTweakText] = useState('')
  const navigate = useNavigate()

  const book = useBookStore((state) => state.book)
  const updatePageIllustration = useBookStore((state) => state.updatePageIllustration)
  const getImageGenerationsToday = useBookStore((s) => s.getImageGenerationsToday)
  const incrementImageGenerations = useBookStore((s) => s.incrementImageGenerations)
  const earnBadge = useRewardsStore((s) => s.earnBadge)
  const { plan, isPaid } = useSubscription()

  const hasIllustration = !!page.illustrationData
  const regenCount = page.illustrationRegenCount ?? 0
  const atPageRegenLimit = regenCount >= MAX_REGENS_PER_PAGE

  // Daily per-user cap. Plans now define a real number (not Infinity) for
  // every tier as a cost-protection layer; we enforce it for every user.
  const usedToday = getImageGenerationsToday()
  const atLimit = usedToday >= plan.imagesPerDay
  const remaining = plan.imagesPerDay - usedToday

  const handleGenerate = async () => {
    if (!book) return
    if (atLimit) return
    if (atPageRegenLimit) return
    setLoading(true)
    setError(null)

    try {
      const imageData = await generatePageIllustration(page, book)
      updatePageIllustration(page.id, imageData)
      incrementImageGenerations()
      earnBadge('added_illustration')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    updatePageIllustration(page.id, null)
  }

  const handleTweak = async () => {
    if (!book) return
    if (!hasIllustration) return
    if (atLimit) return
    if (atPageRegenLimit) return
    const instruction = tweakText.trim()
    if (!instruction) return
    setLoading(true)
    setError(null)
    try {
      const imageData = await editPageIllustration(page, book, instruction)
      updatePageIllustration(page.id, imageData)
      incrementImageGenerations()
      setTweakText('')
      setTweakOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1.5 z-10">
      {/* Tweak panel — only when an illustration exists and the user has
          opened it via the Wand button. Editing keeps the composition and
          applies a small text instruction. */}
      <AnimatePresence>
        {tweakOpen && hasIllustration && !atLimit && !atPageRegenLimit && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="bg-galaxy-bg-light/95 backdrop-blur-md border border-galaxy-primary/30 rounded-xl shadow-lg p-2 flex items-center gap-1.5 max-w-[280px]"
          >
            <input
              type="text"
              autoFocus
              value={tweakText}
              onChange={(e) => setTweakText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTweak() }}
              placeholder="What to change? e.g. add stars"
              className="bg-transparent text-galaxy-text text-[11px] font-body flex-1 min-w-0 outline-none placeholder:text-galaxy-text-muted/60"
              maxLength={120}
              disabled={loading}
            />
            <button
              onClick={handleTweak}
              disabled={loading || !tweakText.trim()}
              className="flex items-center justify-center w-6 h-6 rounded-md bg-galaxy-primary text-white disabled:opacity-40 disabled:cursor-not-allowed"
              title="Apply tweak"
            >
              {loading ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
            </button>
            <button
              onClick={() => { setTweakOpen(false); setTweakText('') }}
              className="flex items-center justify-center w-6 h-6 rounded-md text-galaxy-text-muted hover:text-galaxy-text"
              title="Close"
            >
              <X size={11} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-1.5">
      {hasIllustration && (
        <motion.button
          onClick={handleClear}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-body font-semibold hover:bg-red-500/30 transition-colors cursor-pointer backdrop-blur-sm"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Remove illustration"
        >
          <Trash2 size={10} />
        </motion.button>
      )}

      {hasIllustration && !atLimit && !atPageRegenLimit && (
        <motion.button
          onClick={() => setTweakOpen((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-[10px] font-body font-semibold hover:bg-cyan-500/30 transition-colors cursor-pointer backdrop-blur-sm"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Tweak this image (small change, keeps composition)"
        >
          <Wand2 size={10} />
        </motion.button>
      )}

      {atLimit ? (
        <motion.button
          onClick={() => navigate('/pricing')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-body font-semibold bg-galaxy-text-muted/20 text-galaxy-text-muted border border-galaxy-text-muted/20 backdrop-blur-sm cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Daily limit reached — upgrade for unlimited"
        >
          <Lock size={12} />
          Limit reached today
        </motion.button>
      ) : atPageRegenLimit ? (
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-body font-semibold bg-galaxy-text-muted/20 text-galaxy-text-muted border border-galaxy-text-muted/20 backdrop-blur-sm"
          title={`Max ${MAX_REGENS_PER_PAGE} redraws per page. Clear and try again to start over.`}
        >
          <Lock size={12} />
          Max redraws — clear to retry
        </div>
      ) : (
        <motion.button
          onClick={handleGenerate}
          disabled={loading || (!page.text.trim() && page.pageNumber > 1)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-body font-semibold transition-all cursor-pointer backdrop-blur-sm ${
            loading
              ? 'bg-galaxy-primary/30 text-galaxy-primary'
              : 'bg-galaxy-primary/20 text-galaxy-primary hover:bg-galaxy-primary/30 border border-galaxy-primary/30'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          whileHover={loading ? {} : { scale: 1.05 }}
          whileTap={loading ? {} : { scale: 0.95 }}
          title={hasIllustration ? 'Regenerate illustration' : 'Generate illustration'}
        >
          {loading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Drawing...
            </>
          ) : hasIllustration ? (
            <>
              <RefreshCw size={12} />
              Redraw
            </>
          ) : (
            <>
              <ImageIcon size={12} />
              Draw This Page
            </>
          )}
        </motion.button>
      )}

      </div>

      {error && (
        <div className="absolute bottom-full right-0 mb-1 p-2 bg-red-500/20 border border-red-500/30 rounded-lg max-w-[200px] backdrop-blur-sm">
          <p className="text-red-400 text-[10px] font-body">{error}</p>
        </div>
      )}
    </div>
  )
}

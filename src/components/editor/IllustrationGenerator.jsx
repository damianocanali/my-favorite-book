import { useState } from 'react'
import { motion } from 'motion/react'
import { ImageIcon, Loader2, RefreshCw, Trash2, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useBookStore } from '../../stores/useBookStore'
import { useRewardsStore } from '../../stores/useRewardsStore'
import { useSubscription } from '../../hooks/useSubscription'
import { generatePageIllustration } from '../../services/imageGenerator'

// Hard cap on regenerations per page across all users. Cost-protection
// safety net: a page is a small artifact and 5 retries is far more than
// any legitimate iteration needs. To start over, the user clears the
// illustration (resets the counter to 0).
const MAX_REGENS_PER_PAGE = 5

export default function IllustrationGenerator({ page }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
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

  return (
    <div className="absolute bottom-2 right-2 flex gap-1.5 z-10">
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

      {error && (
        <div className="absolute bottom-full right-0 mb-1 p-2 bg-red-500/20 border border-red-500/30 rounded-lg max-w-[200px] backdrop-blur-sm">
          <p className="text-red-400 text-[10px] font-body">{error}</p>
        </div>
      )}
    </div>
  )
}

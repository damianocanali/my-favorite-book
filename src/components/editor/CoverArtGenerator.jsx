import { useState } from 'react'
import { motion } from 'motion/react'
import { ImageIcon, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useBookStore } from '../../stores/useBookStore'
import { generateCoverArt } from '../../services/imageGenerator'

export default function CoverArtGenerator() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const book = useBookStore((state) => state.book)
  const setCoverImage = useBookStore((state) => state.setCoverImage)

  if (!book) return null

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const imageData = await generateCoverArt(book)
      setCoverImage(imageData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6">
      {/* Cover preview + generate */}
      <div className="flex items-center gap-4 bg-galaxy-bg-light rounded-xl p-4 border border-galaxy-text-muted/10">
        {/* Mini cover preview */}
        <div
          className="w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 shadow-md"
          style={{ backgroundColor: book.colors?.cover ?? '#8B5CF6' }}
        >
          {book.coverImage ? (
            <img src={book.coverImage} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-2xl">{book.characters?.[0]?.emoji ?? '📖'}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-galaxy-text font-body font-semibold text-sm">Book Cover Art</p>
          <p className="text-galaxy-text-muted text-xs font-body">
            {book.coverImage ? 'AI-generated cover' : 'Generate a custom cover illustration'}
          </p>
          {error && <p className="text-red-400 text-xs font-body mt-1">{error}</p>}
        </div>

        <div className="flex gap-2">
          {book.coverImage && (
            <motion.button
              onClick={() => setCoverImage(null)}
              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Remove cover"
            >
              <Trash2 size={14} />
            </motion.button>
          )}
          <motion.button
            onClick={handleGenerate}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-body font-semibold transition-all cursor-pointer ${
              loading
                ? 'bg-galaxy-primary/30 text-galaxy-primary'
                : 'bg-galaxy-primary text-white hover:bg-purple-500'
            } disabled:opacity-50`}
            whileHover={loading ? {} : { scale: 1.05 }}
            whileTap={loading ? {} : { scale: 0.95 }}
          >
            {loading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Creating...
              </>
            ) : book.coverImage ? (
              <>
                <RefreshCw size={12} />
                New Cover
              </>
            ) : (
              <>
                <ImageIcon size={12} />
                Generate Cover
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  )
}

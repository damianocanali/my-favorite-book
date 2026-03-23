import { motion } from 'motion/react'
import { useBookStore } from '../../stores/useBookStore'
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive'
import StoryBuddy from './StoryBuddy'
import IllustrationGenerator from './IllustrationGenerator'

export default function PageEditor({ page }) {
  const updatePageText = useBookStore((state) => state.updatePageText)
  const book = useBookStore((state) => state.book)
  const adaptive = useAgeAdaptive()

  const bookColors = book?.colors ?? { cover: '#8B5CF6', accent: '#06B6D4', text: '#F1F5F9' }

  return (
    <motion.div
      className="bg-galaxy-bg-light rounded-2xl border border-galaxy-text-muted/10 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Illustration area */}
      <div
        className="relative h-48 sm:h-64 flex items-center justify-center overflow-hidden"
        style={{
          background: page.illustrationData
            ? undefined
            : `linear-gradient(135deg, ${bookColors.cover}20, ${bookColors.accent}20)`,
        }}
      >
        {/* AI-generated illustration */}
        {page.illustrationData ? (
          <img
            src={page.illustrationData}
            alt={`Illustration for page ${page.pageNumber}`}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Emoji fallback: Scene and characters display */
          <div className="text-center">
            {book?.setting && (
              <span className="text-6xl sm:text-8xl block mb-2">{book.setting.emoji}</span>
            )}
            <div className="flex justify-center gap-4">
              {book?.characters?.map((char) => (
                <motion.span
                  key={char.id}
                  className="text-3xl sm:text-4xl"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: Math.random() }}
                >
                  {char.emoji}
                </motion.span>
              ))}
            </div>
          </div>
        )}

        {/* Page number badge */}
        <div
          className="absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-heading font-bold shadow-lg"
          style={{ backgroundColor: bookColors.cover, color: bookColors.text }}
        >
          {page.pageNumber}
        </div>

        {/* Illustration generator button */}
        <IllustrationGenerator page={page} />
      </div>

      {/* Text area */}
      <div className="p-4 sm:p-6">
        <textarea
          value={page.text}
          onChange={(e) => updatePageText(page.id, e.target.value)}
          placeholder={
            page.pageNumber === 1
              ? 'Once upon a time...'
              : 'Continue your story...'
          }
          className={`w-full bg-transparent border-none outline-none resize-none text-galaxy-text placeholder:text-galaxy-text-muted/40 font-body leading-relaxed ${adaptive.fontSize.input}`}
          rows={adaptive.mode === 'young' ? 4 : 6}
          maxLength={adaptive.charLimit}
        />
        <div className="flex justify-between items-center mt-2">
          <p className="text-galaxy-text-muted text-xs font-body">
            {page.text.length}/{adaptive.charLimit} characters
          </p>
          {book?.timePeriod && (
            <p className="text-galaxy-text-muted text-xs font-body">
              {book.timePeriod.emoji} {book.timePeriod.label}
            </p>
          )}
        </div>

        {/* Story Buddy AI Helper */}
        <StoryBuddy
          page={page}
          onInsertText={(text) => updatePageText(page.id, text)}
        />
      </div>
    </motion.div>
  )
}

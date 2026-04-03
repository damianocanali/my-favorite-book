import { useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useBookStore } from '../../stores/useBookStore'
import { useAccessibilityStore } from '../../stores/useAccessibilityStore'
import { useAgeAdaptive } from '../../hooks/useAgeAdaptive'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import StoryBuddy from './StoryBuddy'
import IllustrationGenerator from './IllustrationGenerator'
import AccessibilityToolbar from './AccessibilityToolbar'
import WritingScaffold from './WritingScaffold'
import { useRewardsStore } from '../../stores/useRewardsStore'

export default function PageEditor({ page }) {
  const updatePageText = useBookStore((state) => state.updatePageText)
  const book = useBookStore((state) => state.book)
  const adaptive = useAgeAdaptive()
  const dyslexiaFont = useAccessibilityStore((s) => s.dyslexiaFont)

  const earnBadge = useRewardsStore((s) => s.earnBadge)
  const bookColors = book?.colors ?? { cover: '#8B5CF6', accent: '#06B6D4', text: '#F1F5F9' }

  const characterDelays = useMemo(() => {
    const delays = {}
    for (const c of book?.characters ?? []) {
      delays[c.id] = Math.random() * 1.5
    }
    return delays
  // Recompute only when the set of character IDs changes, not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(book?.characters ?? []).map((c) => c.id).join(',')])

  // --- Text-to-speech ---
  const { speak, stop: stopSpeaking, isSpeaking, currentWordIndex, words, isSupported: ttsSupported } = useSpeechSynthesis()
  const handleReadAloud = useCallback(() => speak(page.text), [speak, page.text])

  // --- Voice input ---
  const handleVoiceResult = useCallback((transcript) => {
    const current = page.text
    const separator = current && !current.endsWith(' ') ? ' ' : ''
    updatePageText(page.id, current + separator + transcript.trim())
    earnBadge('used_voice')
  }, [page.text, page.id, updatePageText, earnBadge])

  const { start: startVoice, stop: stopVoice, isListening, interimText, isSupported: voiceSupported } = useSpeechRecognition({ onResult: handleVoiceResult })

  // Font class based on dyslexia toggle
  const fontClass = dyslexiaFont ? 'font-dyslexic' : 'font-body'

  // Auto-expanding textarea
  const textareaRef = useRef(null)
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [page.text])

  const handleTextareaFocus = useCallback(() => {
    // Wait for iOS keyboard to appear, then scroll input into view
    setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
  }, [])

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
        {page.illustrationData ? (
          <>
            <img
              src={page.illustrationData}
              alt={`Illustration for page ${page.pageNumber}`}
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-1 left-2 text-[9px] font-body text-white/40 drop-shadow-sm pointer-events-none">
              AI-generated — may not be perfect
            </span>
          </>
        ) : (
          <div className="text-center">
            {book?.setting && (
              <span className="text-5xl sm:text-7xl block mb-2">{book.setting.emoji}</span>
            )}
            <div className="flex justify-center gap-4">
              {book?.characters?.map((char) => (
                <motion.span
                  key={char.id}
                  className="text-3xl sm:text-4xl"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: characterDelays[char.id] ?? 0 }}
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

        <IllustrationGenerator page={page} />
      </div>

      {/* Text area */}
      <div className="p-4 sm:p-6 space-y-3">

        {/* Read-aloud word-highlight overlay — shown while speaking */}
        <AnimatePresence>
          {isSpeaking && words.length > 0 && (
            <motion.div
              className={`w-full p-4 bg-galaxy-bg rounded-xl border border-galaxy-secondary/30 leading-loose ${fontClass} ${adaptive.fontSize.input}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              aria-live="polite"
              aria-label="Reading aloud"
            >
              {words.map((word, i) => (
                <span
                  key={i}
                  className={`transition-colors duration-100 ${
                    i === currentWordIndex
                      ? 'bg-yellow-300 text-galaxy-bg rounded px-0.5 font-bold'
                      : 'text-galaxy-text'
                  }`}
                >
                  {word}{' '}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea — hidden while speaking to avoid confusion */}
        <div className={isSpeaking ? 'hidden' : ''}>
          <textarea
            ref={textareaRef}
            value={page.text}
            onChange={(e) => updatePageText(page.id, e.target.value)}
            onFocus={handleTextareaFocus}
            placeholder={
              page.pageNumber === 1
                ? 'Once upon a time...'
                : 'Continue your story...'
            }
            className={`w-full bg-transparent border-none outline-none resize-none text-galaxy-text placeholder:text-galaxy-text-muted/40 leading-relaxed ${fontClass} ${adaptive.fontSize.input}`}
            rows={adaptive.mode === 'young' ? 4 : 6}
            style={{ overflow: 'hidden' }}
            maxLength={adaptive.charLimit}
          />
        </div>

        {/* Voice input interim text */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              className="flex items-center gap-2 text-galaxy-accent text-sm font-body"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="w-2 h-2 rounded-full bg-galaxy-accent animate-pulse" />
              <span>{interimText || 'Listening...'}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Writing scaffolds — sentence starters, word bank, idle nudges */}
        <WritingScaffold
          page={page}
          totalPages={book?.pages?.length ?? 1}
          characterName={book?.characters?.[0]?.name}
          onInsertText={updatePageText}
        />

        {/* Character counter */}
        <div className="flex justify-between items-center">
          <p className="text-galaxy-text-muted text-xs font-body">
            {page.text.length}/{adaptive.charLimit} characters
          </p>
          {book?.timePeriod && (
            <p className="text-galaxy-text-muted text-xs font-body">
              {book.timePeriod.emoji} {book.timePeriod.label}
            </p>
          )}
        </div>

        {/* Accessibility toolbar */}
        <AccessibilityToolbar
          onReadAloud={handleReadAloud}
          onStopReading={stopSpeaking}
          onStartVoice={startVoice}
          onStopVoice={stopVoice}
          isSpeaking={isSpeaking}
          isListening={isListening}
          ttsSupported={ttsSupported}
          voiceSupported={voiceSupported}
        />

        {/* Story Buddy AI Helper */}
        <StoryBuddy
          page={page}
          onInsertText={(text) => {
            updatePageText(page.id, text)
            earnBadge('used_buddy')
          }}
        />
      </div>
    </motion.div>
  )
}

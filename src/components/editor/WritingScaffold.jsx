import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Lightbulb, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { getPromptsForPage, getIdleNudge } from '../../lib/sentenceStarters'

const IDLE_TIMEOUT_MS = 15000

export default function WritingScaffold({ page, totalPages, characterName, onInsertText }) {
  const [expanded, setExpanded] = useState(false)
  const [idleNudge, setIdleNudge] = useState(null)
  const [showWordBank, setShowWordBank] = useState(false)

  const prompts = useMemo(
    () => getPromptsForPage(page.pageNumber, totalPages),
    [page.pageNumber, totalPages]
  )

  // Idle nudge — shows a gentle prompt if text is empty and user hasn't typed for 15s
  useEffect(() => {
    if (page.text.length > 0) {
      setIdleNudge(null)
      return
    }

    const timer = setTimeout(() => {
      setIdleNudge(getIdleNudge(characterName))
    }, IDLE_TIMEOUT_MS)

    return () => clearTimeout(timer)
  }, [page.text, page.id, characterName])

  const handleInsert = useCallback((text) => {
    const current = page.text
    const separator = current && !current.endsWith(' ') ? ' ' : ''
    onInsertText(page.id, current + separator + text)
  }, [page.text, page.id, onInsertText])

  return (
    <div className="space-y-2">
      {/* Idle nudge */}
      <AnimatePresence>
        {idleNudge && (
          <motion.div
            className="flex items-start gap-2 p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/30"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Lightbulb size={16} className="text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-galaxy-text font-body text-sm">{idleNudge}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sentence starters toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-galaxy-secondary text-xs font-body font-semibold hover:text-galaxy-secondary/80 transition-colors"
      >
        <Sparkles size={13} />
        Need a spark? Tap a sentence starter
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {/* Sentence starters */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Starter phrases */}
            <div className="flex flex-wrap gap-1.5">
              {prompts.starters.map((s) => (
                <button
                  key={s}
                  onClick={() => handleInsert(s)}
                  className="px-3 py-1.5 rounded-full bg-galaxy-secondary/15 border border-galaxy-secondary/30 text-galaxy-text text-xs font-body hover:bg-galaxy-secondary/25 hover:border-galaxy-secondary/50 transition-colors"
                >
                  {s.trim()}
                </button>
              ))}
            </div>

            {/* Word bank toggle */}
            <button
              onClick={() => setShowWordBank(!showWordBank)}
              className="text-galaxy-text-muted text-xs font-body hover:text-galaxy-text transition-colors"
            >
              {showWordBank ? 'Hide word bank' : 'Show word bank (feelings & actions)'}
            </button>

            {/* Word bank */}
            <AnimatePresence>
              {showWordBank && (
                <motion.div
                  className="space-y-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div>
                    <p className="text-galaxy-text-muted text-xs font-body mb-1">Feelings:</p>
                    <div className="flex flex-wrap gap-1">
                      {prompts.feelings.map((w) => (
                        <button
                          key={w}
                          onClick={() => handleInsert(w + ' ')}
                          className="px-2 py-1 rounded-lg bg-purple-500/15 border border-purple-500/25 text-galaxy-text text-xs font-body hover:bg-purple-500/25 transition-colors"
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-galaxy-text-muted text-xs font-body mb-1">Actions:</p>
                    <div className="flex flex-wrap gap-1">
                      {prompts.actions.map((w) => (
                        <button
                          key={w}
                          onClick={() => handleInsert(w + ' ')}
                          className="px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-galaxy-text text-xs font-body hover:bg-cyan-500/25 transition-colors"
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

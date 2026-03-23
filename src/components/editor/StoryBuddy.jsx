import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Bot, Lightbulb, FileText, HelpCircle, Loader2, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useBookStore } from '../../stores/useBookStore'
import { getStoryStarters, getParagraphSuggestion, getGuidedQuestions } from '../../services/storyBuddy'

const MODES = [
  { id: 'starters', label: 'Sentence Starters', icon: Lightbulb, emoji: '💡', description: 'Get ideas to start writing' },
  { id: 'paragraph', label: 'Write for Me', icon: FileText, emoji: '📝', description: 'Get a full paragraph suggestion' },
  { id: 'questions', label: 'Help Me Think', icon: HelpCircle, emoji: '🤔', description: 'Answer fun questions to build your story' },
]

export default function StoryBuddy({ page, onInsertText }) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState('starters')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const book = useBookStore((state) => state.book)

  const handleGenerate = async () => {
    if (!book || !page) return
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      let result
      switch (mode) {
        case 'starters':
          result = await getStoryStarters(book, page)
          break
        case 'paragraph':
          result = await getParagraphSuggestion(book, page)
          break
        case 'questions':
          result = await getGuidedQuestions(book, page)
          break
      }
      setResults({ type: mode, data: result })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4">
      {/* Toggle button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-galaxy-secondary/10 border border-galaxy-secondary/30 text-galaxy-secondary hover:bg-galaxy-secondary/20 transition-all cursor-pointer font-body font-semibold text-sm mx-auto"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        <Bot size={18} />
        Story Buddy
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="mt-3 bg-galaxy-bg-light rounded-2xl border border-galaxy-secondary/20 overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🤖</span>
                  <div>
                    <h3 className="font-heading font-bold text-sm text-galaxy-text">Story Buddy</h3>
                    <p className="text-galaxy-text-muted text-xs font-body">Your AI writing helper!</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Mode selector */}
              <div className="flex gap-2 mb-3">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setMode(m.id); setResults(null); setError(null); }}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded-xl text-xs font-body font-semibold transition-all cursor-pointer ${
                      mode === m.id
                        ? 'bg-galaxy-secondary/20 text-galaxy-secondary border border-galaxy-secondary/40'
                        : 'bg-galaxy-bg text-galaxy-text-muted border border-galaxy-text-muted/10 hover:border-galaxy-secondary/20'
                    }`}
                  >
                    <span className="text-lg">{m.emoji}</span>
                    <span className="text-[10px] leading-tight text-center">{m.label}</span>
                  </button>
                ))}
              </div>

              {/* Generate button */}
              <motion.button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-galaxy-secondary text-white font-heading font-bold text-sm transition-all cursor-pointer disabled:opacity-50"
                whileHover={loading ? {} : { scale: 1.02 }}
                whileTap={loading ? {} : { scale: 0.98 }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    {mode === 'starters' && 'Get Sentence Starters'}
                    {mode === 'paragraph' && 'Write a Paragraph'}
                    {mode === 'questions' && 'Ask Me Questions'}
                  </>
                )}
              </motion.button>

              {/* Error */}
              {error && (
                <motion.div
                  className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <p className="text-red-400 text-xs font-body">{error}</p>
                </motion.div>
              )}

              {/* Results */}
              <AnimatePresence mode="wait">
                {results && (
                  <motion.div
                    className="mt-3 space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    key={results.type + Date.now()}
                  >
                    {results.type === 'starters' && Array.isArray(results.data) && (
                      <>
                        <p className="text-galaxy-text-muted text-xs font-body">Pick a starter and keep writing!</p>
                        {results.data.map((starter, i) => (
                          <motion.button
                            key={i}
                            onClick={() => onInsertText(starter)}
                            className="w-full text-left p-3 bg-galaxy-bg rounded-xl border border-galaxy-text-muted/10 hover:border-galaxy-secondary/40 transition-all cursor-pointer group"
                            whileHover={{ scale: 1.01 }}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                          >
                            <p className="text-galaxy-text font-body text-sm">"{starter}"</p>
                            <p className="text-galaxy-secondary text-[10px] font-body mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to use this starter
                            </p>
                          </motion.button>
                        ))}
                      </>
                    )}

                    {results.type === 'paragraph' && typeof results.data === 'string' && (
                      <div>
                        <p className="text-galaxy-text-muted text-xs font-body mb-2">Here's a suggestion! Use it, edit it, or try again.</p>
                        <div className="p-3 bg-galaxy-bg rounded-xl border border-galaxy-text-muted/10">
                          <p className="text-galaxy-text font-body text-sm leading-relaxed mb-3">
                            {results.data}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => onInsertText(results.data)}
                              className="px-3 py-1.5 bg-galaxy-secondary text-white rounded-lg text-xs font-body font-semibold cursor-pointer hover:bg-cyan-500 transition-colors"
                            >
                              Use This
                            </button>
                            <button
                              onClick={() => {
                                const current = page.text
                                onInsertText(current ? current + ' ' + results.data : results.data)
                              }}
                              className="px-3 py-1.5 bg-galaxy-primary/20 text-galaxy-primary rounded-lg text-xs font-body font-semibold cursor-pointer hover:bg-galaxy-primary/30 transition-colors"
                            >
                              Add to Existing
                            </button>
                            <button
                              onClick={handleGenerate}
                              className="px-3 py-1.5 bg-galaxy-bg-light text-galaxy-text-muted rounded-lg text-xs font-body font-semibold cursor-pointer hover:text-galaxy-text transition-colors"
                            >
                              Try Another
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {results.type === 'questions' && Array.isArray(results.data) && (
                      <>
                        <p className="text-galaxy-text-muted text-xs font-body">Think about these questions, then write your story!</p>
                        {results.data.map((question, i) => (
                          <motion.div
                            key={i}
                            className="p-3 bg-galaxy-bg rounded-xl border border-galaxy-text-muted/10"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.15 }}
                          >
                            <p className="text-galaxy-text font-body text-sm">{question}</p>
                          </motion.div>
                        ))}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

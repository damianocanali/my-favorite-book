import { useState } from 'react'
import { motion } from 'motion/react'
import { Users, ChevronLeft, Plus } from 'lucide-react'
import { useBookStore } from '../../stores/useBookStore'
import { characters } from '../../data/characters'
import GlowCard from '../ui/GlowCard'
import SparkleButton from '../ui/SparkleButton'

const CHARACTER_EMOJIS = [
  '🌟','👦','👧','🧒','👨','👩','🧑','👴','👵',
  '🧙','🧜','🧝','🧚','🧛','🦸','🦹','🧞','🤖',
  '👻','🐉','🦄','🐲','🦋','🐱','🐶','🐻','🦊',
  '🐸','🦁','🐯','🦝','🐺','🦅','🦜','🐧','🐨',
  '🦖','🐠','🦈','🦭','🐙','🦑','🌈','🔮','💎',
]

export default function StepCharacters({ onNext, onPrev }) {
  const book = useBookStore((state) => state.book)
  const toggleCharacter = useBookStore((state) => state.toggleCharacter)
  const addCharacter = useBookStore((state) => state.addCharacter)
  const [showCreate, setShowCreate] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [customEmoji, setCustomEmoji] = useState('🌟')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const selectedIds = new Set(book?.characters?.map((c) => c.id) ?? [])

  const handleCreateCustom = () => {
    if (!customName.trim()) return
    addCharacter({
      id: `custom-${Date.now()}`,
      name: customName,
      emoji: customEmoji,
      description: customDesc || 'A mysterious character...',
      color: '#8B5CF6',
      isCustom: true,
    })
    setCustomName('')
    setCustomDesc('')
    setCustomEmoji('🌟')
    setShowEmojiPicker(false)
    setShowCreate(false)
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        className="text-center"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-galaxy-primary/20 flex items-center justify-center">
          <Users size={40} className="text-galaxy-primary" />
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl font-bold text-galaxy-text mb-2">
          Choose Your Characters
        </h2>
        <p className="text-galaxy-text-muted font-body text-lg">
          Pick the heroes of your story! Select as many as you like.
        </p>
      </motion.div>

      {/* Selected count */}
      {selectedIds.size > 0 && (
        <motion.p
          className="text-galaxy-secondary font-body font-semibold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {selectedIds.size} character{selectedIds.size !== 1 ? 's' : ''} selected
        </motion.p>
      )}

      {/* Character grid */}
      <motion.div
        className="w-full max-w-2xl"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Create your own — first */}
          <GlowCard
            onClick={() => setShowCreate(true)}
            color="#06B6D4"
            className="flex flex-col items-center justify-center gap-2 py-4 border-dashed"
          >
            <Plus size={28} className="text-galaxy-secondary" />
            <span className="font-heading font-semibold text-sm text-galaxy-secondary text-center">
              Create Your Own!
            </span>
          </GlowCard>

          {characters.map((char) => (
            <GlowCard
              key={char.id}
              selected={selectedIds.has(char.id)}
              onClick={() => toggleCharacter(char)}
              color={char.color}
              className="flex flex-col items-center gap-2 py-4"
            >
              <span className="text-3xl">{char.emoji}</span>
              <span className="font-heading font-semibold text-sm text-galaxy-text text-center">
                {char.name}
              </span>
              <span className="text-galaxy-text-muted text-xs text-center font-body line-clamp-2">
                {char.description}
              </span>
            </GlowCard>
          ))}

          {/* Custom character cards that were already added */}
          {book?.characters
            ?.filter((c) => c.isCustom)
            .map((char) => (
              <GlowCard
                key={char.id}
                selected={true}
                onClick={() => toggleCharacter(char)}
                color={char.color}
                className="flex flex-col items-center gap-2 py-4"
              >
                <span className="text-3xl">{char.emoji}</span>
                <span className="font-heading font-semibold text-sm text-galaxy-text text-center">
                  {char.name}
                </span>
                <span className="text-galaxy-text-muted text-xs text-center font-body line-clamp-2">
                  {char.description}
                </span>
              </GlowCard>
            ))}

        </div>
      </motion.div>

      {/* Custom character creator */}
      {showCreate && (
        <motion.div
          className="w-full max-w-md bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-secondary/30 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="font-heading text-lg font-bold text-galaxy-text text-center">
            Create a Character
          </h3>

          {/* Emoji selector */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-galaxy-text-muted text-sm font-body">Choose an emoji</p>
            <button
              onClick={() => setShowEmojiPicker((v) => !v)}
              className="text-5xl leading-none hover:scale-110 transition-transform"
              aria-label="Pick emoji"
            >
              {customEmoji}
            </button>
            {showEmojiPicker && (
              <motion.div
                className="w-full bg-galaxy-bg border border-galaxy-secondary/30 rounded-xl p-3 grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-40 overflow-y-auto"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {CHARACTER_EMOJIS.map((em) => (
                  <button
                    key={em}
                    onClick={() => { setCustomEmoji(em); setShowEmojiPicker(false) }}
                    className={`text-2xl leading-none p-1 rounded-lg hover:bg-galaxy-secondary/20 transition-colors ${customEmoji === em ? 'bg-galaxy-secondary/30 ring-1 ring-galaxy-secondary' : ''}`}
                  >
                    {em}
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Character name..."
            className="w-full px-4 py-3 bg-galaxy-bg border border-galaxy-secondary/30 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/50 focus:border-galaxy-secondary focus:outline-none font-body"
            maxLength={30}
          />
          <input
            type="text"
            value={customDesc}
            onChange={(e) => setCustomDesc(e.target.value)}
            placeholder="Describe your character..."
            className="w-full px-4 py-3 bg-galaxy-bg border border-galaxy-secondary/30 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/50 focus:border-galaxy-secondary focus:outline-none font-body"
            maxLength={80}
          />
          <div className="flex gap-3 justify-center">
            <SparkleButton onClick={() => { setShowCreate(false); setShowEmojiPicker(false) }} variant="secondary" size="small">
              Cancel
            </SparkleButton>
            <SparkleButton onClick={handleCreateCustom} disabled={!customName.trim()} size="small" variant="accent">
              Add Character
            </SparkleButton>
          </div>
        </motion.div>
      )}

      <div className="flex gap-4">
        <SparkleButton onClick={onPrev} variant="secondary">
          <span className="flex items-center gap-1">
            <ChevronLeft size={18} /> Back
          </span>
        </SparkleButton>
        <SparkleButton
          onClick={onNext}
          disabled={selectedIds.size === 0}
        >
          Next Step →
        </SparkleButton>
      </div>
    </div>
  )
}

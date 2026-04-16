import { useState } from 'react'
import { motion } from 'motion/react'
import { MapPin, ChevronLeft, Plus } from 'lucide-react'
import { useBookStore } from '../../stores/useBookStore'
import { scenes } from '../../data/scenes'
import GlowCard from '../ui/GlowCard'
import SparkleButton from '../ui/SparkleButton'

const WORLD_EMOJIS = [
  '🌍','🌏','🌎','🗺️','🏔️','🌋','🏝️','🏜️','🌊','🌌',
  '🏙️','🏰','🌃','🌄','🌅','🌠','🌈','⛄','🌿','🍄',
  '🔮','🏺','🗽','🛸','🌙','☀️','⚡','🌪️','🔥','❄️',
]

export default function StepSetting({ onNext, onPrev }) {
  const setting = useBookStore((state) => state.book?.setting)
  const setSetting = useBookStore((state) => state.setSetting)

  const [showCreate, setShowCreate] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [customEmoji, setCustomEmoji] = useState('🌍')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const handleCreateCustomWorld = () => {
    if (!customName.trim()) return
    setSetting({
      id: `custom-${Date.now()}`,
      name: customName,
      emoji: customEmoji,
      description: customDesc || 'A mysterious world...',
      color: '#06B6D4',
      gradient: 'from-cyan-900 to-teal-800',
      isCustom: true,
    })
    setCustomName('')
    setCustomDesc('')
    setCustomEmoji('🌍')
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
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <MapPin size={40} className="text-green-400" />
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl font-bold text-galaxy-text mb-2">
          Where Does It Happen?
        </h2>
        <p className="text-galaxy-text-muted font-body text-lg">
          Pick the world for your story!
        </p>
      </motion.div>

      <motion.div
        className="w-full max-w-2xl"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Create your own world — first */}
          <GlowCard
            onClick={() => setShowCreate(true)}
            color="#06B6D4"
            className="flex flex-col items-center justify-center gap-2 py-5 border-dashed"
          >
            <Plus size={28} className="text-galaxy-secondary" />
            <span className="font-heading font-semibold text-sm text-galaxy-secondary text-center">
              Create Your Own World!
            </span>
          </GlowCard>

          {scenes.map((scene) => (
            <GlowCard
              key={scene.id}
              selected={setting?.id === scene.id}
              onClick={() => setSetting(scene)}
              color={scene.color}
              className="flex flex-col items-center gap-2 py-5"
            >
              <span className="text-4xl">{scene.emoji}</span>
              <span className="font-heading font-semibold text-sm text-galaxy-text text-center">
                {scene.name}
              </span>
              <span className="text-galaxy-text-muted text-xs text-center font-body line-clamp-2">
                {scene.description}
              </span>
            </GlowCard>
          ))}

          {/* Show already-created custom world if selected */}
          {setting?.isCustom && (
            <GlowCard
              selected={true}
              onClick={() => {}}
              color={setting.color}
              className="flex flex-col items-center gap-2 py-5"
            >
              <span className="text-4xl">{setting.emoji}</span>
              <span className="font-heading font-semibold text-sm text-galaxy-text text-center">
                {setting.name}
              </span>
              <span className="text-galaxy-text-muted text-xs text-center font-body line-clamp-2">
                {setting.description}
              </span>
            </GlowCard>
          )}
        </div>
      </motion.div>

      {/* Custom world creator */}
      {showCreate && (
        <motion.div
          className="w-full max-w-md bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-secondary/30 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="font-heading text-lg font-bold text-galaxy-text text-center">
            Create a World
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
                {WORLD_EMOJIS.map((em) => (
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
            placeholder="World name..."
            className="w-full px-4 py-3 bg-galaxy-bg border border-galaxy-secondary/30 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/50 focus:border-galaxy-secondary focus:outline-none font-body"
            maxLength={30}
          />
          <input
            type="text"
            value={customDesc}
            onChange={(e) => setCustomDesc(e.target.value)}
            placeholder="Describe your world..."
            className="w-full px-4 py-3 bg-galaxy-bg border border-galaxy-secondary/30 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/50 focus:border-galaxy-secondary focus:outline-none font-body"
            maxLength={80}
          />
          <div className="flex gap-3 justify-center">
            <SparkleButton onClick={() => { setShowCreate(false); setShowEmojiPicker(false) }} variant="secondary" size="small">
              Cancel
            </SparkleButton>
            <SparkleButton onClick={handleCreateCustomWorld} disabled={!customName.trim()} size="small" variant="accent">
              Create World
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
        <SparkleButton onClick={onNext} disabled={!setting}>
          Next Step →
        </SparkleButton>
      </div>
    </div>
  )
}

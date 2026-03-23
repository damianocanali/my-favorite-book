import { useState } from 'react'
import { motion } from 'motion/react'
import { Palette, ChevronLeft } from 'lucide-react'
import { useBookStore } from '../../stores/useBookStore'
import { colorPalettes } from '../../data/colorPalettes'
import GlowCard from '../ui/GlowCard'
import SparkleButton from '../ui/SparkleButton'

function MiniBookPreview({ colors }) {
  return (
    <div className="flex justify-center">
      <div className="relative w-32 h-40 rounded-lg shadow-lg overflow-hidden" style={{ backgroundColor: colors.cover }}>
        {/* Book spine */}
        <div className="absolute left-0 top-0 bottom-0 w-3" style={{ backgroundColor: colors.accent + '80' }} />
        {/* Title area */}
        <div className="flex flex-col items-center justify-center h-full px-4">
          <div className="w-12 h-1 rounded mb-2" style={{ backgroundColor: colors.text + '80' }} />
          <div className="w-16 h-1.5 rounded mb-1" style={{ backgroundColor: colors.text }} />
          <div className="w-10 h-1 rounded mb-3" style={{ backgroundColor: colors.text + '80' }} />
          <div className="w-8 h-8 rounded-full border-2" style={{ borderColor: colors.accent, backgroundColor: colors.accent + '30' }} />
          <div className="w-14 h-1 rounded mt-3" style={{ backgroundColor: colors.text + '60' }} />
        </div>
        {/* Decorative corner */}
        <div className="absolute top-2 right-2 w-4 h-4 rounded-full" style={{ backgroundColor: colors.accent + '50' }} />
      </div>
    </div>
  )
}

export default function StepColors({ onNext, onPrev }) {
  const book = useBookStore((state) => state.book)
  const setColors = useBookStore((state) => state.setColors)
  const [showCustom, setShowCustom] = useState(false)

  const currentColors = book?.colors ?? { cover: '#8B5CF6', accent: '#06B6D4', text: '#F1F5F9', palette: 'starlight' }

  const selectPalette = (palette) => {
    setColors({
      cover: palette.cover,
      accent: palette.accent,
      text: palette.text,
      palette: palette.id,
    })
    setShowCustom(false)
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div
        className="text-center"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-galaxy-accent/20 flex items-center justify-center">
          <Palette size={40} className="text-galaxy-accent" />
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl font-bold text-galaxy-text mb-2">
          Pick Your Colors
        </h2>
        <p className="text-galaxy-text-muted font-body text-lg">
          Choose the colors for your book!
        </p>
      </motion.div>

      {/* Live preview */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
      >
        <MiniBookPreview colors={currentColors} />
      </motion.div>

      {/* Palette options */}
      <motion.div
        className="w-full max-w-lg"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {colorPalettes.map((palette) => (
            <GlowCard
              key={palette.id}
              selected={currentColors.palette === palette.id && !showCustom}
              onClick={() => selectPalette(palette)}
              color={palette.cover}
              className="flex flex-col items-center gap-2 py-4"
            >
              <span className="text-2xl">{palette.emoji}</span>
              <span className="font-heading font-semibold text-sm text-galaxy-text">
                {palette.name}
              </span>
              <div className="flex gap-1">
                <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: palette.cover }} />
                <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: palette.accent }} />
              </div>
            </GlowCard>
          ))}
        </div>

        {/* Custom color toggle */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowCustom(!showCustom)}
            className="text-galaxy-secondary font-body font-semibold text-sm hover:text-galaxy-primary transition-colors cursor-pointer"
          >
            {showCustom ? 'Use a preset instead' : '🎨 Or pick your own colors!'}
          </button>
        </div>

        {/* Custom color pickers */}
        {showCustom && (
          <motion.div
            className="mt-4 bg-galaxy-bg-light rounded-2xl p-6 space-y-4"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-4">
              <label className="font-body font-semibold text-sm text-galaxy-text w-24">Cover</label>
              <input
                type="color"
                value={currentColors.cover}
                onChange={(e) => setColors({ cover: e.target.value, palette: 'custom' })}
                className="w-12 h-12 rounded-lg cursor-pointer border-2 border-galaxy-text-muted/20"
              />
              <span className="text-galaxy-text-muted text-sm font-mono">{currentColors.cover}</span>
            </div>
            <div className="flex items-center gap-4">
              <label className="font-body font-semibold text-sm text-galaxy-text w-24">Accent</label>
              <input
                type="color"
                value={currentColors.accent}
                onChange={(e) => setColors({ accent: e.target.value, palette: 'custom' })}
                className="w-12 h-12 rounded-lg cursor-pointer border-2 border-galaxy-text-muted/20"
              />
              <span className="text-galaxy-text-muted text-sm font-mono">{currentColors.accent}</span>
            </div>
            <div className="flex items-center gap-4">
              <label className="font-body font-semibold text-sm text-galaxy-text w-24">Text</label>
              <input
                type="color"
                value={currentColors.text}
                onChange={(e) => setColors({ text: e.target.value, palette: 'custom' })}
                className="w-12 h-12 rounded-lg cursor-pointer border-2 border-galaxy-text-muted/20"
              />
              <span className="text-galaxy-text-muted text-sm font-mono">{currentColors.text}</span>
            </div>
          </motion.div>
        )}
      </motion.div>

      <div className="flex gap-4">
        <SparkleButton onClick={onPrev} variant="secondary">
          <span className="flex items-center gap-1">
            <ChevronLeft size={18} /> Back
          </span>
        </SparkleButton>
        <SparkleButton onClick={onNext}>
          Next Step →
        </SparkleButton>
      </div>
    </div>
  )
}

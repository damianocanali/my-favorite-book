import { motion } from 'motion/react'
import { MapPin, ChevronLeft } from 'lucide-react'
import { useBookStore } from '../../stores/useBookStore'
import { scenes } from '../../data/scenes'
import GlowCard from '../ui/GlowCard'
import SparkleButton from '../ui/SparkleButton'

export default function StepSetting({ onNext, onPrev }) {
  const setting = useBookStore((state) => state.book?.setting)
  const setSetting = useBookStore((state) => state.setSetting)

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
        </div>
      </motion.div>

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

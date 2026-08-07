import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

// The mascot, extracted from WelcomeBackMoment so every celebration can
// use the same character rather than each inventing its own.
//
// The artwork is still missing, so this falls back to an animated star.
// That is deliberate: the reactions ship and work today, and upgrade the
// moment /mascot.png lands, with no code change.
//
// Reactions are poses, not separate art. With one image the difference has
// to come from motion — a cheer jumps, a think tilts and hovers, a wave
// rocks. When real art arrives with per-pose frames, swap `src` per mood
// and keep these transforms as the secondary motion.

export const MOODS = {
  idle: { emoji: '⭐', y: [0, -8, 0], rotate: [-4, 4, -4], duration: 2.8 },
  cheer: { emoji: '🎉', y: [0, -26, 0], rotate: [-12, 12, -12], duration: 0.6 },
  think: { emoji: '🤔', y: [0, -4, 0], rotate: [-8, -8, -8], duration: 2.2 },
  wave: { emoji: '👋', y: [0, -6, 0], rotate: [-14, 14, -14], duration: 1.1 },
  proud: { emoji: '🌟', y: [0, -14, 0], rotate: [0, 0, 0], duration: 1.4 },
}

export default function Mascot({ mood = 'idle', size = 112, className = '' }) {
  const [failed, setFailed] = useState(false)
  const reduceMotion = useReducedMotion()
  const pose = MOODS[mood] ?? MOODS.idle

  // A cheer is a burst, not a loop — it would be exhausting on repeat.
  const isBurst = mood === 'cheer' || mood === 'proud'

  const animate = reduceMotion
    ? {}
    : { y: pose.y, rotate: pose.rotate }
  const transition = reduceMotion
    ? { duration: 0 }
    : {
        duration: pose.duration,
        repeat: isBurst ? 2 : Infinity,
        ease: 'easeInOut',
      }

  if (failed) {
    return (
      <motion.div
        className={`select-none leading-none ${className}`}
        style={{ fontSize: size * 0.64 }}
        animate={animate}
        transition={transition}
        aria-hidden
      >
        {pose.emoji}
      </motion.div>
    )
  }

  return (
    <motion.img
      src="/mascot.png"
      alt=""
      onError={() => setFailed(true)}
      style={{ height: size, width: size }}
      className={`object-contain drop-shadow-[0_8px_24px_rgba(191,90,242,0.6)] ${className}`}
      animate={animate}
      transition={transition}
    />
  )
}

/**
 * Shows the mascot briefly in a given mood, then hides it. Used for the
 * inline reactions while a child is writing — it must never sit on screen
 * long enough to become something they tap past.
 */
export function useMascotReaction(durationMs = 2600) {
  const [mood, setMood] = useState(null)

  useEffect(() => {
    if (!mood) return
    const t = setTimeout(() => setMood(null), durationMs)
    return () => clearTimeout(t)
  }, [mood, durationMs])

  return [mood, setMood]
}

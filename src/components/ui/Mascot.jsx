import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

// The mascot, one component for every celebration so the character is
// consistent wherever it appears.
//
// Each mood maps to its own drawn pose plus a motion preset chosen to suit
// that pose — a waving pose wants a rocking wave, a mid-jump pose wants a
// bounce, an arms-open pose wants a slow breath. Animating every pose the
// same way would waste the fact that they are drawn differently.
//
// Art is optional at every level. A missing pose file falls back to a
// generic /mascot.png, and a missing mascot falls back to an emoji, so the
// app never renders a broken image and shipped fine before the art existed.

const BASE = '/mascot'

/**
 * `glow` is a second frame of the same pose with the badge lit up. When
 * present it is cross-faded over the base frame, which turns two stills
 * into a pulsing glow without a sprite sheet or a video.
 */
export const POSES = {
  idle: { src: `${BASE}/welcoming.png`, emoji: '⭐', motion: 'float' },
  wave: { src: `${BASE}/welcoming.png`, emoji: '👋', motion: 'wave' },
  welcome: { src: `${BASE}/welcome-back.png`, emoji: '🤗', motion: 'breathe' },
  cheer: { src: `${BASE}/cheering.png`, emoji: '🎉', motion: 'bounce' },
  think: { src: `${BASE}/welcoming.png`, emoji: '🤔', motion: 'tilt' },
  proud: { src: `${BASE}/badge.png`, glow: `${BASE}/badge-glow.png`, emoji: '🏅', motion: 'present' },
  badge: { src: `${BASE}/badge.png`, glow: `${BASE}/badge-glow.png`, emoji: '🏅', motion: 'present' },
}

// Motion presets. `loop: false` means a burst that settles — a cheer that
// never stops stops reading as a cheer.
const MOTIONS = {
  float: { animate: { y: [0, -8, 0] }, duration: 2.8, loop: true },
  wave: { animate: { rotate: [-5, 5, -5] }, duration: 1.4, loop: true },
  breathe: { animate: { scale: [1, 1.04, 1], y: [0, -5, 0] }, duration: 3.2, loop: true },
  bounce: { animate: { y: [0, -28, 0], scale: [1, 1.06, 1] }, duration: 0.62, loop: false, repeat: 2 },
  tilt: { animate: { rotate: [-6, -2, -6], y: [0, -4, 0] }, duration: 2.6, loop: true },
  present: { animate: { y: [0, -6, 0] }, duration: 2.4, loop: true },
}

export default function Mascot({ mood = 'idle', size = 112, className = '' }) {
  const pose = POSES[mood] ?? POSES.idle
  const preset = MOTIONS[pose.motion] ?? MOTIONS.float
  const reduceMotion = useReducedMotion()

  const [failed, setFailed] = useState(false)
  const [glowFailed, setGlowFailed] = useState(false)

  const animate = reduceMotion ? {} : preset.animate
  const transition = reduceMotion
    ? { duration: 0 }
    : {
        duration: preset.duration,
        repeat: preset.loop ? Infinity : (preset.repeat ?? 1),
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

  const showGlow = pose.glow && !glowFailed && !reduceMotion

  return (
    <motion.div
      className={`relative select-none ${className}`}
      style={{ height: size, width: size }}
      animate={animate}
      transition={transition}
      aria-hidden
    >
      <img
        src={pose.src}
        alt=""
        // One retry at the generic mascot before giving up to the emoji, so
        // a single shared image still works if the poses aren't sliced yet.
        onError={(e) => {
          if (e.currentTarget.dataset.retried) { setFailed(true); return }
          e.currentTarget.dataset.retried = '1'
          e.currentTarget.src = '/mascot.png'
        }}
        className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_8px_24px_rgba(191,90,242,0.45)]"
      />

      {showGlow && (
        <motion.img
          src={pose.glow}
          alt=""
          onError={() => setGlowFailed(true)}
          className="absolute inset-0 h-full w-full object-contain"
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.div>
  )
}

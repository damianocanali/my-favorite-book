import { useEffect, useState } from 'react'
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
/**
 * `frames` names a folder under /mascot/frames holding a drawn animation
 * (see scripts/video-to-frames.py). Where one exists it replaces the
 * code-driven motion entirely — real animation beats a still being
 * translated around, and doubling the two up just looks seasick.
 */
export const POSES = {
  idle: { src: `${BASE}/welcoming.png`, emoji: '⭐', motion: 'float' },
  wave: { src: `${BASE}/welcoming.png`, emoji: '👋', motion: 'wave' },
  welcome: {
    src: `${BASE}/welcome-back.png`, emoji: '🤗', motion: 'breathe',
    frames: 'welcome-back', frameCount: 16, fps: 12,
  },
  cheer: { src: `${BASE}/cheering.png`, emoji: '🎉', motion: 'bounce' },
  think: { src: `${BASE}/welcoming.png`, emoji: '🤔', motion: 'tilt' },
  proud: {
    src: `${BASE}/badge.png`, glow: `${BASE}/badge-glow.png`, emoji: '🏅', motion: 'present',
    frames: 'badge', frameCount: 16, fps: 12,
  },
  badge: {
    src: `${BASE}/badge.png`, glow: `${BASE}/badge-glow.png`, emoji: '🏅', motion: 'present',
    frames: 'badge', frameCount: 16, fps: 12,
  },
}

const framePath = (folder, i) =>
  `${BASE}/frames/${folder}/frame-${String(i).padStart(2, '0')}.png`

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
  const [framesFailed, setFramesFailed] = useState(false)
  const [frame, setFrame] = useState(0)

  // Under Reduce Motion a frame animation is exactly the thing to stop, so
  // it holds on frame 0 rather than playing.
  const playFrames = !!pose.frames && !framesFailed && !failed && !reduceMotion

  useEffect(() => {
    if (!playFrames) return
    const id = setInterval(
      () => setFrame((f) => (f + 1) % pose.frameCount),
      1000 / (pose.fps ?? 12)
    )
    return () => clearInterval(id)
  }, [playFrames, pose.frameCount, pose.fps])

  // Warm the whole sequence before it plays, or the first loop stutters as
  // each frame is fetched on the tick it is first shown.
  useEffect(() => {
    if (!pose.frames || framesFailed) return
    let cancelled = false
    Promise.all(
      Array.from({ length: pose.frameCount }, (_, i) => new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = resolve
        img.onerror = reject
        img.src = framePath(pose.frames, i)
      }))
    ).catch(() => { if (!cancelled) setFramesFailed(true) })
    return () => { cancelled = true }
  }, [pose.frames, pose.frameCount, framesFailed])

  // A drawn animation already carries the movement; layering the code
  // preset on top would translate the whole clip around as it plays.
  const animate = reduceMotion || playFrames ? {} : preset.animate
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

  const showGlow = pose.glow && !glowFailed && !reduceMotion && !playFrames

  return (
    <motion.div
      className={`relative select-none ${className}`}
      style={{ height: size, width: size }}
      animate={animate}
      transition={transition}
      aria-hidden
    >
      {playFrames ? (
        <img
          src={framePath(pose.frames, frame)}
          alt=""
          onError={() => setFramesFailed(true)}
          className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_8px_24px_rgba(191,90,242,0.45)]"
        />
      ) : (
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
      )}

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

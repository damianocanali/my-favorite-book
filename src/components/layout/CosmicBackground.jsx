import { useMemo } from 'react'

// Web port of ios-native/MyBookLab/Views/CosmicBackground.swift.
// Four layers, same values as the native app:
//   1. 135° four-stop deep-galaxy gradient
//   2. three blurred nebula blobs that drift on a slow loop
//   3. 70 twinkling stars (deterministic positions, every 23rd a sparkle)
//   4. sparkles drifting bottom → top
//
// Positions use a seeded PRNG (matching the native SplitMix64 approach) so
// the starfield is stable across renders instead of reshuffling.

/** Mulberry32 — small deterministic PRNG. Same seed ⇒ same starfield. */
function makeRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STAR_COUNT = 70
const SPARKLE_COUNT = 14
const SPARKLE_COLORS = ['#FFD60A', '#FF375F', '#BF5AF2', '#64D2FF', '#FFFFFF']

function useStars() {
  return useMemo(() => {
    const rand = makeRandom(42) // seed 42, as in the Swift source
    return Array.from({ length: STAR_COUNT }, (_, i) => {
      const baseRadius = 0.4 + rand() * 1.6 // 0.4…2.0 px
      const isSparkle = i % 23 === 0 // every 23rd star is a 4-point sparkle
      const size = (isSparkle ? baseRadius * 3 : baseRadius) * 2
      return {
        id: i,
        isSparkle,
        left: `${rand() * 100}%`,
        top: `${rand() * 100}%`,
        size,
        // twinkleSpeed 0.5…2.5 rad/s → 2.5s…12.5s visual period
        duration: `${(2 * Math.PI) / (0.5 + rand() * 2)}s`,
        delay: `${-rand() * 6}s`, // negative = start mid-cycle
      }
    })
  }, [])
}

function useSparkles() {
  return useMemo(() => {
    const rand = makeRandom(7)
    return Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
      id: i,
      left: `${rand() * 100}%`,
      size: 10 + rand() * 12, // 10…22 px
      color: SPARKLE_COLORS[Math.floor(rand() * SPARKLE_COLORS.length)],
      duration: `${6 + rand() * 6}s`, // 6…12 s bottom → top
      delay: `${-rand() * 12}s`,
      spin: -90 + rand() * 450, // −90°…360°
    }))
  }, [])
}

/** The 4-point sparkle glyph (SF Symbol "sparkle" equivalent). */
function SparkleGlyph({ size, color, style, className }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M8 0L9.6 6.4L16 8L9.6 9.6L8 16L6.4 9.6L0 8L6.4 6.4Z" fill={color} />
    </svg>
  )
}

export default function CosmicBackground() {
  const stars = useStars()
  const sparkles = useSparkles()

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden="true"
    >
      {/* 1 — deep galaxy gradient (135°, topLeading → bottomTrailing) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, #0D0A29 0%, #1A0D3D 33.33%, #2E1252 66.67%, #1C0A2E 100%)',
        }}
      />

      {/* 2 — nebula blobs: purple, pink, cyan; blur 40px; slow drift */}
      <div
        className="absolute rounded-full animate-nebula-drift"
        style={{
          width: 320,
          height: 320,
          top: 'calc(50% - 200px - 160px)',
          left: 'calc(50% - 120px - 160px)',
          background:
            'radial-gradient(circle, rgba(191,90,242,0.35) 0%, rgba(191,90,242,0) 100%)',
          filter: 'blur(40px)',
          animationDuration: '12s',
        }}
      />
      <div
        className="absolute rounded-full animate-nebula-drift"
        style={{
          width: 280,
          height: 280,
          top: 'calc(50% + 260px - 140px)',
          left: 'calc(50% + 140px - 140px)',
          background:
            'radial-gradient(circle, rgba(255,55,95,0.22) 0%, rgba(255,55,95,0) 100%)',
          filter: 'blur(40px)',
          animationDuration: '14s',
        }}
      />
      <div
        className="absolute rounded-full animate-nebula-drift"
        style={{
          width: 220,
          height: 220,
          top: 'calc(50% - 80px - 110px)',
          left: 'calc(50% + 60px - 110px)',
          background:
            'radial-gradient(circle, rgba(100,210,255,0.18) 0%, rgba(100,210,255,0) 100%)',
          filter: 'blur(40px)',
          animationDuration: '16s',
        }}
      />

      {/* 3 — twinkling stars */}
      {stars.map((star) =>
        star.isSparkle ? (
          <SparkleGlyph
            key={star.id}
            size={star.size}
            color="#FFFFFF"
            className="absolute animate-twinkle motion-reduce:animate-none"
            style={{
              left: star.left,
              top: star.top,
              animationDuration: star.duration,
              animationDelay: star.delay,
            }}
          />
        ) : (
          <div
            key={star.id}
            className="absolute rounded-full bg-white animate-twinkle motion-reduce:animate-none"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              animationDuration: star.duration,
              animationDelay: star.delay,
            }}
          />
        )
      )}

      {/* 4 — sparkles drifting bottom → top */}
      {sparkles.map((s) => (
        <SparkleGlyph
          key={`sp-${s.id}`}
          size={s.size}
          color={s.color}
          className="absolute cosmic-sparkle motion-reduce:hidden"
          style={{
            left: s.left,
            animationDuration: s.duration,
            animationDelay: s.delay,
            '--spin': `${s.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}

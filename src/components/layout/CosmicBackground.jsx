import { useEffect, useRef, useMemo } from 'react'

function Star({ style }) {
  return (
    <div
      className="absolute rounded-full"
      style={style}
    />
  )
}

export default function CosmicBackground() {
  const stars = useMemo(() => {
    const result = []
    for (let i = 0; i < 80; i++) {
      result.push({
        key: i,
        style: {
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: `${Math.random() * 3 + 1}px`,
          height: `${Math.random() * 3 + 1}px`,
          backgroundColor: ['#F1F5F9', '#8B5CF6', '#06B6D4', '#F472B6'][Math.floor(Math.random() * 4)],
          opacity: Math.random() * 0.7 + 0.3,
          animation: `twinkle ${Math.random() * 4 + 2}s ease-in-out ${Math.random() * 3}s infinite`,
        },
      })
    }
    return result
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Deep space gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-galaxy-bg via-[#131B2E] to-galaxy-bg" />

      {/* Nebula glow effects */}
      <div
        className="absolute w-96 h-96 rounded-full opacity-10 blur-xl"
        style={{
          background: 'radial-gradient(circle, #8B5CF6, transparent)',
          top: '10%',
          right: '10%',
        }}
      />
      <div
        className="absolute w-80 h-80 rounded-full opacity-10 blur-xl"
        style={{
          background: 'radial-gradient(circle, #06B6D4, transparent)',
          bottom: '20%',
          left: '5%',
        }}
      />
      <div
        className="absolute w-64 h-64 rounded-full opacity-5 blur-xl"
        style={{
          background: 'radial-gradient(circle, #F472B6, transparent)',
          top: '50%',
          left: '50%',
        }}
      />

      {/* Stars */}
      {stars.map((star) => (
        <Star key={star.key} style={star.style} />
      ))}
    </div>
  )
}

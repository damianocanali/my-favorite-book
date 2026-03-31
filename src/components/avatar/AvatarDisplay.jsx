import { useAvatarStore } from '../../stores/useAvatarStore'

/**
 * Renders the user's avatar.
 * Shows AI-generated image if available, falls back to initials placeholder.
 */
export default function AvatarDisplay({ size = 120, mini = false, className = '' }) {
  const avatarImage = useAvatarStore((s) => s.avatarImage)
  const features = useAvatarStore((s) => s.features)

  if (avatarImage) {
    return (
      <div
        className={`rounded-full overflow-hidden shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={avatarImage}
          alt="My avatar"
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  // Placeholder — skin-toned circle with face
  const skinColors = {
    light: '#FFDBB4', fair: '#E8B88A', medium: '#C68642',
    dark: '#8D5524', peach: '#FFDBAC', tan: '#F1C27D',
  }
  const skin = skinColors[features.skinTone] || '#C68642'

  return (
    <div
      className={`rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-galaxy-bg-light border-2 border-galaxy-text-muted/20 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size * 0.75} height={size * 0.75}>
        <circle cx="50" cy="50" r="40" fill={skin} />
        <circle cx="40" cy="45" r="3" fill="#333" />
        <circle cx="60" cy="45" r="3" fill="#333" />
        <circle cx="41" cy="44" r="1" fill="#FFF" />
        <circle cx="61" cy="44" r="1" fill="#FFF" />
        <path d="M 40 58 Q 50 66 60 58" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="34" cy="55" rx="5" ry="3" fill="#FFB4B4" opacity="0.4" />
        <ellipse cx="66" cy="55" rx="5" ry="3" fill="#FFB4B4" opacity="0.4" />
      </svg>
    </div>
  )
}

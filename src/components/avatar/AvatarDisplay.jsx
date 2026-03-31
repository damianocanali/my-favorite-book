import { useMemo } from 'react'
import { useAvatarStore } from '../../stores/useAvatarStore'
import {
  AVATAR_BODIES, AVATAR_HAIR, AVATAR_CLOTHING,
  AVATAR_HATS, AVATAR_ACCESSORIES, AVATAR_BACKGROUNDS,
} from '../../lib/avatarItems'

function findItem(items, id) {
  return items.find((i) => i.id === id) ?? items[0]
}

/**
 * Renders the user's avatar as layered SVG.
 * @param {number} size - width/height in px (default 120)
 * @param {boolean} mini - compact mode for nav bar
 */
export default function AvatarDisplay({ size = 120, mini = false, className = '' }) {
  const equipped = useAvatarStore((s) => s.equipped)

  const body = useMemo(() => findItem(AVATAR_BODIES, equipped.body), [equipped.body])
  const hair = useMemo(() => findItem(AVATAR_HAIR, equipped.hair), [equipped.hair])
  const clothing = useMemo(() => findItem(AVATAR_CLOTHING, equipped.clothing), [equipped.clothing])
  const hat = useMemo(() => findItem(AVATAR_HATS, equipped.hat), [equipped.hat])
  const accessory = useMemo(() => findItem(AVATAR_ACCESSORIES, equipped.accessory), [equipped.accessory])
  const bg = useMemo(() => findItem(AVATAR_BACKGROUNDS, equipped.background), [equipped.background])

  const bgStyle = bg.color?.startsWith('linear')
    ? { background: bg.color }
    : { backgroundColor: bg.color }

  return (
    <div
      className={`rounded-full overflow-hidden flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, ...bgStyle }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size * 0.85}
        height={size * 0.85}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Body / Head */}
        <circle cx="50" cy="42" r="22" fill={body.skin} />
        {/* Eyes */}
        <circle cx="42" cy="39" r="2.5" fill="#333" />
        <circle cx="58" cy="39" r="2.5" fill="#333" />
        {/* Eye shine */}
        <circle cx="43" cy="38" r="0.8" fill="#FFF" />
        <circle cx="59" cy="38" r="0.8" fill="#FFF" />
        {/* Smile */}
        <path d="M 43 47 Q 50 53 57 47" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Blush */}
        <ellipse cx="37" cy="46" rx="4" ry="2" fill="#FFB4B4" opacity="0.5" />
        <ellipse cx="63" cy="46" rx="4" ry="2" fill="#FFB4B4" opacity="0.5" />

        {/* Hair */}
        {hair.color && hair.style === 'short' && (
          <path d="M 28 38 Q 28 18 50 18 Q 72 18 72 38 Q 65 28 50 28 Q 35 28 28 38 Z" fill={hair.color} />
        )}
        {hair.color && hair.style === 'long' && (
          <>
            <path d="M 28 38 Q 28 16 50 16 Q 72 16 72 38 Q 65 26 50 26 Q 35 26 28 38 Z" fill={hair.color} />
            <path d="M 28 38 Q 26 60 30 70" stroke={hair.color} strokeWidth="8" fill="none" strokeLinecap="round" />
            <path d="M 72 38 Q 74 60 70 70" stroke={hair.color} strokeWidth="8" fill="none" strokeLinecap="round" />
          </>
        )}
        {hair.color && hair.style === 'curly' && (
          <>
            <path d="M 28 38 Q 28 16 50 16 Q 72 16 72 38 Q 65 26 50 26 Q 35 26 28 38 Z" fill={hair.color} />
            <circle cx="30" cy="32" r="5" fill={hair.color} />
            <circle cx="70" cy="32" r="5" fill={hair.color} />
            <circle cx="34" cy="24" r="4" fill={hair.color} />
            <circle cx="66" cy="24" r="4" fill={hair.color} />
            <circle cx="50" cy="18" r="5" fill={hair.color} />
          </>
        )}

        {/* Clothing / Body */}
        {clothing.color && (
          <path d="M 30 62 Q 30 55 50 55 Q 70 55 70 62 L 74 90 L 26 90 Z" fill={clothing.color} />
        )}
        {/* Neck */}
        <rect x="44" y="60" width="12" height="6" rx="2" fill={body.skin} />

        {/* Hat */}
        {hat.emoji === '🧢' && (
          <>
            <ellipse cx="50" cy="22" rx="24" ry="4" fill={hat.color} />
            <path d="M 30 22 Q 30 10 50 10 Q 70 10 70 22 Z" fill={hat.color} />
            <rect x="26" y="19" width="28" height="5" rx="2" fill={hat.color} />
          </>
        )}
        {hat.emoji === '🎩' && (
          <>
            <ellipse cx="50" cy="20" rx="22" ry="4" fill={hat.color} />
            <rect x="38" y="2" width="24" height="18" rx="3" fill={hat.color} />
          </>
        )}
        {hat.emoji === '👑' && (
          <polygon points="32,22 38,8 44,18 50,4 56,18 62,8 68,22" fill={hat.color} stroke="#FFA000" strokeWidth="1" />
        )}
        {hat.emoji === '🎀' && (
          <>
            <ellipse cx="68" cy="24" rx="6" ry="4" fill={hat.color} />
            <ellipse cx="76" cy="24" rx="6" ry="4" fill={hat.color} />
            <circle cx="72" cy="24" r="2.5" fill={hat.color} opacity="0.8" />
          </>
        )}
        {hat.emoji === '🥳' && (
          <polygon points="50,2 42,22 58,22" fill={hat.color} stroke="#FFD600" strokeWidth="0.5" />
        )}
        {hat.emoji === '🎧' && (
          <>
            <path d="M 28 36 Q 28 14 50 14 Q 72 14 72 36" stroke={hat.color} strokeWidth="4" fill="none" />
            <circle cx="28" cy="36" r="5" fill={hat.color} />
            <circle cx="72" cy="36" r="5" fill={hat.color} />
          </>
        )}
        {hat.emoji === '🎓' && (
          <>
            <rect x="32" y="16" width="36" height="5" rx="1" fill={hat.color} />
            <polygon points="50,12 30,20 50,24 70,20" fill={hat.color} />
            <line x1="68" y1="20" x2="72" y2="30" stroke="#FFD600" strokeWidth="1.5" />
            <circle cx="72" cy="31" r="2" fill="#FFD600" />
          </>
        )}

        {/* Accessory */}
        {accessory.emoji === '👓' && (
          <>
            <circle cx="42" cy="39" r="6" stroke={accessory.color} strokeWidth="1.5" fill="none" />
            <circle cx="58" cy="39" r="6" stroke={accessory.color} strokeWidth="1.5" fill="none" />
            <line x1="48" y1="39" x2="52" y2="39" stroke={accessory.color} strokeWidth="1.5" />
          </>
        )}
        {accessory.emoji === '🕶️' && (
          <>
            <rect x="35" y="35" width="12" height="8" rx="2" fill={accessory.color} />
            <rect x="53" y="35" width="12" height="8" rx="2" fill={accessory.color} />
            <line x1="47" y1="39" x2="53" y2="39" stroke={accessory.color} strokeWidth="1.5" />
          </>
        )}
        {accessory.emoji === '🧣' && (
          <path d="M 36 58 Q 43 65 50 60 Q 57 55 64 60 L 62 72 Q 55 68 50 72 Q 45 76 38 70 Z" fill={accessory.color} opacity="0.9" />
        )}
        {accessory.emoji === '⭐' && (
          <>
            <polygon points="42,35 43.5,38 47,38 44.5,40 45.5,43 42,41 38.5,43 39.5,40 37,38 40.5,38" fill="#FFD600" />
            <polygon points="58,35 59.5,38 63,38 60.5,40 61.5,43 58,41 54.5,43 55.5,40 53,38 56.5,38" fill="#FFD600" />
            <line x1="47" y1="38" x2="53" y2="38" stroke="#FFD600" strokeWidth="1" />
          </>
        )}

        {!mini && accessory.emoji === '🏆' && (
          <>
            <rect x="76" y="65" width="10" height="14" rx="2" fill="#FFD600" />
            <path d="M 76 65 Q 81 58 86 65" fill="#FFD600" />
          </>
        )}
      </svg>
    </div>
  )
}

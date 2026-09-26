import { useTranslation } from 'react-i18next'
import { useCheckInStore } from '../../stores/useCheckInStore'
import { FEELINGS, constellationFeelings, CONSTELLATION_LAYOUTS } from '../../lib/checkIn'

// The child's own pattern — and deliberately NOT a chart.
//
// The obvious build is "angry: 8 this week". That teaches a child that some
// feelings are a bad score, and a score invites comparison. So each feeling
// they have noticed appears ONCE, as a named star, and the stars are joined by
// faint lines into a small constellation — in the order each was last felt, so
// the line ends at how they feel most recently. No totals, no sizes that grow
// with frequency, no ranking. The message is "all of these are normal, and you
// noticed them".
//
// It used to be one unlabelled dot per check-in, which read as confetti: a
// child could not tell which colour was which feeling.

const TONE = {
  gold: '#FFD60A', purple: '#BF5AF2', blue: '#64D2FF',
  cyan: '#66D9FF', pink: '#FF375F', indigo: '#A68CFF',
}
const toneFor = (id) => TONE[FEELINGS.find((f) => f.id === id)?.tone] ?? '#FFFFFF'

// viewBox units; the SVG scales to the panel width.
const W = 320
const H = 200

export default function FeelingConstellation() {
  const { t } = useTranslation()
  const entries = useCheckInStore((s) => s.entries)
  const feelings = constellationFeelings(entries)
  const layout = CONSTELLATION_LAYOUTS[feelings.length] ?? []
  const points = feelings.map((id, i) => ({ id, x: layout[i][0] * W, y: layout[i][1] * H }))
  const words = feelings.map((id) => t(`checkin:feeling.${id}`))

  return (
    <div>
      <h3 className="mb-2 font-heading text-lg font-bold text-galaxy-text">
        {t('checkin:constellation.title')}
      </h3>
      {feelings.length === 0 ? (
        <p className="font-body text-sm text-galaxy-text-muted">
          {t('checkin:constellation.empty')}
        </p>
      ) : (
        <div className="w-full overflow-hidden rounded-2xl glass">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block h-auto w-full"
            role="img"
            // One sentence for the whole picture: a screen reader gets the
            // feelings as a list, which is what the drawing says to a sighted child.
            aria-label={t('checkin:constellation.aria', { feelings: words.join(', ') })}
          >
            <defs>
              <filter id="star-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* A few fixed background stars, so a single feeling still sits in a sky. */}
            {[[24, 22], [300, 30], [150, 12], [60, 150], [280, 150], [210, 96]].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill="white" opacity="0.35" />
            ))}

            {points.length > 1 && (
              <polyline
                points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="white"
                strokeOpacity="0.28"
                strokeWidth="1"
                strokeDasharray="2 3"
                strokeLinecap="round"
              />
            )}

            {points.map((p, i) => {
              // Keep labels inside the panel at the left and right edges.
              const anchor = p.x < W * 0.2 ? 'start' : p.x > W * 0.8 ? 'end' : 'middle'
              const dx = anchor === 'start' ? -6 : anchor === 'end' ? 6 : 0
              return (
                <g key={p.id}>
                  <circle cx={p.x} cy={p.y} r="5" fill={toneFor(p.id)} filter="url(#star-glow)" />
                  <circle cx={p.x} cy={p.y} r="2" fill="white" />
                  <text
                    x={p.x + dx}
                    y={p.y + 19}
                    textAnchor={anchor}
                    fill={toneFor(p.id)}
                    className="font-heading"
                    style={{ fontSize: 13, fontWeight: 700 }}
                  >
                    {words[i]}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}

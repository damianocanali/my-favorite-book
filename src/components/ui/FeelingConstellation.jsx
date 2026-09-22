import { useTranslation } from 'react-i18next'
import { useCheckInStore } from '../../stores/useCheckInStore'
import { FEELINGS } from '../../lib/checkIn'
import { formatDate } from '../../i18n/formats'

// The child's own pattern — and deliberately NOT a chart.
//
// The obvious build is "angry: 8 this week". That teaches a child that some
// feelings are a bad score, and a score invites comparison. So: one star per
// check-in, coloured by feeling, no totals, no ranking, no trend line. The
// message the layout carries is "all of these are normal, and you noticed
// them".
//
// Positions are derived from the entry timestamp rather than random, so the
// sky is stable between renders instead of rearranging itself each visit.

const TONE = {
  gold: '#FFD60A', purple: '#BF5AF2', blue: '#64D2FF',
  cyan: '#66D9FF', pink: '#FF375F', indigo: '#A68CFF',
}
const toneFor = (id) => TONE[FEELINGS.find((f) => f.id === id)?.tone] ?? '#FFFFFF'

export default function FeelingConstellation() {
  const { t } = useTranslation()
  const entries = useCheckInStore((s) => s.entries)

  return (
    <div>
      <h3 className="mb-2 font-heading text-lg font-bold text-galaxy-text">
        {t('checkin:constellation.title')}
      </h3>
      {entries.length === 0 ? (
        <p className="font-body text-sm text-galaxy-text-muted">
          {t('checkin:constellation.empty')}
        </p>
      ) : (
        <div className="relative h-40 w-full overflow-hidden rounded-2xl glass">
          {entries.map((e) => {
            const seed = Date.parse(e.at)
            const left = (seed % 89) / 89 * 92 + 4
            const top = (Math.floor(seed / 1000) % 61) / 61 * 76 + 12
            const label = t('checkin:constellation.star_aria', {
              feeling: t(`checkin:feeling.${e.feeling}`),
              date: formatDate(e.at, 'medium'),
            })
            return (
              // role="img" + aria-label (not `title`) is what actually gets this
              // announced: a bare, non-interactive <span> with only a `title`
              // often falls out of the accessibility tree entirely, and even
              // where it doesn't, `title` needs a mouse hover that touch and
              // keyboard users never get. This isn't a control — there is
              // nothing to activate — so it stays out of the tab order and
              // relies on a screen reader's normal browse/virtual-cursor
              // navigation, the same way an inline chart's data points would.
              <span
                key={e.at}
                role="img"
                aria-label={label}
                className="absolute block h-2 w-2 rounded-full"
                style={{
                  left: `${left}%`, top: `${top}%`,
                  background: toneFor(e.feeling),
                  boxShadow: `0 0 8px ${toneFor(e.feeling)}`,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

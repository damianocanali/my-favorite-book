import { useTranslation } from 'react-i18next'
import { Undo2 } from 'lucide-react'
import { PICTURES } from '../../../lib/school/pictures.js'

// Presentational: the 3 picture-secret slots plus the 16-picture keypad.
// Callbacks out, no state of its own — ClassSignInPage owns `picked`,
// decides when 3 picks means "submit", and drives `shake` on a wrong
// guess. The shake itself is a plain Tailwind `animate-shake` utility
// (tailwind.config.js): the app-wide `@media (prefers-reduced-motion:
// reduce)` rule in index.css already forces every animation's duration to
// 0.01ms, so it needs no reduced-motion handling of its own.
export default function PicturePad({ picked, onPick, onBack, shake, disabled }) {
  const { t } = useTranslation()
  const slots = [0, 1, 2]

  return (
    <div>
      <div
        className={`flex justify-center gap-3 md:gap-2 mb-6 md:mb-2 ${shake ? 'animate-shake' : ''}`}
        aria-hidden="true"
      >
        {slots.map((i) => {
          const id = picked[i]
          const picture = id ? PICTURES.find((p) => p.id === id) : null
          return (
            <div
              key={i}
              // Display only, never a tap target — free to shrink at md+
              // to help the whole picture step fit an iPad screen without
              // scrolling, unlike the picture buttons below.
              className={`w-20 h-20 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-4xl md:text-3xl border-2 ${
                picture ? 'border-galaxy-primary bg-galaxy-primary/15' : 'border-dashed border-galaxy-text-muted/30'
              }`}
            >
              {picture?.emoji}
            </div>
          )
        })}
      </div>

      <div className="flex justify-center mb-4 md:mb-1">
        <button
          type="button"
          onClick={onBack}
          // Also disabled while `shake` plays: a tap that lands during the
          // wrong-guess feedback used to be silently swallowed by onBack
          // popping a picture the child never saw land (the slots were
          // about to clear anyway) — better to make the pad visibly
          // unresponsive for that instant than to accept a tap it can't
          // act on sensibly.
          disabled={disabled || shake || picked.length === 0}
          aria-label={t('school:picture_step.back_aria')}
          className="min-h-[48px] md:min-h-[40px] flex items-center gap-1.5 px-4 py-2 md:py-1.5 rounded-xl font-body font-semibold text-sm text-galaxy-text-muted border border-galaxy-text-muted/20 hover:text-galaxy-text hover:border-galaxy-text-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Undo2 size={15} aria-hidden="true" />
          {t('school:picture_step.back')}
        </button>
      </div>

      {/* Capped at md+ so the 4 columns land near a 96-100px square
          regardless of how wide the card itself is — without this, `w-full`
          + `aspect-square` just grow each button to fill whatever the card's
          own (much wider, to suit the name step's tiles) max-width gives
          each column, which is what was actually making 4 rows of these
          taller than a 1024x768 iPad-landscape viewport. Unconstrained
          below md, so phones are unaffected. */}
      <div className="md:mx-auto md:max-w-[420px]">
        <div className="grid grid-cols-4 gap-3 md:gap-2">
          {PICTURES.map((picture) => (
            <button
              key={picture.id}
              type="button"
              onClick={() => onPick(picture.id)}
              // Same reasoning as the back button above: a guess tapped
              // while the slots are shaking would otherwise be accepted and
              // silently lost when they clear a moment later.
              disabled={disabled || shake}
              aria-label={t(`school:pictures.${picture.id}`)}
              // A real tap target, so it keeps a 96px floor at every size —
              // it was 110px at md+ to fill more of an iPad screen, but that
              // made the picture step taller than a 1024x768
              // iPad-landscape viewport; back down to the phone floor,
              // combined with the width cap above, is the brief's own
              // explicit fallback.
              className="min-w-[96px] min-h-[96px] w-full aspect-square flex items-center justify-center text-4xl rounded-card glass border border-galaxy-text-muted/10 hover:border-galaxy-secondary/50 hover:bg-white/[0.08] active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <span aria-hidden="true">{picture.emoji}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

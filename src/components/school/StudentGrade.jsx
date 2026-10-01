import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lightbulb, Volume2, VolumeX, Undo2, PenLine } from 'lucide-react'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import { LEVELS, LEVEL_EMOJI, LEVEL_TONE, tipLabel } from './gradingUi'

// Grading with tips, the child's side: their OWN level (a friendly badge,
// never a score, never anyone else's), the teacher's tips each with Read
// aloud, and "sent back — try again". Used inside the existing assignment
// card and feedback modal only. iPad: StudentGradeViews.swift.

export function StudentLevelBadge({ level, compact = false }) {
  const { t } = useTranslation()
  if (!LEVELS.includes(level)) return null
  if (compact) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm font-body font-semibold text-galaxy-text">
        <span aria-hidden="true" className="text-lg leading-none">{LEVEL_EMOJI[level]}</span>
        {t(`school:grading.levels.${level}`)}
      </p>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="text-5xl leading-none">{LEVEL_EMOJI[level]}</span>
      <div>
        <p className="text-xs font-body font-bold text-galaxy-text-muted">{t('school:grading.student.level_heading')}</p>
        <p className="font-heading text-2xl font-bold text-galaxy-text">{t(`school:grading.levels.${level}`)}</p>
      </div>
    </div>
  )
}

function TipItem({ label }) {
  const { t } = useTranslation()
  const { speak, stop, isSpeaking, isSupported } = useSpeechSynthesis()
  const [mine, setMine] = useState(false)

  useEffect(() => {
    if (!isSpeaking) setMine(false)
  }, [isSpeaking])

  function toggle() {
    if (mine && isSpeaking) {
      stop()
      setMine(false)
    } else {
      setMine(true)
      speak(label)
    }
  }

  return (
    <li className="flex items-start gap-2">
      <Lightbulb size={18} className="text-amber-300 mt-1 shrink-0" aria-hidden="true" />
      <p className="flex-1 min-w-0 font-body text-galaxy-text">{label}</p>
      {isSupported && (
        <button
          type="button"
          onClick={toggle}
          aria-label={mine && isSpeaking ? t('school:actions.stop_listening') : t('school:grading.student.listen_tip')}
          className="shrink-0 p-2.5 rounded-xl text-galaxy-secondary hover:bg-white/[0.08] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          {mine && isSpeaking ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
        </button>
      )}
    </li>
  )
}

// The level and the tips, on the feedback modal.
export function StudentGradeCard({ grade }) {
  const { t } = useTranslation()
  const labels = (grade?.tips ?? []).map((tip) => tipLabel(t, tip)).filter(Boolean)
  if (!grade) return null
  return (
    <div className={`rounded-2xl p-4 border space-y-3 ${LEVEL_TONE[grade.level] ?? 'border-galaxy-text-muted/10'}`}>
      <StudentLevelBadge level={grade.level} />
      {labels.length > 0 && (
        <>
          <h3 className="font-heading text-sm font-bold text-amber-200">{t('school:grading.student.tips_heading')}</h3>
          <ul className="space-y-1">
            {labels.map((label) => <TipItem key={label} label={label} />)}
          </ul>
        </>
      )}
    </div>
  )
}

// "Your teacher sent this back with tips. Try again!" + the button that
// opens their book to revise and hand in again. Calm: no pulsing.
export function SentBackBanner({ onTryAgain }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl p-3 bg-orange-400/10 border border-orange-300/30 space-y-2">
      <p className="flex items-start gap-2 font-body text-sm font-semibold text-galaxy-text">
        <Undo2 size={18} className="text-orange-300 shrink-0 mt-0.5" aria-hidden="true" />
        {t('school:grading.student.sent_back')}
      </p>
      {onTryAgain && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTryAgain() }}
          className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl font-body font-bold text-sm text-white bg-orange-400/25 border border-orange-300/60 hover:bg-orange-400/35 transition-colors"
        >
          <PenLine size={16} aria-hidden="true" /> {t('school:grading.student.try_again')}
        </button>
      )}
    </div>
  )
}

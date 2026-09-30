import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'motion/react'
import { Volume2, VolumeX, PenLine } from 'lucide-react'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import { nudgeText, nudgeTeacher } from './nudgeUi'

// The teacher's note at the top of "From your teacher" (a class account's
// home). Presentational only — MyAssignments owns the fetch, "Got it" and
// where the big button goes. A preset is shown (and read aloud) in the
// child's app language; a custom message exactly as the teacher wrote it.
export default function StudentNudgeCard({ nudge, actionLabel, onAction, onGotIt }) {
  const { t, i18n } = useTranslation()
  const reduceMotion = useReducedMotion()
  const { speak, stop, isSpeaking, isSupported } = useSpeechSynthesis()
  const name = nudgeTeacher(t, nudge)
  const text = nudgeText(t, nudge)
  const spoken = t('school:nudges.student.spoken', { name, message: text })

  return (
    <motion.div
      className="rounded-2xl p-4 border-2 border-amber-400/50 bg-gradient-to-br from-amber-400/15 to-pink-400/10 space-y-4"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-4xl leading-none">💌</span>
        {/* One sentence for a screen reader: who it's from and what it says. */}
        <div className="flex-1 min-w-0" role="group" aria-label={spoken}>
          <p aria-hidden="true" className="font-body text-sm font-semibold text-amber-200">
            {t('school:nudges.student.says', { name })}
          </p>
          <p aria-hidden="true" className="font-heading text-xl font-bold text-galaxy-text break-words">{text}</p>
        </div>
        {isSupported && (
          <button
            type="button"
            onClick={() => (isSpeaking ? stop() : speak(spoken, i18n.language))}
            aria-label={isSpeaking ? t('school:actions.stop_listening') : t('school:nudges.student.listen_aria')}
            className="shrink-0 rounded-full bg-galaxy-secondary/15 text-galaxy-secondary hover:bg-galaxy-secondary/25 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            {isSpeaking ? <VolumeX size={22} aria-hidden="true" /> : <Volume2 size={22} aria-hidden="true" />}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => { stop(); onAction() }}
          className="inline-flex items-center gap-2 px-6 py-3 min-h-[48px] rounded-xl font-body font-bold text-base text-white btn-fill-primary transition-colors"
        >
          <PenLine size={18} aria-hidden="true" />
          {actionLabel}
        </button>
        <button
          type="button"
          onClick={() => { stop(); onGotIt() }}
          className="px-5 py-3 min-h-[48px] rounded-xl font-body font-bold text-base text-galaxy-text border border-galaxy-text-muted/40 hover:bg-white/5 transition-colors"
        >
          {t('school:nudges.student.got_it')}
        </button>
      </div>
    </motion.div>
  )
}

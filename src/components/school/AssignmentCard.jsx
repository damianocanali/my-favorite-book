import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'motion/react'
import { Volume2, VolumeX, Sparkles } from 'lucide-react'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import { assignmentCardStatus, canHandInAgain, hasUnseenFeedback, dueWording } from './assignmentStudentUi'

const STATUS_TONE = {
  not_started: 'bg-galaxy-text-muted/10 text-galaxy-text-muted border-galaxy-text-muted/20',
  handed_in: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  closed: 'bg-galaxy-text-muted/10 text-galaxy-text-muted border-galaxy-text-muted/20',
}

// Kinds that read as urgent-but-friendly get the secondary (cyan) accent;
// 'none' just recedes.
const DUE_TONE = {
  none: 'text-galaxy-text-muted',
  today: 'text-galaxy-secondary font-semibold',
  tomorrow: 'text-galaxy-secondary',
  weekday: 'text-galaxy-text-muted',
  date: 'text-galaxy-text-muted',
  late_ok: 'text-amber-300 font-semibold',
  past_due: 'text-red-400',
}

function DueText({ assignment }) {
  const { t, i18n } = useTranslation()
  const w = dueWording(assignment)
  if (w.kind === 'none') return <span className={DUE_TONE.none}>{t('school:student.assignments.due.none')}</span>
  if (w.kind === 'weekday') {
    const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(w.date)
    return <span className={DUE_TONE.weekday}>{t('school:student.assignments.due.weekday', { weekday })}</span>
  }
  if (w.kind === 'date') {
    const date = new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric' }).format(w.date)
    return <span className={DUE_TONE.date}>{t('school:student.assignments.due.date', { date })}</span>
  }
  return <span className={DUE_TONE[w.kind]}>{t(`school:student.assignments.due.${w.kind}`)}</span>
}

// One assignment on the bookshelf (brief S3 #1). Presentational only — all
// the fetching/navigation/book-tagging lives in MyAssignments, the same
// split as AssignmentReview/StudentRow on the teacher side.
export default function AssignmentCard({ assignment, onStartWriting, onOpenHandedIn, onSeeFeedback }) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const { speak, stop, isSpeaking, isSupported: ttsSupported } = useSpeechSynthesis()
  const status = assignmentCardStatus(assignment)
  const unseen = hasUnseenFeedback(assignment)
  const canHandedInAgain = status === 'handed_in' && canHandInAgain(assignment)

  function handleListen() {
    if (isSpeaking) stop()
    else speak(assignment.prompt)
  }

  return (
    <motion.div
      className="glass rounded-2xl p-4 border border-galaxy-text-muted/10 space-y-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading text-base font-bold text-galaxy-text min-w-0 break-words">{assignment.title}</h3>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-body font-semibold border ${STATUS_TONE[status]}`}>
          {t(`school:student.assignments.status.${status}`)}
        </span>
      </div>

      <div className="flex items-start gap-2">
        <p className="flex-1 min-w-0 text-galaxy-text-muted font-body text-sm">{assignment.prompt}</p>
        {ttsSupported && (
          <button
            type="button"
            onClick={handleListen}
            aria-label={isSpeaking ? t('school:actions.stop_listening') : t('school:student.assignments.prompt_listen_aria')}
            className="shrink-0 p-3 rounded-full bg-galaxy-secondary/15 text-galaxy-secondary hover:bg-galaxy-secondary/25 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {isSpeaking ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
          </button>
        )}
      </div>

      <p className="text-xs font-body"><DueText assignment={assignment} /></p>

      {unseen && (
        <motion.button
          type="button"
          onClick={onSeeFeedback}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-400/20 to-pink-400/20 border border-amber-400/30 text-amber-200 font-body font-semibold text-sm"
          animate={prefersReducedMotion ? {} : { scale: [1, 1.03, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Sparkles size={16} aria-hidden="true" /> {t('school:student.assignments.new_feedback')}
        </motion.button>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {status === 'not_started' && (
          <button
            type="button"
            onClick={onStartWriting}
            className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors"
          >
            {t('school:student.assignments.start_writing')}
          </button>
        )}
        {status === 'handed_in' && (
          <button
            type="button"
            onClick={onOpenHandedIn}
            className="px-4 py-2 rounded-xl font-body font-semibold text-sm text-galaxy-text border border-galaxy-text-muted/30 hover:border-galaxy-text-muted/50 transition-colors"
          >
            {canHandedInAgain ? t('school:student.assignments.hand_in_again') : t('school:student.assignments.open_handed_in')}
          </button>
        )}
        {assignment.my_submission && !unseen && (
          <button
            type="button"
            onClick={onSeeFeedback}
            className="px-4 py-2 rounded-xl font-body font-semibold text-sm text-galaxy-text-muted hover:text-galaxy-text transition-colors"
          >
            {t('school:student.assignments.see_feedback')}
          </button>
        )}
      </div>
    </motion.div>
  )
}

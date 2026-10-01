import { useTranslation } from 'react-i18next'
import { handInChipKey } from './assignmentUi'

// Shared by AssignmentReview's per-student row and the dashboard
// StudentsTable's assignment column, so a "Late" hand-in reads the same
// color and copy in both places. `row` is either the raw dashboard string
// or a submissions.js row ({status, late}) — handInChipKey flattens both.
const TONE = {
  handed_in: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  late: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  not_started: 'bg-galaxy-text-muted/10 text-galaxy-text-muted border-galaxy-text-muted/20',
  // Sent back to revise: warm, not alarming.
  revising: 'bg-orange-400/15 text-orange-200 border-orange-300/40',
}

export default function HandInChip({ row, className = '' }) {
  const { t } = useTranslation()
  const key = handInChipKey(row)
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body font-semibold border ${TONE[key]} ${className}`}
    >
      {t(`school:teacher.assignments.review.status.${key}`)}
    </span>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { ClipboardList } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { useBookStore } from '../../stores/useBookStore'
import { useBookshelfStore } from '../../stores/useBookshelfStore'
import AssignmentCard from './AssignmentCard'
import StudentFeedbackModal from './StudentFeedbackModal'

// "My assignments" at the top of the bookshelf (brief S3 #1) — student
// accounts only; BookshelfPage renders this behind useIsStudent so a
// consumer account never even mounts it. Owns the fetch and the
// start-writing/hand-in-again navigation; AssignmentCard itself is purely
// presentational (same split as AssignmentReview/StudentRow on the teacher
// side).
export default function MyAssignments() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const books = useBookshelfStore((s) => s.books)
  const startNewBook = useBookStore((s) => s.startNewBook)
  const tagAssignment = useBookStore((s) => s.tagAssignment)
  const loadBook = useBookStore((s) => s.loadBook)

  const [assignments, setAssignments] = useState(null) // null while loading
  const [error, setError] = useState(null)
  const [feedbackFor, setFeedbackFor] = useState(null) // the assignment whose feedback is open

  const load = useCallback(async () => {
    setError(null)
    const res = await schoolFetch('/api/school/assignments')
    if (res.ok) setAssignments(res.data.assignments ?? [])
    else setError(res.code || 'generic')
  }, [])

  useEffect(() => { load() }, [load])

  // A book already tagged for this assignment (see useBookStore's
  // tagAssignment) — lets "Start writing" resume a draft instead of
  // starting a second book, and "Hand in again"/"Handed in" open the
  // actual submitted book rather than only offering to make a new one.
  const findBook = (assignmentId) => books.find((b) => b.assignmentId === assignmentId)

  function startOrContinue(assignment) {
    const existing = findBook(assignment.id)
    if (existing) {
      // Same shortcut PreviewPage's own Edit button uses: load the book,
      // then push the step past the wizard so CreatePage opens straight
      // into the page editor instead of replaying the setup wizard.
      loadBook(existing)
      useBookStore.getState().setStep(7)
    } else {
      startNewBook()
      tagAssignment({ id: assignment.id, title: assignment.title, prompt: assignment.prompt })
    }
    navigate('/create')
  }

  function openHandedIn(assignment) {
    const existing = findBook(assignment.id)
    if (existing) navigate(`/preview/${existing.id}`)
    else startOrContinue(assignment)
  }

  function markSeen(assignmentId) {
    setAssignments((prev) =>
      (prev ?? []).map((a) =>
        a.id === assignmentId && a.my_submission
          ? { ...a, my_submission: { ...a.my_submission, feedback_unseen: 0 } }
          : a
      )
    )
  }

  // Quiet failure/loading — a broken schools API (or the first render
  // before the fetch resolves) shouldn't block or flash empty above a
  // child's own bookshelf, which works regardless.
  if (!assignments || !assignments.length || error) return null

  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList size={20} className="text-galaxy-secondary shrink-0" />
        <h2 className="font-heading text-xl font-bold text-galaxy-text">{t('school:student.assignments.heading')}</h2>
      </div>

      <motion.div
        className="grid gap-4 sm:grid-cols-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {assignments.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            onStartWriting={() => startOrContinue(assignment)}
            onOpenHandedIn={() => openHandedIn(assignment)}
            onSeeFeedback={() => setFeedbackFor(assignment)}
          />
        ))}
      </motion.div>

      <AnimatePresence>
        {feedbackFor && (
          <StudentFeedbackModal
            submissionId={feedbackFor.my_submission.id}
            onSeen={() => markSeen(feedbackFor.id)}
            onClose={() => setFeedbackFor(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

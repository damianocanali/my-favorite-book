import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { ClipboardList } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { useBookStore } from '../../stores/useBookStore'
import { useBookshelfStore } from '../../stores/useBookshelfStore'
import { useAuthStore } from '../../stores/useAuthStore'
import AssignmentCard from './AssignmentCard'
import {
  homeStatus, showsOnHome, sortForHome, startDecision,
  readSeenAssignments, markAssignmentSeen, pruneSeenAssignments,
} from './assignmentStudentUi'
import StudentFeedbackModal from './StudentFeedbackModal'

const POLL_MS = 60 * 1000

// "From your teacher" at the top of the bookshelf, a class account's home —
// student accounts only; BookshelfPage renders this behind useIsStudent so a
// consumer account never even mounts it. Owns the fetch and the
// start-writing/hand-in-again navigation; AssignmentCard itself is purely
// presentational (same split as AssignmentReview/StudentRow on the teacher
// side). Same list, order, statuses and "New" badges as the iPad's
// MyAssignmentsSection.
//
// Students are on shared devices and get no push: a just-published
// assignment arrives by re-reading the list every minute while the tab is
// visible, and as soon as it becomes visible again.
export default function MyAssignments() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const books = useBookshelfStore((s) => s.books)
  const startNewBook = useBookStore((s) => s.startNewBook)
  const tagAssignment = useBookStore((s) => s.tagAssignment)
  const loadBook = useBookStore((s) => s.loadBook)
  const draft = useBookStore((s) => s.book)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const [seen, setSeen] = useState(() => readSeenAssignments(userId))
  useEffect(() => { setSeen(readSeenAssignments(userId)) }, [userId])

  const [assignments, setAssignments] = useState(null) // null while loading
  const [error, setError] = useState(null)
  const [feedbackFor, setFeedbackFor] = useState(null) // the assignment whose feedback is open

  const loaded = useRef(false)
  const load = useCallback(async () => {
    const res = await schoolFetch('/api/school/assignments')
    if (res.ok) {
      loaded.current = true
      setError(null)
      const list = res.data.assignments ?? []
      setAssignments(list)
      setSeen(pruneSeenAssignments(useAuthStore.getState().user?.id ?? null, list.map((a) => a.id)))
    } else if (!loaded.current) {
      // A failed poll keeps what is on screen; only a first load hides it.
      setError(res.code || 'generic')
    }
  }, [])

  useEffect(() => {
    load()
    const tick = () => {
      if (document.visibilityState === 'visible') load()
    }
    const timer = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [load])

  function markOpened(assignmentId) {
    if (seen.has(assignmentId)) return
    setSeen(new Set(markAssignmentSeen(userId, assignmentId)))
  }

  // A book already tagged for this assignment (see useBookStore's
  // tagAssignment) — lets "Start writing" resume a draft instead of
  // starting a second book, and "Hand in again"/"Handed in" open the
  // actual submitted book rather than only offering to make a new one.
  const findBook = (assignmentId) => books.find((b) => b.assignmentId === assignmentId)

  // Started counts the draft open in the editor too, not only saved books.
  const isStarted = useCallback(
    (id) => draft?.assignmentId === id || books.some((b) => b.assignmentId === id),
    [books, draft]
  )
  const statusOf = useCallback(
    (a) => homeStatus(a, { hasBook: isStarted(a.id), seen: seen.has(a.id) }),
    [isStarted, seen]
  )
  const visible = useMemo(
    () => sortForHome((assignments ?? []).filter(showsOnHome), statusOf),
    [assignments, statusOf]
  )

  // Never silently wipes work: the draft already open for this assignment
  // is just returned to, and any other draft with something in it is only
  // replaced after the child says so (same as the iPad).
  function startOrContinue(assignment) {
    markOpened(assignment.id)
    const decision = startDecision(useBookStore.getState().book, assignment.id)
    if (decision === 'resume') {
      navigate('/create')
      return
    }
    if (decision === 'confirm' && !window.confirm(t('school:student.assignments.replace_draft'))) return
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
  if (!visible.length || error) return null

  return (
    <section className="mb-10 rounded-3xl p-4 sm:p-5 border border-galaxy-secondary/30 bg-gradient-to-br from-galaxy-secondary/10 to-galaxy-primary/10">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList size={22} className="text-galaxy-secondary shrink-0" />
        <h2 className="font-heading text-2xl font-bold text-galaxy-text">{t('school:student.assignments.from_teacher')}</h2>
      </div>

      <motion.div
        className="grid gap-4 sm:grid-cols-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {visible.map((assignment) => (
          <AssignmentCard
            key={assignment.id}
            assignment={assignment}
            homeStatus={statusOf(assignment)}
            hasBook={isStarted(assignment.id)}
            onOpen={() => markOpened(assignment.id)}
            onStartWriting={() => startOrContinue(assignment)}
            onOpenHandedIn={() => openHandedIn(assignment)}
            onSeeFeedback={() => {
              markOpened(assignment.id)
              setFeedbackFor(assignment)
            }}
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
    </section>
  )
}

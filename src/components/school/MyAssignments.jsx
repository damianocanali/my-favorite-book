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
  readSeenAssignments, markAssignmentSeen, pruneSeenAssignments, classBadgeCount,
} from './assignmentStudentUi'
import { useClassBadgeStore } from '../../stores/useClassBadgeStore'
import StudentFeedbackModal from './StudentFeedbackModal'
import StudentNudgeCard from './StudentNudgeCard'
import { nudgeAction } from './nudgeUi'

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
  // The teacher's unread nudge (api/school/nudges.js), shown first. Ids
  // dismissed here stay hidden even if a poll races the "Got it" PATCH.
  const [nudge, setNudge] = useState(null)
  const dismissedNudges = useRef(new Set())

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
    // Independent of the list: a failed read keeps whatever is shown.
    const n = await schoolFetch('/api/school/nudges')
    if (n.ok) {
      const next = n.data?.nudge ?? null
      const gone = dismissedNudges.current.has(next?.id) || useClassBadgeStore.getState().dismissedNudges.has(next?.id)
      setNudge(next && !gone ? next : null)
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

  // The Class tab's badge follows this section while it is on screen: a
  // just-opened assignment drops off it at once (TabBar polls on its own
  // while the child is elsewhere).
  const setBadge = useClassBadgeStore((s) => s.setCount)
  useEffect(() => {
    if (assignments === null) return
    setBadge(classBadgeCount(assignments, { seen, isStarted, hasNudge: !!nudge }))
  }, [assignments, seen, isStarted, nudge, setBadge])

  // Never silently wipes work: the draft already open for this assignment
  // is just returned to, and any other draft with something in it is only
  // replaced after the child says so (same as the iPad).
  function startOrContinue(assignment) {
    markOpened(assignment.id)
    const decision = startDecision(useBookStore.getState().book, assignment.id)
    if (decision === 'resume') {
      navigate('/create')
      return true
    }
    if (decision === 'confirm' && !window.confirm(t('school:student.assignments.replace_draft'))) return false
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
    return true
  }

  function openHandedIn(assignment) {
    const existing = findBook(assignment.id)
    if (existing) navigate(`/preview/${existing.id}`)
    else startOrContinue(assignment)
  }

  const nudgeNext = nudge ? nudgeAction(nudge, { assignments: assignments ?? [], books, draft }) : null
  const nudgeLabel = !nudgeNext
    ? ''
    : nudgeNext.kind === 'assignment'
      ? (isStarted(nudgeNext.assignment.id) ? t('school:student.assignments.continue_writing') : t('school:student.assignments.start_writing'))
      : nudgeNext.kind === 'create'
        ? t('school:nudges.student.create_book')
        : t('school:nudges.student.keep_writing')

  function dismissNudge() {
    if (!nudge) return
    dismissedNudges.current.add(nudge.id)
    useClassBadgeStore.getState().dismissNudge(nudge.id)
    const id = nudge.id
    setNudge(null)
    // Best-effort: a failure only means the card may come back next poll.
    schoolFetch('/api/school/nudges', { method: 'PATCH', body: JSON.stringify({ id }) })
  }

  // The big button: the linked assignment's Start/Continue writing (same
  // path as its card), else the book in progress, the most recent book, or
  // a new one. Acting on the note counts as reading it — but only once the
  // action really goes ahead (not when the child cancels "replace draft?").
  function actOnNudge() {
    const next = nudgeNext
    if (!next) return
    if (next.kind === 'assignment') {
      if (startOrContinue(next.assignment)) dismissNudge()
      return
    }
    dismissNudge()
    if (next.kind === 'book') {
      loadBook(next.book)
      useBookStore.getState().setStep(7)
    } else if (next.kind === 'create') {
      startNewBook()
    }
    navigate('/create')
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
  if (!nudge && (!visible.length || error)) return null

  return (
    <section className="mb-10 rounded-3xl p-4 sm:p-5 border border-galaxy-secondary/30 bg-gradient-to-br from-galaxy-secondary/10 to-galaxy-primary/10">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList size={22} className="text-galaxy-secondary shrink-0" />
        <h2 className="font-heading text-2xl font-bold text-galaxy-text">{t('school:student.assignments.from_teacher')}</h2>
      </div>

      {nudge && (
        <div className={visible.length && !error ? 'mb-4' : ''}>
          <StudentNudgeCard nudge={nudge} actionLabel={nudgeLabel} onAction={actOnNudge} onGotIt={dismissNudge} />
        </div>
      )}

      {visible.length > 0 && !error && (
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
      )}

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

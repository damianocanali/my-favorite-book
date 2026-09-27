import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { GraduationCap, BookOpenCheck, ChevronRight } from 'lucide-react'
import { schoolFetch } from '../lib/schoolApi'
import { teacherErrorText } from '../components/school/teacherErrors'
import { sortHelp, filterRecentlySeen, SEEN_SUPPRESS_MS } from '../lib/dashboardHelp'
import { getRememberedClassId, setRememberedClassId, pickClassId } from '../lib/dashboardClass'
import { enterKidsPreview } from '../lib/viewMode'
import NeedsYouNow from '../components/school/NeedsYouNow'
import ClassGlance from '../components/school/ClassGlance'
import StudentsTable from '../components/school/StudentsTable'
import StudentDetailDrawer from '../components/school/StudentDetailDrawer'

const POLL_MS = 30 * 1000

function SkeletonBlock({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-white/[0.06] ${className}`} />
}

export default function TeacherDashboardPage() {
  const { t, i18n } = useTranslation()

  // Cross-class load: every class this teacher owns, plus unseen help asks
  // across all of them (the "needs you now" strip — owner decision D7).
  const [classes, setClasses] = useState(null) // null = not loaded yet
  const [help, setHelp] = useState([])
  const [dashError, setDashError] = useState(null)

  // The selected class's own summary/roster — a second, smaller fetch kept
  // separate so switching classes never re-triggers the cross-class load
  // (and its 30s poll) for no reason.
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [classData, setClassData] = useState(null)
  const [classLoading, setClassLoading] = useState(false)
  const [classError, setClassError] = useState(null)

  const [openStudent, setOpenStudent] = useState(null)
  const [helpActionError, setHelpActionError] = useState(null)

  // id -> ms timestamp a just-marked-Seen row stays excluded from poll
  // results (see filterRecentlySeen's own comment for the race this
  // closes). A ref, not state: it's read/written from callbacks and must
  // never itself trigger a re-render.
  const recentlySeenUntil = useRef(new Map())

  const loadDashboard = useCallback(async () => {
    setDashError(null)
    const res = await schoolFetch('/api/school/dashboard')
    if (!res.ok) {
      setDashError(res.code || 'generic')
      return
    }
    const nextClasses = res.data?.classes ?? []
    setClasses(nextClasses)
    setHelp(filterRecentlySeen(res.data?.help ?? [], recentlySeenUntil.current))
    setSelectedClassId((prev) => {
      // Keep whatever the teacher already has open if it's still valid —
      // only re-derive from the remembered id on the very first load (prev
      // is null then), so a 30s poll never yanks the switcher back to a
      // remembered class the teacher has since navigated away from.
      if (prev && nextClasses.some((c) => c.id === prev)) return prev
      const picked = pickClassId(nextClasses, getRememberedClassId())
      return picked
    })
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // Poll the cross-class "needs you now" list every 30s, but only while
  // this tab is actually visible — a teacher who switched tabs an hour ago
  // doesn't need 120 silent background requests waiting for them to come
  // back, and a poll firing on a hidden tab could also resurrect a help ask
  // the teacher just marked Seen elsewhere before this tab's next repaint.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') loadDashboard()
    }
    const timer = setInterval(tick, POLL_MS)
    return () => clearInterval(timer)
  }, [loadDashboard])

  const loadClass = useCallback(async (classId) => {
    if (!classId) return
    setClassLoading(true)
    setClassError(null)
    const res = await schoolFetch(`/api/school/dashboard?classId=${encodeURIComponent(classId)}`)
    setClassLoading(false)
    if (res.ok) setClassData(res.data)
    else setClassError(res.code || 'generic')
  }, [])

  useEffect(() => {
    if (selectedClassId) loadClass(selectedClassId)
  }, [selectedClassId, loadClass])

  function handleSelectClass(classId) {
    setSelectedClassId(classId)
    setRememberedClassId(classId)
    // Without this, the previous class's summary/roster stays on screen
    // (classData is only replaced once the new fetch resolves), which
    // reads as "this is Room 6's data" for however long the request takes
    // rather than as a loading state.
    setClassData(null)
  }

  async function handleSeen(item) {
    setHelpActionError(null)
    setHelp((prev) => prev.filter((h) => h.id !== item.id))
    const res = await schoolFetch('/api/school/help-seen', {
      method: 'POST',
      body: JSON.stringify({ id: item.id }),
    })
    if (res.ok) {
      // Only on confirmed success — a failed Seen restores the row below
      // and must not also suppress it from the very next poll.
      recentlySeenUntil.current.set(item.id, Date.now() + SEEN_SUPPRESS_MS)
    } else {
      setHelp((prev) => sortHelp([...prev, item]))
      setHelpActionError(teacherErrorText(t, res.code || 'generic'))
    }
  }

  // Initial load (classes still null): whole-page loading/error.
  if (classes === null) {
    if (dashError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-red-400 font-body text-lg">{teacherErrorText(t, dashError)}</p>
          <button
            onClick={loadDashboard}
            className="px-4 py-2.5 rounded-xl font-body font-bold text-white btn-fill-primary transition-colors"
          >
            {t('common:actions.retry')}
          </button>
        </div>
      )
    }
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="h-24" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-20" />)}
        </div>
        <SkeletonBlock className="h-64" />
      </div>
    )
  }

  if (classes.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-galaxy-secondary/20 flex items-center justify-center">
          <GraduationCap size={40} className="text-galaxy-secondary" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-galaxy-text mb-2">
          {t('school:teacher.dashboard.empty.heading')}
        </h1>
        <p className="text-galaxy-text-muted font-body mb-6">{t('school:teacher.dashboard.empty.body')}</p>
        <Link
          to="/teacher/classes"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-body font-bold text-white btn-fill-primary transition-colors"
        >
          {t('school:teacher.dashboard.empty.cta')} <ChevronRight size={16} />
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <motion.div
        className="flex flex-wrap items-center justify-between gap-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="font-heading text-2xl font-bold text-galaxy-text">{t('school:teacher.dashboard.title')}</h1>
        <div className="flex items-center gap-3">
          {classes.length > 1 && (
            <select
              value={selectedClassId ?? ''}
              onChange={(e) => handleSelectClass(e.target.value)}
              aria-label={t('school:teacher.dashboard.class_switcher.aria_label')}
              className="px-3 py-2 bg-galaxy-bg border border-galaxy-secondary/30 rounded-xl text-galaxy-text font-body text-sm focus:border-galaxy-secondary focus:outline-none"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <Link
            to="/bookshelf"
            onClick={enterKidsPreview}
            className="flex items-center gap-1.5 font-body text-sm font-semibold text-galaxy-secondary hover:underline"
          >
            <BookOpenCheck size={16} />
            {t('school:teacher.dashboard.preview_link')}
          </Link>
        </div>
      </motion.div>

      {helpActionError && <p className="text-red-400 text-sm font-body">{helpActionError}</p>}

      <NeedsYouNow help={help} onSeen={handleSeen} locale={i18n.language} />

      {classLoading && !classData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-20" />)}
          </div>
          <SkeletonBlock className="h-64" />
        </div>
      ) : classError ? (
        <div className="glass rounded-2xl p-6 border border-red-500/20 flex flex-col items-center gap-3 text-center">
          <p className="text-red-400 text-sm font-body">{teacherErrorText(t, classError)}</p>
          <button
            onClick={() => loadClass(selectedClassId)}
            className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors"
          >
            {t('common:actions.retry')}
          </button>
        </div>
      ) : classData ? (
        <>
          <ClassGlance classInfo={classData.class} summary={classData.summary} />

          <section aria-labelledby="students-heading">
            <h2 id="students-heading" className="font-heading text-lg font-bold text-galaxy-text mb-3">
              {t('school:teacher.dashboard.students.heading')}
            </h2>
            <StudentsTable students={classData.students} locale={i18n.language} onOpen={setOpenStudent} />
          </section>
        </>
      ) : null}

      {openStudent && (
        <StudentDetailDrawer
          classId={selectedClassId}
          student={openStudent}
          onClose={() => setOpenStudent(null)}
        />
      )}
    </div>
  )
}

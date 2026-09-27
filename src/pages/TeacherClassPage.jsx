import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { ArrowLeft, Copy, Check, Pencil, RefreshCw } from 'lucide-react'
import LicenseBadge from '../components/school/LicenseBadge'
import SchoolHoursEditor from '../components/school/SchoolHoursEditor'
import AddStudents from '../components/school/AddStudents'
import RosterTable from '../components/school/RosterTable'
import SignInCards from '../components/school/SignInCards'
import { schoolFetch } from '../lib/schoolApi'
import { MAX_SEATS } from '../../lib/school/license.js'

function errorText(t, code) {
  return t(`school:teacher.errors.${code}`, { defaultValue: t('school:teacher.errors.generic') })
}

export default function TeacherClassPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [classItem, setClassItem] = useState(null)
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [renamingClass, setRenamingClass] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [banner, setBanner] = useState(null)
  // Pictures are only ever visible right after a create/reset response.
  // Kept in memory only — never localStorage/sessionStorage — and wiped
  // the moment this page unmounts (see the cleanup effect below).
  const [cardsToShow, setCardsToShow] = useState(null)

  async function load() {
    setLoading(true)
    const [classesRes, studentsRes] = await Promise.all([
      schoolFetch('/api/school/classes'),
      schoolFetch(`/api/school/students?classId=${encodeURIComponent(id)}`),
    ])
    setLoading(false)
    const found = classesRes.ok ? (classesRes.data?.classes ?? []).find((c) => c.id === id) : null
    if (!found) {
      setNotFound(true)
      return
    }
    setClassItem(found)
    setNameDraft(found.name)
    if (studentsRes.ok) setStudents(studentsRes.data?.students ?? [])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Belt-and-suspenders on top of unmount: a teacher who leaves this page
  // must never carry a printable set of picture passwords with them.
  useEffect(() => () => setCardsToShow(null), [])

  async function patchClass(patch) {
    const res = await schoolFetch('/api/school/classes', {
      method: 'PATCH',
      body: JSON.stringify({ id: classItem.id, ...patch }),
    })
    if (res.ok) setClassItem(res.data.class)
    return res
  }

  function handleCopy() {
    navigator.clipboard?.writeText(classItem.code).catch(() => {})
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  async function handleRotateCode() {
    if (!window.confirm(t('school:teacher.class_page.new_code_confirm'))) return
    const res = await patchClass({ rotate_code: true })
    if (!res.ok) setBanner(errorText(t, res.code || 'generic'))
  }

  async function handleToggleSignIn() {
    const res = await patchClass({ sign_in_open: !classItem.sign_in_open })
    if (!res.ok) setBanner(errorText(t, res.code || 'generic'))
  }

  async function handleSaveClassName() {
    const name = nameDraft.trim()
    if (!name) { setRenamingClass(false); setNameDraft(classItem.name); return }
    const res = await patchClass({ name })
    if (res.ok) setRenamingClass(false)
    else setBanner(errorText(t, res.code || 'generic'))
  }

  async function handleStudentAction(studentId, action, extra) {
    const res = await schoolFetch('/api/school/students', {
      method: 'PATCH',
      body: JSON.stringify({ classId: classItem.id, id: studentId, action, ...extra }),
    })
    if (res.ok) {
      const updated = res.data.student
      setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      if (action === 'reset_secret' && res.data.pictures) {
        setCardsToShow([{
          id: updated.id,
          display_name: updated.display_name,
          avatar_emoji: updated.avatar_emoji,
          pictures: res.data.pictures,
        }])
      }
    }
    return res
  }

  function handleStudentsCreated(created) {
    const now = new Date().toISOString()
    setStudents((prev) => [
      ...prev,
      ...created.map((c) => ({
        id: c.id,
        display_name: c.display_name,
        avatar_emoji: c.avatar_emoji,
        status: 'active',
        hard_locked: false,
        locked: false,
        last_sign_in_at: null,
        created_at: now,
      })),
    ])
    setCardsToShow(created.map((c) => ({
      id: c.id, display_name: c.display_name, avatar_emoji: c.avatar_emoji, pictures: c.pictures,
    })))
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !classItem) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-galaxy-text-muted font-body text-xl">{t('school:teacher.class_page.not_found')}</p>
        <button
          onClick={() => navigate('/teacher')}
          className="flex items-center gap-2 text-galaxy-secondary font-body font-semibold hover:underline"
        >
          <ArrowLeft size={16} /> {t('school:teacher.class_page.back')}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => navigate('/teacher')}
          className="flex items-center gap-2 text-galaxy-text-muted hover:text-galaxy-text transition-colors font-body text-sm mb-4"
        >
          <ArrowLeft size={16} /> {t('school:teacher.class_page.back')}
        </button>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            {renamingClass ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveClassName()}
                  maxLength={60}
                  className="flex-1 px-3 py-2 glass border border-white/15 rounded-xl text-galaxy-text font-heading font-bold text-xl focus:border-galaxy-primary focus:outline-none"
                />
                <button
                  onClick={handleSaveClassName}
                  className="px-3 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary"
                >
                  {t('common:actions.save')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-2xl font-bold text-galaxy-text truncate">{classItem.name}</h1>
                <button
                  onClick={() => { setNameDraft(classItem.name); setRenamingClass(true) }}
                  aria-label={t('school:teacher.class_page.rename_aria')}
                  className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <LicenseBadge license={classItem.license} />
              <span className="text-galaxy-text-muted text-sm font-body">
                {t('school:teacher.card.student_count', {
                  used: classItem.student_count,
                  seats: classItem.license?.seats ?? MAX_SEATS,
                })}
              </span>
            </div>
          </div>
        </div>

        {banner && <p className="text-red-400 text-sm font-body mt-3">{banner}</p>}
      </motion.div>

      {/* Code + sign-in toggle */}
      <div className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-galaxy-text-muted text-xs font-body font-semibold uppercase tracking-wide mb-1">
              {t('school:teacher.class_page.code_heading')}
            </p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-galaxy-secondary text-2xl font-bold tracking-widest">{classItem.code}</span>
              <button
                onClick={handleCopy}
                title={t('school:teacher.card.copy_code')}
                className="text-galaxy-text-muted hover:text-galaxy-secondary transition-colors"
              >
                {copiedCode ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          <button
            onClick={handleRotateCode}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body text-galaxy-text-muted border border-galaxy-text-muted/20 hover:text-galaxy-text hover:border-galaxy-text-muted/40 transition-colors"
          >
            <RefreshCw size={14} /> {t('school:teacher.class_page.new_code')}
          </button>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!classItem.sign_in_open}
            onChange={handleToggleSignIn}
            className="w-5 h-5 accent-galaxy-secondary"
          />
          <span className="font-body text-galaxy-text">
            {classItem.sign_in_open
              ? t('school:teacher.class_page.sign_in_open')
              : t('school:teacher.class_page.sign_in_closed')}
          </span>
        </label>
      </div>

      <SchoolHoursEditor
        classId={classItem.id}
        schoolHours={classItem.school_hours}
        timezone={classItem.timezone}
        onSave={patchClass}
      />

      <AddStudents classId={classItem.id} license={classItem.license} onCreated={handleStudentsCreated} />

      {cardsToShow && (
        <SignInCards
          classInfo={{ name: classItem.name, code: classItem.code }}
          students={cardsToShow}
          onDismiss={() => setCardsToShow(null)}
        />
      )}

      <div className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-galaxy-text">{t('school:teacher.roster.heading')}</h2>
        <RosterTable students={students} onAction={handleStudentAction} />
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'motion/react'
import { GraduationCap, Plus, Copy, Check, LogOut, ChevronRight } from 'lucide-react'
import SparkleButton from '../components/ui/SparkleButton'
import LicenseBadge from '../components/school/LicenseBadge'
import { schoolFetch } from '../lib/schoolApi'
import { useAuthStore } from '../stores/useAuthStore'
import { MAX_SEATS } from '../../lib/school/license.js'

// Task 12 replaces the localStorage-only class list this page used to
// keep (before /api/school/classes existed) with the real API. Any class
// still sitting in that old key is never migrated automatically — the
// server has no record of it — so it's surfaced once as plain links to its
// still-working /classroom/:code page, with a way to dismiss the note.
const LEGACY_KEY = 'my-favorite-book-teacher-classes'

function loadLegacyClasses() {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]')
  } catch {
    return []
  }
}

function errorText(t, code) {
  return t(`school:teacher.errors.${code}`, { defaultValue: t('school:teacher.errors.generic') })
}

export default function TeacherPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)

  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [legacyClasses, setLegacyClasses] = useState(loadLegacyClasses)

  const [className, setClassName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [trialUsedUpNotice, setTrialUsedUpNotice] = useState(false)
  const [copiedCode, setCopiedCode] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await schoolFetch('/api/school/classes')
      setLoading(false)
      if (res.ok) setClasses(res.data?.classes ?? [])
      else setError(errorText(t, res.code || 'generic'))
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function hideLegacyNote() {
    try {
      localStorage.removeItem(LEGACY_KEY)
    } catch {
      // ignore
    }
    setLegacyClasses([])
  }

  async function handleCreate() {
    const name = className.trim()
    if (!name || creating) return
    setCreating(true)
    setCreateError(null)
    setTrialUsedUpNotice(false)
    const res = await schoolFetch('/api/school/classes', {
      method: 'POST',
      body: JSON.stringify({
        name,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: i18n.language === 'it' ? 'it' : 'en',
      }),
    })
    setCreating(false)
    if (!res.ok) {
      setCreateError(errorText(t, res.code || 'generic'))
      return
    }
    setClasses((prev) => [res.data.class, ...prev])
    setClassName('')
    if (res.data.trial_used_up) setTrialUsedUpNotice(true)
  }

  function handleCopy(code) {
    navigator.clipboard?.writeText(code).catch(() => {})
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <motion.div
        className="text-center mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-galaxy-secondary/20 flex items-center justify-center">
          <GraduationCap size={40} className="text-galaxy-secondary" />
        </div>
        <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-2">{t('school:teacher.title')}</h1>
        <p className="text-galaxy-text-muted font-body">{t('school:teacher.subtitle')}</p>
        {user && (
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="text-galaxy-text-muted text-sm font-body">{user.email}</span>
            <button
              onClick={async () => { await signOut(); navigate('/') }}
              className="flex items-center gap-1 text-galaxy-text-muted hover:text-galaxy-text text-sm font-body transition-colors"
            >
              <LogOut size={13} /> {t('common:actions.sign_out')}
            </button>
          </div>
        )}
      </motion.div>

      {legacyClasses.length > 0 && (
        <motion.div
          className="glass rounded-2xl p-4 border border-galaxy-text-muted/10 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-body text-sm text-galaxy-text-muted">{t('school:teacher.legacy.heading')}</p>
            <button
              onClick={hideLegacyNote}
              className="shrink-0 text-galaxy-text-muted hover:text-galaxy-text text-xs font-body font-semibold uppercase tracking-wide transition-colors"
            >
              {t('school:teacher.legacy.hide')}
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {legacyClasses.map((c) => (
              <li key={c.code}>
                <Link to={`/classroom/${c.code}`} className="text-galaxy-secondary font-body text-sm hover:underline">
                  {c.name} ({c.code})
                </Link>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Create class form */}
      <motion.div
        className="glass rounded-2xl p-6 border border-galaxy-secondary/20 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="font-heading text-lg font-bold text-galaxy-text mb-4">{t('school:teacher.create.heading')}</h2>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder={t('school:teacher.create.name_placeholder')}
            aria-label={t('school:teacher.create.name_label')}
            maxLength={60}
            className="flex-1 min-w-[200px] px-4 py-3 bg-galaxy-bg border border-galaxy-secondary/30 rounded-xl text-galaxy-text placeholder:text-galaxy-text-muted/50 focus:border-galaxy-secondary focus:outline-none font-body"
          />
          <SparkleButton onClick={handleCreate} disabled={!className.trim() || creating} size="small">
            <span className="flex items-center gap-1">
              <Plus size={16} />
              {creating ? t('school:teacher.create.submitting') : t('school:teacher.create.submit')}
            </span>
          </SparkleButton>
        </div>
        <AnimatePresence>
          {createError && (
            <motion.p className="text-red-400 text-sm font-body mt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {createError}
            </motion.p>
          )}
          {trialUsedUpNotice && (
            <motion.p className="text-amber-300 text-sm font-body mt-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {t('school:teacher.create.trial_used_up')}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {loading && (
        <p className="text-center text-galaxy-text-muted font-body text-sm">{t('school:teacher.loading')}</p>
      )}

      {!loading && error && (
        <p className="text-center text-red-400 font-body text-sm">{error}</p>
      )}

      {!loading && !error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          {classes.length === 0 ? (
            <p className="text-center text-galaxy-text-muted font-body text-sm mt-4">{t('school:teacher.list.empty')}</p>
          ) : (
            <div className="space-y-3">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  className="glass rounded-xl p-4 border border-galaxy-text-muted/10 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-heading font-semibold text-galaxy-text truncate">{cls.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="font-mono text-galaxy-secondary font-bold tracking-widest">{cls.code}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(cls.code)}
                        title={t('school:teacher.card.copy_code')}
                        className="text-galaxy-text-muted hover:text-galaxy-secondary transition-colors"
                      >
                        {copiedCode === cls.code ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <LicenseBadge license={cls.license} />
                      <span className="text-galaxy-text-muted text-xs font-body">
                        {t('school:teacher.card.student_count', {
                          used: cls.student_count,
                          seats: cls.license?.seats ?? MAX_SEATS,
                        })}
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/teacher/class/${cls.id}`}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl font-body font-semibold text-sm text-galaxy-secondary border border-galaxy-secondary/40 hover:bg-galaxy-secondary/10 transition-colors shrink-0"
                  >
                    {t('school:teacher.card.open')} <ChevronRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

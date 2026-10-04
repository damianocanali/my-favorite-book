import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { X, Check } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { teacherErrorText } from './teacherErrors'
import {
  NUDGE_PRESETS, NUDGE_MESSAGE_MAX, NUDGE_MAX_STUDENTS,
  nudgeReasons, suggestedIds, openNotHandedIn, openAssignments, truncateUtf16, buildNudgeBody,
} from './nudgeUi'

// The teacher's "Nudge" dialog: the whole class (suggestions pre-ticked)
// from the dashboard, or one child (`single`) from their details drawer.
// Counterpart of the iPad's TeacherNudgeSheet. The server enforces one
// unread note per child and 3 a day; no push reaches children.
export default function NudgeSheet({ classId, students, assignments = [], single = false, onSent, onClose }) {
  const { t } = useTranslation()
  const panelRef = useRef(null)
  const open = useMemo(() => openAssignments(assignments), [assignments])
  const [selected, setSelected] = useState(() =>
    new Set(single ? students.map((s) => s.id) : suggestedIds(students, assignments))
  )
  const [assignmentId, setAssignmentId] = useState(() => {
    if (!single || !students[0]) return ''
    const o = openNotHandedIn(students[0], assignments)
    return o.length === 1 ? o[0].id : ''
  })
  const [choice, setChoice] = useState('story_waiting')
  const [custom, setCustom] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement
    panelRef.current?.focus()
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [])

  // Keys are handled on the dialog itself, not on window: Escape closes only
  // this (top) dialog — stopPropagation keeps it from reaching the student
  // drawer's window listener underneath — and Tab cycles inside it.
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = [...(panelRef.current?.querySelectorAll(
      'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ) ?? [])]
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // "Hand in" only exists with an assignment chosen.
  useEffect(() => {
    if (!assignmentId && choice === 'hand_in') setChoice('story_waiting')
  }, [assignmentId, choice])

  const title = open.find((a) => a.id === assignmentId)?.title
  const presets = NUDGE_PRESETS.filter((p) => p !== 'hand_in' || assignmentId)
  const presetLabel = (p) =>
    p === 'hand_in' ? t('school:nudges.presets.hand_in', { title }) : t(`school:nudges.presets.${p}`)

  function toggle(id) {
    if (single) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < NUDGE_MAX_STUDENTS) next.add(id)
      return next
    })
  }

  async function send() {
    setError(null)
    const built = buildNudgeBody({ classId, selected, choice, custom, assignmentId: assignmentId || null })
    if (built.error) {
      setError(t(`school:nudges.teacher.${built.error}`))
      return
    }
    setSending(true)
    const res = await schoolFetch('/api/school/nudges', { method: 'POST', body: JSON.stringify(built.body) })
    setSending(false)
    if (!res.ok) {
      setError(teacherErrorText(t, res.code || 'generic'))
      return
    }
    onSent(res.data)
    onClose()
  }

  const heading = t('school:nudges.teacher.title')
  const radio = (id, label) => (
    <button
      key={id}
      type="button"
      role="radio"
      aria-checked={choice === id}
      onClick={() => setChoice(id)}
      className={`w-full min-h-[48px] text-left px-3 py-2 rounded-xl border font-body text-sm transition-colors ${
        choice === id ? 'border-galaxy-secondary/60 bg-galaxy-secondary/10 text-galaxy-text' : 'border-galaxy-text-muted/15 text-galaxy-text hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  )

  return createPortal(
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onKeyDown={onKeyDown}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-text-muted/10 focus:outline-none space-y-5"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-galaxy-text">{heading}</h2>
          <button type="button" onClick={onClose} aria-label={t('common:actions.close')} className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text">
            <X size={18} />
          </button>
        </div>
        <p className="font-body text-sm text-galaxy-text-muted">{t('school:nudges.teacher.intro')}</p>

        <section className="space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="font-heading font-bold text-galaxy-text flex-1">{t('school:nudges.teacher.who_heading')}</h3>
            {!single && (
              <>
                <button type="button" onClick={() => setSelected(new Set(students.slice(0, NUDGE_MAX_STUDENTS).map((s) => s.id)))} className="text-sm font-semibold text-galaxy-secondary hover:underline">
                  {t('school:nudges.teacher.select_all')}
                </button>
                <button type="button" onClick={() => setSelected(new Set())} className="text-sm font-semibold text-galaxy-secondary hover:underline">
                  {t('school:nudges.teacher.select_none')}
                </button>
              </>
            )}
          </div>
          {!single && <p className="font-body text-xs text-galaxy-text-muted">{t('school:nudges.teacher.suggested_note')}</p>}
          <ul className="rounded-xl border border-galaxy-text-muted/10 divide-y divide-galaxy-text-muted/10">
            {students.map((s) => {
              const on = selected.has(s.id)
              const reasons = nudgeReasons(s, assignments)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={single}
                    onClick={() => toggle(s.id)}
                    className="w-full min-h-[48px] flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 disabled:cursor-default"
                  >
                    <span aria-hidden="true" className={`h-5 w-5 shrink-0 rounded-full border flex items-center justify-center ${on ? 'bg-galaxy-secondary border-galaxy-secondary text-galaxy-bg' : 'border-galaxy-text-muted/50'}`}>
                      {on && <Check size={14} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-body font-semibold text-galaxy-text truncate">{s.display_name}</span>
                      {reasons.length > 0 && (
                        <span className="flex flex-wrap gap-1 mt-1">
                          {reasons.map((r) => (
                            <span key={r} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${r === 'not_handed_in' ? 'border-amber-400/40 text-amber-200' : 'border-galaxy-text-muted/30 text-galaxy-text-muted'}`}>
                              {t(r === 'quiet' ? 'school:nudges.teacher.reason_quiet' : 'school:nudges.teacher.reason_not_handed_in')}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-heading font-bold text-galaxy-text">{t('school:nudges.teacher.message_heading')}</h3>
          {open.length > 0 && (
            <label className="flex items-center gap-3 font-body text-sm text-galaxy-text-muted">
              <span className="flex-1">{t('school:nudges.teacher.assignment_label')}</span>
              <select
                value={assignmentId}
                onChange={(e) => setAssignmentId(e.target.value)}
                className="px-3 py-2 bg-galaxy-bg border border-galaxy-secondary/30 rounded-xl text-galaxy-text text-sm"
              >
                <option value="">{t('school:nudges.teacher.assignment_none')}</option>
                {open.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </label>
          )}
          <div role="radiogroup" aria-label={t('school:nudges.teacher.message_heading')} className="space-y-2">
            {presets.map((p) => radio(p, presetLabel(p)))}
            {radio('custom', t('school:nudges.teacher.write_own'))}
          </div>
          {choice === 'custom' && (
            <>
              <textarea
                value={custom}
                onChange={(e) => setCustom(truncateUtf16(e.target.value, NUDGE_MESSAGE_MAX))}
                placeholder={t('school:nudges.teacher.placeholder')}
                aria-label={t('school:nudges.teacher.write_own')}
                rows={3}
                className="w-full px-3 py-2 bg-galaxy-bg border border-galaxy-secondary/30 rounded-xl text-galaxy-text font-body text-sm"
              />
              <p className="text-right text-xs text-galaxy-text-muted">{custom.length}/{NUDGE_MESSAGE_MAX}</p>
            </>
          )}
          <p className="font-body text-xs text-galaxy-text-muted">{t('school:nudges.teacher.signed_note')}</p>
        </section>

        {error && <p className="text-red-400 text-sm font-body" role="alert">{error}</p>}

        <button
          type="button"
          onClick={send}
          disabled={sending || selected.size === 0}
          className="w-full min-h-[48px] rounded-xl font-body font-bold text-white btn-fill-primary disabled:opacity-50 transition-colors"
        >
          {sending ? t('school:nudges.teacher.sending') : t('school:nudges.teacher.send', { count: selected.size })}
        </button>
      </motion.div>
    </motion.div>,
    document.body
  )
}

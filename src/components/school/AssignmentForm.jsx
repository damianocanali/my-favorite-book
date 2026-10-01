import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { X, Volume2, VolumeX, BookOpen, ClipboardList } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { teacherErrorText } from './teacherErrors'
import { isoToLocalInput, localInputToIso } from './assignmentUi'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'
import WorksheetPicker from './WorksheetPicker'
import { cleanAcrosticWord } from '../../../lib/school/worksheets.js'

const TITLE_MAX = 80
const PROMPT_MAX = 1000

// New-assignment / edit-assignment modal (Task S2). Creating offers "Save as
// draft" and "Publish now" (two different `status` values on the same POST);
// editing an existing assignment only ever changes title/prompt/due_at/
// allow_late here — status transitions (Publish/Close/Reopen) are one-click
// actions on the list row instead, so this form never has to reproduce
// api/school/assignments.js's canTransition rules.
//
// Worksheets (spec 2026-10-01 §2): a new assignment is first a choice of
// "A book" or "A worksheet"; a worksheet then picks a template and edits
// its prompts (WorksheetPicker). What an assignment is never changes after
// it is created, and the template only while it is still a draft.
export default function AssignmentForm({ classId, assignment, onClose, onSaved }) {
  const { t } = useTranslation()
  const panelRef = useRef(null)
  const isEdit = !!assignment

  const [kind, setKind] = useState(assignment ? (assignment.kind === 'worksheet' ? 'worksheet' : 'book') : null)
  const [worksheet, setWorksheet] = useState(() => (assignment?.worksheet
    ? { templateId: assignment.worksheet.templateId, prompts: { ...assignment.worksheet.prompts }, word: assignment.worksheet.word ?? '' }
    : { templateId: null, prompts: {}, word: '' }))
  const [title, setTitle] = useState(assignment?.title ?? '')
  const [prompt, setPrompt] = useState(assignment?.prompt ?? '')
  const [due, setDue] = useState(isoToLocalInput(assignment?.due_at))
  const [allowLate, setAllowLate] = useState(assignment ? assignment.allow_late : true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const { speak, stop: stopSpeaking, isSpeaking, isSupported: ttsSupported } = useSpeechSynthesis()

  useEffect(() => {
    const previouslyFocused = document.activeElement
    panelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleListen() {
    if (isSpeaking) stopSpeaking()
    else if (prompt.trim()) speak(prompt)
  }

  // Picking a template fills an empty title and instructions with the
  // template's own, so a teacher can publish in two taps.
  function changeWorksheet(next, { picked = false } = {}) {
    setWorksheet(next)
    setError(null)
    if (picked && next.templateId) {
      if (!title.trim()) setTitle(t(`school:worksheet.templates.${next.templateId}.title`).slice(0, TITLE_MAX))
      if (!prompt.trim()) setPrompt(t(`school:worksheet.templates.${next.templateId}.description`).slice(0, PROMPT_MAX))
    }
  }

  // The worksheet as the API takes it, or an error key.
  function worksheetBody() {
    if (!worksheet.templateId) return { error: 'school:worksheet.teacher.template_required' }
    const prompts = {}
    for (const [id, text] of Object.entries(worksheet.prompts)) {
      if (!String(text ?? '').trim()) return { error: 'school:worksheet.teacher.prompt_required' }
      prompts[id] = String(text).trim()
    }
    const out = { templateId: worksheet.templateId, prompts }
    if (worksheet.templateId === 'acrostic' && worksheet.word?.trim()) {
      const word = cleanAcrosticWord(worksheet.word)
      if (!word) return { error: 'school:worksheet.teacher.acrostic_word_invalid' }
      out.word = word
    }
    return { worksheet: out }
  }

  async function save(status) {
    const trimmedTitle = title.trim()
    const trimmedPrompt = prompt.trim()
    const isWorksheet = kind === 'worksheet'
    if (!trimmedTitle) return setError(t('school:teacher.assignments.errors.title_required'))
    // A worksheet's boxes carry its prompts; the class-wide line is optional.
    if (!trimmedPrompt && !isWorksheet) return setError(t('school:teacher.assignments.errors.prompt_required'))
    let ws = null
    if (isWorksheet) {
      const w = worksheetBody()
      if (w.error) return setError(t(w.error))
      ws = w.worksheet
    }
    setSaving(true)
    setError(null)
    const dueIso = localInputToIso(due)
    // A worksheet's instructions are optional: on an edit an empty box
    // clears them (sent as ''); a book always sends its prompt.
    const promptField = trimmedPrompt || (isEdit && isWorksheet) ? { prompt: trimmedPrompt } : {}
    const body = isEdit
      ? { classId, id: assignment.id, title: trimmedTitle, ...promptField, due_at: dueIso, allow_late: allowLate, ...(ws ? { worksheet: ws } : {}) }
      : { classId, title: trimmedTitle, ...promptField, due_at: dueIso, allow_late: allowLate, status, kind, ...(ws ? { worksheet: ws } : {}) }
    const res = await schoolFetch('/api/school/assignments', {
      method: isEdit ? 'PATCH' : 'POST',
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) onSaved(res.data.assignment)
    else setError(teacherErrorText(t, res.code || 'generic'))
  }

  const heading = isEdit
    ? t('school:teacher.assignments.form.edit_heading')
    : t('school:teacher.assignments.form.new_heading')

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        // bg-galaxy-bg-light rather than `.glass` — see AssignmentReview.jsx's
        // panel for why: this sits directly over the class page's own
        // Assignments list, and `.glass`'s translucent white/8% let that
        // list's text show through underneath this form's own fields.
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-galaxy-bg-light rounded-2xl p-6 border border-galaxy-text-muted/10 focus:outline-none space-y-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-galaxy-text truncate">{heading}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common:actions.close')}
            className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {!isEdit && (
          <fieldset className="space-y-2">
            <legend className="text-galaxy-text-muted text-sm font-body font-semibold mb-1">{t('school:worksheet.teacher.kind_label')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'book', Icon: BookOpen, hint: 'kind_book_hint' },
                { id: 'worksheet', Icon: ClipboardList, hint: 'kind_worksheet_hint' },
              ].map(({ id, Icon, hint }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={kind === id}
                  onClick={() => { setKind(id); setError(null) }}
                  className={`text-left rounded-xl p-3 border transition-colors ${kind === id ? 'border-galaxy-secondary bg-galaxy-secondary/10' : 'border-galaxy-text-muted/20 hover:border-galaxy-secondary/50'}`}
                >
                  <span className="flex items-center gap-2 font-body font-semibold text-sm text-galaxy-text">
                    <Icon size={16} aria-hidden="true" /> {t(`school:worksheet.teacher.kind_${id}`)}
                  </span>
                  <span className="block mt-1 font-body text-xs text-galaxy-text-muted">{t(`school:worksheet.teacher.${hint}`)}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {kind === 'worksheet' && (
          <WorksheetPicker
            value={worksheet}
            onChange={changeWorksheet}
            canChangeTemplate={!isEdit || assignment.status === 'draft'}
          />
        )}

        {kind && (kind === 'book' || worksheet.templateId) && (<>
        <div className="space-y-1">
          <label htmlFor="assignment-title" className="text-galaxy-text-muted text-sm font-body font-semibold">
            {t('school:teacher.assignments.form.title_label')}
          </label>
          <input
            id="assignment-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
            className="w-full px-3 py-2.5 glass border border-white/15 rounded-xl text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="assignment-prompt" className="text-galaxy-text-muted text-sm font-body font-semibold">
              {kind === 'worksheet' ? t('school:worksheet.teacher.instructions_label') : t('school:teacher.assignments.form.prompt_label')}
            </label>
            {ttsSupported && (
              <button
                type="button"
                onClick={handleListen}
                aria-label={isSpeaking ? t('school:actions.stop_listening') : t('school:teacher.assignments.form.listen')}
                className="shrink-0 p-1.5 rounded-lg text-galaxy-secondary hover:bg-white/[0.08] transition-colors"
              >
                {isSpeaking ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
              </button>
            )}
          </div>
          <textarea
            id="assignment-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={PROMPT_MAX}
            rows={4}
            className="w-full px-3 py-2.5 glass border border-white/15 rounded-xl text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body resize-none"
          />
          <p className="text-right text-xs font-body text-galaxy-text-muted">{prompt.length}/{PROMPT_MAX}</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="assignment-due" className="text-galaxy-text-muted text-sm font-body font-semibold">
            {t('school:teacher.assignments.form.due_label')}
          </label>
          <input
            id="assignment-due"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full px-3 py-2.5 glass border border-white/15 rounded-xl text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={allowLate}
            onChange={(e) => setAllowLate(e.target.checked)}
            className="w-5 h-5 accent-galaxy-secondary"
          />
          <span className="font-body text-galaxy-text text-sm">{t('school:teacher.assignments.form.allow_late_label')}</span>
        </label>
        </>)}

        {error && <p className="text-red-400 text-sm font-body">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-body font-semibold text-sm text-galaxy-text-muted hover:text-galaxy-text transition-colors"
          >
            {t('common:actions.cancel')}
          </button>
          {isEdit ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => save()}
              className="px-4 py-2.5 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors disabled:opacity-60"
            >
              {saving ? t('school:teacher.assignments.form.saving') : t('common:actions.save')}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={saving || !kind}
                onClick={() => save('draft')}
                className="px-4 py-2.5 rounded-xl font-body font-semibold text-sm text-galaxy-text border border-galaxy-text-muted/30 hover:border-galaxy-text-muted/50 transition-colors disabled:opacity-60"
              >
                {t('school:teacher.assignments.form.save_draft')}
              </button>
              <button
                type="button"
                disabled={saving || !kind}
                onClick={() => save('published')}
                className="px-4 py-2.5 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors disabled:opacity-60"
              >
                {t('school:teacher.assignments.form.publish_now')}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

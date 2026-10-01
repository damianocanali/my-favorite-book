import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { X, ArrowUp, ArrowDown, GripVertical, Trash2, Check, Eye, Download } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { apiFetchAuthed } from '../../lib/api'
import { moveItem, splitItems, wyErrorText } from './writingYearUi'
import WritingYearBookView from './WritingYearBookView'
import { NOTE_MAX, COVER_TITLE_MAX } from '../../../lib/school/writingYear.js'

// One child's Writing Year, for the teacher: the pieces in book order (drag
// to reorder, or Move up / Move down), the child's waiting suggestions
// (Add it / Not this one), the teacher's note and cover title, a preview and
// the free PDF. iPad: WritingYearChildView.swift.
export default function WritingYearChild({ classId, student, onClose, onChanged }) {
  const { t } = useTranslation()
  const panelRef = useRef(null)
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')
  const [coverTitle, setCoverTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const dragFrom = useRef(null)

  const base = `/api/school/writing-year?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(student.student_id)}`

  const load = useCallback(async () => {
    setError(null)
    const res = await schoolFetch(base)
    if (!res.ok) return setError(wyErrorText(t, res.code))
    setItems(res.data.items ?? [])
    setNote(res.data.meta?.teacher_note ?? '')
    setCoverTitle(res.data.meta?.cover_title ?? '')
  }, [base, t])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const previouslyFocused = document.activeElement
    panelRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function act(body) {
    setError(null)
    const res = await schoolFetch('/api/school/writing-year', { method: 'POST', body: JSON.stringify({ classId, ...body }) })
    if (!res.ok) setError(wyErrorText(t, res.code))
    return res
  }

  const { approved, waiting } = splitItems(items)

  async function reorder(next) {
    const prev = items
    setItems([...next.map((it, i) => ({ ...it, position: i + 1 })), ...waiting.map((it, i) => ({ ...it, position: next.length + i + 1 }))])
    const res = await act({ action: 'reorder', studentId: student.student_id, itemIds: [...next, ...waiting].map((i) => i.id) })
    if (!res.ok) { setItems(prev); load() }
  }

  async function approve(item) {
    const res = await act({ action: 'approve', itemId: item.id })
    if (res.ok) { setItems((p) => p.map((i) => (i.id === item.id ? { ...i, approved: true } : i))); onChanged?.() }
  }

  async function remove(item, confirm) {
    if (confirm && !window.confirm(t('school:writing_year.teacher.remove_confirm'))) return
    const res = await act({ action: 'remove', itemId: item.id })
    if (res.ok) { setItems((p) => p.filter((i) => i.id !== item.id)); onChanged?.() }
  }

  async function saveNote() {
    setSaving(true)
    setSaved(false)
    const res = await act({ action: 'note', studentId: student.student_id, teacherNote: note, coverTitle })
    setSaving(false)
    if (res.ok) { setSaved(true); onChanged?.() }
  }

  async function openPreview() {
    if (preview) return setPreview(null)
    const res = await schoolFetch(`${base}&preview=1`)
    if (res.ok) setPreview(res.data.book)
    else setError(wyErrorText(t, res.code))
  }

  async function downloadPdf() {
    setDownloading(true)
    setError(null)
    try {
      const r = await apiFetchAuthed(`/api/school/writing-year-pdf?classId=${encodeURIComponent(classId)}&studentId=${encodeURIComponent(student.student_id)}`)
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        if (body.code === 'page_overflow' && body.pages?.length) {
          setError(t('school:writing_year.errors.page_overflow', { pages: body.pages.join(', ') }))
          return
        }
        throw new Error(String(r.status))
      }
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `${student.display_name} - ${t('school:writing_year.teacher.section_heading')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      setError(wyErrorText(t, 'generic'))
    } finally {
      setDownloading(false)
    }
  }

  const kindLabel = (i) => t(`school:writing_year.teacher.kind_${i.kind}`)

  return createPortal(
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('school:writing_year.teacher.child_heading', { name: student.display_name })}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto glass rounded-2xl p-6 border border-galaxy-text-muted/10 focus:outline-none space-y-5"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-galaxy-text truncate">
            <span aria-hidden="true" className="mr-2">{student.avatar_emoji}</span>
            {t('school:writing_year.teacher.child_heading', { name: student.display_name })}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('common:actions.close')} className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text">
            <X size={18} />
          </button>
        </div>

        {error && <p role="alert" className="text-red-400 text-sm font-body">{error}</p>}

        {items === null ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {waiting.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-body font-semibold uppercase tracking-wide text-amber-200">{t('school:writing_year.teacher.suggested')}</h3>
                <ul className="space-y-2">
                  {waiting.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2">
                      <span className="flex-1 min-w-0 text-sm font-body text-galaxy-text truncate">{i.title || '—'} <span className="text-xs text-galaxy-text-muted">· {kindLabel(i)}</span></span>
                      <button type="button" onClick={() => approve(i)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-body font-semibold text-white btn-fill-primary">
                        <Check size={13} aria-hidden="true" /> {t('school:writing_year.teacher.approve')}
                      </button>
                      <button type="button" onClick={() => remove(i, false)} className="px-2.5 py-1.5 rounded-lg text-xs font-body font-semibold text-galaxy-text-muted border border-galaxy-text-muted/20 hover:text-galaxy-text">
                        {t('school:writing_year.teacher.decline')}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-2">
              {approved.length === 0 ? (
                <p className="text-sm font-body text-galaxy-text-muted">{t('school:writing_year.teacher.empty_child')}</p>
              ) : (
                <>
                  <p className="text-xs font-body text-galaxy-text-muted">{t('school:writing_year.teacher.drag_hint')}</p>
                  <ol className="space-y-2">
                    {approved.map((i, idx) => (
                      <li
                        key={i.id}
                        draggable
                        onDragStart={() => { dragFrom.current = idx }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          const from = dragFrom.current
                          dragFrom.current = null
                          if (from !== null && from !== idx) reorder(moveItem(approved, from, idx))
                        }}
                        className="flex items-center gap-2 rounded-xl border border-galaxy-text-muted/10 px-3 py-2 bg-white/[0.03]"
                      >
                        <GripVertical size={16} className="text-galaxy-text-muted cursor-grab shrink-0" aria-hidden="true" />
                        <span className="text-xs tabular-nums text-galaxy-text-muted w-5">{idx + 1}</span>
                        <span className="flex-1 min-w-0 text-sm font-body text-galaxy-text truncate">{i.title || '—'} <span className="text-xs text-galaxy-text-muted">· {kindLabel(i)}</span></span>
                        <button type="button" disabled={idx === 0} onClick={() => reorder(moveItem(approved, idx, idx - 1))} aria-label={t('school:writing_year.teacher.move_up')} className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text disabled:opacity-30">
                          <ArrowUp size={14} />
                        </button>
                        <button type="button" disabled={idx === approved.length - 1} onClick={() => reorder(moveItem(approved, idx, idx + 1))} aria-label={t('school:writing_year.teacher.move_down')} className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text disabled:opacity-30">
                          <ArrowDown size={14} />
                        </button>
                        <button type="button" onClick={() => remove(i, true)} aria-label={t('school:writing_year.teacher.remove')} className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-red-300">
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>

            <section className="space-y-3 border-t border-galaxy-text-muted/10 pt-4">
              <label className="block space-y-1">
                <span className="text-xs font-body font-semibold text-galaxy-text-muted">{t('school:writing_year.teacher.cover_title_label')}</span>
                <input
                  value={coverTitle}
                  maxLength={COVER_TITLE_MAX}
                  onChange={(e) => { setCoverTitle(e.target.value); setSaved(false) }}
                  placeholder={t('school:writing_year.teacher.cover_title_placeholder')}
                  className="w-full px-3 py-2 glass border border-white/15 rounded-xl text-sm text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-body font-semibold text-galaxy-text-muted">{t('school:writing_year.teacher.note_label')}</span>
                <textarea
                  value={note}
                  maxLength={NOTE_MAX}
                  rows={4}
                  onChange={(e) => { setNote(e.target.value); setSaved(false) }}
                  placeholder={t('school:writing_year.teacher.note_placeholder', { name: student.display_name })}
                  className="w-full px-3 py-2 glass border border-white/15 rounded-xl text-sm text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body"
                />
                <span className="block text-right text-xs font-body text-galaxy-text-muted">{note.length}/{NOTE_MAX}</span>
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" disabled={saving} onClick={saveNote} className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary disabled:opacity-60">
                  {saving ? t('school:writing_year.teacher.saving') : t('school:writing_year.teacher.save')}
                </button>
                {saved && <span role="status" className="text-xs font-body font-semibold text-emerald-300">{t('school:writing_year.teacher.saved')}</span>}
                <span className="flex-1" />
                <button type="button" onClick={openPreview} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-semibold text-galaxy-secondary border border-galaxy-secondary/30">
                  <Eye size={14} aria-hidden="true" /> {t('school:writing_year.teacher.preview')}
                </button>
                <button type="button" disabled={downloading} onClick={downloadPdf} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-semibold text-galaxy-secondary border border-galaxy-secondary/30 disabled:opacity-60">
                  <Download size={14} aria-hidden="true" /> {downloading ? t('school:writing_year.teacher.downloading') : t('school:writing_year.teacher.download_pdf')}
                </button>
              </div>
            </section>

            {preview && (
              <section className="border-t border-galaxy-text-muted/10 pt-4">
                <WritingYearBookView book={preview} />
              </section>
            )}
          </>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}

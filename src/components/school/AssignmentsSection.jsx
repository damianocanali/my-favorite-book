import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Printer, Download } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { teacherErrorText } from './teacherErrors'
import { STATUS_CHIP_KEY, formatDueDate, canDeleteAssignment, nextStatusActions } from './assignmentUi'
import AssignmentForm from './AssignmentForm'
import AssignmentWorksheetPrint from '../worksheets/AssignmentSheet'
import { isWorksheet } from './worksheetUi'
import { gradesCsv, csvFilename } from './gradingUi'

const STATUS_TONE = {
  draft: 'bg-galaxy-text-muted/10 text-galaxy-text-muted border-galaxy-text-muted/20',
  open: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  closed: 'bg-galaxy-text-muted/10 text-galaxy-text-muted border-galaxy-text-muted/20',
}

function StatusChip({ status }) {
  const { t } = useTranslation()
  const key = STATUS_CHIP_KEY[status] ?? 'draft'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body font-semibold border ${STATUS_TONE[key]}`}>
      {t(`school:teacher.assignments.status.${key}`)}
    </span>
  )
}

// The class page's "Assignments" section (Task S2): list, "New assignment"
// modal, and the per-row status actions (Publish/Close/Reopen/Edit/Delete).
// Clicking a row (not a button inside it) opens the Review drawer, owned by
// the caller (TeacherClassPage) since it also needs to be reachable from a
// dashboard link — see that page's `?review=` query param handling.
export default function AssignmentsSection({ classId, className, locale, onOpenReview, startAssign = null, onStartAssignConsumed }) {
  const { t } = useTranslation()
  const [assignments, setAssignments] = useState(null)
  const [error, setError] = useState(null)
  const [banner, setBanner] = useState(null)
  const [formTarget, setFormTarget] = useState(null) // null (closed) | 'new' | an assignment (edit)
  const [busyId, setBusyId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [printJob, setPrintJob] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await schoolFetch(`/api/school/assignments?classId=${encodeURIComponent(classId)}`)
    if (res.ok) setAssignments(res.data?.assignments ?? [])
    else setError(res.code || 'generic')
  }, [classId])

  useEffect(() => {
    load()
  }, [load])

  // Deep link from the worksheets library: open "New assignment" already
  // on "A worksheet", once.
  const [initialKind, setInitialKind] = useState(null)
  useEffect(() => {
    if (!startAssign) return
    setInitialKind(startAssign)
    setFormTarget('new')
    onStartAssignConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAssign])

  function upsert(updated) {
    setAssignments((prev) => {
      const list = prev ?? []
      const i = list.findIndex((a) => a.id === updated.id)
      if (i === -1) return [{ ...updated, counts: updated.counts ?? { handed_in: 0, total_students: 0 } }, ...list]
      const next = [...list]
      // A PATCH response doesn't repeat `counts` (assignments.js's teacherShape
      // only adds it in the list read) — keep whatever the row already had.
      next[i] = { ...next[i], ...updated }
      return next
    })
  }

  async function handleStatus(assignment, status) {
    setBusyId(assignment.id)
    setBanner(null)
    const res = await schoolFetch('/api/school/assignments', {
      method: 'PATCH',
      body: JSON.stringify({ classId, id: assignment.id, status }),
    })
    setBusyId(null)
    if (res.ok) upsert(res.data.assignment)
    else setBanner(teacherErrorText(t, res.code || 'generic'))
  }

  async function handleDelete(assignment) {
    if (!window.confirm(t('school:teacher.assignments.actions.delete_confirm', { title: assignment.title }))) return
    setBusyId(assignment.id)
    setBanner(null)
    const res = await schoolFetch(
      `/api/school/assignments?classId=${encodeURIComponent(classId)}&id=${encodeURIComponent(assignment.id)}`,
      { method: 'DELETE' }
    )
    setBusyId(null)
    if (res.ok) setAssignments((prev) => (prev ?? []).filter((a) => a.id !== assignment.id))
    else setBanner(teacherErrorText(t, res.code || 'generic'))
  }

  // Every graded version in the class as a CSV (student name, assignment,
  // level, version, date, sent back), built here so the headers and level
  // names are in the teacher's language. Nothing about a child beyond the
  // display name the teacher gave them.
  async function handleExport() {
    setExporting(true)
    setBanner(null)
    const res = await schoolFetch(`/api/school/grades?classId=${encodeURIComponent(classId)}`)
    setExporting(false)
    if (!res.ok) return setBanner(teacherErrorText(t, res.code || 'generic'))
    const rows = res.data?.grades ?? []
    if (!rows.length) return setBanner(t('school:grading.teacher.export_empty'))
    const url = URL.createObjectURL(new Blob([gradesCsv(t, rows)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = csvFilename(className)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold text-galaxy-text">{t('school:teacher.assignments.heading')}</h2>
        <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={exporting}
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-semibold text-galaxy-text border border-galaxy-text-muted/30 hover:border-galaxy-text-muted/50 transition-colors disabled:opacity-60"
        >
          <Download size={16} aria-hidden="true" /> {t('school:grading.teacher.export_csv')}
        </button>
        <button
          type="button"
          onClick={() => { setInitialKind(null); setFormTarget('new') }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-bold text-white btn-fill-primary transition-colors"
        >
          <Plus size={16} /> {t('school:teacher.assignments.new')}
        </button>
        </div>
      </div>

      {banner && <p className="text-red-400 text-sm font-body">{banner}</p>}

      {error ? (
        <div className="glass rounded-2xl p-6 border border-red-500/20 flex flex-col items-center gap-3 text-center">
          <p className="text-red-400 text-sm font-body">{teacherErrorText(t, error)}</p>
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary transition-colors"
          >
            {t('common:actions.retry')}
          </button>
        </div>
      ) : assignments === null ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-galaxy-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : assignments.length === 0 ? (
        <p className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 text-center font-body text-sm text-galaxy-text-muted">
          {t('school:teacher.assignments.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {assignments.map((a) => {
            const due = formatDueDate(a.due_at, locale)
            const actions = nextStatusActions(a.status)
            const busy = busyId === a.id
            return (
              <li key={a.id} className="glass rounded-2xl border border-galaxy-text-muted/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => onOpenReview(a.id)}
                  aria-label={t('school:teacher.assignments.actions.review_aria', { title: a.title })}
                  className="w-full text-left p-4 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-body font-semibold text-galaxy-text truncate">{a.title}</span>
                    <StatusChip status={a.status} />
                    {isWorksheet(a) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body font-semibold border border-galaxy-secondary/30 text-galaxy-secondary">
                        {t('school:worksheet.teacher.chip')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap text-xs font-body text-galaxy-text-muted">
                    <span>{due ? t('school:teacher.assignments.due', { when: due }) : t('school:teacher.assignments.no_due_date')}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t('school:teacher.assignments.handed_in_count', {
                        handed_in: a.counts?.handed_in ?? 0,
                        total: a.counts?.total_students ?? 0,
                      })}
                    </span>
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
                  {actions.map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={busy}
                      onClick={() => handleStatus(a, status)}
                      className="px-3 py-1.5 rounded-lg text-xs font-body font-semibold text-galaxy-text border border-galaxy-text-muted/25 hover:border-galaxy-secondary/50 transition-colors disabled:opacity-60"
                    >
                      {status === 'published' && a.status === 'closed'
                        ? t('school:teacher.assignments.actions.reopen')
                        : status === 'published'
                          ? t('school:teacher.assignments.actions.publish')
                          : t('school:teacher.assignments.actions.close')}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setFormTarget(a)}
                    aria-label={t('common:actions.edit')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-body font-semibold text-galaxy-text-muted hover:text-galaxy-text transition-colors disabled:opacity-60"
                  >
                    <Pencil size={13} /> {t('common:actions.edit')}
                  </button>
                  {/* Task WS teacher hook: opens the free public worksheets
                      library pre-filled with this assignment's own prompt
                      and the class name, straight into the Customize panel
                      (WorksheetsPage reads these same query params via
                      parseWorksheetParams). */}
                  {isWorksheet(a) ? (
                    // A worksheet assignment prints its own boxes and
                    // prompts, blank, for a paper day.
                    <button
                      type="button"
                      onClick={() => setPrintJob({ title: a.title, className, worksheet: a.worksheet, sheets: [{ studentName: '', answers: null }] })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-body font-semibold text-galaxy-secondary hover:text-galaxy-text transition-colors"
                    >
                      <Printer size={13} /> {t('school:worksheet.teacher.print_blank')}
                    </button>
                  ) : (
                  <Link
                    to={{
                      pathname: '/worksheets',
                      search: new URLSearchParams({
                        template: 'story-map',
                        prompt: a.prompt ?? '',
                        class: className ?? '',
                      }).toString(),
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-body font-semibold text-galaxy-secondary hover:text-galaxy-text transition-colors"
                  >
                    <Printer size={13} /> {t('school:teacher.assignments.actions.print_worksheet')}
                  </Link>
                  )}
                  {canDeleteAssignment(a.counts) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(a)}
                      aria-label={t('common:actions.delete')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-body font-semibold text-red-400 hover:text-red-300 transition-colors disabled:opacity-60"
                    >
                      <Trash2 size={13} /> {t('common:actions.delete')}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {printJob && <AssignmentWorksheetPrint job={printJob} onDone={() => setPrintJob(null)} />}

      {formTarget && (
        <AssignmentForm
          classId={classId}
          assignment={formTarget === 'new' ? null : formTarget}
          initialKind={formTarget === 'new' ? initialKind : null}
          onClose={() => setFormTarget(null)}
          onSaved={(saved) => {
            // A freshly-created assignment's POST response has no `counts`
            // (assignments.js's teacherShape only adds that on the list
            // read) — upsert()'s own fallback used to show a hardcoded
            // "0 of 0", which reads wrong the moment the class has any
            // students at all. Reloading the list gets the real
            // `{handed_in, total_students}` instead of guessing at it.
            // An edit's PATCH response only changes fields the row already
            // has real counts for, so that path keeps using upsert().
            const wasNew = formTarget === 'new'
            setFormTarget(null)
            if (wasNew) load()
            else upsert(saved)
          }}
        />
      )}
    </div>
  )
}

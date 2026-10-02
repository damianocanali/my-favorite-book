// "Data and privacy" on a class page: the teacher's controls over the
// class's data (privacy review §7.3, §7.4, §7.28). Deleting is permanent and
// immediate; the typed-name dialog says so in plain words.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Download } from 'lucide-react'
import TypedConfirmDialog from './TypedConfirmDialog'
import { schoolFetch } from '../../lib/schoolApi'
import { downloadSchoolExport } from '../../lib/schoolExport'
import { teacherErrorText } from './teacherErrors'

export default function ClassDataSection({ classItem, onPatch, onDeleted }) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [savingCheckins, setSavingCheckins] = useState(false)
  const [checkinsError, setCheckinsError] = useState(null)
  const checkinsOn = classItem.checkins_enabled !== false

  async function toggleCheckins() {
    setSavingCheckins(true)
    setCheckinsError(null)
    const res = await onPatch({ checkins_enabled: !checkinsOn })
    setSavingCheckins(false)
    if (!res?.ok) setCheckinsError(res?.code || 'generic')
  }

  async function exportClass() {
    setExporting(true)
    setExportError(null)
    const res = await downloadSchoolExport({ classId: classItem.id, name: classItem.name })
    setExporting(false)
    if (!res.ok) setExportError(res.code || 'generic')
  }

  async function deleteClass(typed) {
    const res = await schoolFetch(`/api/school/classes?id=${encodeURIComponent(classItem.id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirm_name: typed }),
    })
    if (res.ok) {
      setConfirming(false)
      // 202: the server couldn't confirm its evidence row; the deletion
      // finishes on its own. Say so rather than leaving the page.
      if (res.data?.pending) setDeletePending(true)
      else onDeleted?.()
    }
    return res
  }

  return (
    <section className="glass rounded-2xl p-6 border border-galaxy-text-muted/10 space-y-4" aria-labelledby="class-data-heading">
      <h2 id="class-data-heading" className="font-heading text-lg font-bold text-galaxy-text">{t('school:teacher.data.heading')}</h2>

      <div className="space-y-1">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checkinsOn}
            disabled={savingCheckins}
            onChange={toggleCheckins}
            className="w-5 h-5 accent-galaxy-secondary"
          />
          <span className="font-body text-galaxy-text">{t('school:teacher.data.checkins.label')}</span>
        </label>
        <p className="font-body text-sm text-galaxy-text-muted pl-8">
          {checkinsOn ? t('school:teacher.data.checkins.hint_on') : t('school:teacher.data.checkins.hint_off')}
        </p>
        {checkinsError && <p className="text-red-400 text-sm font-body pl-8" role="alert">{teacherErrorText(t, checkinsError)}</p>}
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap pt-2 border-t border-white/10">
        <p className="flex-1 min-w-[12rem] font-body text-sm text-galaxy-text-muted">{t('school:teacher.data.export.hint')}</p>
        <button
          type="button"
          onClick={exportClass}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-semibold text-galaxy-text border border-galaxy-text-muted/30 hover:border-galaxy-text-muted/60 disabled:opacity-50 transition-colors"
        >
          <Download size={14} /> {exporting ? t('school:teacher.data.export.working') : t('school:teacher.data.export.button')}
        </button>
      </div>
      {exportError && <p className="text-red-400 text-sm font-body" role="alert">{teacherErrorText(t, exportError)}</p>}

      <div className="flex items-start justify-between gap-3 flex-wrap pt-2 border-t border-white/10">
        <p className="flex-1 min-w-[12rem] font-body text-sm text-galaxy-text-muted">{t('school:teacher.data.delete_class.hint')}</p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-semibold text-red-300 border border-red-500/40 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={14} /> {t('school:teacher.data.delete_class.button')}
        </button>
      </div>

      {deletePending && <p className="font-body text-sm text-galaxy-text" role="status">{t('school:teacher.data.delete_pending')}</p>}

      {confirming && (
        <TypedConfirmDialog
          heading={t('school:teacher.data.delete_class.heading', { name: classItem.name })}
          body={t('school:teacher.data.delete_class.body')}
          prompt={t('school:teacher.data.delete_class.prompt', { name: classItem.name })}
          expected={classItem.name}
          confirmLabel={t('school:teacher.data.delete_class.confirm')}
          onCancel={() => setConfirming(false)}
          onConfirm={deleteClass}
        />
      )}
    </section>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookHeart } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { liveRequest, wyErrorText } from './writingYearUi'
import WritingYearChild from './WritingYearChild'
import ClassPrintFlow from './ClassPrintFlow'

// "My Writing Year" on the class page (spec §3): every child's book at a
// glance (pieces, waiting suggestions, About me), open one to arrange it,
// and "Print the class books" at the end. iPad: WritingYearTab.swift.
export default function WritingYearSection({ classId, locale }) {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(null)

  const load = useCallback(async () => {
    const res = await schoolFetch(`/api/school/writing-year?classId=${encodeURIComponent(classId)}`)
    if (res.ok) { setData(res.data); setError(null) } else setError(wyErrorText(t, res.code))
  }, [classId, t])

  useEffect(() => { load() }, [load])

  const request = data ? liveRequest(data.requests, data.school_year) : null

  return (
    <section className="space-y-3" aria-labelledby="wy-heading">
      <div>
        <h2 id="wy-heading" className="flex items-center gap-2 font-heading text-lg font-bold text-galaxy-text">
          <BookHeart size={18} className="text-galaxy-secondary" aria-hidden="true" />
          {t('school:writing_year.teacher.section_heading')}
        </h2>
        <p className="text-sm font-body text-galaxy-text-muted">{t('school:writing_year.teacher.section_sub')}</p>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm font-body">{error}</p>}

      {data && (
        <div className="glass rounded-2xl p-4 border border-galaxy-text-muted/10 space-y-4">
          {data.children.length === 0 ? (
            <p className="text-sm font-body text-galaxy-text-muted">{t('school:writing_year.teacher.no_children')}</p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.children.map((c) => (
                <li key={c.student_id}>
                  <button
                    type="button"
                    onClick={() => setOpen(c)}
                    className="w-full text-left rounded-xl border border-galaxy-text-muted/10 hover:border-galaxy-secondary/40 px-3 py-2.5 transition-colors"
                  >
                    <span className="flex items-center gap-2 font-body font-semibold text-sm text-galaxy-text truncate">
                      <span aria-hidden="true">{c.avatar_emoji}</span>{c.display_name}
                    </span>
                    <span className="block text-xs font-body text-galaxy-text-muted">
                      {t('school:writing_year.teacher.pieces_count', { count: c.item_count })}
                      {c.pending_count > 0 && <span className="text-amber-200"> · {t('school:writing_year.teacher.waiting_count', { count: c.pending_count })}</span>}
                    </span>
                    <span className="block text-xs font-body text-galaxy-text-muted">
                      {c.about_me_done ? t('school:writing_year.teacher.about_done') : t('school:writing_year.teacher.about_missing')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-galaxy-text-muted/10 pt-4">
            <ClassPrintFlow
              classId={classId}
              canPrint={data.can_print}
              request={request}
              schoolYear={data.school_year}
              locale={locale}
              onRequested={load}
            />
          </div>
        </div>
      )}

      {open && (
        <WritingYearChild classId={classId} student={open} onClose={() => { setOpen(null); load() }} onChanged={load} />
      )}
    </section>
  )
}

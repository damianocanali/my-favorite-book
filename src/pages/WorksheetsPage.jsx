// Free printable story worksheets (brief §11 / task WS): a public, no
// sign-in library of 8 templates. Public and unauthenticated like /gallery
// or /example — this is the teacher-acquisition surface (spec
// 2026-09-26-schools-design.md §11), so it deliberately sits outside every
// auth/consumer-only route guard.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer, SlidersHorizontal, ClipboardList } from 'lucide-react'
import i18next, { loadLocale } from '../i18n/index.js'
import WorksheetSheet from '../components/worksheets/sheets.jsx'
import WorksheetThumbnail from '../components/worksheets/WorksheetThumbnail'
import CustomizePanel from '../components/worksheets/CustomizePanel'
import { WORKSHEET_TEMPLATES, GRADE_BANDS, getWorksheetTemplate } from '../lib/worksheets/templates.js'
import { parseWorksheetParams } from '../lib/worksheets/params.js'
import { parseNameList } from '../lib/worksheets/names.js'
import { useTeacherMode } from '../hooks/useTeacherMode'
import { ASSIGN_WORKSHEET_HREF } from '../components/school/assignIntent.js'
import { enterWorksheetsPrintMode, exitWorksheetsPrintMode } from '../components/school/printMode.js'

const DEFAULT_VALUES = { prompt: '', className: '', teacherName: '', sheetLocale: 'en', namesRaw: '' }

export default function WorksheetsPage() {
  const { t, i18n } = useTranslation(['worksheets', 'checkin', 'games'])
  const [searchParams] = useSearchParams()
  // A signed-in teacher reaches this page from their own Worksheets tab;
  // they also get the way into assigning one (the public visitor doesn't).
  const teacherMode = useTeacherMode()

  // Cross-namespace wrappers so sheets.jsx (and its thumbnails) can take a
  // single `t`/`tCheckin`/`tGames` prop each already scoped to the right
  // namespace, whether it's this reactive site-language version or, for an
  // actual print job, a fixed one (see printJob below).
  const tCheckinSite = (key, opts) => t(`checkin:${key}`, opts)
  const tGamesSite = (key, opts) => t(`games:${key}`, opts)

  const [customTarget, setCustomTarget] = useState(null) // template id, or null when the panel is closed
  const [values, setValues] = useState(DEFAULT_VALUES)
  const [printJob, setPrintJob] = useState(null)

  // SEO: a proper <title> and meta description, restored on unmount so
  // navigating away doesn't leave another page introducing itself as the
  // worksheets library.
  useEffect(() => {
    const metaDescEl = document.querySelector('meta[name="description"]')
    const prevTitle = document.title
    const prevDesc = metaDescEl?.getAttribute('content') ?? null
    document.title = `${t('page.title')} — My Book Lab`
    metaDescEl?.setAttribute('content', t('page.meta_description'))
    return () => {
      document.title = prevTitle
      if (prevDesc != null) metaDescEl?.setAttribute('content', prevDesc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language])

  // Teacher-hook deep link (brief §4): /worksheets?template=<id>&prompt=
  // <assignment prompt>&class=<class name> opens straight into the
  // Customize panel, prefilled. Runs once — a teacher editing the panel
  // afterwards shouldn't have their edits stomped by the URL on every
  // render.
  useEffect(() => {
    const parsed = parseWorksheetParams(searchParams)
    if (!parsed.template) return
    setValues((v) => ({ ...v, prompt: parsed.prompt, className: parsed.className }))
    setCustomTarget(parsed.template)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleAfterPrint() {
      exitWorksheetsPrintMode(document)
    }
    window.addEventListener('afterprint', handleAfterPrint)
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      exitWorksheetsPrintMode(document)
    }
  }, [])

  // Fires only after React has committed printJob's sheets into the portal
  // (an effect, not the click handler itself) — calling window.print()
  // synchronously in the handler risks printing the PREVIOUS job, since
  // React's state update hasn't necessarily painted yet.
  useEffect(() => {
    if (!printJob) return
    enterWorksheetsPrintMode(document)
    window.print()
  }, [printJob])

  function openCustomize(templateId) {
    setValues((v) => ({
      prompt: '',
      className: '',
      teacherName: v.teacherName,
      sheetLocale: v.sheetLocale || (i18n.language === 'it' ? 'it' : 'en'),
      namesRaw: '',
    }))
    setCustomTarget(templateId)
  }

  function quickPrint(templateId) {
    setPrintJob({
      templateId,
      prompt: '',
      className: '',
      teacherName: '',
      sheetLocale: i18n.language === 'it' ? 'it' : 'en',
      names: [],
    })
  }

  async function printFromCustomize() {
    if (values.sheetLocale !== 'en') await loadLocale(values.sheetLocale)
    setPrintJob({
      templateId: customTarget,
      prompt: values.prompt,
      className: values.className,
      teacherName: values.teacherName,
      sheetLocale: values.sheetLocale,
      names: parseNameList(values.namesRaw),
    })
    setCustomTarget(null)
  }

  const openTemplate = customTarget ? getWorksheetTemplate(customTarget) : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h1 className="font-heading text-3xl font-bold text-galaxy-text mb-2">{t('page.title')}</h1>
        <p className="text-galaxy-text-muted font-body">{t('page.intro')}</p>
        {teacherMode && (
          <div className="mt-5 flex flex-col items-center gap-1.5">
            <Link
              to={ASSIGN_WORKSHEET_HREF}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-body font-bold text-white btn-fill-primary transition-colors"
            >
              <ClipboardList size={16} aria-hidden="true" /> {t('teacher.assign_link')}
            </Link>
            <p className="text-xs text-galaxy-text-muted font-body">{t('teacher.assign_hint')}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {WORKSHEET_TEMPLATES.map((template) => (
          <div
            key={template.id}
            className="glass rounded-2xl p-4 border border-galaxy-text-muted/10 flex flex-col gap-3"
          >
            <div className="flex justify-center">
              <WorksheetThumbnail templateId={template.id} t={t} tCheckin={tCheckinSite} tGames={tGamesSite} />
            </div>
            <div>
              <h2 className="font-heading font-bold text-galaxy-text">{t(template.titleKey)}</h2>
              <p className="text-xs text-galaxy-text-muted font-body mt-0.5">{t(template.descriptionKey)}</p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-body font-semibold border border-galaxy-secondary/30 text-galaxy-secondary">
                {t(`grid.grade_band.${template.gradeBand === GRADE_BANDS.K2 ? 'k2' : 'g35'}`)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-auto pt-1">
              <button
                type="button"
                onClick={() => quickPrint(template.id)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-bold text-white btn-fill-primary transition-colors"
              >
                <Printer size={15} /> {t('actions.print')}
              </button>
              <button
                type="button"
                onClick={() => openCustomize(template.id)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-body font-semibold text-galaxy-text border border-galaxy-text-muted/25 hover:border-galaxy-secondary/50 transition-colors"
              >
                <SlidersHorizontal size={14} /> {t('actions.customize')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {openTemplate && (
        <CustomizePanel
          t={t}
          template={openTemplate}
          values={values}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          onPrint={printFromCustomize}
          onClose={() => setCustomTarget(null)}
        />
      )}

      {/* Print-only portal — see index.css's "Worksheets print" section for
          why this has to be a sibling of #root rather than a descendant. */}
      {printJob && createPortal(
        <div className="worksheets-print">
          {(printJob.names.length ? printJob.names : [null]).map((name, i) => (
            <WorksheetSheet
              key={i}
              templateId={printJob.templateId}
              t={i18next.getFixedT(printJob.sheetLocale, 'worksheets')}
              tCheckin={i18next.getFixedT(printJob.sheetLocale, 'checkin')}
              tGames={i18next.getFixedT(printJob.sheetLocale, 'games')}
              prompt={printJob.prompt}
              className={printJob.className}
              teacherName={printJob.teacherName}
              studentName={name || ''}
            />
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

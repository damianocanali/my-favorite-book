// The worksheet library (brief §11 / task WS; teacher round 6B): a public,
// no sign-in library of all 33 worksheets, searchable, by shelf and grade,
// each viewable full size, printable, customizable and — for a signed-in
// teacher — assignable. Public and unauthenticated like /gallery
// or /example — this is the teacher-acquisition surface (spec
// 2026-09-26-schools-design.md §11), so it deliberately sits outside every
// auth/consumer-only route guard.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer, SlidersHorizontal, ClipboardList } from 'lucide-react'
import i18next, { loadLocale } from '../i18n/index.js'
import WorksheetSheet from '../components/worksheets/sheets.jsx'
import WorksheetThumbnail from '../components/worksheets/WorksheetThumbnail'
import CustomizePanel from '../components/worksheets/CustomizePanel'
import WorksheetPreview from '../components/worksheets/WorksheetPreview'
import LibraryFilters, { LibraryEmpty } from '../components/worksheets/LibraryFilters'
import { getWorksheetTemplate, schoolKey } from '../lib/worksheets/templates.js'
import { filterTemplates, groupByCategory, parseLibraryParams, withLibraryParams, hasActiveFilters } from '../lib/worksheets/library.js'
import { useElementWidth } from '../hooks/useElementWidth'
import { parseWorksheetParams } from '../lib/worksheets/params.js'
import { parseNameList } from '../lib/worksheets/names.js'
import { sheetTranslators } from '../lib/worksheets/sheetLocale.js'
import { useTeacherMode } from '../hooks/useTeacherMode'
import { ASSIGN_WORKSHEET_HREF } from '../components/school/assignIntent.js'
import { enterWorksheetsPrintMode, exitWorksheetsPrintMode } from '../components/school/printMode.js'

const GRID = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5'

// A live, lazily rendered thumbnail as wide as its card.
function CardThumbnail({ templateId, sheetProps }) {
  const ref = useRef(null)
  const width = useElementWidth(ref)
  return (
    <div ref={ref} className="w-full">
      <WorksheetThumbnail lazy width={width} templateId={templateId} {...sheetProps} />
    </div>
  )
}

const DEFAULT_VALUES = { prompt: '', className: '', teacherName: '', sheetLocale: 'en', namesRaw: '' }

export default function WorksheetsPage() {
  const { t, i18n } = useTranslation(['worksheets', 'checkin', 'games', 'school'])
  const [searchParams, setSearchParams] = useSearchParams()
  // A signed-in teacher reaches this page from their own Worksheets tab;
  // they also get the way into assigning one (the public visitor doesn't).
  const teacherMode = useTeacherMode()

  // Cross-namespace wrappers so sheets.jsx (and its thumbnails) can take a
  // single `t`/`tCheckin`/`tGames` prop each already scoped to the right
  // namespace, whether it's this reactive site-language version or, for an
  // actual print job, a fixed one (see printJob below).
  const tCheckinSite = (key, opts) => t(`checkin:${key}`, opts)
  const tGamesSite = (key, opts) => t(`games:${key}`, opts)
  // Keys passed to tSchool already carry their 'school:' namespace.
  const tSchoolSite = t

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

  // Search, shelf and grade live in the URL (?q=&cat=&grade=) so a link or
  // Back brings the same view; typing replaces the entry, a chip adds one.
  // The box shows what was typed straight away (`query`); the URL follows
  // through a functional update so fast typing never drops a letter, and a
  // Back / link that changes ?q= puts its value back in the box.
  const urlFilters = parseLibraryParams(searchParams)
  const [query, setQuery] = useState(urlFilters.q)
  useEffect(() => {
    setQuery((cur) => (cur === urlFilters.q ? cur : urlFilters.q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilters.q])
  const filters = { ...urlFilters, q: query }
  const setFilters = (patch) => {
    if ('q' in patch) setQuery(patch.q)
    const typingOnly = Object.keys(patch).length === 1 && 'q' in patch
    setSearchParams((prev) => withLibraryParams(prev, patch), { replace: typingOnly })
  }
  const filtering = hasActiveFilters(filters)
  const results = filterTemplates(filters, t)
  const [previewId, setPreviewId] = useState(null)
  const previewTemplate = previewId ? getWorksheetTemplate(previewId) : null

  // A card: the thumbnail, title, description and grade, with the title's
  // button stretched over the whole card (::after overlay) so a click
  // anywhere opens the preview — no block content inside a <button>. Print
  // and Customize sit above the overlay.
  const card = (template) => (
    <div key={template.id} className="group relative glass rounded-2xl p-2.5 sm:p-4 border border-galaxy-text-muted/10 flex flex-col gap-2.5 min-w-0">
      <CardThumbnail templateId={template.id} sheetProps={{ t, tSchool: tSchoolSite, tCheckin: tCheckinSite, tGames: tGamesSite }} />
      <div className="min-w-0">
        <h3 className="font-heading font-bold text-galaxy-text group-hover:text-galaxy-secondary transition-colors break-words">
          <button
            type="button"
            onClick={() => setPreviewId(template.id)}
            aria-label={`${t('school:worksheet.library.view')}: ${t(schoolKey(template.id, 'title'))}`}
            className="text-left after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-galaxy-secondary"
          >
            {t(schoolKey(template.id, 'title'))}
          </button>
        </h3>
        <p className="text-xs text-galaxy-text-muted font-body mt-0.5 line-clamp-3">{t(schoolKey(template.id, 'description'))}</p>
        <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-body font-semibold border border-galaxy-secondary/30 text-galaxy-secondary">
          {t(`school:worksheet.grades.${template.gradeBand}`)}
        </span>
      </div>
      <div className="relative z-10 flex items-center gap-1.5 mt-auto pt-1">
        <button
          type="button"
          onClick={() => quickPrint(template.id)}
          className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-sm font-body font-bold text-white btn-fill-primary transition-colors"
        >
          <Printer size={15} aria-hidden="true" /> <span className="truncate">{t('actions.print')}</span>
        </button>
        <button
          type="button"
          onClick={() => openCustomize(template.id)}
          aria-label={t('actions.customize')}
          title={t('actions.customize')}
          className="shrink-0 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-sm font-body font-semibold text-galaxy-text border border-galaxy-text-muted/25 hover:border-galaxy-secondary/50 transition-colors min-w-[40px]"
        >
          <SlidersHorizontal size={14} aria-hidden="true" /> <span className="hidden lg:inline">{t('actions.customize')}</span>
        </button>
      </div>
    </div>
  )

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

      <div className="mb-6">
        <LibraryFilters value={filters} onChange={setFilters} />
      </div>

      {results.length === 0 ? (
        <LibraryEmpty value={filters} onChange={setFilters} />
      ) : filtering ? (
        <div className={GRID}>{results.map(card)}</div>
      ) : (
        // No filter: shelf by shelf, each under its heading.
        <div className="space-y-10">
          {groupByCategory(results).map((group) => (
            <section key={group.category} aria-labelledby={`ws-cat-${group.category}`}>
              <h2 id={`ws-cat-${group.category}`} className="font-heading text-xl font-bold text-galaxy-text mb-3">
                {t(`school:worksheet.categories.${group.category}`)}
              </h2>
              <div className={GRID}>{group.templates.map(card)}</div>
            </section>
          ))}
        </div>
      )}

      {previewTemplate && (
        <WorksheetPreview
          template={previewTemplate}
          list={results.some((x) => x.id === previewTemplate.id) ? results : [previewTemplate]}
          sheetProps={{ t, tSchool: tSchoolSite, tCheckin: tCheckinSite, tGames: tGamesSite }}
          teacherMode={teacherMode}
          onNavigate={setPreviewId}
          onClose={() => setPreviewId(null)}
          onPrint={() => quickPrint(previewTemplate.id)}
          onCustomize={() => {
            // One dialog at a time: each makes the page behind it inert.
            setPreviewId(null)
            openCustomize(previewTemplate.id)
          }}
        />
      )}

      {openTemplate && (
        <CustomizePanel
          t={t}
          template={openTemplate}
          values={values}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          teacherMode={teacherMode}
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
              {...sheetTranslators(i18next, printJob.sheetLocale)}
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

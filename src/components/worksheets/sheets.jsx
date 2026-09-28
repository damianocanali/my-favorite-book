// The 8 free worksheet templates (brief §11 / spec §11). Each `*Body`
// component only renders the part of the sheet specific to that template —
// WorksheetSheet below wraps whichever one matches `templateId` with the
// shared header/footer so every sheet, whatever it is, prints as exactly
// one page with the same Name/Date header and mybooklab.app footer + QR.
//
// Plain bordered boxes for "drawing space" and ruled `<div>` lines for
// "lines to write on" rather than any illustration — black-and-white
// friendly (brief), and it's what a photocopier-bound worksheet actually
// looks like.
import { Star } from 'lucide-react'
import WorksheetHeader from './WorksheetHeader'
import WorksheetFooter from './WorksheetFooter'
import { getWorksheetTemplate } from '../../lib/worksheets/templates.js'
import { FEELINGS, NEEDS } from '../../lib/checkIn.js'
import { getAllStartersForPosition } from '../../lib/sentenceStarters.js'

function DrawBox({ className = '', style }) {
  return <div className={`border-2 border-black rounded-md flex-1 ${className}`} style={style} aria-hidden="true" />
}

function WriteLines({ count = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border-b border-black h-4" />
      ))}
    </div>
  )
}

function TodayPrompt({ t, prompt }) {
  if (!prompt) return null
  return (
    <p className="text-sm font-semibold border border-black rounded-md px-3 py-2 mb-3 bg-black/[0.03]">
      {t('sheet.today_prompt', { prompt })}
    </p>
  )
}

function StoryMapBody({ t, prompt }) {
  const parts = ['beginning', 'middle', 'end']
  return (
    <div className="flex flex-col h-full">
      <TodayPrompt t={t} prompt={prompt} />
      <div className="grid grid-cols-1 gap-4 flex-1">
        {parts.map((part) => (
          <div key={part} className="flex flex-col gap-2 flex-1">
            <p className="font-bold text-sm">{t(`sheet.story_map.${part}`)}</p>
            <DrawBox style={{ minHeight: '1.1in' }} />
            <WriteLines count={2} />
          </div>
        ))}
      </div>
    </div>
  )
}

function CharacterProfileBody({ t, prompt }) {
  const fields = ['looks_like', 'likes', 'wants', 'afraid_of']
  return (
    <div className="flex flex-col h-full gap-3">
      <TodayPrompt t={t} prompt={prompt} />
      <div className="flex items-end gap-2 text-sm">
        <span>{t('sheet.character_profile.name_label')}:</span>
        <span className="flex-1 border-b border-black h-4" />
      </div>
      <DrawBox style={{ minHeight: '2.4in' }} />
      <div className="grid grid-cols-2 gap-4 flex-1">
        {fields.map((f) => (
          <div key={f} className="flex flex-col gap-1">
            <p className="font-bold text-sm">{t(`sheet.character_profile.${f}`)}</p>
            <WriteLines count={2} />
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingSketchBody({ t, prompt }) {
  return (
    <div className="flex flex-col h-full gap-3">
      <TodayPrompt t={t} prompt={prompt} />
      <p className="font-bold text-sm">{t('sheet.setting_sketch.draw_prompt')}</p>
      <DrawBox style={{ minHeight: '4in' }} />
      <p className="font-bold text-sm mt-2">{t('sheet.setting_sketch.question')}</p>
      <WriteLines count={4} className="flex-1" />
    </div>
  )
}

function StoryboardBody({ t, prompt }) {
  return (
    <div className="flex flex-col h-full">
      <TodayPrompt t={t} prompt={prompt} />
      <div className="grid grid-cols-3 grid-rows-2 gap-3 flex-1">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold text-black/60">{t('sheet.storyboard.panel', { number: i + 1 })}</p>
            <DrawBox style={{ minHeight: '1.1in' }} />
            <WriteLines count={2} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Order and counts chosen so the whole strip — 3 opening + 3 middle + 2
// ending starters, each with a line to finish it — fits one Letter page
// with 0.5in margins. getAllStartersForPosition returns every starter for a
// position in a stable order (unlike getPromptsForPage's random 4, used
// in-editor); translate is the sheet-language-fixed `t`, so the strip is
// independent of whatever the site chrome is showing.
const STRIP_COUNTS = { opening: 3, middle: 3, ending: 2 }

function SentenceStartersBody({ t, tGames, prompt }) {
  const rows = Object.entries(STRIP_COUNTS).flatMap(([position, count]) =>
    getAllStartersForPosition(position, tGames).slice(0, count)
  )
  return (
    <div className="flex flex-col h-full gap-3">
      <TodayPrompt t={t} prompt={prompt} />
      <p className="font-semibold text-sm">{t('sheet.sentence_starters.finish_prompt')}</p>
      <div className="flex-1 flex flex-col justify-between gap-4">
        {rows.map((starter, i) => (
          <div key={i} className="flex items-end gap-1 text-sm">
            <span className="whitespace-nowrap italic">{starter}</span>
            <span className="flex-1 border-b border-black h-4" />
          </div>
        ))}
      </div>
    </div>
  )
}

function BookReportBody({ t, prompt }) {
  return (
    <div className="flex flex-col h-full gap-3">
      <TodayPrompt t={t} prompt={prompt} />
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-end gap-1">
          <span>{t('sheet.book_report.title_label')}:</span>
          <span className="flex-1 border-b border-black h-4" />
        </div>
        <div className="flex items-end gap-1">
          <span>{t('sheet.book_report.author_label')}:</span>
          <span className="flex-1 border-b border-black h-4" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 flex-none">
        <div className="flex flex-col gap-1">
          <p className="font-bold text-sm">{t('sheet.book_report.favorite_part')}</p>
          <WriteLines count={2} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-bold text-sm">{t('sheet.book_report.favorite_character')}</p>
          <WriteLines count={2} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className="font-bold text-sm">{t('sheet.book_report.rating_label')}</p>
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} size={22} strokeWidth={1.5} color="black" fill="none" />
          ))}
        </div>
      </div>
      <p className="font-bold text-sm">{t('sheet.book_report.draw_scene')}</p>
      <DrawBox className="flex-1" style={{ minHeight: '2.2in' }} />
    </div>
  )
}

// Review round 1: bigger circles (a page that only used its top third
// looked unfinished) plus a draw box and a couple of "why" lines, so the
// sheet actually uses the page it's printed on rather than leaving most of
// it blank.
function FeelingsCheckinBody({ t, tCheckin }) {
  return (
    <div className="flex flex-col h-full gap-5">
      <p className="font-bold text-lg">{t('sheet.feelings_checkin.how_feeling')}</p>
      <div className="grid grid-cols-3 gap-6">
        {FEELINGS.map((f) => (
          <div key={f.id} className="flex flex-col items-center gap-1">
            <div className="w-28 h-28 rounded-full border-2 border-black flex items-center justify-center text-center px-2">
              <span className="text-base font-semibold">{tCheckin(`feeling.${f.id}`)}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="font-bold text-lg">{t('sheet.feelings_checkin.i_need')}</p>
      <div className="flex flex-wrap gap-3">
        {NEEDS.map((n) => (
          <span key={n.id} className="border-2 border-black rounded-full px-4 py-2 text-base font-semibold">
            {tCheckin(`need.${n.id}`)}
          </span>
        ))}
      </div>
      <p className="font-bold text-lg">{t('sheet.feelings_checkin.draw_prompt')}</p>
      <DrawBox style={{ minHeight: '2.2in' }} />
      <p className="font-bold text-base">{t('sheet.feelings_checkin.why_prompt')}</p>
      <WriteLines count={2} />
    </div>
  )
}

function AboutAuthorBody({ t, prompt }) {
  return (
    <div className="flex flex-col h-full gap-3">
      <TodayPrompt t={t} prompt={prompt} />
      <p className="font-bold text-sm">{t('sheet.about_author.draw_yourself')}</p>
      <DrawBox style={{ minHeight: '3in' }} />
      <div className="flex flex-col gap-3 flex-1">
        {['my_name_is', 'i_like_to_write_about', 'my_next_book'].map((k) => (
          <div key={k} className="flex flex-col gap-1">
            <p className="font-semibold text-sm">{t(`sheet.about_author.${k}`)}</p>
            <WriteLines count={1} />
          </div>
        ))}
      </div>
    </div>
  )
}

export const SHEET_BODIES = {
  'story-map': StoryMapBody,
  'character-profile': CharacterProfileBody,
  'setting-sketch': SettingSketchBody,
  storyboard: StoryboardBody,
  'sentence-starters': SentenceStartersBody,
  'book-report': BookReportBody,
  'feelings-checkin': FeelingsCheckinBody,
  'about-author': AboutAuthorBody,
}

/**
 * One full worksheet sheet: header, the template's own body, footer + QR.
 * `t`/`tCheckin`/`tGames` are fixed-language translators bound to the
 * chosen SHEET language (independent of the site's own language — brief
 * §2) — see WorksheetsPage for how those are built.
 */
export default function WorksheetSheet({
  templateId,
  t,
  tCheckin,
  tGames,
  prompt = '',
  className = '',
  teacherName = '',
  studentName = '',
}) {
  const template = getWorksheetTemplate(templateId)
  const Body = SHEET_BODIES[templateId]
  if (!template || !Body) return null

  return (
    <div className="worksheet-sheet font-body flex flex-col">
      {/* Review round 1: a big, kid-friendly title ("My Story Map", "How I
          Feel Today") from the template registry's own sheetTitleKey — a
          deliberately different, friendlier string from the grid card's
          plain titleKey. In the sheet language, same as everything else
          `t` renders here. */}
      <h1 className="text-2xl font-heading font-bold text-center mb-2">{t(template.sheetTitleKey)}</h1>
      <WorksheetHeader t={t} className={className} teacherName={teacherName} studentName={studentName} />
      <div className="worksheet-body flex-1 min-h-0">
        <Body t={t} tCheckin={tCheckin} tGames={tGames} prompt={prompt} />
      </div>
      <WorksheetFooter t={t} templateId={templateId} />
    </div>
  )
}

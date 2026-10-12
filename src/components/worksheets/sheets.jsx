// The printable sheets of the worksheet library (teacher round 6B): all 33
// templates of lib/school/worksheets.js, one US Letter page each.
//
// Most sheets are drawn by GenericSheetBody from the template's boxes and
// print hints (src/lib/worksheets/printLayout.js gives every block its exact
// height in inches; tests/worksheets-print-layout.test.js checks every sheet
// fits one page). A few keep a hand-made body where it adds something real:
// the sentence-starter strip, the feelings grid, the book report's star
// rating, the word web's bubbles. WorksheetSheet wraps either one with the
// shared title, Name / Date header and mybooklab.app footer + QR.
//
// Every box label is the template's default prompt (school.json
// worksheet.templates.<id>.boxes.*) — the same words the child sees when the
// sheet is assigned — or, for an assignment printed blank, the teacher's
// own prompts (`labels`).
//
// Plain bordered boxes for drawing space and ruled lines to write on rather
// than any illustration: black-and-white friendly, photocopier-ready.
import { Star } from 'lucide-react'
import WorksheetHeader from './WorksheetHeader'
import WorksheetFooter from './WorksheetFooter'
import { getWorksheetTemplate, schoolKey } from '../../lib/worksheets/templates.js'
import { printLayout, LABEL_IN, LINE_IN, GAP_IN, DRAW_GAP_IN } from '../../lib/worksheets/printLayout.js'
import { FEELINGS, NEEDS } from '../../lib/checkIn.js'
import { getAllStartersForPosition } from '../../lib/sentenceStarters.js'

const inch = (n) => `${n}in`

function DrawBox({ className = '', style }) {
  return <div className={`border-2 border-black rounded-md ${className}`} style={style} aria-hidden="true" />
}

function WriteLines({ count = 3, className = '' }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} data-line="" className="border-b border-black" style={{ height: inch(LINE_IN) }} />
      ))}
    </div>
  )
}

function Label({ children, className = '' }) {
  return (
    <p
      className={`font-bold text-sm leading-tight line-clamp-2 overflow-hidden ${className}`}
      style={{ height: inch(LABEL_IN) }}
    >
      {children}
    </p>
  )
}

function TodayPrompt({ t, prompt }) {
  if (!prompt) return null
  return (
    <p className="text-sm font-semibold border border-black rounded-md px-3 py-2 mb-3 bg-black/[0.03] line-clamp-2 shrink-0">
      {t('sheet.today_prompt', { prompt })}
    </p>
  )
}

/// The label of each box: the teacher's prompt when printing an assignment,
/// else the template's default prompt in the sheet language.
const labelFor = (tSchool, templateId, labels) => (boxId) =>
  labels?.[boxId] ?? tSchool(schoolKey(templateId, `boxes.${boxId}`))

function GenericBox({ box, label, word }) {
  const letters = box.perLetter ? [...(word ?? '')] : []
  return (
    <div className="flex flex-col min-w-0 flex-1" style={{ height: inch(box.height) }} data-box={box.id}>
      <Label>{label}</Label>
      {box.drawIn > 0 && (
        <DrawBox className="shrink-0" style={{ height: inch(box.drawIn), marginBottom: inch(DRAW_GAP_IN) }} />
      )}
      {box.perLetter ? (
        <div aria-hidden="true">
          {Array.from({ length: box.lines }, (_, i) => (
            <div key={i} data-line="" className="flex items-end gap-2" style={{ height: inch(LINE_IN) }}>
              <span className="w-7 text-center text-lg font-bold leading-none border-b-2 border-black">{letters[i] ?? ''}</span>
              <span className="flex-1 border-b border-black" />
            </div>
          ))}
        </div>
      ) : box.id === 'word' && word ? (
        <p className="text-xl font-bold tracking-[0.3em]" style={{ height: inch(LINE_IN * box.lines) }}>{word}</p>
      ) : (
        <WriteLines count={box.lines} />
      )}
    </div>
  )
}

function Picture({ label, picture }) {
  return (
    <div className="flex flex-col flex-1" style={{ minHeight: inch(picture.blockHeight) }}>
      <Label>{label}</Label>
      <DrawBox className="flex-1" />
    </div>
  )
}

/**
 * The generic body: rows of boxes at the heights printLayout computed, and
 * the drawing box (when the template has one) taking whatever room is left.
 * `labels`: box id -> label (an assignment's prompts); `word`: the
 * acrostic's word, when the teacher set one.
 */
export function GenericSheetBody({ templateId, tSchool, labels = null, word = null }) {
  const layout = printLayout(templateId)
  if (!layout) return null
  const label = labelFor(tSchool, templateId, labels)
  const picture = layout.picture
    ? <Picture label={tSchool(schoolKey(templateId, 'picture'))} picture={layout.picture} />
    : null
  return (
    <div className="flex flex-col h-full" style={{ gap: inch(GAP_IN) }} data-layout-height={layout.height}>
      {layout.picture?.at === 'top' && picture}
      {layout.rows.map((row, i) => (
        <div key={i} className="flex shrink-0" style={{ gap: '0.2in', height: inch(row.height) }}>
          {row.boxes.map((box) => <GenericBox key={box.id} box={box} label={label(box.id)} word={word} />)}
        </div>
      ))}
      {layout.picture?.at === 'bottom' && picture}
    </div>
  )
}

// The sentence-starter strip: 3 opening + 3 middle + 2 ending starters, each
// with a line to finish it. getAllStartersForPosition returns every starter
// for a position in a stable order (unlike getPromptsForPage's random 4,
// used in-editor); `tGames` is the sheet-language-fixed translator, so the
// strip is independent of whatever the site chrome is showing.
const STRIP_COUNTS = { opening: 3, middle: 3, ending: 2 }

function SentenceStartersBody({ t, tGames }) {
  const rows = Object.entries(STRIP_COUNTS).flatMap(([position, count]) =>
    getAllStartersForPosition(position, tGames).slice(0, count)
  )
  return (
    <div className="flex flex-col h-full gap-3">
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

function BookReportBody({ t, tSchool }) {
  const label = labelFor(tSchool, 'book_report', null)
  const field = (id, lines) => (
    <div className="flex flex-col gap-1 min-w-0 flex-1">
      <p className="font-bold text-sm leading-tight">{label(id)}</p>
      <WriteLines count={lines} />
    </div>
  )
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex gap-4">{field('title', 1)}{field('author', 1)}</div>
      {field('about', 3)}
      <div className="flex gap-4">{field('favorite', 3)}{field('would_recommend', 3)}</div>
      <div className="flex items-center gap-2">
        <p className="font-bold text-sm">{t('sheet.book_report.rating_label')}</p>
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} size={22} strokeWidth={1.5} color="black" fill="none" />
          ))}
        </div>
      </div>
      <p className="font-bold text-sm">{tSchool(schoolKey('book_report', 'picture'))}</p>
      <DrawBox className="flex-1" style={{ minHeight: '1.2in' }} />
    </div>
  )
}

// Circles to ring how you feel, chips for what would help, then a drawing
// box and the two "why / what helps" lines the assigned sheet asks too.
function FeelingsCheckinBody({ t, tSchool, tCheckin }) {
  const label = labelFor(tSchool, 'feelings_checkin', null)
  return (
    <div className="flex flex-col h-full gap-4">
      <p className="font-bold text-lg">{t('sheet.feelings_checkin.how_feeling')}</p>
      <div className="grid grid-cols-3 gap-4">
        {FEELINGS.map((f) => (
          <div key={f.id} className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full border-2 border-black flex items-center justify-center text-center px-2">
              <span className="text-base font-semibold">{tCheckin(`feeling.${f.id}`)}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="font-bold text-lg">{t('sheet.feelings_checkin.i_need')}</p>
      <div className="flex flex-wrap gap-3">
        {NEEDS.map((n) => (
          <span key={n.id} className="border-2 border-black rounded-full px-4 py-1.5 text-base font-semibold">
            {tCheckin(`need.${n.id}`)}
          </span>
        ))}
      </div>
      <p className="font-bold text-base">{tSchool(schoolKey('feelings_checkin', 'picture'))}</p>
      <DrawBox className="flex-1" style={{ minHeight: '0.8in' }} />
      <div className="flex gap-4">
        {['why', 'what_helps'].map((id) => (
          <div key={id} className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-tight">{label(id)}</p>
            <WriteLines count={2} />
          </div>
        ))}
      </div>
    </div>
  )
}

// A big idea in the middle, six bubbles around it, joined by spokes. Laid
// out in a fixed 7.5 x 6in box (well inside the body's 7.2in budget).
const WEB_IDEAS = ['idea_one', 'idea_two', 'idea_three', 'idea_four', 'idea_five', 'idea_six']
// Bubble centres in percent of the box, clockwise from top-left.
const WEB_SPOTS = [[18, 16], [50, 11], [82, 16], [82, 84], [50, 89], [18, 84]]

function WordWebBody({ tSchool }) {
  const label = labelFor(tSchool, 'word_web', null)
  return (
    <div className="relative w-full" style={{ height: '6in' }}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {WEB_SPOTS.map(([x, y], i) => (
          <line key={i} x1="50" y1="50" x2={x} y2={y} stroke="black" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div
        className="absolute border-[3px] border-black rounded-[50%] bg-white flex flex-col items-center justify-start pt-3 px-4"
        style={{ left: '50%', top: '50%', width: '2.8in', height: '1.6in', transform: 'translate(-50%, -50%)' }}
      >
        <p className="text-sm font-bold text-center leading-tight">{label('center')}</p>
      </div>
      {WEB_IDEAS.map((id, i) => (
        <div
          key={id}
          className="absolute border-2 border-black rounded-[50%] bg-white flex flex-col items-center justify-start pt-2 px-3"
          style={{ left: `${WEB_SPOTS[i][0]}%`, top: `${WEB_SPOTS[i][1]}%`, width: '2.1in', height: '1.15in', transform: 'translate(-50%, -50%)' }}
        >
          <p className="text-xs font-semibold text-center leading-tight text-black/70">{label(id)}</p>
        </div>
      ))}
    </div>
  )
}

/// The hand-made bodies (print.body in lib), by name.
export const SHEET_BODIES = {
  sentence_starters: SentenceStartersBody,
  book_report: BookReportBody,
  feelings_checkin: FeelingsCheckinBody,
  word_web: WordWebBody,
}

/**
 * One full worksheet sheet: title, header, the template's body, footer +
 * QR. `templateId` may be an old printable alias ('story-map').
 * `t`/`tSchool`/`tCheckin`/`tGames` are fixed-language translators bound to
 * the chosen SHEET language (independent of the site's own language) for
 * the worksheets, school, checkin and games namespaces — see WorksheetsPage
 * for how those are built.
 */
export default function WorksheetSheet({
  templateId,
  t,
  tSchool,
  tCheckin,
  tGames,
  prompt = '',
  className = '',
  teacherName = '',
  studentName = '',
}) {
  const template = getWorksheetTemplate(templateId)
  if (!template) return null
  const Body = SHEET_BODIES[template.print?.body]

  return (
    <div className="worksheet-sheet font-body flex flex-col" data-template={template.id}>
      {/* The big, kid-friendly heading ("My Story Map") — a different,
          friendlier string than the library card's title. */}
      <h1 className="text-2xl font-heading font-bold text-center mb-2 truncate shrink-0">{tSchool(schoolKey(template.id, 'heading'))}</h1>
      <WorksheetHeader t={t} className={className} teacherName={teacherName} studentName={studentName} />
      <TodayPrompt t={t} prompt={prompt} />
      <div className="worksheet-body flex-1 min-h-0 overflow-hidden">
        {Body
          ? <Body t={t} tSchool={tSchool} tCheckin={tCheckin} tGames={tGames} />
          : <GenericSheetBody templateId={template.id} tSchool={tSchool} />}
      </div>
      <WorksheetFooter t={t} templateId={template.id} />
    </div>
  )
}

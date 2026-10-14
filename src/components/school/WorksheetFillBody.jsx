// What a child sees on screen for a worksheet assignment: the title and
// class instructions, then one box per prompt (the acrostic: its word, then
// a line per letter). Shared by the child's WorksheetFill and the teacher's
// live preview in the assign form (AssignmentForm), so the preview can't
// drift from the real thing.
//
// `preview`: the teacher's read-only look — no read-aloud, dictation or
// word help, fields not editable (the caller also makes it `inert`).
// Student-facing: never give this file the teacher contrast scope.
import { useTranslation } from 'react-i18next'
import { Volume2, VolumeX, Mic, MicOff } from 'lucide-react'
import WritingScaffold from '../editor/WritingScaffold'
import { ANSWER_MAX, ACROSTIC_WORD_MAX } from '../../../lib/school/worksheets.js'
import { BOX_ROWS } from './worksheetUi'

export function ListenButton({ text, speech }) {
  const { t } = useTranslation()
  if (!speech?.isSupported || !text) return null
  const active = speech.isSpeaking && speech.current === text
  return (
    <button
      type="button"
      onClick={() => (active ? speech.stop() : speech.say(text))}
      aria-label={active ? t('school:actions.stop_listening') : t('school:worksheet.student.listen')}
      className="shrink-0 p-3 rounded-full bg-galaxy-secondary/15 text-galaxy-secondary hover:bg-galaxy-secondary/25 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
    >
      {active ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
    </button>
  )
}

export function MicButton({ boxId, dictation }) {
  const { t } = useTranslation()
  if (!dictation?.isSupported) return null
  const active = dictation.isListening && dictation.box === boxId
  return (
    <button
      type="button"
      onClick={() => (active ? dictation.stop() : dictation.start(boxId))}
      aria-label={active ? t('school:worksheet.student.stop_dictate') : t('school:worksheet.student.dictate')}
      aria-pressed={active}
      className={`shrink-0 p-3 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${active ? 'bg-red-500/25 text-red-300' : 'bg-white/[0.06] text-galaxy-text-muted hover:text-galaxy-text'}`}
    >
      {active ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
    </button>
  )
}

/// The heading block: template chip, the assignment's title, its class-wide
/// instructions (with read-aloud).
export function WorksheetFillTitle({ templateId, title, prompt, speech }) {
  const { t } = useTranslation()
  return (
    <div className="min-w-0">
      <p className="text-xs font-body font-semibold text-galaxy-secondary uppercase tracking-wide">
        {t(`school:worksheet.templates.${templateId}.title`, { defaultValue: t('school:worksheet.teacher.chip') })}
      </p>
      <h2 className="font-heading text-2xl font-bold text-galaxy-text break-words">{title}</h2>
      {prompt?.trim() && (
        <div className="flex items-start gap-2 mt-1">
          <p className="flex-1 font-body text-galaxy-text-muted break-words">{prompt}</p>
          <ListenButton text={prompt} speech={speech} />
        </div>
      )}
    </div>
  )
}

function BoxEditor({ id, prompt, rows, label, scaffold = false, answers, onChange, speech, dictation, preview }) {
  const { t } = useTranslation()
  const value = answers?.[id] ?? ''
  return (
    <div className="glass rounded-2xl p-4 border border-galaxy-text-muted/10 space-y-2">
      {prompt && (
        <div className="flex items-start gap-2">
          <p className="flex-1 font-heading text-lg font-bold text-galaxy-text break-words">{prompt}</p>
          <ListenButton text={prompt} speech={speech} />
        </div>
      )}
      <div className="flex items-start gap-2">
        {label && <span className="font-heading text-2xl font-bold text-galaxy-secondary w-8 shrink-0 pt-2" aria-hidden="true">{label}</span>}
        <textarea
          value={value}
          onChange={(e) => onChange?.(id, e.target.value)}
          readOnly={preview}
          tabIndex={preview ? -1 : undefined}
          rows={rows}
          maxLength={ANSWER_MAX}
          aria-label={label ? t('school:worksheet.student.line_for', { letter: label }) : prompt}
          className="flex-1 min-w-0 px-4 py-3 bg-white/[0.06] border border-white/15 rounded-xl text-galaxy-text text-xl font-body focus:border-galaxy-primary focus:outline-none resize-y"
        />
        <MicButton boxId={id} dictation={dictation} />
      </div>
      {value.length >= ANSWER_MAX && (
        <p className="text-amber-300 text-sm font-body">{t('school:worksheet.student.box_full')}</p>
      )}
      {/* Word help only on the big free-writing boxes, and always the
          "middle of a story" starters: a worksheet box has no page
          position for opening/ending starters to fit. */}
      {scaffold && !preview && (
        <WritingScaffold
          page={{ id, pageNumber: 2, text: value }}
          totalPages={3}
          characterName=""
          onInsertText={(boxId, text) => onChange(boxId, text)}
        />
      )}
    </div>
  )
}

/// Every box of `layout` (worksheetUi's fillLayout), in order.
export function WorksheetFillBoxes({ layout, worksheet, answers, onChange, speech = null, dictation = null, preview = false }) {
  const { t } = useTranslation()
  const shared = { answers, onChange, speech, dictation, preview }
  return (
    <div className="space-y-4">
      {layout.map((box) => {
        if (box.type === 'word') {
          return (
            <div key="word" className="glass rounded-2xl p-4 border border-galaxy-text-muted/10 space-y-2">
              <div className="flex items-start gap-2">
                <p className="flex-1 font-heading text-lg font-bold text-galaxy-text break-words">{box.prompt}</p>
                <ListenButton text={box.prompt} speech={speech} />
              </div>
              {box.fixed ? (
                <p className="font-heading text-3xl font-bold tracking-[0.3em] text-galaxy-secondary break-all">{worksheet.word}</p>
              ) : (
                <input
                  type="text"
                  value={answers?.word ?? ''}
                  onChange={(e) => onChange?.('word', e.target.value.replace(/\s/g, ''))}
                  readOnly={preview}
                  tabIndex={preview ? -1 : undefined}
                  maxLength={ACROSTIC_WORD_MAX}
                  placeholder={t('school:worksheet.student.word_placeholder')}
                  aria-label={t('school:worksheet.student.word_label')}
                  className="w-full px-4 py-3 bg-white/[0.06] border border-white/15 rounded-xl text-galaxy-text text-2xl font-heading uppercase tracking-[0.3em] focus:border-galaxy-primary focus:outline-none"
                />
              )}
            </div>
          )
        }
        if (box.type === 'letters') {
          return (
            <div key="lines" className="space-y-3">
              {box.prompt && (
                <div className="flex items-start gap-2">
                  <p className="flex-1 font-heading text-lg font-bold text-galaxy-text break-words">{box.prompt}</p>
                  <ListenButton text={box.prompt} speech={speech} />
                </div>
              )}
              {box.letters.map((l) => <BoxEditor key={l.id} id={l.id} prompt={null} rows={2} label={l.letter} {...shared} />)}
            </div>
          )
        }
        return <BoxEditor key={box.id} id={box.id} prompt={box.prompt} rows={BOX_ROWS[box.size] ?? 4} label={null} scaffold={box.size === 'large'} {...shared} />
      })}
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import { Volume2, VolumeX } from 'lucide-react'
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis'

// A built "My Writing Year" book on screen (the same content the PDF prints:
// lib/print/writing-year-html.js) — the teacher's preview and the child's
// read-only view. Each piece can be read aloud in the class language.
export default function WritingYearBookView({ book }) {
  const { t } = useTranslation()
  const { speak, stop, isSpeaking, isSupported } = useSpeechSynthesis()
  if (!book) return null

  function listen(text) {
    if (isSpeaking) stop()
    else speak(text, book.lang)
  }

  const pieceText = (p) => (p.kind === 'worksheet'
    ? p.boxes.map((b) => `${b.prompt}. ${b.answer}`).join('\n')
    : p.pages.map((pg) => pg.text).join('\n'))

  const aboutRows = ['about_favorite', 'about_best_sentence', 'about_learned'].filter((f) => book.about?.[f])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {book.avatar_url
          ? <img src={book.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
          : <span aria-hidden="true" className="text-4xl">{book.avatar_emoji || '✏️'}</span>}
        <div>
          <p className="font-heading font-bold text-galaxy-text">{book.cover_title || t('school:writing_year.student.card_heading')}</p>
          <p className="text-xs font-body text-galaxy-text-muted">{book.name} · {book.class_name} · {String(book.year ?? '').replace('-', '–')}</p>
        </div>
      </div>

      {!book.pieces?.length && <p className="text-sm font-body text-galaxy-text-muted">{t('school:writing_year.preview.empty')}</p>}

      <ol className="space-y-3">
        {(book.pieces ?? []).map((p, i) => (
          <li key={i} className="rounded-xl border border-galaxy-text-muted/10 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-heading font-bold text-sm text-galaxy-text">{i + 1}. {p.title}</p>
              {isSupported && (
                <button
                  type="button"
                  onClick={() => listen(pieceText(p))}
                  aria-label={isSpeaking ? t('school:writing_year.student.stop') : t('school:writing_year.student.listen')}
                  className="p-1.5 rounded-lg text-galaxy-text-muted hover:text-galaxy-text"
                >
                  {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              )}
            </div>
            {p.kind === 'worksheet'
              ? p.boxes.map((b, j) => (
                <div key={j}>
                  <p className="text-xs font-body font-semibold text-galaxy-secondary">{b.prompt}</p>
                  <p className="text-sm font-body text-galaxy-text whitespace-pre-wrap">{b.answer}</p>
                </div>
              ))
              : p.pages.map((pg, j) => (
                <div key={j} className="flex gap-3 items-start">
                  {pg.image && <img src={pg.image} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0" />}
                  <p className="text-sm font-body text-galaxy-text whitespace-pre-wrap">{pg.text}</p>
                </div>
              ))}
          </li>
        ))}
      </ol>

      {aboutRows.length > 0 && (
        <div className="rounded-xl border border-galaxy-text-muted/10 p-3 space-y-2">
          <p className="font-heading font-bold text-sm text-galaxy-text">{t('school:writing_year.preview.about')}</p>
          {aboutRows.map((f) => (
            <div key={f}>
              <p className="text-xs font-body font-semibold text-galaxy-secondary">{t(`school:writing_year.preview.${f}`)}</p>
              <p className="text-sm font-body text-galaxy-text">{book.about[f]}</p>
            </div>
          ))}
        </div>
      )}

      {book.teacher_note && (
        <div className="rounded-xl border border-galaxy-text-muted/10 p-3">
          <p className="font-heading font-bold text-sm text-galaxy-text">{t('school:writing_year.preview.teacher_note')}</p>
          <p className="text-sm font-body text-galaxy-text whitespace-pre-wrap">{book.teacher_note}</p>
        </div>
      )}
    </div>
  )
}

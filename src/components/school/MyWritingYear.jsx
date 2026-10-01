import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookHeart, Send, Undo2, Check } from 'lucide-react'
import { schoolFetch } from '../../lib/schoolApi'
import { ABOUT_FIELDS, splitItems, wyErrorText } from './writingYearUi'
import WritingYearBookView from './WritingYearBookView'

// "My Writing Year" on a class account's home (spec §3): the pieces chosen
// so far (in the teacher's order, read-only), suggestions waiting for the
// teacher, "Suggest this for my Writing Year" on their own finished books
// and hand-ins, and the "About me" page. iPad: MyWritingYearCard.swift.
export default function MyWritingYear() {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [about, setAbout] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [book, setBook] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await schoolFetch('/api/school/writing-year')
    if (!res.ok) return setError(wyErrorText(t, res.code))
    setData(res.data)
    setAbout((a) => a ?? res.data.about)
  }, [t])

  useEffect(() => { load() }, [load])

  async function post(body) {
    setBusy(true)
    setError(null)
    const res = await schoolFetch('/api/school/writing-year', { method: 'POST', body: JSON.stringify(body) })
    setBusy(false)
    if (!res.ok) setError(wyErrorText(t, res.code))
    return res
  }

  async function suggest(s) {
    const res = await post(s.kind === 'book' ? { action: 'suggest', bookId: s.book_id } : { action: 'suggest', submissionId: s.submission_id })
    if (res.ok) load()
  }

  async function withdraw(item) {
    const res = await post({ action: 'withdraw', itemId: item.id })
    if (res.ok) load()
  }

  async function saveAbout() {
    setSaved(false)
    const res = await post({ action: 'about', ...about })
    if (res.ok) { setAbout(res.data.about); setSaved(true) }
  }

  async function toggleBook() {
    if (book) return setBook(null)
    const res = await schoolFetch('/api/school/writing-year?preview=1')
    if (res.ok) setBook(res.data.book)
    else setError(wyErrorText(t, res.code))
  }

  if (!data) return error ? <p className="text-red-400 text-sm font-body mb-6">{error}</p> : null
  const { approved, waiting } = splitItems(data.items)
  const max = data.limits?.about_max ?? 200

  return (
    <section className="glass rounded-2xl p-5 border border-galaxy-text-muted/10 space-y-5 mb-8" aria-labelledby="my-wy-heading">
      <div>
        <h2 id="my-wy-heading" className="flex items-center gap-2 font-heading text-xl font-bold text-galaxy-text">
          <BookHeart size={20} className="text-galaxy-secondary" aria-hidden="true" />
          {t('school:writing_year.student.card_heading')}
        </h2>
        <p className="text-sm font-body text-galaxy-text-muted">{t('school:writing_year.student.card_sub')}</p>
      </div>

      {error && <p role="alert" className="text-red-400 text-sm font-body">{error}</p>}

      <div className="space-y-2">
        <h3 className="text-xs font-body font-semibold uppercase tracking-wide text-galaxy-text-muted">{t('school:writing_year.student.chosen')}</h3>
        {approved.length === 0 ? (
          <p className="text-sm font-body text-galaxy-text-muted">{t('school:writing_year.student.nothing_yet')}</p>
        ) : (
          <ol className="space-y-1">
            {approved.map((i, idx) => (
              <li key={i.id} className="text-sm font-body text-galaxy-text">{idx + 1}. {i.title || '—'}</li>
            ))}
          </ol>
        )}
        {approved.length > 0 && (
          <button type="button" onClick={toggleBook} className="px-3 py-1.5 rounded-lg text-sm font-body font-semibold text-galaxy-secondary border border-galaxy-secondary/30">
            {t('school:writing_year.student.view_book')}
          </button>
        )}
        {book && <div className="pt-2"><WritingYearBookView book={book} /></div>}
      </div>

      {waiting.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-body font-semibold uppercase tracking-wide text-amber-200">{t('school:writing_year.student.waiting')}</h3>
          <ul className="space-y-1">
            {waiting.map((i) => (
              <li key={i.id} className="flex items-center gap-2 text-sm font-body text-galaxy-text">
                <span className="flex-1 min-w-0 truncate">{i.title || '—'}</span>
                <button type="button" disabled={busy} onClick={() => withdraw(i)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-galaxy-text-muted border border-galaxy-text-muted/20">
                  <Undo2 size={12} aria-hidden="true" /> {t('school:writing_year.student.take_back')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-body font-semibold uppercase tracking-wide text-galaxy-text-muted">{t('school:writing_year.student.suggest_heading')}</h3>
        {data.suggestable.length === 0 ? (
          <p className="text-sm font-body text-galaxy-text-muted">{t('school:writing_year.student.nothing_to_suggest')}</p>
        ) : (
          <ul className="space-y-1.5">
            {data.suggestable.slice(0, 12).map((s) => (
              <li key={s.submission_id ?? s.book_id} className="flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate text-sm font-body text-galaxy-text">{s.title || '—'}</span>
                <button type="button" disabled={busy} onClick={() => suggest(s)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-body font-semibold text-galaxy-secondary bg-galaxy-secondary/15 hover:bg-galaxy-secondary/25">
                  <Send size={12} aria-hidden="true" /> {t('school:writing_year.student.suggest')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-galaxy-text-muted/10 pt-4">
        <h3 className="font-heading font-bold text-galaxy-text">{t('school:writing_year.student.about_heading')}</h3>
        {ABOUT_FIELDS.map((f) => (
          <label key={f} className="block space-y-1">
            <span className="text-sm font-body text-galaxy-text">{t(`school:writing_year.student.${f}`)}</span>
            <textarea
              rows={2}
              maxLength={max}
              value={about?.[f] ?? ''}
              onChange={(e) => { setAbout((a) => ({ ...a, [f]: e.target.value })); setSaved(false) }}
              className="w-full px-3 py-2 glass border border-white/15 rounded-xl text-base text-galaxy-text focus:border-galaxy-primary focus:outline-none font-body"
            />
          </label>
        ))}
        <div className="flex items-center gap-3">
          <button type="button" disabled={busy} onClick={saveAbout} className="px-4 py-2 rounded-xl font-body font-bold text-sm text-white btn-fill-primary disabled:opacity-60">
            {t('school:writing_year.student.save')}
          </button>
          {saved && (
            <span role="status" className="inline-flex items-center gap-1 text-xs font-body font-semibold text-emerald-300">
              <Check size={14} aria-hidden="true" /> {t('school:writing_year.student.saved')}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

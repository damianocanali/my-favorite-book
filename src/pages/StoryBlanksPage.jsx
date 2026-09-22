import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { nanoid } from 'nanoid'
import { ArrowLeft, Check, Shuffle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { STORY_TEMPLATES, slotsForTemplate, localizedTemplate, bankLabel } from '../data/storyTemplates'
import {
  renderStory, missingSlots, isComplete, progress,
  validateCustomWord, localizedBank, buildBookFromBlanks,
} from '../lib/storyBlanks'
import { formatNumber } from '../i18n/formats'
import { useBookStore } from '../stores/useBookStore'
import { useBookshelfStore } from '../stores/useBookshelfStore'
import { useAuthStore, selectDisplayName } from '../stores/useAuthStore'
import { useRewardsStore } from '../stores/useRewardsStore'
import { useMilestoneStore } from '../stores/useMilestoneStore'
import { celebrateBig } from '../lib/celebrate'
import SparkleButton from '../components/ui/SparkleButton'
import Mascot from '../components/ui/Mascot'

// "Story Blanks" — pick a story, fill the gaps, get a real book.
//
// The output is an ordinary book: same shape, same editor, same publish
// and print paths. A child who finishes here lands in the normal preview
// screen, so this is an on-ramp to the app rather than a side attraction.

export default function StoryBlanksPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [rawTemplate, setRawTemplate] = useState(null)
  const [picks, setPicks] = useState({})
  const [activeSlot, setActiveSlot] = useState(null)
  const [custom, setCustom] = useState('')
  const [customError, setCustomError] = useState(null)
  const [saving, setSaving] = useState(false)

  const displayName = useAuthStore(selectDisplayName)
  const loadBook = useBookStore((s) => s.loadBook)
  const addBookToShelf = useBookshelfStore((s) => s.addBook)
  const earnBadge = useRewardsStore((s) => s.earnBadge)
  const recordWritingActivity = useRewardsStore((s) => s.recordWritingActivity)
  const fireMilestone = useMilestoneStore((s) => s.fire)

  // Title, blurb and every sentence come from the catalogue, so the blank
  // parser reads the LOCALISED sentence and the finished book carries
  // localised prose.
  const template = useMemo(
    () => localizedTemplate(rawTemplate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawTemplate, i18n.language]
  )

  const slots = useMemo(() => slotsForTemplate(template), [template])
  const rendered = useMemo(() => renderStory(template, picks), [template, picks])
  const done = isComplete(template, picks)
  const pct = Math.round(progress(template, picks) * 100)

  const choose = (slot, word) => {
    setPicks((prev) => ({ ...prev, [slot]: word }))
    setActiveSlot(null)
    setCustom('')
    setCustomError(null)
  }

  const submitCustom = (slot) => {
    const result = validateCustomWord(custom)
    if (!result.ok) { setCustomError(result.reason); return }
    choose(slot, result.value)
  }

  const surpriseMe = () => {
    const next = {}
    for (const slot of slots) {
      const bank = localizedBank(slot, { authorName: displayName })
      next[slot] = bank.words[Math.floor(Math.random() * bank.words.length)]
    }
    setPicks(next)
    setActiveSlot(null)
  }

  const finish = () => {
    if (!done || saving) return
    setSaving(true)
    const book = buildBookFromBlanks({
      template, picks, authorName: displayName, makeId: nanoid,
    })
    addBookToShelf(book)
    loadBook(book)
    // Same rewards as any finished book, plus the game's own badge.
    recordWritingActivity()
    earnBadge('finished_blanks')
    earnBadge('first_page')
    earnBadge('first_book')
    if (book.pages.length >= 5) earnBadge('five_pages')
    fireMilestone({
      id: `blanks:${book.id}`,
      title: t('games:blanks.milestone_title'),
      sub: t('games:blanks.milestone_sub'),
      mood: 'proud',
    })
    celebrateBig()
    navigate(`/preview/${book.id}`)
  }

  // ── Template picker ────────────────────────────────────────────────
  if (!template) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="toolbar-btn mb-6"
          aria-label={t('games:actions.go_back')}
          title={t('games:actions.go_back')}
        >
          <ArrowLeft size={15} /> <span className="toolbar-btn__label">{t('common:actions.back')}</span>
        </button>

        <div className="text-center mb-8">
          <Mascot mood="wave" size={92} className="mx-auto" />
          <h1 className="font-heading text-3xl font-bold mt-3">{t('games:blanks.title')}</h1>
          <p className="font-body text-galaxy-text-muted mt-1">
            {t('games:blanks.subtitle')}
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {STORY_TEMPLATES.map((raw) => {
            // Localised here too, so the blank count on the card matches the
            // sentences the child is about to see.
            const tpl = localizedTemplate(raw)
            return (
              <li key={tpl.id}>
                <button
                  onClick={() => { setRawTemplate(raw); setPicks({}) }}
                  className="ios-card w-full text-left transition-transform hover:scale-[1.02] active:scale-[0.99]"
                >
                  <span className="text-4xl" aria-hidden>{tpl.emoji}</span>
                  <p className="font-heading text-lg font-bold mt-2">{tpl.title}</p>
                  <p className="font-body text-sm text-galaxy-text-muted">{tpl.blurb}</p>
                  <p className="font-body text-xs text-galaxy-text-muted/70 mt-2">
                    {t('games:blanks.template_meta', {
                      pages: formatNumber(tpl.pages.length),
                      blanks: formatNumber(slotsForTemplate(tpl).length),
                    })}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  // ── The game ───────────────────────────────────────────────────────
  const bank = activeSlot ? localizedBank(activeSlot, { authorName: displayName }) : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setRawTemplate(null)}
          className="toolbar-btn"
          aria-label={t('games:actions.stories_aria')}
          title={t('games:actions.stories_aria')}
        >
          <ArrowLeft size={15} /> <span className="toolbar-btn__label">{t('games:actions.stories')}</span>
        </button>
        <button
          onClick={surpriseMe}
          className="toolbar-btn toolbar-btn--cyan ml-auto"
          aria-label={t('games:blanks.surprise_me_aria')}
          title={t('games:actions.surprise_me')}
        >
          <Shuffle size={15} /> <span className="toolbar-btn__label">{t('games:actions.surprise_me')}</span>
        </button>
      </div>

      <h1 className="font-heading text-2xl font-bold">{template.title}</h1>

      {/* Progress */}
      <div className="mt-3 mb-6">
        <div className="h-2.5 rounded-full glass-recessed overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#FFD60A] to-[#FF9F0A]"
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          />
        </div>
        <p className="font-body text-xs text-galaxy-text-muted mt-1.5" aria-live="polite">
          {done
            ? t('games:blanks.all_filled')
            : t('games:blanks.blanks_left', { count: missingSlots(template, picks).length })}
        </p>
      </div>

      {/* The story, with blanks as buttons */}
      <ol className="space-y-4">
        {template.pages.map((raw, i) => (
          <li key={i} className="ios-card">
            <p className="font-body text-lg leading-relaxed">
              <span className="text-galaxy-text-muted text-xs mr-2">{formatNumber(i + 1)}</span>
              {renderSentence(raw, picks, setActiveSlot, t)}
            </p>
          </li>
        ))}
      </ol>

      {/* Word bank */}
      <AnimatePresence>
        {activeSlot && bank && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[58] ios-material border-t border-white/15 px-4 pt-4 pb-[calc(16px+var(--sab,0px))]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            role="dialog"
            aria-label={t('games:blanks.choose', { bank: bank.label })}
          >
            <div className="max-w-2xl mx-auto">
              <p className="font-heading font-bold mb-3">
                <span aria-hidden>{bank.emoji}</span>{' '}
                {t('games:blanks.choose', { bank: bank.label })}
              </p>
              <div className="flex flex-wrap gap-2">
                {bank.words.map((w) => (
                  <button
                    key={w}
                    onClick={() => choose(activeSlot, w)}
                    className="rounded-full border-2 border-white/20 bg-white/10 px-4 py-2 font-body text-sm font-semibold transition-colors hover:bg-white/20 active:scale-95"
                  >
                    {w}
                  </button>
                ))}
              </div>

              {bank.allowCustom && (
                <div className="mt-4">
                  <label className="font-body text-xs text-galaxy-text-muted" htmlFor="custom-word">
                    {t('games:blanks.type_your_own')}
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input
                      id="custom-word"
                      value={custom}
                      onChange={(e) => { setCustom(e.target.value); setCustomError(null) }}
                      onKeyDown={(e) => e.key === 'Enter' && submitCustom(activeSlot)}
                      className="flex-1 rounded-xl glass-recessed px-3 py-2 font-body text-sm outline-none"
                      placeholder={t('games:blanks.your_word_placeholder')}
                      maxLength={24}
                    />
                    <button
                      onClick={() => submitCustom(activeSlot)}
                      className="toolbar-btn toolbar-btn--primary"
                      aria-label={t('games:blanks.use_this_word')}
                      title={t('games:blanks.use_this_word')}
                    >
                      <Check size={15} />
                    </button>
                  </div>
                  {customError && (
                    <p className="font-body text-xs text-red-300 mt-1" role="alert">{customError}</p>
                  )}
                </div>
              )}

              <button
                onClick={() => setActiveSlot(null)}
                className="mt-4 w-full py-2 font-body text-sm text-galaxy-text-muted"
              >
                {t('common:actions.close')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 mb-24">
        <SparkleButton onClick={finish} disabled={!done || saving}>
          {done ? t('games:actions.make_my_book') : t('games:blanks.finish_hint')}
        </SparkleButton>
      </div>

      {/* Screen-reader copy of the finished story. The buttons above read as
          a jumble of controls; this reads as the actual sentence. */}
      <p className="sr-only" aria-live="polite">{rendered.join(' ')}</p>
    </div>
  )
}

/**
 * Splits a template sentence into text and tappable blanks.
 * A filled blank stays tappable so a child can change their mind — the
 * commonest thing a 5-year-old wants to do right after choosing.
 */
function renderSentence(raw, picks, onPick, t) {
  const parts = []
  let last = 0
  for (const m of raw.matchAll(/\{([a-z]+)\}/g)) {
    if (m.index > last) parts.push(raw.slice(last, m.index))
    const key = m[1]
    const value = picks[key]
    parts.push(
      <button
        key={`${key}-${m.index}`}
        onClick={() => onPick(key)}
        className={
          value
            ? 'mx-0.5 rounded-lg bg-[#FFD60A]/20 px-2 py-0.5 font-bold text-[#FFE68A] underline decoration-dotted underline-offset-4'
            : 'mx-0.5 rounded-lg bg-white/10 px-4 py-0.5 font-bold text-galaxy-text-muted underline decoration-dashed underline-offset-4'
        }
        aria-label={
          value
            ? t('games:blanks.blank_filled_aria', { slot: bankLabel(key), value })
            : t('games:blanks.blank_empty_aria', { slot: bankLabel(key) })
        }
      >
        {value || '_____'}
      </button>
    )
    last = m.index + m[0].length
  }
  if (last < raw.length) parts.push(raw.slice(last))
  return parts
}

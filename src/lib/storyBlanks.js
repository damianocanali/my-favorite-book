import { WORD_BANKS, slotsForTemplate } from '../data/storyTemplates'

// Pure logic for the fill-in-the-blanks game, kept out of the component so
// it can be tested without a React tree — the sentence assembly is the part
// most likely to break quietly, and a wrong article ("a apple") is exactly
// the kind of thing a 6-year-old notices and an adult skims past.

/** Renders one template page with the child's picks substituted in. */
export function renderPage(templatePage, picks) {
  if (typeof templatePage !== 'string') return ''
  return templatePage.replace(/\{([a-z]+)\}/g, (whole, key) => {
    const value = picks?.[key]
    if (!value) return whole // leave the marker so the blank stays visible
    // Capitalise a name wherever it lands, including mid-sentence.
    if (key === 'name') return capitalise(value)
    return value
  })
}

/** All pages rendered, in order. */
export function renderStory(template, picks) {
  return (template?.pages ?? []).map((p) => renderPage(p, picks))
}

/** Which slots still need a word. */
export function missingSlots(template, picks) {
  return slotsForTemplate(template).filter((k) => !picks?.[k]?.trim())
}

export function isComplete(template, picks) {
  return slotsForTemplate(template).length > 0 && missingSlots(template, picks).length === 0
}

/** 0–1 progress, for the bar. */
export function progress(template, picks) {
  const all = slotsForTemplate(template)
  if (all.length === 0) return 0
  return (all.length - missingSlots(template, picks).length) / all.length
}

function capitalise(word) {
  const w = String(word).trim()
  return w ? w[0].toUpperCase() + w.slice(1) : w
}

/**
 * A safe, kid-appropriate custom word. Deliberately strict: this text ends
 * up in a printed book and possibly the public gallery, so anything that
 * isn't plainly a word is rejected rather than sanitised into nonsense.
 */
export function validateCustomWord(raw) {
  const word = String(raw ?? '').trim()
  if (!word) return { ok: false, reason: 'Type a word first.' }
  if (word.length > 24) return { ok: false, reason: 'That word is a bit too long.' }
  if (!/^[\p{L}\p{M}][\p{L}\p{M}'\- ]*$/u.test(word)) {
    return { ok: false, reason: 'Letters only, please.' }
  }
  if (/(.)\1{4,}/.test(word)) return { ok: false, reason: 'Too many repeats.' }
  return { ok: true, value: word }
}

/**
 * Seeds the name bank with the child's own name so the first suggestion is
 * theirs. Returns a new bank rather than mutating the shared constant.
 */
export function bankFor(slotKey, { authorName } = {}) {
  const bank = WORD_BANKS[slotKey]
  if (!bank) return null
  if (slotKey !== 'name' || !authorName?.trim()) return bank
  const mine = authorName.trim().split(/\s+/)[0]
  const rest = bank.words.filter((w) => w.toLowerCase() !== mine.toLowerCase())
  return { ...bank, words: [mine, ...rest].slice(0, bank.words.length) }
}

/**
 * Turns a finished game into the book shape the rest of the app already
 * understands, so a blanks story is a real book — editable, illustratable,
 * publishable, printable — rather than a toy with its own dead-end format.
 *
 * `makeId` is injected so tests are deterministic and the caller supplies
 * nanoid; this module stays free of side effects.
 */
export function buildBookFromBlanks({ template, picks, authorName, authorAge, makeId }) {
  const texts = renderStory(template, picks)
  const now = new Date().toISOString()
  return {
    id: makeId(),
    title: template.title,
    authorName: authorName || capitalise(picks?.name ?? '') || 'Me',
    authorAge: authorAge ?? 8,
    colors: { cover: '#8B5CF6', accent: '#06B6D4', text: '#F1F5F9', palette: 'starlight' },
    characters: [],
    setting: picks?.place ?? null,
    timePeriod: null,
    pages: texts.map((text, i) => ({
      id: makeId(),
      pageNumber: i + 1,
      text,
      illustrationData: null,
      illustrationRegenCount: 0,
      borderStyle: 'stars',
    })),
    coverImage: null,
    createdAt: now,
    updatedAt: now,
  }
}

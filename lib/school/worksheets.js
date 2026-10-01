// Worksheet assignments (spec 2026-10-01 §2, migration 023).
//
// A teacher assigns either a book (as before) or a WORKSHEET: one of the
// templates below, with the box prompts pre-filled and editable. What is
// stored on the assignment is assignments.worksheet =
//   { templateId, prompts: { <boxId>: "<teacher text, 1-300>" }, word? }
// and a child's hand-in freezes { kind: 'worksheet', templateId, word?,
// boxes: [{ id, prompt }], answers: { <boxId>: "<child text, <= 2000>" } }
// into class_submissions.book_snapshot (see snapshotWorksheet).
//
// This file is the STRUCTURE (template ids, box ids, sizes, the page
// mapping) and the validation the API applies. The wording — titles,
// descriptions and default prompts — lives in the clients, like the tip
// library: src/i18n/locales/{en,it}/school.json (worksheet.templates.*) and
// ios-native/MyBookLab/Models/Worksheets.swift + WorksheetCopy (with
// Localizable.xcstrings). tests/worksheets-assign.test.js fails if any of
// the three drift.
//
// Text only in v1: no drawing slots in a box.

export const PROMPT_TEXT_MAX = 300
export const ANSWER_MAX = 2000
// The acrostic's word: letters only (any alphabet), 2-12 of them.
export const ACROSTIC_WORD_MAX = 12
const ACROSTIC_WORD = /^\p{L}{2,12}$/u
export const BOX_SIZES = ['small', 'medium', 'large']

// `pages`: which boxes become which book page in "Turn into book pages"
// (worksheetPages below). `join`: 'lines' puts each answer on its own line,
// 'paragraph' runs them together as one paragraph (the OREO opinion piece
// reads as one paragraph).
export const WORKSHEET_TEMPLATES = [
  {
    id: 'story_map',
    boxes: [
      { id: 'characters', size: 'medium' },
      { id: 'setting', size: 'medium' },
      { id: 'problem', size: 'medium' },
      { id: 'events', size: 'large' },
      { id: 'ending', size: 'medium' },
    ],
    // A story map becomes the start of a story: beginning (who, where),
    // middle (the problem and what happens), end.
    pages: [['characters', 'setting'], ['problem', 'events'], ['ending']],
    join: 'lines',
  },
  {
    id: 'character_profile',
    // Same fields as the free printable character-profile sheet.
    boxes: [
      { id: 'name', size: 'small' },
      { id: 'looks_like', size: 'medium' },
      { id: 'likes', size: 'medium' },
      { id: 'wants', size: 'medium' },
      { id: 'afraid_of', size: 'medium' },
    ],
    pages: [['name', 'looks_like'], ['likes', 'wants'], ['afraid_of']],
    join: 'lines',
  },
  {
    id: 'beginning_middle_end',
    // The free printable "story-map" sheet is this one (beginning, middle, end).
    boxes: [
      { id: 'beginning', size: 'large' },
      { id: 'middle', size: 'large' },
      { id: 'end', size: 'large' },
    ],
    pages: [['beginning'], ['middle'], ['end']],
    join: 'lines',
  },
  {
    id: 'five_senses',
    boxes: [
      { id: 'place', size: 'small' },
      { id: 'see', size: 'medium' },
      { id: 'hear', size: 'medium' },
      { id: 'smell', size: 'medium' },
      { id: 'touch', size: 'medium' },
      { id: 'taste', size: 'medium' },
    ],
    pages: [['place', 'see', 'hear'], ['smell', 'touch', 'taste']],
    join: 'lines',
  },
  {
    id: 'letter',
    boxes: [
      { id: 'greeting', size: 'small' },
      { id: 'opening', size: 'medium' },
      { id: 'body', size: 'large' },
      { id: 'closing', size: 'medium' },
      { id: 'signature', size: 'small' },
    ],
    pages: [['greeting', 'opening', 'body', 'closing', 'signature']],
    join: 'lines',
  },
  {
    id: 'opinion',
    // OREO: Opinion, Reason, Example, Opinion again.
    boxes: [
      { id: 'opinion', size: 'medium' },
      { id: 'reason', size: 'medium' },
      { id: 'example', size: 'medium' },
      { id: 'conclusion', size: 'medium' },
    ],
    pages: [['opinion', 'reason', 'example', 'conclusion']],
    join: 'paragraph',
  },
  {
    id: 'acrostic',
    // `word`: the word down the side (the teacher's, or the child's own
    // when the teacher leaves it open); `lines`: one box per letter
    // (answers line_1 ... line_N), expanded from the word.
    boxes: [
      { id: 'word', size: 'small' },
      { id: 'lines', size: 'large', perLetter: true },
    ],
    pages: [['lines']],
    join: 'lines',
  },
  {
    id: 'sequence',
    boxes: [
      { id: 'first', size: 'medium' },
      { id: 'next', size: 'medium' },
      { id: 'then', size: 'medium' },
      { id: 'last', size: 'medium' },
    ],
    pages: [['first'], ['next'], ['then'], ['last']],
    join: 'lines',
  },
  {
    id: 'my_week',
    boxes: [
      { id: 'best', size: 'medium' },
      { id: 'learned', size: 'medium' },
      { id: 'tricky', size: 'medium' },
      { id: 'felt_good', size: 'medium' },
      { id: 'next_week', size: 'medium' },
    ],
    pages: [['best', 'learned', 'tricky', 'felt_good', 'next_week']],
    join: 'lines',
  },
]

export const TEMPLATE_IDS = WORKSHEET_TEMPLATES.map((t) => t.id)

export function getTemplate(id) {
  return WORKSHEET_TEMPLATES.find((t) => t.id === id) ?? null
}

/// The prompt box ids of a template, in order (the per-letter box counts
/// once: its prompt is the instruction above the letters).
export const boxIds = (template) => template.boxes.map((b) => b.id)

/// One line, trimmed: what both composers send for a prompt.
const oneLine = (s) => s.replace(/[\r\n\u2028\u2029]+/g, ' ').trim()

/// The acrostic word, normalised to upper case, or null if it isn't one.
export function cleanAcrosticWord(value) {
  if (typeof value !== 'string') return null
  // Checked after upper-casing: 'ß' becomes 'SS', one letter longer.
  const w = value.trim().toUpperCase()
  return ACROSTIC_WORD.test(w) ? w : null
}

/// Letters of an acrostic word as the boxes show them (code points, so a
/// letter outside the BMP is still one box).
export const acrosticLetters = (word) => (word ? [...word] : [])

/// Validates a teacher's worksheet. Returns { ok: true, worksheet } with
/// every prompt trimmed, or { ok: false, error }.
/// Rules: a known template; prompts for exactly that template's boxes,
/// each 1-300 characters (UTF-16 units, as both composers count); for the
/// acrostic, an optional word (letters only, 2-12) — none means the child
/// chooses it.
export function cleanWorksheet(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'Invalid worksheet' }
  const template = getTemplate(value.templateId)
  if (!template) return { ok: false, error: 'Unknown worksheet template' }
  const p = value.prompts
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, error: 'Invalid worksheet prompts' }
  const ids = boxIds(template)
  for (const k of Object.keys(p)) {
    if (!ids.includes(k)) return { ok: false, error: 'Unknown worksheet box' }
  }
  const prompts = {}
  for (const id of ids) {
    if (typeof p[id] !== 'string') return { ok: false, error: 'Every box needs a prompt' }
    const text = oneLine(p[id])
    if (!text || text.length > PROMPT_TEXT_MAX) return { ok: false, error: `A prompt must be 1-${PROMPT_TEXT_MAX} characters` }
    prompts[id] = text
  }
  const out = { templateId: template.id, prompts }
  if (value.word !== undefined && value.word !== null && value.word !== '') {
    if (template.id !== 'acrostic') return { ok: false, error: 'Only the acrostic takes a word' }
    const word = cleanAcrosticWord(value.word)
    if (!word) return { ok: false, error: `The word must be 2-${ACROSTIC_WORD_MAX} letters` }
    out.word = word
  }
  return { ok: true, worksheet: out }
}

/// Validates a child's answers against the assignment's worksheet.
/// Returns { ok: true, answers, word } or { ok: false, error, code }.
/// Rules: an object of known box ids (for the acrostic: `word` — only when
/// the teacher left it open — and line_1..line_N for the N letters); each
/// a string of at most 2000 characters; blank answers are dropped; at
/// least one answer.
export function cleanAnswers(worksheet, value) {
  const template = getTemplate(worksheet?.templateId)
  if (!template) return { ok: false, error: 'Not a worksheet', code: 'bad_request' }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Invalid answers', code: 'bad_request' }
  }
  for (const v of Object.values(value)) {
    if (typeof v !== 'string') return { ok: false, error: 'Invalid answer', code: 'bad_request' }
    if (v.length > ANSWER_MAX) return { ok: false, error: `An answer must be at most ${ANSWER_MAX} characters`, code: 'answer_too_long' }
  }

  let word = null
  const answers = {}
  if (template.id === 'acrostic') {
    if (worksheet.word) {
      word = worksheet.word
      if (value.word !== undefined && value.word.trim() && cleanAcrosticWord(value.word) !== word) {
        return { ok: false, error: 'The word is set by the teacher', code: 'bad_request' }
      }
    } else if (value.word !== undefined && value.word.trim()) {
      word = cleanAcrosticWord(value.word)
      if (!word) return { ok: false, error: `The word must be 2-${ACROSTIC_WORD_MAX} letters`, code: 'bad_request' }
      answers.word = word
    }
    const n = acrosticLetters(word).length
    for (const k of Object.keys(value)) {
      if (k === 'word') continue
      const m = /^line_([1-9]|1[0-2])$/.exec(k)
      if (!m || Number(m[1]) > n) return { ok: false, error: 'Unknown worksheet box', code: 'bad_request' }
      const text = value[k].trim()
      if (text) answers[k] = text
    }
  } else {
    const ids = boxIds(template)
    for (const k of Object.keys(value)) {
      if (!ids.includes(k)) return { ok: false, error: 'Unknown worksheet box', code: 'bad_request' }
      const text = value[k].trim()
      if (text) answers[k] = text
    }
  }
  const filled = Object.keys(answers).some((k) => k !== 'word')
  if (!filled) return { ok: false, error: 'Write something in at least one box', code: 'empty_worksheet' }
  return { ok: true, answers, word }
}

/// Everything a child wrote, as one string (for moderation).
export const answersText = (answers) => Object.values(answers ?? {}).join('\n')

/// The frozen hand-in stored in class_submissions.book_snapshot: the
/// prompts as the child saw them (a teacher editing prompts later doesn't
/// rewrite what was answered) plus the answers.
export function snapshotWorksheet(worksheet, answers, word) {
  const template = getTemplate(worksheet.templateId)
  const snap = {
    kind: 'worksheet',
    templateId: template.id,
    boxes: boxIds(template).map((id) => ({ id, prompt: worksheet.prompts?.[id] ?? '' })),
    answers,
  }
  if (word) snap.word = word
  return snap
}

export const isWorksheetSnapshot = (s) => !!s && typeof s === 'object' && s.kind === 'worksheet'

// ── Turn into book pages ────────────────────────────────────────────────
// Deterministic text mapping, no AI. Mirrored by Worksheets.swift
// (WorksheetPages); tests/worksheets-assign.test.js pins both.

// The web editor's longest page (useAgeAdaptive's older charLimit) and
// most pages; a longer answer runs onto the next page.
export const PAGE_TEXT_MAX = 500
export const BOOK_PAGES_MAX = 24

/// Splits text into chunks of at most `max`, at a sentence end or a space
/// when there is one in the second half of the chunk, else hard.
export function splitPageText(text, max = PAGE_TEXT_MAX) {
  const out = []
  let rest = text.trim()
  while (rest.length > max) {
    const head = rest.slice(0, max + 1)
    let cut = -1
    for (const re of [/[.!?…]\s/g, /\s/g]) {
      let m
      while ((m = re.exec(head)) !== null) {
        const end = m.index + m[0].length - 1
        if (end <= max && end >= max / 2) cut = end
      }
      if (cut !== -1) break
    }
    if (cut === -1) cut = max
    out.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) out.push(rest)
  return out
}

/// The book pages (plain text, in order) a finished worksheet becomes.
/// `answers`: the child's answers; `word`: the acrostic word (the
/// teacher's, else answers.word). Empty pages are skipped.
export function worksheetPages(templateId, answers = {}, word = null) {
  const template = getTemplate(templateId)
  if (!template) return []
  const sep = template.join === 'paragraph' ? ' ' : '\n'
  const pages = []
  for (const group of template.pages) {
    const parts = []
    for (const id of group) {
      if (id === 'lines') {
        const letters = acrosticLetters(word ?? answers.word ?? null)
        letters.forEach((letter, i) => {
          const a = (answers[`line_${i + 1}`] ?? '').trim()
          parts.push(a || letter)
        })
      } else {
        const a = (answers[id] ?? '').trim()
        if (a) parts.push(a)
      }
    }
    const text = parts.join(sep).trim()
    // An acrostic with nothing but its bare letters isn't a page.
    const hasWriting = group.some((id) => (id === 'lines'
      ? Object.keys(answers).some((k) => k.startsWith('line_') && answers[k].trim())
      : (answers[id] ?? '').trim()))
    if (text && hasWriting) pages.push(...splitPageText(text))
  }
  return pages
}

/// How many of `pages` fit after `existing` pages without going over
/// BOOK_PAGES_MAX.
export const pagesThatFit = (existing, pages) => pages.slice(0, Math.max(0, BOOK_PAGES_MAX - existing))

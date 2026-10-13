// The worksheet library (spec 2026-10-01 §2, migration 023; teacher round
// 6B): ONE catalogue of 33 sheets, every one both printable (the public
// /worksheets library) and assignable (filled in on a device and handed
// in). Framework-free: the API validates against it, the web's printable
// sheets, library and assign picker read it, and the iPad mirrors it in
// ios-native/MyBookLab/Models/Worksheets.swift.
//
// A teacher assigns either a book (as before) or a WORKSHEET: one of the
// templates below, with the box prompts pre-filled and editable. What is
// stored on the assignment is assignments.worksheet =
//   { templateId, prompts: { <boxId>: "<teacher text, 1-300>" }, word? }
// and a child's hand-in freezes { kind: 'worksheet', templateId, word?,
// boxes: [{ id, prompt }], answers: { <boxId>: "<child text, <= 2000>" } }
// into class_submissions.book_snapshot (see snapshotWorksheet).
//
// LIVE DATA: the first nine templates (story_map … my_week) and their box
// ids are referenced by real assignments and hand-ins: never rename them.
// Migration 023's CHECK only allows ids (template and box) matching
// ^[a-z_]{1,40}$ — letters and underscores, NO digits (hence panel_one,
// not panel_1) — and 1-12 prompts; tests/worksheets-migration.test.js pins
// every id against it, so a new template needs no migration.
//
// This file is the STRUCTURE (ids, category, grade band, boxes, sizes, the
// page mapping, print layout hints) and the validation the API applies.
// The wording — titles, descriptions, sheet headings, search keywords and
// default prompts (which are also the printed box labels) — lives in the
// clients: src/i18n/locales/{en,it}/school.json (worksheet.*) and
// ios-native/MyBookLab/Views/WorksheetCopy.swift + Localizable.xcstrings.
// tests/worksheets-assign.test.js and tests/worksheets-ios.test.js fail if
// any of them drift.

export const PROMPT_TEXT_MAX = 300
export const ANSWER_MAX = 2000
// The acrostic's word: letters only (any alphabet), 2-12 of them.
export const ACROSTIC_WORD_MAX = 12
const ACROSTIC_WORD = /^\p{L}{2,12}$/u
export const BOX_SIZES = ['small', 'medium', 'large']

/// The library's shelves, in display order.
export const WORKSHEET_CATEGORIES = ['plan', 'characters', 'words', 'poems', 'opinions', 'reading', 'facts', 'me']
/// 'k2' (grades K-2), 'g35' (grades 3-5), 'all' (any grade).
export const GRADE_BANDS = ['k2', 'g35', 'all']

/// Whether a template belongs under a grade filter ('all' or null = every
/// template; an 'all' template shows under both K-2 and 3-5).
export const matchesGrade = (template, grade) =>
  !grade || grade === 'all' || template.gradeBand === 'all' || template.gradeBand === grade

// Each template:
//   id, category, gradeBand;
//   boxes: [{ id, size, perLetter? }] — what the child fills in;
//   pages: which boxes become which book page in "Turn into book pages"
//     (worksheetPages below); join: 'lines' puts each answer on its own
//     line, 'paragraph' runs them together as one paragraph;
//   print: how the one-page Letter sheet lays the boxes out
//     (src/lib/worksheets/printLayout.js turns this into inches and
//     tests/worksheets-print-layout.test.js guards that every sheet fits
//     one page):
//       rows    — box ids side by side, row by row (default: one per row)
//       lines   — ruled lines per box (default by size: 1 / 3 / 6)
//       drawIn  — a drawing panel inside a box, above its lines (inches)
//       picture — one labelled drawing box: { at: 'top' | 'bottom', height }
//       body    — a hand-made layout used by the free printable instead of
//                 the generic one (sentence_starters, word_web, book_report,
//                 feelings_checkin). An assignment's blank print always uses
//                 the generic layout, since it shows the teacher's prompts.
const b = (id, size, extra) => ({ id, size, ...(extra ?? {}) })

export const WORKSHEET_TEMPLATES = [
  // ── Plan a story ─────────────────────────────────────────────────────
  {
    id: 'story_map',
    category: 'plan',
    gradeBand: 'all',
    boxes: [b('characters', 'medium'), b('setting', 'medium'), b('problem', 'medium'), b('events', 'large'), b('ending', 'medium')],
    // A story map becomes the start of a story: beginning (who, where),
    // middle (the problem and what happens), end.
    pages: [['characters', 'setting'], ['problem', 'events'], ['ending']],
    join: 'lines',
    print: { rows: [['characters', 'setting'], ['problem'], ['events'], ['ending']] },
  },
  {
    id: 'beginning_middle_end',
    category: 'plan',
    gradeBand: 'k2',
    // The old free printable "story-map" sheet (a picture and two lines for
    // each part).
    boxes: [b('beginning', 'large'), b('middle', 'large'), b('end', 'large')],
    pages: [['beginning'], ['middle'], ['end']],
    join: 'lines',
    print: { lines: { beginning: 2, middle: 2, end: 2 }, drawIn: { beginning: 1.1, middle: 1.1, end: 1.1 } },
  },
  {
    id: 'sequence',
    category: 'plan',
    gradeBand: 'k2',
    boxes: [b('first', 'medium'), b('next', 'medium'), b('then', 'medium'), b('last', 'medium')],
    pages: [['first'], ['next'], ['then'], ['last']],
    join: 'lines',
    print: {
      rows: [['first', 'next'], ['then', 'last']],
      lines: { first: 2, next: 2, then: 2, last: 2 },
      drawIn: { first: 2, next: 2, then: 2, last: 2 },
    },
  },
  {
    id: 'storyboard',
    category: 'plan',
    gradeBand: 'all',
    boxes: ['one', 'two', 'three', 'four', 'five', 'six'].map((n) => b(`panel_${n}`, 'medium')),
    pages: [['panel_one', 'panel_two'], ['panel_three', 'panel_four'], ['panel_five', 'panel_six']],
    join: 'lines',
    print: {
      rows: [['panel_one', 'panel_two', 'panel_three'], ['panel_four', 'panel_five', 'panel_six']],
      lines: Object.fromEntries(['one', 'two', 'three', 'four', 'five', 'six'].map((n) => [`panel_${n}`, 2])),
      drawIn: Object.fromEntries(['one', 'two', 'three', 'four', 'five', 'six'].map((n) => [`panel_${n}`, 2])),
    },
  },
  {
    id: 'problem_solution',
    category: 'plan',
    gradeBand: 'k2',
    boxes: [b('problem', 'medium'), b('tries', 'large'), b('solution', 'medium')],
    pages: [['problem'], ['tries'], ['solution']],
    join: 'lines',
    print: { lines: { tries: 5 }, picture: { at: 'bottom', height: 1.4 } },
  },
  {
    id: 'story_mountain',
    category: 'plan',
    gradeBand: 'g35',
    boxes: [b('beginning', 'medium'), b('build_up', 'medium'), b('big_moment', 'medium'), b('wind_down', 'medium'), b('ending', 'medium')],
    pages: [['beginning', 'build_up'], ['big_moment'], ['wind_down', 'ending']],
    join: 'lines',
    print: { rows: [['beginning', 'build_up'], ['big_moment'], ['wind_down', 'ending']], lines: { beginning: 4, build_up: 4, big_moment: 6, wind_down: 4, ending: 4 } },
  },

  // ── Characters & places ──────────────────────────────────────────────
  {
    id: 'character_profile',
    category: 'characters',
    gradeBand: 'k2',
    // Same fields as the old free printable character-profile sheet.
    boxes: [b('name', 'small'), b('looks_like', 'medium'), b('likes', 'medium'), b('wants', 'medium'), b('afraid_of', 'medium')],
    pages: [['name', 'looks_like'], ['likes', 'wants'], ['afraid_of']],
    join: 'lines',
    print: {
      picture: { at: 'top', height: 2.3 },
      rows: [['name'], ['looks_like', 'likes'], ['wants', 'afraid_of']],
    },
  },
  {
    id: 'setting_sketch',
    category: 'characters',
    gradeBand: 'k2',
    boxes: [b('place', 'small'), b('when', 'small'), b('looks_like', 'medium'), b('sounds_smells', 'medium')],
    pages: [['place', 'when', 'looks_like', 'sounds_smells']],
    join: 'lines',
    print: { picture: { at: 'top', height: 2.6 }, rows: [['place', 'when'], ['looks_like'], ['sounds_smells']] },
  },
  {
    id: 'five_senses',
    category: 'characters',
    gradeBand: 'all',
    boxes: [b('place', 'small'), b('see', 'medium'), b('hear', 'medium'), b('smell', 'medium'), b('touch', 'medium'), b('taste', 'medium')],
    pages: [['place', 'see', 'hear'], ['smell', 'touch', 'taste']],
    join: 'lines',
    print: { rows: [['place'], ['see', 'hear'], ['smell', 'touch'], ['taste']], lines: { see: 4, hear: 4, smell: 4, touch: 4 } },
  },
  {
    id: 'character_change',
    category: 'characters',
    gradeBand: 'g35',
    boxes: [b('character', 'small'), b('at_start', 'medium'), b('what_happened', 'medium'), b('at_end', 'medium')],
    pages: [['character', 'at_start'], ['what_happened'], ['at_end']],
    join: 'lines',
    print: { lines: { at_start: 4, what_happened: 4, at_end: 4 } },
  },

  // ── Words & sentences ────────────────────────────────────────────────
  {
    id: 'sentence_starters',
    category: 'words',
    gradeBand: 'k2',
    boxes: ['one', 'two', 'three', 'four'].map((n) => b(`sentence_${n}`, 'medium')),
    pages: [['sentence_one', 'sentence_two', 'sentence_three', 'sentence_four']],
    join: 'paragraph',
    print: { body: 'sentence_starters' },
  },
  {
    id: 'describing_words',
    category: 'words',
    gradeBand: 'k2',
    boxes: [b('thing', 'small'), ...['one', 'two', 'three', 'four', 'five'].map((n) => b(`word_${n}`, 'small'))],
    pages: [['thing', 'word_one', 'word_two', 'word_three', 'word_four', 'word_five']],
    join: 'lines',
    print: {
      picture: { at: 'top', height: 2.6 },
      rows: [['thing'], ['word_one', 'word_two'], ['word_three', 'word_four'], ['word_five']],
    },
  },
  {
    id: 'word_web',
    category: 'words',
    gradeBand: 'all',
    boxes: [b('center', 'small'), ...['one', 'two', 'three', 'four', 'five', 'six'].map((n) => b(`idea_${n}`, 'small'))],
    pages: [['center', 'idea_one', 'idea_two', 'idea_three', 'idea_four', 'idea_five', 'idea_six']],
    join: 'lines',
    print: {
      body: 'word_web',
      rows: [['center'], ['idea_one', 'idea_two'], ['idea_three', 'idea_four'], ['idea_five', 'idea_six']],
      lines: { center: 1, idea_one: 2, idea_two: 2, idea_three: 2, idea_four: 2, idea_five: 2, idea_six: 2 },
    },
  },
  {
    id: 'stretch_sentence',
    category: 'words',
    gradeBand: 'k2',
    boxes: [b('who', 'small'), b('did_what', 'small'), b('where', 'small'), b('when', 'small'), b('why', 'small'), b('my_sentence', 'large')],
    pages: [['my_sentence']],
    join: 'lines',
    print: { rows: [['who', 'did_what'], ['where', 'when'], ['why'], ['my_sentence']], lines: { my_sentence: 8 } },
  },
  {
    id: 'dialogue',
    category: 'words',
    gradeBand: 'g35',
    boxes: [b('character_a', 'small'), b('character_b', 'small'), b('conversation', 'large')],
    pages: [['conversation']],
    join: 'lines',
    print: { rows: [['character_a', 'character_b'], ['conversation']], lines: { conversation: 16 } },
  },

  // ── Poems ────────────────────────────────────────────────────────────
  {
    id: 'acrostic',
    category: 'poems',
    gradeBand: 'all',
    // `word`: the word down the side (the teacher's, or the child's own
    // when the teacher leaves it open); `lines`: one box per letter
    // (answers line_1 ... line_N), expanded from the word.
    boxes: [b('word', 'small'), b('lines', 'large', { perLetter: true })],
    pages: [['lines']],
    join: 'lines',
    // On paper: the word line, then twelve letter rows (the longest word
    // a teacher can set; the child writes the letters in).
    print: { lines: { lines: 12 } },
  },
  {
    id: 'haiku',
    category: 'poems',
    gradeBand: 'g35',
    boxes: [b('line_one', 'small'), b('line_two', 'small'), b('line_three', 'small')],
    pages: [['line_one', 'line_two', 'line_three']],
    join: 'lines',
    print: { lines: { line_one: 2, line_two: 2, line_three: 2 }, picture: { at: 'bottom', height: 3 } },
  },
  {
    id: 'i_am_poem',
    category: 'poems',
    gradeBand: 'all',
    boxes: [b('i_am', 'small'), b('i_wonder', 'small'), b('i_hear', 'small'), b('i_see', 'small'), b('i_want', 'small'), b('i_am_again', 'small')],
    pages: [['i_am', 'i_wonder', 'i_hear', 'i_see', 'i_want', 'i_am_again']],
    join: 'lines',
    print: { lines: { i_am: 2, i_wonder: 2, i_hear: 2, i_see: 2, i_want: 2, i_am_again: 2 } },
  },
  {
    id: 'cinquain',
    category: 'poems',
    gradeBand: 'g35',
    boxes: [b('noun', 'small'), b('two_describing', 'small'), b('three_doing', 'small'), b('feeling_phrase', 'small'), b('another_name', 'small')],
    pages: [['noun', 'two_describing', 'three_doing', 'feeling_phrase', 'another_name']],
    join: 'lines',
    print: { picture: { at: 'bottom', height: 2.2 } },
  },

  // ── Opinions & letters ───────────────────────────────────────────────
  {
    id: 'opinion',
    category: 'opinions',
    gradeBand: 'g35',
    // OREO: Opinion, Reason, Example, Opinion again.
    boxes: [b('opinion', 'medium'), b('reason', 'medium'), b('example', 'medium'), b('conclusion', 'medium')],
    pages: [['opinion', 'reason', 'example', 'conclusion']],
    join: 'paragraph',
    print: { lines: { reason: 4, example: 4 } },
  },
  {
    id: 'letter',
    category: 'opinions',
    gradeBand: 'all',
    boxes: [b('greeting', 'small'), b('opening', 'medium'), b('body', 'large'), b('closing', 'medium'), b('signature', 'small')],
    pages: [['greeting', 'opening', 'body', 'closing', 'signature']],
    join: 'lines',
    print: { lines: { opening: 2, closing: 2 } },
  },
  {
    id: 'thank_you',
    category: 'opinions',
    gradeBand: 'k2',
    boxes: [b('to', 'small'), b('thank_you_for', 'medium'), b('because', 'medium'), b('from', 'small')],
    pages: [['to', 'thank_you_for', 'because', 'from']],
    join: 'lines',
    print: { picture: { at: 'bottom', height: 1.9 } },
  },
  {
    id: 'persuade',
    category: 'opinions',
    gradeBand: 'g35',
    boxes: [b('should', 'medium'), b('reason_one', 'medium'), b('reason_two', 'medium'), b('reason_three', 'medium'), b('so', 'medium')],
    pages: [['should', 'reason_one', 'reason_two', 'reason_three', 'so']],
    join: 'paragraph',
    print: { lines: { should: 2, so: 2 } },
  },

  // ── Reading response ─────────────────────────────────────────────────
  {
    id: 'book_report',
    category: 'reading',
    gradeBand: 'all',
    boxes: [b('title', 'small'), b('author', 'small'), b('about', 'medium'), b('favorite', 'medium'), b('would_recommend', 'medium')],
    pages: [['title', 'author', 'about'], ['favorite', 'would_recommend']],
    join: 'lines',
    print: {
      body: 'book_report',
      rows: [['title', 'author'], ['about'], ['favorite', 'would_recommend']],
      picture: { at: 'bottom', height: 2 },
    },
  },
  {
    id: 'favorite_part',
    category: 'reading',
    gradeBand: 'k2',
    boxes: [b('title', 'small'), b('part', 'medium'), b('why', 'medium')],
    pages: [['title', 'part', 'why']],
    join: 'lines',
    print: { picture: { at: 'top', height: 2.7 } },
  },
  {
    id: 'predict',
    category: 'reading',
    gradeBand: 'all',
    boxes: [b('title', 'small'), b('clues', 'medium'), b('prediction', 'medium'), b('what_happened', 'medium')],
    pages: [['clues', 'prediction'], ['what_happened']],
    join: 'lines',
    print: { lines: { clues: 4, prediction: 4, what_happened: 4 } },
  },
  {
    id: 'compare_books',
    category: 'reading',
    gradeBand: 'g35',
    boxes: [b('book_one', 'small'), b('book_two', 'small'), b('same', 'medium'), b('different', 'medium')],
    pages: [['book_one', 'book_two', 'same'], ['different']],
    join: 'lines',
    print: { rows: [['book_one', 'book_two'], ['same'], ['different']], lines: { same: 7, different: 7 } },
  },

  // ── Facts & how-to ───────────────────────────────────────────────────
  {
    id: 'all_about',
    category: 'facts',
    gradeBand: 'all',
    boxes: [b('topic', 'small'), b('fact_one', 'medium'), b('fact_two', 'medium'), b('fact_three', 'medium'), b('wow_fact', 'medium')],
    pages: [['topic', 'fact_one'], ['fact_two', 'fact_three'], ['wow_fact']],
    join: 'lines',
    print: {
      picture: { at: 'top', height: 2.4 },
      rows: [['topic'], ['fact_one', 'fact_two'], ['fact_three', 'wow_fact']],
    },
  },
  {
    id: 'how_to',
    category: 'facts',
    gradeBand: 'all',
    boxes: [b('what', 'small'), b('need', 'medium'), ...['one', 'two', 'three', 'four'].map((n) => b(`step_${n}`, 'medium'))],
    pages: [['what', 'need'], ['step_one', 'step_two'], ['step_three', 'step_four']],
    join: 'lines',
    print: {
      rows: [['what'], ['need'], ['step_one', 'step_two'], ['step_three', 'step_four']],
      lines: { need: 2, step_one: 2, step_two: 2, step_three: 2, step_four: 2 },
      drawIn: { step_one: 1, step_two: 1, step_three: 1, step_four: 1 },
    },
  },

  // ── About me & feelings ──────────────────────────────────────────────
  {
    id: 'about_author',
    category: 'me',
    gradeBand: 'k2',
    boxes: [b('my_name', 'small'), b('i_like', 'medium'), b('i_write_about', 'medium'), b('fun_fact', 'medium')],
    pages: [['my_name', 'i_like', 'i_write_about', 'fun_fact']],
    join: 'lines',
    print: { picture: { at: 'top', height: 2.2 }, lines: { i_like: 2, i_write_about: 2, fun_fact: 2 } },
  },
  {
    id: 'feelings_checkin',
    category: 'me',
    gradeBand: 'k2',
    boxes: [b('feeling', 'small'), b('why', 'medium'), b('what_helps', 'medium')],
    pages: [['feeling', 'why', 'what_helps']],
    join: 'lines',
    print: { body: 'feelings_checkin', picture: { at: 'top', height: 2.6 } },
  },
  {
    id: 'my_week',
    category: 'me',
    gradeBand: 'all',
    boxes: [b('best', 'medium'), b('learned', 'medium'), b('tricky', 'medium'), b('felt_good', 'medium'), b('next_week', 'medium')],
    pages: [['best', 'learned', 'tricky', 'felt_good', 'next_week']],
    join: 'lines',
    print: { lines: { felt_good: 2, next_week: 2 } },
  },
  {
    id: 'all_about_me',
    category: 'me',
    gradeBand: 'k2',
    boxes: [b('favorites', 'medium'), b('good_at', 'medium'), b('learning', 'medium'), b('dream', 'medium')],
    pages: [['favorites', 'good_at'], ['learning', 'dream']],
    join: 'lines',
    print: {
      picture: { at: 'top', height: 2.4 },
      rows: [['favorites', 'good_at'], ['learning', 'dream']],
      lines: { favorites: 4, good_at: 4, learning: 4, dream: 4 },
    },
  },
]

export const TEMPLATE_IDS = WORKSHEET_TEMPLATES.map((t) => t.id)

/// The nine templates that existed before the library (live assignments
/// and hand-ins reference them and their box ids: frozen).
export const FROZEN_TEMPLATE_IDS = [
  'story_map', 'character_profile', 'beginning_middle_end', 'five_senses', 'letter',
  'opinion', 'acrostic', 'sequence', 'my_week',
]

/// The old free-printable ids (kebab-case) — still valid in links such as
/// /worksheets?template=story-map — and the template each one now is.
export const TEMPLATE_ALIASES = {
  'story-map': 'beginning_middle_end',
  'character-profile': 'character_profile',
  'setting-sketch': 'setting_sketch',
  storyboard: 'storyboard',
  'sentence-starters': 'sentence_starters',
  'book-report': 'book_report',
  'feelings-checkin': 'feelings_checkin',
  'about-author': 'about_author',
}

export function getTemplate(id) {
  return WORKSHEET_TEMPLATES.find((t) => t.id === id) ?? null
}

/// A template id from a link: a current id, or an old printable alias.
/// Null when it is neither. (The API never takes aliases: an assignment
/// always stores the real id.)
export function resolveTemplateId(id) {
  if (typeof id !== 'string') return null
  if (getTemplate(id)) return id
  return Object.hasOwn(TEMPLATE_ALIASES, id) ? TEMPLATE_ALIASES[id] : null
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

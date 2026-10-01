// Shared rules for grading with tips (migration 022). The limits mirror the
// SQL checks so a bad value is a 400 from the API, never a 502 from Postgres.
//
// A grade is one of four child-facing LEVELS plus 0–3 tips. A tip is either
// a library tip, stored as its KEY (each app renders it in the child's own
// language), or a custom one the teacher wrote, stored as text.
//
// The tip library is the list below. The wording lives in the clients:
// src/i18n/locales/{en,it}/school.json (grading.tips.<key>) and
// ios-native/MyBookLab/Views/GradingCopy.swift + Localizable.xcstrings.
// tests/grading-tips.test.js fails if any of the three drift.
export const LEVELS = ['getting_started', 'growing', 'got_it', 'wow']

// Grouped by skill, in the order the teacher's picker shows them.
export const TIP_SKILLS = {
  ideas: ['more_detail', 'feelings', 'senses', 'what_next', 'problem', 'why', 'own_idea'],
  order: ['beginning', 'middle', 'ending', 'time_words', 'one_idea_per_page', 'check_order', 'new_line'],
  words: ['strong_verbs', 'describing', 'repeated', 'dialogue', 'new_word', 'said', 'sound_words'],
  spelling: ['capitals', 'end_marks', 'names', 'read_aloud', 'commas', 'quotation_marks', 'spaces'],
}
export const SKILLS = Object.keys(TIP_SKILLS)
// 'ideas.more_detail', ... — what is stored and what the clients look up.
export const TIP_KEYS = SKILLS.flatMap((s) => TIP_SKILLS[s].map((t) => `${s}.${t}`))

export const TIPS_MAX = 3
// Counted in UTF-16 code units (JS String.length), the unit both composers
// count. Postgres' char_length counts code points, never more, so anything
// accepted here fits the SQL check.
export const TIP_TEXT_MAX = 140

/// Validates a teacher's tips. Returns { ok: true, tips } with each tip
/// normalised to { key } or { text } (trimmed), or { ok: false, error }.
/// Rules: an array of at most 3; a key must be in the library; custom text
/// is 1–140 UTF-16 units after trimming; no tip twice.
export function cleanTips(value) {
  if (value === undefined || value === null) return { ok: true, tips: [] }
  if (!Array.isArray(value)) return { ok: false, error: 'Tips must be a list' }
  if (value.length > TIPS_MAX) return { ok: false, error: `At most ${TIPS_MAX} tips` }
  const tips = []
  const seen = new Set()
  for (const t of value) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) return { ok: false, error: 'Invalid tip' }
    const keys = Object.keys(t)
    if (keys.length !== 1) return { ok: false, error: 'Invalid tip' }
    if (keys[0] === 'key') {
      if (typeof t.key !== 'string' || !TIP_KEYS.includes(t.key)) return { ok: false, error: 'Unknown tip' }
      if (seen.has(`k:${t.key}`)) return { ok: false, error: 'The same tip twice' }
      seen.add(`k:${t.key}`)
      tips.push({ key: t.key })
    } else if (keys[0] === 'text') {
      if (typeof t.text !== 'string') return { ok: false, error: 'Invalid tip' }
      const text = t.text.trim()
      if (!text || text.length > TIP_TEXT_MAX) return { ok: false, error: `A tip must be 1-${TIP_TEXT_MAX} characters` }
      if (seen.has(`t:${text}`)) return { ok: false, error: 'The same tip twice' }
      seen.add(`t:${text}`)
      tips.push({ text })
    } else {
      return { ok: false, error: 'Invalid tip' }
    }
  }
  return { ok: true, tips }
}

/// Defensive read of a stored tips value (jsonb): only well-formed tips go
/// out, so a client never has to cope with anything else.
export function storedTips(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((t) => t && typeof t === 'object' && (typeof t.key === 'string' || typeof t.text === 'string'))
    .slice(0, TIPS_MAX)
    .map((t) => (typeof t.key === 'string' ? { key: t.key } : { text: t.text }))
}

// The columns every grade read selects (never author_user_id).
export const GRADE_SELECT = 'id,version,level,tips,returned,created_at,updated_at,seen_at'

/// Allowlisted output of one grade row.
export const gradeShape = (g) => ({
  id: g.id, version: g.version, level: g.level, tips: storedTips(g.tips), returned: !!g.returned,
  created_at: g.created_at, updated_at: g.updated_at ?? g.created_at, seen_at: g.seen_at ?? null,
})

/// The newest grade (highest version) among embedded rows, or null.
export function latestGrade(rows) {
  if (!Array.isArray(rows) || !rows.length) return null
  return rows.reduce((a, b) => (b.version > a.version ? b : a))
}

// ── CSV export ─────────────────────────────────────────────────────────
// Built in the teacher's browser from GET /api/school/grades?classId=…, so
// the headers and level names are in the teacher's language.

/// One CSV cell: quoted, inner quotes doubled, and — so a spreadsheet never
/// runs it as a formula — a cell starting with = + - @ (or a tab/CR, which
/// some spreadsheets strip before parsing) gets a leading apostrophe.
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

/// Rows (arrays of cells) to CSV text, CRLF line ends, with a BOM so Excel
/// reads UTF-8 names (accents, emoji) correctly.
export function toCsv(rows) {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/// A download filename from a class name: letters, digits, dash and
/// underscore only (accents dropped), never empty, never a path.
export function csvFilename(className, date = new Date()) {
  const base = String(className ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const day = date.toISOString().slice(0, 10)
  return `grades-${base || 'class'}-${day}.csv`
}

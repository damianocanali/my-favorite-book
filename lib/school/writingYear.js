// "My Writing Year" (spec 2026-10-01 §3, migration 024): the pure rules
// shared by api/school/writing-year.js, the PDF builder, the admin print
// step and the web UI. No I/O here.
import { isLicenseUsable } from './license.js'
import { acrosticLetters } from './worksheets.js'

export const MAX_ITEMS = 30 // pieces in one child's book (approved + waiting)
export const MAX_PENDING = 5 // a child's suggestions waiting for the teacher
export const ABOUT_MAX = 200 // each "About me" answer
export const ABOUT_FIELDS = ['about_favorite', 'about_best_sentence', 'about_learned']
export const NOTE_MAX = 600 // the teacher's note
export const COVER_TITLE_MAX = 60
export const PRINT_STATUSES = ['requested', 'approved', 'submitted', 'in_production', 'shipped', 'canceled', 'failed']
// Legal moves for a class print request. submitted and later come from the
// admin submit call or Lulu's status; canceled only before the printer has it.
const PRINT_NEXT = {
  requested: ['approved', 'canceled'],
  approved: ['submitted', 'failed', 'canceled'],
  submitted: ['in_production', 'shipped', 'failed'],
  in_production: ['shipped', 'failed'],
  shipped: [],
  canceled: [],
  failed: ['canceled'],
}
export const canMovePrint = (from, to) => !!PRINT_NEXT[from]?.includes(to)

/// The school year a date falls in, '2026-27' (a new year starts Aug 1, UTC).
export function schoolYear(date = new Date()) {
  const d = new Date(date)
  const y = d.getUTCFullYear()
  const start = d.getUTCMonth() >= 7 ? y : y - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}
/// '2026-27' → '2026–27' (en dash) for the cover.
export const schoolYearLabel = (sy) => String(sy ?? '').replace('-', '–')

/// R1: printing is included with a PAID license only — active, grace or
/// comped, never a trial (a lapsed/canceled one is not usable either).
/// Must agree with school_create_class_print in 024_writing_year.sql.
export function canPrintClass(license, now = new Date()) {
  if (!license || !['active', 'grace', 'comped'].includes(license.status)) return false
  return isLicenseUsable(license, now)
}

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// [field, max, required]. Lulu needs a phone number on the shipping address.
const ADDRESS_FIELDS = [
  ['school_name', 120, true],
  ['contact_name', 80, true],
  ['contact_email', 254, true],
  ['contact_phone', 30, true],
  ['address_line1', 120, true],
  ['address_line2', 120, false],
  ['city', 80, true],
  ['state_code', 10, false],
  ['postal_code', 20, true],
  ['country_code', 2, true],
]
export const ADDRESS_FIELD_NAMES = ADDRESS_FIELDS.map(([f]) => f)

/// Validates the school shipping address. Returns {ok, address} or
/// {ok:false, field, error}.
export function cleanAddress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, field: null, error: 'Add the school address' }
  const address = {}
  for (const [field, max, required] of ADDRESS_FIELDS) {
    let v = str(value[field])
    if (field === 'country_code' || field === 'state_code') v = v.toUpperCase()
    if (!v && required) return { ok: false, field, error: 'Fill in every required field' }
    if (v.length > max) return { ok: false, field, error: 'That is too long' }
    address[field] = v
  }
  if (!EMAIL_RE.test(address.contact_email)) return { ok: false, field: 'contact_email', error: 'Check the email address' }
  if (!/^[A-Z]{2}$/.test(address.country_code)) return { ok: false, field: 'country_code', error: 'Use a two-letter country code' }
  if (address.contact_phone.replace(/\D/g, '').length < 5) return { ok: false, field: 'contact_phone', error: 'Check the phone number' }
  // US addresses need a state for Lulu.
  if (address.country_code === 'US' && !/^[A-Z]{2}$/.test(address.state_code)) {
    return { ok: false, field: 'state_code', error: 'Add the two-letter state' }
  }
  return { ok: true, address }
}

/// Trims an "About me" / note value; null if it isn't a string or is too long.
export function cleanShortText(value, max) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v.length > max ? null : v
}

// ── The book's content ─────────────────────────────────────────────────

const pageText = (p) => (typeof p?.text === 'string' ? p.text : '')
const imageOf = (v) => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : null)

/// One piece as the printer sees it. `snapshot` is the hand-in's
/// book_snapshot (kind 'submission') or the item's own (kind 'book').
/// Returns {kind:'book', title, pages:[{text, image}]} or
/// {kind:'worksheet', title, boxes:[{prompt, answer}]}, or null if empty.
export function pieceContent(title, snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null
  if (snapshot.kind === 'worksheet') {
    const answers = snapshot.answers && typeof snapshot.answers === 'object' ? snapshot.answers : {}
    const boxes = []
    for (const box of Array.isArray(snapshot.boxes) ? snapshot.boxes : []) {
      if (box?.id === 'lines') {
        // The acrostic: one line per letter of the word.
        const letters = acrosticLetters(snapshot.word ?? answers.word ?? null)
        const lines = letters.map((letter, i) => `${letter} — ${str(answers[`line_${i + 1}`])}`.trim())
        if (letters.length) boxes.push({ prompt: str(box.prompt), answer: lines.join('\n') })
        continue
      }
      const answer = str(answers[box?.id])
      if (answer) boxes.push({ prompt: str(box?.prompt), answer })
    }
    return boxes.length ? { kind: 'worksheet', title: str(title) || str(snapshot.title), boxes } : null
  }
  const pages = (Array.isArray(snapshot.pages) ? snapshot.pages : [])
    .map((p) => ({ text: pageText(p), image: imageOf(p?.illustrationData) }))
    .filter((p) => p.text.trim() || p.image)
  if (!pages.length) return null
  return { kind: 'book', title: str(title) || str(snapshot.title), pages, cover: imageOf(snapshot.coverImage) }
}

/// The whole child's book, frozen into a print request (and the same shape
/// the preview and the per-child PDF use).
///   pieces: [{title, snapshot}] in order (approved only — the caller filters)
export function buildChildBook({ student, avatarUrl = null, className, lang, year, pieces, meta }) {
  const content = pieces.map((p) => pieceContent(p.title, p.snapshot)).filter(Boolean)
  const about = {}
  for (const f of ABOUT_FIELDS) about[f] = str(meta?.[f])
  return {
    v: 1,
    name: str(student.display_name),
    avatar_emoji: str(student.avatar_emoji),
    avatar_url: imageOf(avatarUrl),
    class_name: str(className),
    lang: lang === 'it' ? 'it' : 'en',
    year,
    cover_title: str(meta?.cover_title) || null,
    pieces: content,
    about,
    teacher_note: str(meta?.teacher_note),
  }
}

/// True when a child's book has anything to print (R: children with zero
/// approved pieces are excluded from a class print and listed).
export const hasPieces = (book) => Array.isArray(book?.pieces) && book.pieces.length > 0
export const aboutMeDone = (meta) => ABOUT_FIELDS.some((f) => str(meta?.[f]))

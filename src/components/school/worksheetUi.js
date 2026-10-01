// Pure helpers for worksheet assignments on the web (spec 2026-10-01 §2):
// default prompts in the teacher's language, the boxes a child fills in
// (the acrostic expands to one box per letter), the on-device draft, and
// the turn-into-book-pages step. No React here, so it's unit-testable.
// The iPad mirrors these in Models/Worksheets.swift.
import {
  getTemplate, boxIds, acrosticLetters, cleanAcrosticWord, worksheetPages, pagesThatFit,
} from '../../../lib/school/worksheets.js'

export const isWorksheet = (assignment) => assignment?.kind === 'worksheet' && !!assignment?.worksheet

/// The template's own prompts in the teacher's language (school.json
/// worksheet.templates.<id>.boxes.*): what the teacher starts editing from.
export function defaultPrompts(t, templateId) {
  const template = getTemplate(templateId)
  if (!template) return {}
  return Object.fromEntries(boxIds(template).map((id) => [id, t(`school:worksheet.templates.${templateId}.boxes.${id}`)]))
}

// Ruled lines per box size on paper, and rows on screen.
export const BOX_LINES = { small: 1, medium: 3, large: 6 }
export const BOX_ROWS = { small: 2, medium: 4, large: 7 }

/// What the child sees, in order. A plain box: { type: 'box', id, prompt,
/// size }. The acrostic's word: { type: 'word', id: 'word', prompt, fixed }
/// (fixed = the teacher chose it). Its letters: { type: 'letters', id:
/// 'lines', prompt, letters: [{ id: 'line_1', letter: 'S' }, ...] }.
/// `prompts`: the assignment's (or a hand-in's frozen) prompts by box id.
export function fillLayout({ templateId, prompts = {}, word = null }, childWord = '') {
  const template = getTemplate(templateId)
  if (!template) return []
  const effective = word || cleanAcrosticWord(childWord ?? '') || null
  return template.boxes.map((b) => {
    const prompt = prompts[b.id] ?? ''
    if (templateId === 'acrostic' && b.id === 'word') return { type: 'word', id: 'word', prompt, fixed: !!word, size: b.size }
    if (b.perLetter) {
      return {
        type: 'letters', id: b.id, prompt, size: b.size,
        letters: acrosticLetters(effective).map((letter, i) => ({ id: `line_${i + 1}`, letter })),
      }
    }
    return { type: 'box', id: b.id, prompt, size: b.size }
  })
}

/// A hand-in's frozen worksheet as fillLayout input (prompts by id).
export function snapshotPrompts(worksheet) {
  return Object.fromEntries((worksheet?.boxes ?? []).map((b) => [b.id, b.prompt]))
}

/// What goes to POST /api/school/submit: every box the child wrote in
/// (blank ones are left out; the server trims too), plus their own
/// acrostic word when the teacher left it open. Lines past the word's
/// length (the child shortened the word) are dropped.
export function answersForSubmit(worksheet, answers = {}) {
  const out = {}
  const isAcrostic = worksheet?.templateId === 'acrostic'
  const word = isAcrostic ? (worksheet.word || cleanAcrosticWord(answers.word ?? '') || null) : null
  const n = acrosticLetters(word).length
  for (const [k, v] of Object.entries(answers)) {
    if (typeof v !== 'string' || !v.trim()) continue
    if (isAcrostic) {
      if (k === 'word') {
        if (!worksheet.word) out.word = v.trim()
        continue
      }
      const m = /^line_(\d+)$/.exec(k)
      if (!m || Number(m[1]) > n) continue
    }
    out[k] = v
  }
  return out
}

/// Whether anything (beyond the acrostic word) has been written.
export const hasAnswers = (answers = {}) =>
  Object.entries(answers).some(([k, v]) => k !== 'word' && typeof v === 'string' && v.trim())

// ── On-device draft (no server drafts in v1) ────────────────────────────
// Per signed-in child and assignment, so a shared class device never shows
// one child's answers to the next.
const DRAFT_PREFIX = 'mbl.worksheetDraft.'
const draftKey = (userId, assignmentId) => `${DRAFT_PREFIX}${userId}.${assignmentId}`

export function readWorksheetDraft(userId, assignmentId, storage = globalThis.localStorage) {
  if (!userId || !assignmentId) return null
  try {
    const raw = storage?.getItem(draftKey(userId, assignmentId))
    const d = raw ? JSON.parse(raw) : null
    if (!d || typeof d !== 'object' || !d.answers || typeof d.answers !== 'object') return null
    return { answers: d.answers, updatedAt: d.updatedAt ?? null }
  } catch {
    return null
  }
}

export function writeWorksheetDraft(userId, assignmentId, answers, storage = globalThis.localStorage) {
  if (!userId || !assignmentId) return
  try {
    storage?.setItem(draftKey(userId, assignmentId), JSON.stringify({ answers, updatedAt: new Date().toISOString() }))
  } catch {
    // Storage full or blocked: the answers stay on screen; nothing to do.
  }
}

/// Started = there is a draft with something in it on this device.
export const hasWorksheetDraft = (userId, assignmentId, storage) =>
  hasAnswers(readWorksheetDraft(userId, assignmentId, storage)?.answers ?? {})

// ── Turn into book pages ────────────────────────────────────────────────

/// The page texts a finished worksheet becomes (lib's deterministic
/// mapping), for a hand-in's frozen worksheet + answers.
export function pagesFor(worksheet, answers) {
  return worksheetPages(worksheet?.templateId, answers ?? {}, worksheet?.word || null)
}

/// `existing` book pages (web shape) + new page texts, numbered on, never
/// past the book page limit. `makeId` gives each new page an id.
export function appendWorksheetPages(existing = [], texts = [], makeId) {
  const fit = pagesThatFit(existing.length, texts)
  const added = fit.map((text, i) => ({
    id: makeId(),
    pageNumber: existing.length + i + 1,
    text,
    illustrationData: null,
    illustrationRegenCount: 0,
    borderStyle: 'stars',
  }))
  return { pages: [...existing, ...added], added: added.length }
}

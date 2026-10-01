// Server-side caps for the child-typed "create your own" text on a book
// (both apps already cap it in the wizard: character name <= 24, character
// description <= 80, place <= 80 — see src/data/characters.js and the
// iPad's CharacterCatalog). Enforced again wherever a book is stored or
// published, so a hand-crafted request can't park a novel in a character
// description. Truncates rather than rejects: a child must never lose a
// book over it. Catalogue entries (no custom flag) are left untouched.
export const CUSTOM_NAME_MAX = 24
export const CUSTOM_DESCRIPTION_MAX = 80
export const CUSTOM_PLACE_MAX = 80

const isCustom = (e) => !!(e && (e.custom || e.isCustom))
const cap = (v, n) => (typeof v === 'string' && v.length > n ? v.slice(0, n) : v)

function capPrompt(promptEn, nameMax, descMax) {
  if (!promptEn || typeof promptEn !== 'object') return promptEn
  return { ...promptEn, name: cap(promptEn.name, nameMax), description: cap(promptEn.description, descMax) }
}

export function capCustomBookText(book) {
  if (!book || typeof book !== 'object') return book
  const characters = Array.isArray(book.characters)
    ? book.characters.map((c) => (isCustom(c)
      ? {
          ...c,
          name: cap(c.name, CUSTOM_NAME_MAX),
          description: cap(c.description, CUSTOM_DESCRIPTION_MAX),
          promptEn: capPrompt(c.promptEn, CUSTOM_NAME_MAX, CUSTOM_DESCRIPTION_MAX),
        }
      : c))
    : book.characters
  const s = book.setting
  const setting = isCustom(s)
    ? {
        ...s,
        name: cap(s.name, CUSTOM_PLACE_MAX),
        label: cap(s.label, CUSTOM_PLACE_MAX),
        description: cap(s.description, CUSTOM_PLACE_MAX),
        promptEn: capPrompt(s.promptEn, CUSTOM_PLACE_MAX, CUSTOM_PLACE_MAX),
      }
    : s
  return { ...book, characters, setting }
}

/// Everything on a book that becomes readable by other people once it is
/// published — screened by moderation before it reaches the gallery.
export function publicBookText(book) {
  const s = book?.setting
  return [
    book?.title,
    book?.authorName,
    ...(book?.characters ?? []).flatMap((c) => [c?.name, c?.description]),
    s?.name,
    s?.label,
    s?.description,
    ...(book?.pages ?? []).map((p) => p?.text),
  ]
    .filter((x) => typeof x === 'string' && x.trim())
    .join('\n')
}

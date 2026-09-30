import { promptName, promptDescription, promptLabel } from '../i18n/contentCatalog'

// Structured bodies for /api/generate-image. Pure (no I/O) so it is testable.
//
// EVERYTHING THAT DESCRIBES THE PICTURE IS ENGLISH ON PURPOSE. Catalogue terms
// go through promptName()/promptDescription()/promptLabel(), which read the
// frozen `promptEn` fields, never display text. The only non-English thing
// sent is the child's own page text — and the SERVER turns that into an
// English scene (lib/imageScene.js). No client builds a FLUX prompt any more:
// raw prose pasted into the prompt was drawn as letters, carried real
// people's names through, and forced every character into every page.

function characterFor(ch) {
  return {
    // FIREWALL ALLOWANCE: `name` is the one display-side field sent. It is
    // what the child calls the character, used only so the server can tell
    // whether a page is about them; the server never draws from it (the
    // scene writer gets it as data, the offline fallback ignores it). This
    // is why tests/i18n-prompt-firewall.test.js tolerates `ch?.name` here.
    name: ch?.name ?? '',
    promptEn: promptName(ch),
    description: promptDescription(ch),
  }
}

const hasCharacter = (c) => Boolean(c.promptEn)

// Server limit (lib/imageScene.js LIMITS.characters); more would 413.
const MAX_CHARACTERS = 6

function base(kind, book, locale) {
  return {
    kind,
    characters: (book?.characters ?? []).map(characterFor).filter(hasCharacter).slice(0, MAX_CHARACTERS),
    setting: book?.setting
      ? { promptEn: promptName(book.setting), description: promptDescription(book.setting) }
      : null,
    timePeriod: promptLabel(book?.timePeriod),
    locale: locale || 'en',
  }
}

export function coverPayload(book, locale) {
  return { ...base('cover', book, locale), title: book?.title ?? '' }
}

export function portraitPayload(character, book, locale) {
  // Pre-filtered like base(): an empty character would only earn a 400.
  return { ...base('portrait', book, locale), characters: [characterFor(character)].filter(hasCharacter) }
}

export function pagePayload(page, book, locale) {
  return {
    ...base('page', book, locale),
    pageText: page?.text ?? '',
    // Story Builder pages carry the cards the child actually chose, already
    // English (promptEn) — see src/lib/storyBuilder.js.
    hint: page?.illustrationHint ?? '',
  }
}

export function editPayload(page, book, instruction, locale) {
  return {
    ...base('edit', book, locale),
    pageText: page?.text ?? '',
    instruction,
    sourceImage: page?.illustrationData,
    strength: 0.55,
  }
}

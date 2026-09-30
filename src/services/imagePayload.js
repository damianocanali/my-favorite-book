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
    // `name` is what the child calls the character, used only so the server
    // can tell whether a page is about them. It is never drawn from.
    name: ch?.name ?? '',
    promptEn: promptName(ch),
    description: promptDescription(ch),
  }
}

function base(kind, book, locale) {
  return {
    kind,
    characters: (book?.characters ?? []).map(characterFor).filter((c) => c.promptEn),
    setting: book?.setting ? { promptEn: promptName(book.setting) } : null,
    timePeriod: promptLabel(book?.timePeriod),
    locale: locale || 'en',
  }
}

export function coverPayload(book, locale) {
  return { ...base('cover', book, locale), title: book?.title ?? '' }
}

export function portraitPayload(character, book, locale) {
  return { ...base('portrait', book, locale), characters: [characterFor(character)] }
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

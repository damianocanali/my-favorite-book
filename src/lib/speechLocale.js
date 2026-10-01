// The BCP-47 locale web speech APIs should use (dictation and read-aloud).
// Without one, Chrome/Safari default to the browser's language — usually
// en-US — so an Italian child's dictation came back as English gibberish
// and Italian text was read by an English voice. The book's language wins
// (a child may write English in an Italian app), then the app language.
const FULL = { en: 'en-US', it: 'it-IT' }

export function speechLocale(...candidates) {
  for (const c of candidates) {
    const base = String(c ?? '').toLowerCase().slice(0, 2)
    if (FULL[base]) return FULL[base]
  }
  return FULL.en
}

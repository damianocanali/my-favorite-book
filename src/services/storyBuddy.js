import { apiFetchAuthed } from '../lib/api'
import i18next from '../i18n'
import { aiResponseError } from '../lib/aiErrors'
import { displayName } from '../i18n/contentCatalog'

// The buddy talks to the child in their language, so it gets the names the
// child SEES ("Nonna Rosa"), never the stored English catalogue names or the
// frozen prompt text. Exported for tests.
export function buddyBook(book, t = i18next.t.bind(i18next)) {
  if (!book) return book
  return {
    ...book,
    characters: (book.characters ?? []).map((c) => ({ ...c, name: displayName(c, t, 'characters'), promptEn: undefined })),
    setting: book.setting ? { ...book.setting, name: displayName(book.setting, t, 'scenes'), promptEn: undefined } : book.setting,
    timePeriod: book.timePeriod
      ? { ...book.timePeriod, label: displayName(book.timePeriod, t, 'time_periods'), promptEn: undefined }
      : book.timePeriod,
  }
}

async function callStoryBuddy(intent, book, page) {
  const response = await apiFetchAuthed('/api/story-buddy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // `locale` tells the server which language to reply in. Without it an
    // Italian child gets English suggestions inside an Italian app — the
    // most visible way a half-finished localization shows.
    body: JSON.stringify({ intent, book: buddyBook(book), page, locale: i18next.language || 'en' }),
  })

  if (!response.ok) throw await aiResponseError(response, 'API error')

  return response.json()
}

function parseList(text) {
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(Boolean)
}

export async function getStoryStarters(book, currentPage) {
  const data = await callStoryBuddy('starters', book, currentPage)
  return parseList(data.content[0].text)
}

export async function getParagraphSuggestion(book, currentPage) {
  const data = await callStoryBuddy('paragraph', book, currentPage)
  return data.content[0].text.trim()
}

export async function getGuidedQuestions(book, currentPage) {
  const data = await callStoryBuddy('questions', book, currentPage)
  return parseList(data.content[0].text)
}

import { apiFetchAuthed } from '../lib/api'
import i18next from '../i18n'

async function callStoryBuddy(intent, book, page) {
  const response = await apiFetchAuthed('/api/story-buddy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // `locale` tells the server which language to reply in. Without it an
    // Italian child gets English suggestions inside an Italian app — the
    // most visible way a half-finished localization shows.
    body: JSON.stringify({ intent, book, page, locale: i18next.language || 'en' }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error || `API error: ${response.status}`)
  }

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

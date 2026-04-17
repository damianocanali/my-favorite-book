import { apiFetch } from '../lib/api'

async function callStoryBuddy(intent, book, page) {
  const response = await apiFetch('/api/story-buddy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent, book, page }),
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

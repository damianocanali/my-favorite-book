function buildContext(book) {
  const chars = book.characters?.map((c) => c.name).join(', ') || 'no characters yet'
  const setting = book.setting?.name || 'unknown place'
  const time = book.timePeriod?.label || 'unknown time'
  const existingPages = book.pages
    ?.filter((p) => p.text.trim())
    .map((p) => `Page ${p.pageNumber}: ${p.text}`)
    .join('\n')

  return `
You are Story Buddy, a friendly creative writing assistant for kids. You help children aged ${book.authorAge} write their own stories.

THE KID'S BOOK:
- Title: "${book.title}"
- Author: ${book.authorName} (age ${book.authorAge})
- Characters: ${chars}
- Setting: ${setting}
- Time Period: ${time}

STORY SO FAR:
${existingPages || '(The story has not started yet)'}

IMPORTANT RULES:
- Write at a level appropriate for a ${book.authorAge}-year-old
${book.authorAge <= 7 ? '- Use simple words and short sentences\n- Keep things fun, silly, and easy to understand' : '- Use creative vocabulary but keep it accessible\n- Encourage descriptive writing and imagination'}
- Always incorporate the kid's chosen characters, setting, and time period
- Keep content positive, safe, and kid-friendly
- Be encouraging and enthusiastic
- Never write anything scary, violent, or inappropriate
`.trim()
}

async function callStoryBuddy(system, messages, max_tokens) {
  const response = await fetch('/api/story-buddy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages, max_tokens }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error || `API error: ${response.status}`)
  }

  return response.json()
}

export async function getStoryStarters(book, currentPage) {
  const context = buildContext(book)

  const data = await callStoryBuddy(context, [
    {
      role: 'user',
      content: `Give me 3 different sentence starters for page ${currentPage.pageNumber} of my story. Each should be 1 short sentence that I can continue writing from. ${currentPage.pageNumber === 1 ? 'These should be great opening lines!' : 'These should continue from where my story left off.'}

Return ONLY the 3 starters, one per line, numbered 1-3. No extra text.`,
    },
  ], 300)

  const text = data.content[0].text
  return text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(Boolean)
}

export async function getParagraphSuggestion(book, currentPage) {
  const context = buildContext(book)

  const data = await callStoryBuddy(context, [
    {
      role: 'user',
      content: `Write a paragraph for page ${currentPage.pageNumber} of my story. ${
        currentPage.text
          ? `The page currently says: "${currentPage.text}". Write a continuation or replacement paragraph.`
          : currentPage.pageNumber === 1
          ? 'Write an exciting opening paragraph!'
          : 'Continue the story from where it left off.'
      }

Write ONLY the paragraph, 2-4 sentences. No extra text or explanation.`,
    },
  ], 400)

  return data.content[0].text.trim()
}

export async function getGuidedQuestions(book, currentPage) {
  const context = buildContext(book)

  const data = await callStoryBuddy(context, [
    {
      role: 'user',
      content: `Help me think about what to write on page ${currentPage.pageNumber}. Ask me 3 fun questions that will help me figure out what happens next in my story. ${
        currentPage.text
          ? `So far on this page I wrote: "${currentPage.text}"`
          : currentPage.pageNumber === 1
          ? 'This is the first page, so help me think about how to start!'
          : 'Help me think about what happens next.'
      }

Return ONLY 3 questions, one per line, numbered 1-3. Make them fun and exciting! Use emojis.`,
    },
  ], 300)

  return data.content[0].text
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(Boolean)
}

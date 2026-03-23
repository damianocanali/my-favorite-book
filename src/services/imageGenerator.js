function buildStylePrompt() {
  return `children's storybook illustration, colorful, friendly, whimsical, cute cartoon style, soft colors, safe for kids, no text, no words, no letters`
}

async function generateImage(prompt) {
  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error || `Image API error: ${response.status}`)
  }

  const data = await response.json()
  return data.image
}

export async function generateCoverArt(book) {
  const chars = book.characters?.map((c) => c.name).join(' and ') || 'a hero'
  const setting = book.setting?.name || 'a magical place'
  const time = book.timePeriod?.label || 'once upon a time'

  const prompt = `A beautiful children's book cover illustration for a story called "${book.title}". The scene shows ${chars} in ${setting} during ${time}. ${buildStylePrompt()}`

  return generateImage(prompt)
}

export async function generateCharacterPortrait(character, book) {
  const setting = book?.setting?.name || 'a magical world'

  const prompt = `A cute character portrait of ${character.name}, ${character.description || 'a friendly character'}. Standing in ${setting}. ${buildStylePrompt()}, character portrait, centered, full body`

  return generateImage(prompt)
}

export async function generatePageIllustration(page, book) {
  const chars = book.characters?.map((c) => c.name).join(' and ') || 'the hero'
  const setting = book.setting?.name || 'a magical place'
  const pageText = page.text || 'the beginning of an adventure'

  const prompt = `A scene from a children's storybook: ${pageText.substring(0, 200)}. The characters ${chars} are in ${setting}. ${buildStylePrompt()}, wide scene, landscape composition`

  return generateImage(prompt)
}

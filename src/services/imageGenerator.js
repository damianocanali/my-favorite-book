import { apiFetchAuthed } from '../lib/api'
import { aiResponseError } from '../lib/aiErrors'
import i18next from '../i18n'
import { coverPayload, portraitPayload, pagePayload, editPayload } from './imagePayload'

// The server writes the picture's English scene from these structured
// payloads — see src/services/imagePayload.js and lib/imageScene.js.
async function generateImage(payload) {
  const response = await apiFetchAuthed('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  // Keeps the server's `code` and status so friendlyAiError can show the
  // right translated message (src/lib/aiErrors.js).
  if (!response.ok) throw await aiResponseError(response, 'Image API error')

  const data = await response.json()
  return data.image
}

const locale = () => i18next.language || 'en'

export async function generateCoverArt(book) {
  return generateImage(coverPayload(book, locale()))
}

export async function generateCharacterPortrait(character, book) {
  return generateImage(portraitPayload(character, book, locale()))
}

export async function generatePageIllustration(page, book) {
  return generateImage(pagePayload(page, book, locale()))
}

// Image-to-image edit. Keeps the existing illustration's composition and
// applies the child's change, rewritten server-side into an English
// instruction. Counts toward the same caps as a generation.
export async function editPageIllustration(page, book, instruction) {
  if (!page.illustrationData) throw new Error('No illustration to edit')
  return generateImage(editPayload(page, book, instruction, locale()))
}

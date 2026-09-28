// Sanitises the /worksheets query string (brief §4's teacher-hook link:
// ?template=<id>&prompt=<assignment prompt>&class=<class name>). Both
// `prompt` and `class` are attacker-controlled text the moment they're read
// back out of the URL — same posture as safeNext.js for `?next=` — so this
// caps length and strips anything that could ever look like a tag. The
// components that render these values do so as plain text (no
// dangerouslySetInnerHTML anywhere in this tree); this is defense in depth
// on top of that, not instead of it.
import { getWorksheetTemplate } from './templates.js'

export const MAX_PROMPT_LENGTH = 200
export const MAX_CLASS_NAME_LENGTH = 60

function sanitizeText(raw, maxLength) {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {{ template: string|null, prompt: string, className: string }}
 */
export function parseWorksheetParams(searchParams) {
  const templateId = searchParams.get('template')
  return {
    template: getWorksheetTemplate(templateId) ? templateId : null,
    prompt: sanitizeText(searchParams.get('prompt'), MAX_PROMPT_LENGTH),
    className: sanitizeText(searchParams.get('class'), MAX_CLASS_NAME_LENGTH),
  }
}

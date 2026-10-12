// Sanitises the /worksheets query string (brief §4's teacher-hook link:
// ?template=<id>&prompt=<assignment prompt>&class=<class name>). Both
// `prompt` and `class` are attacker-controlled text the moment they're read
// back out of the URL — same posture as safeNext.js for `?next=` — so this
// caps length and strips anything that could ever look like a tag. The
// components that render these values do so as plain text (no
// dangerouslySetInnerHTML anywhere in this tree); this is defense in depth
// on top of that, not instead of it.
import { resolveTemplateId } from '../../../lib/school/worksheets.js'

// "Today's prompt" prints on at most two lines of the sheet, after the
// longer (Italian) "Traccia di oggi:" prefix — measured in Chrome with the
// widest realistic text (tests/worksheets-params.test.js pins the cap).
export const MAX_PROMPT_LENGTH = 140
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
 * `template` is the real template id: an old printable alias
 * (?template=story-map) comes back as the sheet it became.
 */
export function parseWorksheetParams(searchParams) {
  return {
    template: resolveTemplateId(searchParams.get('template')),
    prompt: sanitizeText(searchParams.get('prompt'), MAX_PROMPT_LENGTH),
    className: sanitizeText(searchParams.get('class'), MAX_CLASS_NAME_LENGTH),
  }
}

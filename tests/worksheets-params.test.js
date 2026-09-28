// The teacher-hooks deep link (brief §4) puts an assignment's title/prompt
// and a class name straight into the URL:
//   /worksheets?template=story-map&prompt=<assignment prompt>&class=<class name>
// Both prompt and class travel through the address bar, so — same reasoning
// as safeNext.js for `?next=` — they are attacker-controlled text, not app
// state, by the time WorksheetsPage reads them. This is the sanitiser: cap
// length, strip anything that could ever look like a tag, collapse newlines
// so a pasted multi-line prompt can't blow out a one-line header. Rendered
// as plain text by React either way (no dangerouslySetInnerHTML anywhere in
// this component tree) — this is defense in depth, not the only guard.
import { describe, it, expect } from 'vitest'
import { parseWorksheetParams, MAX_PROMPT_LENGTH, MAX_CLASS_NAME_LENGTH } from '../src/lib/worksheets/params.js'

function paramsFrom(query) {
  return new URLSearchParams(query)
}

describe('parseWorksheetParams', () => {
  it('parses a well-formed teacher-hook link', () => {
    const out = parseWorksheetParams(paramsFrom('template=story-map&prompt=Write+about+a+dragon&class=Room+12'))
    expect(out).toEqual({ template: 'story-map', prompt: 'Write about a dragon', className: 'Room 12' })
  })

  it('drops an unknown template id rather than passing it through', () => {
    const out = parseWorksheetParams(paramsFrom('template=not-a-real-template'))
    expect(out.template).toBeNull()
  })

  it('is null-safe when params are entirely absent', () => {
    expect(parseWorksheetParams(paramsFrom(''))).toEqual({ template: null, prompt: '', className: '' })
  })

  it('strips angle brackets so the value can never look like a tag', () => {
    const out = parseWorksheetParams(paramsFrom('prompt=' + encodeURIComponent('<script>alert(1)</script> hi')))
    expect(out.prompt).not.toMatch(/[<>]/)
    expect(out.prompt).toContain('scriptalert(1)/script')
  })

  it('collapses newlines and tabs into single spaces', () => {
    const out = parseWorksheetParams(paramsFrom('prompt=' + encodeURIComponent('line one\nline two\tend')))
    expect(out.prompt).toBe('line one line two end')
  })

  it('caps prompt length', () => {
    const long = 'x'.repeat(MAX_PROMPT_LENGTH + 50)
    const out = parseWorksheetParams(paramsFrom('prompt=' + long))
    expect(out.prompt).toHaveLength(MAX_PROMPT_LENGTH)
  })

  it('caps class name length', () => {
    const long = 'y'.repeat(MAX_CLASS_NAME_LENGTH + 50)
    const out = parseWorksheetParams(paramsFrom('class=' + long))
    expect(out.className).toHaveLength(MAX_CLASS_NAME_LENGTH)
  })

  it('trims surrounding whitespace', () => {
    const out = parseWorksheetParams(paramsFrom('class=' + encodeURIComponent('  Room 12  ')))
    expect(out.className).toBe('Room 12')
  })
})

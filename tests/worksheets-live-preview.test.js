// Live preview while customizing (owner request 2026-10): the Customize
// editor and the assign form draw the REAL sheet as the teacher types, with
// the same renderer and translators the print job uses.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next, { bootI18n, loadLocale } from '../src/i18n/index.js'
import { LiveSheet, CopyPager } from '../src/components/worksheets/CustomizePanel.jsx'
import { fitSheetWidth, SHEET_WIDTH_PX, SHEET_HEIGHT_PX } from '../src/components/worksheets/WorksheetThumbnail.jsx'
import { sheetTranslators, isSheetLocaleReady, previewCopyIndex } from '../src/lib/worksheets/sheetLocale.js'

const en = { school: JSON.parse(readFileSync('src/i18n/locales/en/school.json', 'utf8')), worksheets: JSON.parse(readFileSync('src/i18n/locales/en/worksheets.json', 'utf8')) }
const itCat = { school: JSON.parse(readFileSync('src/i18n/locales/it/school.json', 'utf8')), worksheets: JSON.parse(readFileSync('src/i18n/locales/it/worksheets.json', 'utf8')) }
const plain = (html) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
const RAW_KEY = /worksheet\.templates\.|sheet\.[a-z_]+\.[a-z_]+|customize\.[a-z_]+|undefined/

beforeAll(async () => {
  if (!i18next.isInitialized) await bootI18n()
})

const values = { prompt: 'Write about a dragon who is afraid of the dark', className: 'Room 4', teacherName: 'Ms. Rossi', sheetLocale: 'en', namesRaw: '' }

describe('Customize: the live sheet', () => {
  it('renders the real sheet with the typed prompt, class and teacher', () => {
    const html = plain(renderToStaticMarkup(createElement(LiveSheet, { templateId: 'beginning_middle_end', locale: 'en', values, width: 400 })))
    expect(html).toContain('data-template="beginning_middle_end"')
    expect(html).toContain(en.school.worksheet.templates.beginning_middle_end.heading)
    expect(html).toContain('Write about a dragon who is afraid of the dark')
    expect(html).toContain('Room 4')
    expect(html).toContain('Ms. Rossi')
    expect(html).not.toMatch(RAW_KEY)
    // Scaled down from the real 8.5in page.
    expect(html).toContain(`scale(${400 / SHEET_WIDTH_PX})`)
  })

  it('switching the sheet language re-renders it in Italian (no raw keys)', async () => {
    await loadLocale('it')
    expect(isSheetLocaleReady(i18next, 'it')).toBe(true)
    const html = plain(renderToStaticMarkup(createElement(LiveSheet, { templateId: 'beginning_middle_end', locale: 'it', values: { ...values, sheetLocale: 'it' }, width: 400 })))
    expect(html).toContain(itCat.school.worksheet.templates.beginning_middle_end.heading)
    expect(html).not.toContain(en.school.worksheet.templates.beginning_middle_end.heading)
    expect(html).not.toMatch(RAW_KEY)
  })

  it('an unloaded language is not "ready" (the panel keeps the previous render meanwhile)', () => {
    expect(isSheetLocaleReady({ hasResourceBundle: () => false }, 'it')).toBe(false)
    expect(isSheetLocaleReady({ hasResourceBundle: () => false }, 'en')).toBe(true)
  })

  it('with pasted names the Name line shows copy N; without, it is blank', () => {
    const named = renderToStaticMarkup(createElement(LiveSheet, { templateId: 'acrostic', locale: 'en', values, studentName: 'Maya', width: 300 }))
    expect(named).toMatch(/border-b border-black h-4">Maya</)
    const blank = renderToStaticMarkup(createElement(LiveSheet, { templateId: 'acrostic', locale: 'en', values, studentName: '', width: 300 }))
    expect(blank).not.toContain('Maya')
    expect(renderToStaticMarkup(createElement(LiveSheet, { templateId: 'acrostic', locale: 'en', values, width: 0 }))).toBe('')
  })

  it('the pager reads "Copy N of M · name" and clamps', () => {
    const t = i18next.getFixedT('en', 'worksheets')
    const names = ['Ava', 'Ben', 'Maya']
    const html = plain(renderToStaticMarkup(createElement(CopyPager, { t, names, index: 2, onIndex: () => {} })))
    expect(html).toContain('Copy 3 of 3 · Maya')
    expect(html).toContain('disabled="" aria-label="Next copy"')
    expect(renderToStaticMarkup(createElement(CopyPager, { t, names: [], index: -1, onIndex: () => {} }))).toBe('')
    const tIt = i18next.getFixedT('it', 'worksheets')
    expect(plain(renderToStaticMarkup(createElement(CopyPager, { t: tIt, names, index: 0, onIndex: () => {} })))).toContain('Copia 1 di 3 · Ava')
    expect(previewCopyIndex([], 4)).toBe(-1)
    expect(previewCopyIndex(names, 9)).toBe(2)
    expect(previewCopyIndex(names, -1)).toBe(0)
  })

  it('fits the page to its pane: width on a phone, the whole page on a wide screen, never past true size', () => {
    expect(fitSheetWidth({ width: 343, height: 500 })).toBe(343)
    expect(fitSheetWidth({ width: 600, height: 500 }, { fitHeight: true })).toBe(Math.floor(500 * SHEET_WIDTH_PX / SHEET_HEIGHT_PX))
    expect(fitSheetWidth({ width: 2000, height: 3000 }, { fitHeight: true })).toBe(SHEET_WIDTH_PX)
    expect(fitSheetWidth({ width: 0, height: 0 })).toBe(0)
  })

  it('preview and print share the renderer, translators and values', () => {
    const page = readFileSync('src/pages/WorksheetsPage.jsx', 'utf8')
    const panel = readFileSync('src/components/worksheets/CustomizePanel.jsx', 'utf8')
    expect(page).toContain('{...sheetTranslators(i18next, printJob.sheetLocale)}')
    expect(panel).toContain('sheetTranslators(i18next, locale)')
    expect(panel).toContain('<WorksheetSheet')
    expect(panel).toContain('prompt={values.prompt}')
    expect(panel).toContain('className={values.className}')
    expect(panel).toContain('teacherName={values.teacherName}')
    // Print still takes the very same values.
    expect(page).toMatch(/prompt: values\.prompt,\s*className: values\.className,\s*teacherName: values\.teacherName,\s*sheetLocale: values\.sheetLocale,\s*names: parseNameList\(values\.namesRaw\)/)
    // Teacher contrast only for a teacher (the page is public).
    expect(panel).toContain("teacherMode ? 'teacher-ui' : ''")
    expect(page).toContain('teacherMode={teacherMode}')
    // Still a proper modal.
    for (const s of ['enterInertBackground(document)', 'exitInertBackground(document)', "e.key === 'Escape'", 'panelRef.current?.focus()', 'previouslyFocused.focus()', 'aria-modal="true"']) expect(panel).toContain(s)
    // Language switch waits for the catalogue, as the print job does.
    expect(panel).toContain('loadLocale(values.sheetLocale)')
  })

  it('the sheet translators are the print job\'s', () => {
    const tr = sheetTranslators(i18next, 'it')
    expect(tr.t('sheet.header.name')).toBe(itCat.worksheets.sheet.header.name)
    expect(tr.tSchool('school:worksheet.templates.acrostic.heading')).toBe(itCat.school.worksheet.templates.acrostic.heading)
  })
})

describe('assign form: the live preview', async () => {
  const { default: AssignPreview, previewWorksheet } = await import('../src/components/school/AssignPreview.jsx')
  const draft = (prompts, extra = {}) => ({ templateId: 'beginning_middle_end', prompts, word: '', ...extra })
  const base = { beginning: 'How does it start?', middle: 'What happens next?', end: 'How does it end?' }
  const screen = (props) => plain(renderToStaticMarkup(createElement(AssignPreview, { title: 'Our story', prompt: 'Use full sentences.', ...props })))
  const paper = (props) => plain(renderToStaticMarkup(createElement(AssignPreview, { title: 'Our story', prompt: '', initialMode: 'paper', width: 400, ...props })))

  it('on screen: the child\'s own boxes, and editing a box prompt updates the text', () => {
    const before = screen({ worksheet: draft(base) })
    expect(before).toContain('data-testid="assign-preview-screen"')
    expect(before).toContain('inert=""')
    expect(before).toContain('Our story')
    expect(before).toContain('Use full sentences.')
    expect(before).toContain('What happens next?')
    const after = screen({ worksheet: draft({ ...base, middle: 'Then the dragon sneezed. What next?' }) })
    expect(after).toContain('Then the dragon sneezed. What next?')
    expect(after).not.toContain('What happens next?')
    // Read-only preview: no word help, no read-aloud / dictation buttons.
    expect(after).toContain('readOnly=""')
    expect(after).not.toMatch(RAW_KEY)
  })

  it('printed: the printable blank, with the edited prompts; a long prompt wraps in full', () => {
    const html = paper({ worksheet: draft({ ...base, end: 'How does the dragon feel at the end?' }) })
    expect(html).toContain('data-testid="assignment-sheet"')
    expect(html).toContain('How does the dragon feel at the end?')
    expect(html).toContain('data-box="end"') // the library's one-page layout
    const long = 'Tell me about the ending of your story in lots of detail, including who was there, what they said, how they felt about it, and what you would change if you could write it again tomorrow'
    const wrapped = paper({ worksheet: draft({ ...base, end: long }) })
    expect(wrapped).toContain(long)
    expect(wrapped).not.toContain('data-box="end"') // the full-wrap list
  })

  it('the acrostic word shows as the child will get it (cleaned like the API)', () => {
    const ws = { templateId: 'acrostic', prompts: { word: 'The word', lines: 'A line per letter' }, word: ' sun ' }
    expect(previewWorksheet(ws).word).toBe('SUN')
    const html = screen({ worksheet: ws })
    expect(html).toContain('>SUN<')
    expect(html).toMatch(/>S<[\s\S]*>U<[\s\S]*>N</)
    expect(previewWorksheet({ ...ws, word: '' }).word).toBe(null)
  })

  it('sits in the form: beside the fields on lg, Edit | Preview below', () => {
    const form = readFileSync('src/components/school/AssignmentForm.jsx', 'utf8')
    expect(form).toContain('<AssignPreview worksheet={worksheet} title={title} prompt={prompt} />')
    expect(form).toContain("showPreview ? 'lg:max-w-6xl' : ''")
    expect(form).toContain('lg:grid lg:grid-cols-2')
    expect(form).toMatch(/className="lg:hidden flex gap-1/)
  })
})

describe('student-facing views stay out of the teacher scope', () => {
  it('the child\'s fill-in view and its shared boxes never carry teacher-ui', () => {
    for (const f of ['src/components/school/WorksheetFill.jsx', 'src/components/school/WorksheetFillBody.jsx']) {
      expect(readFileSync(f, 'utf8'), f).not.toContain('teacher-ui')
    }
  })
})

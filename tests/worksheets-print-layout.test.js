// Every printable sheet is ONE US Letter page (teacher round 6B). The page
// is a fixed 8.5 x 11in box with overflow hidden, so a layout that is too
// tall wouldn't spill onto a second page — it would silently lose its last
// boxes. printLayout gives every block of the generic body an exact height
// in inches and GenericSheetBody draws them at exactly that height; this
// pins that every template's body fits the budget left after the margins,
// title, header, "today's prompt", and footer.
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import en from '../src/i18n/locales/en/index.js'
import itLocale from '../src/i18n/locales/it/index.js'
import { WORKSHEET_TEMPLATES, boxIds } from '../lib/school/worksheets.js'
import {
  printLayout, layoutBoxIds, BODY_BUDGET_IN, SHEET_IN, CHROME_IN, LABEL_IN, LINE_IN,
  BESPOKE_IN, bespokeHeight, labelCharLimit, labelsFit,
} from '../src/lib/worksheets/printLayout.js'
import WorksheetSheet, { SHEET_BODIES } from '../src/components/worksheets/sheets.jsx'

describe('printLayout: every sheet fits one Letter page', () => {
  it('the body budget is what a Letter page leaves after the margins and the chrome', () => {
    expect(SHEET_IN).toEqual({ width: 8.5, height: 11, margin: 0.5 })
    expect(BODY_BUDGET_IN).toBeCloseTo(11 - 1 - Object.values(CHROME_IN).reduce((a, n) => a + n, 0), 5)
    expect(BODY_BUDGET_IN).toBeGreaterThan(6.5)
  })

  for (const t of WORKSHEET_TEMPLATES) {
    it(`${t.id}: fits (${printLayout(t).height}in of ${BODY_BUDGET_IN}in), every box placed once, with room to write`, () => {
      const layout = printLayout(t)
      expect(layout.height).toBeLessThanOrEqual(BODY_BUDGET_IN)
      expect([...layoutBoxIds(layout)].sort()).toEqual([...boxIds(t)].sort())
      for (const row of layout.rows) {
        expect(row.boxes.length).toBeLessThanOrEqual(3)
        for (const b of row.boxes) {
          expect(b.lines, `${t.id}:${b.id}`).toBeGreaterThanOrEqual(1)
          expect(b.height).toBeGreaterThanOrEqual(LABEL_IN + LINE_IN)
        }
      }
      if (t.print?.picture) {
        expect(['top', 'bottom']).toContain(t.print.picture.at)
        expect(t.print.picture.height).toBeGreaterThanOrEqual(1)
      }
      if (t.print?.body) expect(SHEET_BODIES[t.print.body], t.id).toBeTruthy()
    })
  }

  // The four hand-made bodies aren't laid out from boxes, but they draw every
  // block at a BESPOKE_IN height too (only a drawing box grows), so their
  // minimum height is a sum checked against the same budget.
  for (const name of ['sentence_starters', 'book_report', 'feelings_checkin', 'word_web']) {
    it(`hand-made ${name}: fits (${bespokeHeight(name)}in of ${BODY_BUDGET_IN}in)`, () => {
      expect(WORKSHEET_TEMPLATES.find((t) => t.print?.body === name), name).toBeTruthy()
      expect(BESPOKE_IN[name]).toBeTruthy()
      expect(bespokeHeight(name)).toBeLessThanOrEqual(BODY_BUDGET_IN)
    })
  }

  it('every hand-made body the catalogue names has a budget', () => {
    for (const t of WORKSHEET_TEMPLATES) if (t.print?.body) expect(bespokeHeight(t.print.body), t.id).not.toBeNull()
  })

  it('every default prompt (EN and IT) fits its two-line label, so the library sheets never clip one', () => {
    for (const lang of ['en', 'it']) {
      const school = (lang === 'en' ? en : itLocale).school.worksheet.templates
      for (const t of WORKSHEET_TEMPLATES) {
        expect(labelsFit(t.id, school[t.id].boxes), `${lang}:${t.id}`).toBe(true)
      }
    }
    expect([labelCharLimit(1), labelCharLimit(2), labelCharLimit(3)]).toEqual([156, 76, 48])
  })

  it('unknown templates have no layout', () => {
    expect(printLayout('nope')).toBeNull()
  })
})

async function makeI18n() {
  const instance = i18next.createInstance()
  await instance.init({
    resources: { en, it: itLocale }, lng: 'en', fallbackLng: false,
    ns: ['worksheets', 'school', 'checkin', 'games'], defaultNS: 'worksheets',
    interpolation: { escapeValue: false },
  })
  return instance
}

describe('every sheet renders, in English and Italian, with real copy', () => {
  for (const lang of ['en', 'it']) {
    it(`${lang}: heading, every box label, no raw keys`, async () => {
      const i18n = await makeI18n()
      const school = (lang === 'en' ? en : itLocale).school.worksheet.templates
      for (const t of WORKSHEET_TEMPLATES) {
        const html = renderToStaticMarkup(createElement(WorksheetSheet, {
          templateId: t.id,
          t: i18n.getFixedT(lang, 'worksheets'),
          tSchool: i18n.getFixedT(lang),
          tCheckin: i18n.getFixedT(lang, 'checkin'),
          tGames: i18n.getFixedT(lang, 'games'),
          prompt: 'Write about a dragon',
        }))
        const plain = html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
        expect(plain, `${lang}:${t.id}`).toContain(school[t.id].heading)
        expect(html).not.toMatch(/worksheet\.templates\.|sheet\.[a-z_]+\.[a-z_]+|undefined/)
        if (t.id === 'sentence_starters') continue // the starter strip, not the boxes
        for (const id of boxIds(t)) {
          if (t.id === 'feelings_checkin' && id === 'feeling') continue // the circles are the answer
          expect(plain, `${lang}:${t.id}:${id}`).toContain(school[t.id].boxes[id])
        }
        if (school[t.id].picture) expect(plain, `${lang}:${t.id}`).toContain(school[t.id].picture)
      }
    })
  }

  it('an old printable alias still prints its sheet', async () => {
    const i18n = await makeI18n()
    const html = renderToStaticMarkup(createElement(WorksheetSheet, {
      templateId: 'story-map', t: i18n.getFixedT('en', 'worksheets'), tSchool: i18n.getFixedT('en'),
      tCheckin: i18n.getFixedT('en', 'checkin'), tGames: i18n.getFixedT('en', 'games'),
    }))
    expect(html).toContain('data-template="beginning_middle_end"')
    expect(html).toContain(en.school.worksheet.templates.beginning_middle_end.heading)
  })
})

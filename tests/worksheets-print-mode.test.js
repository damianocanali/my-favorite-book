// printMode.js generalized (brief §3) to add a `print-worksheets` mode
// alongside the existing sign-in-cards one, on the same
// html-class-plus-injected-@page mechanism — see school-print-mode.test.js
// for the cards-mode contract this must NOT break, and printMode.js's own
// header comment for why the @page rule is injected fresh per print job
// rather than baked into index.css.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  enterCardsPrintMode, exitCardsPrintMode,
  enterWorksheetsPrintMode, exitWorksheetsPrintMode,
} from '../src/components/school/printMode.js'

function makeFakeDocument() {
  const classes = new Set()
  const headChildren = []
  return {
    documentElement: {
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
      },
    },
    head: {
      appendChild: (el) => headChildren.push(el),
      removeChild: (el) => {
        const i = headChildren.indexOf(el)
        if (i !== -1) headChildren.splice(i, 1)
      },
    },
    getElementById: (id) => headChildren.find((el) => el.id === id) ?? null,
    createElement: () => ({ id: '', textContent: '' }),
    _classes: classes,
    _headChildren: headChildren,
  }
}

describe('enterWorksheetsPrintMode / exitWorksheetsPrintMode', () => {
  let doc

  beforeEach(() => {
    doc = makeFakeDocument()
  })

  it('enter adds the html class and an injected @page style', () => {
    enterWorksheetsPrintMode(doc)
    expect(doc._classes.has('print-worksheets')).toBe(true)
    const style = doc.getElementById('worksheets-page')
    expect(style).toBeTruthy()
    expect(style.textContent).toMatch(/@page/)
    expect(style.textContent).toMatch(/size:\s*letter/)
  })

  it('enter does not inject a second style tag if called twice', () => {
    enterWorksheetsPrintMode(doc)
    enterWorksheetsPrintMode(doc)
    expect(doc._headChildren.filter((el) => el.id === 'worksheets-page')).toHaveLength(1)
  })

  it('exit removes both the html class and the injected style', () => {
    enterWorksheetsPrintMode(doc)
    exitWorksheetsPrintMode(doc)
    expect(doc._classes.has('print-worksheets')).toBe(false)
    expect(doc.getElementById('worksheets-page')).toBeNull()
  })

  it('exit is idempotent', () => {
    expect(() => exitWorksheetsPrintMode(doc)).not.toThrow()
    enterWorksheetsPrintMode(doc)
    exitWorksheetsPrintMode(doc)
    expect(() => exitWorksheetsPrintMode(doc)).not.toThrow()
  })

  it('never touches the cards print-mode class or style tag', () => {
    enterCardsPrintMode(doc)
    enterWorksheetsPrintMode(doc)
    expect(doc._classes.has('print-signin-cards')).toBe(true)
    expect(doc._classes.has('print-worksheets')).toBe(true)
    exitWorksheetsPrintMode(doc)
    expect(doc._classes.has('print-signin-cards')).toBe(true)
    expect(doc.getElementById('signin-cards-page')).toBeTruthy()
    exitCardsPrintMode(doc)
  })
})

describe('index.css worksheets print scope (static)', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const lines = css.split('\n')
  const worksheetsLines = lines.filter((l) => l.includes('.worksheets-print') && l.includes('{'))

  it('has at least one .worksheets-print rule', () => {
    expect(worksheetsLines.length).toBeGreaterThan(0)
  })

  it('every .worksheets-print selector line is scoped under html.print-worksheets, except the unconditional hide-on-screen rule', () => {
    const isBaseHideRule = (l) => /^\.worksheets-print\s*\{\s*display:\s*none;?\s*\}\s*$/.test(l.trim())
    const unscoped = worksheetsLines.filter((l) => !isBaseHideRule(l) && !l.includes('print-worksheets'))
    expect(unscoped, `Unscoped .worksheets-print rules:\n${unscoped.join('\n')}`).toEqual([])
  })

  it('explicitly hides #root under html.print-worksheets', () => {
    const offenders = lines.filter((l) => /print-worksheets.*#root/.test(l) || /#root.*print-worksheets/.test(l))
    expect(offenders.length).toBeGreaterThan(0)
    const hasRootHide = offenders.some((l, idx) => /display:\s*none/.test(l) || lines[lines.indexOf(l) + 1]?.includes('display: none'))
    expect(hasRootHide).toBe(true)
  })
})

describe('WorksheetsPage prints its sheets through a portal (static)', () => {
  const src = readFileSync('src/pages/WorksheetsPage.jsx', 'utf8')

  it('imports createPortal from react-dom', () => {
    expect(src).toMatch(/import\s*\{[^}]*createPortal[^}]*\}\s*from\s*['"]react-dom['"]/)
  })

  it('portals the print-only sheets to document.body, tagged .worksheets-print', () => {
    expect(src).toMatch(/createPortal\(/)
    const portalCall = src.slice(src.indexOf('createPortal('))
    expect(portalCall).toMatch(/document\.body/)
    expect(portalCall.slice(0, portalCall.indexOf('document.body'))).toMatch(/worksheets-print/)
  })
})

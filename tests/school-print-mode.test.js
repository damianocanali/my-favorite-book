// Two things pinned here, both load-bearing for the fix in this round:
//
//  1. enterCardsPrintMode/exitCardsPrintMode (src/components/school/
//     printMode.js) actually add/remove the <html> class and the injected
//     `@page` <style> tag, and do so idempotently — exercised against a
//     minimal fake `document`, no jsdom needed.
//  2. Every `.signin-cards` rule in src/index.css is nested under
//     `html.print-signin-cards`, and no unscoped `body *` visibility rule
//     exists — a regression here is exactly what made ordinary book
//     printing render blank pages before this fix.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { enterCardsPrintMode, exitCardsPrintMode } from '../src/components/school/printMode.js'

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

describe('enterCardsPrintMode / exitCardsPrintMode', () => {
  let doc

  beforeEach(() => {
    doc = makeFakeDocument()
  })

  it('enter adds the html class and an injected @page style', () => {
    enterCardsPrintMode(doc)
    expect(doc._classes.has('print-signin-cards')).toBe(true)
    const style = doc.getElementById('signin-cards-page')
    expect(style).toBeTruthy()
    expect(style.textContent).toMatch(/@page/)
    expect(style.textContent).toMatch(/size:\s*letter/)
  })

  it('enter does not inject a second style tag if called twice', () => {
    enterCardsPrintMode(doc)
    enterCardsPrintMode(doc)
    expect(doc._headChildren.filter((el) => el.id === 'signin-cards-page')).toHaveLength(1)
  })

  it('exit removes both the html class and the injected style', () => {
    enterCardsPrintMode(doc)
    exitCardsPrintMode(doc)
    expect(doc._classes.has('print-signin-cards')).toBe(false)
    expect(doc.getElementById('signin-cards-page')).toBeNull()
  })

  it('exit is idempotent — safe to call when never entered, or twice in a row', () => {
    expect(() => exitCardsPrintMode(doc)).not.toThrow()
    enterCardsPrintMode(doc)
    exitCardsPrintMode(doc)
    expect(() => exitCardsPrintMode(doc)).not.toThrow()
    expect(doc._classes.has('print-signin-cards')).toBe(false)
  })
})

describe('index.css sign-in cards print scope (static)', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const lines = css.split('\n')
  const signinCardsLines = lines.filter((l) => l.includes('.signin-cards'))

  it('has at least one .signin-cards rule to check', () => {
    expect(signinCardsLines.length).toBeGreaterThan(0)
  })

  it('every .signin-cards selector line is scoped under html.print-signin-cards', () => {
    const unscoped = signinCardsLines.filter((l) => !l.includes('print-signin-cards'))
    expect(unscoped, `Unscoped .signin-cards rules:\n${unscoped.join('\n')}`).toEqual([])
  })

  it('has no top-level (unscoped) `body *` rule', () => {
    // Match an actual selector (ends in `{`), not this file's own prose —
    // the comment above this block talks about `body *` in English too.
    const offenders = lines.filter((l) => /\bbody\s+\*\s*\{/.test(l) && !l.includes('print-signin-cards'))
    expect(offenders, `Unscoped 'body *' rules:\n${offenders.join('\n')}`).toEqual([])
  })

  it('does not declare its own @page (letter size is injected at print time, not baked into the stylesheet)', () => {
    // A bare @page here would sit in the same always-on stylesheet as the
    // Lulu book's @page rule and — since @page isn't scoped by which
    // element is visible — whichever comes later in the file would win for
    // every print job, book pages included.
    const cardsSectionStart = css.indexOf('Sign-in cards print')
    const cardsSectionEnd = css.indexOf('\n}\n', css.indexOf('@media print', cardsSectionStart))
    const cardsSection = css.slice(cardsSectionStart, cardsSectionEnd)
    expect(cardsSection).not.toMatch(/@page/)
  })
})

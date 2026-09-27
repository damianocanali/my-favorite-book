// Three things pinned here, all load-bearing for the fix in this round:
//
//  1. enterCardsPrintMode/exitCardsPrintMode (src/components/school/
//     printMode.js) actually add/remove the <html> class and the injected
//     `@page` <style> tag, and do so idempotently — exercised against a
//     minimal fake `document`, no jsdom needed.
//  2. Every `.signin-cards` rule in src/index.css other than its one
//     unconditional "hidden by default" rule is nested under
//     `html.print-signin-cards`, that mode explicitly hides `#root` itself
//     (rather than relying on the pre-existing, unrelated book-printing
//     rule to keep doing that), and no unscoped `body *` visibility rule
//     exists.
//  3. SignInCards.jsx renders its printable copy through a `createPortal`
//     to `document.body` — a sibling of #root, not a descendant — which is
//     the whole reason any of this works: `display:none` on #root (from
//     the pre-existing book-printing rule, which always applies during
//     every print job) can't be undone by anything on a descendant, so an
//     element rendered inside #root, however it's styled, can never be
//     what ends up on the printed page.
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
  // Only actual selector lines (end in `{`), not this file's own prose —
  // the comment above this block talks about .signin-cards in English too.
  const signinCardsLines = lines.filter((l) => l.includes('.signin-cards') && l.includes('{'))
  // The one allowed unscoped line: the unconditional "hidden on screen by
  // default" rule for the print-only portal element.
  const isBaseHideRule = (l) => /^\.signin-cards\s*\{\s*display:\s*none;?\s*\}\s*$/.test(l.trim())

  it('has at least one .signin-cards rule to check', () => {
    expect(signinCardsLines.length).toBeGreaterThan(0)
  })

  it('has exactly one unconditional rule hiding .signin-cards on screen by default', () => {
    const baseRules = signinCardsLines.filter(isBaseHideRule)
    expect(baseRules).toHaveLength(1)
  })

  it('every other .signin-cards selector line is scoped under html.print-signin-cards', () => {
    const unscoped = signinCardsLines.filter((l) => !isBaseHideRule(l) && !l.includes('print-signin-cards'))
    expect(unscoped, `Unscoped .signin-cards rules:\n${unscoped.join('\n')}`).toEqual([])
  })

  it('explicitly hides #root under html.print-signin-cards, independent of the book-printing rule', () => {
    const offenders = lines.filter((l) => /print-signin-cards.*#root/.test(l) || /#root.*print-signin-cards/.test(l))
    const hasRootHide = offenders.some((l) => /display:\s*none/.test(l) || lines[lines.indexOf(l) + 1]?.includes('display: none'))
    expect(offenders.length, 'No html.print-signin-cards rule mentions #root at all').toBeGreaterThan(0)
    expect(hasRootHide, `Found a #root rule under print-signin-cards, but none of them hide it:\n${offenders.join('\n')}`).toBe(true)
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

describe('SignInCards renders its printable copy through a portal (static)', () => {
  const src = readFileSync('src/components/school/SignInCards.jsx', 'utf8')

  it('imports createPortal from react-dom', () => {
    expect(src).toMatch(/import\s*\{[^}]*createPortal[^}]*\}\s*from\s*['"]react-dom['"]/)
  })

  it('portals the .signin-cards element to document.body', () => {
    expect(src).toMatch(/createPortal\(/)
    expect(src).toMatch(/document\.body/)
    // The portalled subtree — not just the file somewhere — carries the
    // class the print CSS targets.
    const portalCall = src.slice(src.indexOf('createPortal('))
    expect(portalCall.slice(0, portalCall.indexOf('document.body'))).toMatch(/signin-cards/)
  })
})

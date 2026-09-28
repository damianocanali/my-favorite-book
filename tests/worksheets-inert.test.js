// Review round 1 fix: the Customize panel (a body-level portal, same
// portal-out-of-#root pattern as everything else in task WS) needs to keep
// the rest of the page out of the Tab order and away from assistive tech
// while it's open — a real Tab/Shift+Tab cycle inside the panel is one way
// to do that; marking #root `inert` while the panel is open is the other,
// and is what this app uses (src/components/worksheets/inert.js): the
// browser itself then refuses to focus or announce anything under #root,
// for as long as the attribute is present, without CustomizePanel needing
// to enumerate focusable elements itself. Lives in src/lib/worksheets/ next
// to the rest of task WS's pure helpers, not src/components/.
import { describe, it, expect, beforeEach } from 'vitest'
import { enterInertBackground, exitInertBackground } from '../src/lib/worksheets/inert.js'

function makeFakeDocument() {
  const attrs = new Map()
  const root = {
    setAttribute: (k, v) => attrs.set(k, v),
    removeAttribute: (k) => attrs.delete(k),
    hasAttribute: (k) => attrs.has(k),
    _attrs: attrs,
  }
  return {
    getElementById: (id) => (id === 'root' ? root : null),
    _root: root,
  }
}

describe('enterInertBackground / exitInertBackground', () => {
  let doc

  beforeEach(() => {
    doc = makeFakeDocument()
  })

  it('enter marks #root inert', () => {
    enterInertBackground(doc)
    expect(doc._root.hasAttribute('inert')).toBe(true)
  })

  it('exit removes it again', () => {
    enterInertBackground(doc)
    exitInertBackground(doc)
    expect(doc._root.hasAttribute('inert')).toBe(false)
  })

  it('is idempotent both ways', () => {
    expect(() => exitInertBackground(doc)).not.toThrow()
    enterInertBackground(doc)
    enterInertBackground(doc)
    expect(doc._root.hasAttribute('inert')).toBe(true)
    exitInertBackground(doc)
    exitInertBackground(doc)
    expect(doc._root.hasAttribute('inert')).toBe(false)
  })

  it('does nothing (never throws) if #root is missing', () => {
    const empty = { getElementById: () => null }
    expect(() => enterInertBackground(empty)).not.toThrow()
    expect(() => exitInertBackground(empty)).not.toThrow()
  })
})

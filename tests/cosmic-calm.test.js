// The teacher area's backdrop is still: same gradient, no animated layers.
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CosmicBackground from '../src/components/layout/CosmicBackground.jsx'

describe('CosmicBackground', () => {
  it('calm: gradient only — no twinkle, drift or sparkle layers', () => {
    const html = renderToStaticMarkup(createElement(CosmicBackground, { calm: true }))
    expect(html).toContain('data-cosmic-style="calm"')
    expect(html).toContain('linear-gradient(135deg, #0D0A29')
    expect(html).not.toMatch(/animate-|cosmic-sparkle|<svg/)
  })

  it('default (kids): keeps the animated starfield', () => {
    const html = renderToStaticMarkup(createElement(CosmicBackground))
    expect(html).toContain('animate-twinkle')
    expect(html).toContain('cosmic-sparkle')
  })
})

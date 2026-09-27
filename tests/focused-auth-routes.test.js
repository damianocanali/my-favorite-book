// isFocusedAuthRoute decides whether AppShell renders its stripped-down
// header (logo + language toggle + Back, no tab bar, no Pricing/Play/Sign
// Up) for a given route. Exercised as a pure function here so the route
// list has one tested source of truth without rendering AppShell.
import { describe, it, expect } from 'vitest'
import { FOCUSED_AUTH_ROUTES, isFocusedAuthRoute } from '../src/lib/focusedAuthRoutes.js'

describe('isFocusedAuthRoute', () => {
  it('is true for every route the brief lists', () => {
    for (const path of ['/login', '/signup', '/class', '/reset-password', '/auth/callback']) {
      expect(isFocusedAuthRoute(path)).toBe(true)
    }
  })

  it('matches the exported route list exactly', () => {
    expect(FOCUSED_AUTH_ROUTES).toEqual(['/login', '/signup', '/class', '/reset-password', '/auth/callback'])
  })

  it('is false for ordinary app routes', () => {
    for (const path of ['/', '/bookshelf', '/create', '/pricing', '/account', '/teacher']) {
      expect(isFocusedAuthRoute(path)).toBe(false)
    }
  })

  it('does not match a route by prefix', () => {
    // /teacher/class/:id must keep the full chrome — only the exact
    // listed paths are focused.
    expect(isFocusedAuthRoute('/teacher/class/123')).toBe(false)
    expect(isFocusedAuthRoute('/login/extra')).toBe(false)
  })

  it('is false for an empty or malformed path', () => {
    expect(isFocusedAuthRoute('')).toBe(false)
    expect(isFocusedAuthRoute('login')).toBe(false)
  })
})

// safeNext gates the `?next=` query param ProtectedRoute attaches to
// /login and LoginPage reads back after a successful sign-in. That param
// is attacker-controlled input reachable via a plain login link, so it
// must only ever accept a same-site relative path — never a full URL or
// a protocol-relative "//evil.com" (browsers treat a leading "//" as
// off-site), both classic open-redirect payloads.
import { describe, it, expect } from 'vitest'
import { safeNext } from '../src/lib/safeNext.js'

describe('safeNext', () => {
  it('passes through an ordinary same-site path', () => {
    expect(safeNext('/teacher')).toBe('/teacher')
  })

  it('passes through a path with a query string', () => {
    expect(safeNext('/teacher/class/123?tab=roster')).toBe('/teacher/class/123?tab=roster')
  })

  it('rejects a protocol-relative URL ("//evil.com" is off-site to a browser)', () => {
    expect(safeNext('//evil.com')).toBeNull()
  })

  it('rejects an absolute URL', () => {
    expect(safeNext('https://evil.com')).toBeNull()
  })

  it('rejects a path that does not start with "/"', () => {
    expect(safeNext('teacher')).toBeNull()
  })

  it('rejects null, undefined, and empty string', () => {
    expect(safeNext(null)).toBeNull()
    expect(safeNext(undefined)).toBeNull()
    expect(safeNext('')).toBeNull()
  })

  it('rejects a non-string value', () => {
    expect(safeNext(42)).toBeNull()
  })
})

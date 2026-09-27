// safeNext gates the `?next=` query param ProtectedRoute attaches to
// /login and LoginPage reads back after a successful sign-in. That param
// is attacker-controlled input reachable via a plain login link, so it
// must only ever accept a same-site relative path — never a full URL, a
// protocol-relative "//evil.com" (browsers treat a leading "//" as
// off-site), or a backslash variant of the same trick (a browser's URL
// parser treats a leading "\" the same as "/", so "/\evil.com" is
// ALSO off-site) — all classic open-redirect payloads.
import { describe, it, expect } from 'vitest'
import { safeNext } from '../src/lib/safeNext.js'

describe('safeNext', () => {
  it('passes through an ordinary same-site path', () => {
    expect(safeNext('/teacher')).toBe('/teacher')
  })

  it('passes through a path with a query string', () => {
    expect(safeNext('/teacher/class/123?tab=roster')).toBe('/teacher/class/123?tab=roster')
  })

  it('round-trips a path with a query string and a hash', () => {
    expect(safeNext('/teacher/class/abc?x=1#y')).toBe('/teacher/class/abc?x=1#y')
  })

  it('rejects a protocol-relative URL ("//evil.com" is off-site to a browser)', () => {
    expect(safeNext('//evil.com')).toBeNull()
  })

  it('rejects an absolute URL', () => {
    expect(safeNext('https://evil.com')).toBeNull()
  })

  it('rejects a javascript: URL', () => {
    expect(safeNext('javascript:alert(1)')).toBeNull()
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

  // A naive "starts with / and not //" prefix check (the previous
  // implementation) waves these straight through: a browser's URL parser
  // normalizes a leading backslash to a forward slash before it ever
  // looks at the host, so each of these is protocol-relative to
  // evil.com in a real navigation despite starting with "/", not "//".
  it('rejects "/\\evil.com" (leading backslash normalizes to protocol-relative)', () => {
    expect(safeNext('/\\evil.com')).toBeNull()
  })

  it('rejects "/\\/evil.com" (slash-backslash-slash, same normalization)', () => {
    expect(safeNext('/\\/evil.com')).toBeNull()
  })

  it('rejects "\\\\evil.com" (no leading "/" at all, so the prefix check alone still catches it)', () => {
    expect(safeNext('\\\\evil.com')).toBeNull()
  })

  it('keeps a percent-encoded backslash as a literal same-origin path segment, never decoded into a path separator', () => {
    const result = safeNext('/%5Cevil.com')
    expect(result).toBe('/%5Cevil.com')
    // Belt-and-braces: whatever safeNext returns must itself resolve
    // same-origin — this is the property every case above is really
    // testing for.
    expect(new URL(result, 'https://app.test').origin).toBe('https://app.test')
  })

  it('never resolves an accepted value to a cross-origin target', () => {
    const attempts = [
      '/\\evil.com', '/\\/evil.com', '\\\\evil.com', '/%5Cevil.com',
      '//evil.com', 'https://evil.com', 'javascript:alert(1)',
    ]
    for (const attempt of attempts) {
      const result = safeNext(attempt)
      if (result !== null) {
        expect(new URL(result, 'https://app.test').origin).toBe('https://app.test')
      }
    }
  })
})

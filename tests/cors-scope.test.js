// Guards the CORS wiring in api/.
//
// Two rules, both learned the hard way while removing the wildcard from
// vercel.json:
//
// 1. withCors() must be called WITH req. Without it the helper falls back to a
//    hardcoded 'Access-Control-Allow-Origin: *', which silently defeats the
//    ALLOWED_ORIGINS allowlist in _rateLimit.js. 52 of 67 call sites were doing
//    exactly that.
//
// 2. req must actually be in scope where it is passed. Several responses are
//    built inside small helpers — unauthorized(), bad() — that did not take
//    req, so adding it produced a ReferenceError that crashes the response
//    instead of returning it. Syntax checks and the build do not catch this:
//    it is a runtime error on an error path, which is the least-tested code in
//    any handler.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

// Same iCloud sync-copy exclusion as tests/i18n-keys.test.js — see there.
const SYNC_COPY = / \d+\.[a-z]+$/

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (extname(p) === '.js' && !SYNC_COPY.test(p)) out.push(p)
  }
  return out
}

const FILES = walk('api').filter((f) => readFileSync(f, 'utf8').includes('withCors('))

/// The nearest enclosing function signature above a line.
function enclosingSignature(lines, lineIndex) {
  for (let i = lineIndex; i >= 0; i--) {
    if (/(function\s+\w*\s*\(|async\s+function|=>\s*\{)/.test(lines[i])) return lines[i]
  }
  return ''
}

describe('api CORS wiring', () => {
  it('has files to check', () => {
    // A rename that empties this list would make every assertion below vacuous.
    expect(FILES.length).toBeGreaterThan(10)
  })

  it('never calls withCors() without req', () => {
    const offenders = []
    for (const f of FILES) {
      if (f.endsWith('_rateLimit.js')) continue // defines the fallback itself
      const src = readFileSync(f, 'utf8')
      for (const [i, line] of src.split('\n').entries()) {
        if (!line.includes('withCors(')) continue
        if (!/withCors\([^)]*,\s*req\s*\)/.test(line)) offenders.push(`${f}:${i + 1}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('only passes req where req is actually in scope', () => {
    const offenders = []
    for (const f of FILES) {
      const lines = readFileSync(f, 'utf8').split('\n')
      for (const [i, line] of lines.entries()) {
        if (!(line.includes('withCors(') && /,\s*req\s*\)/.test(line))) continue
        const sig = enclosingSignature(lines, i)
        // `handler(req)` is the entry point; any helper must name req itself.
        if (!/\breq\b/.test(sig) && !/handler/.test(sig)) offenders.push(`${f}:${i + 1} — ${sig.trim()}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('vercel.json does not force a wildcard CORS header', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'))
    const headers = JSON.stringify(vercel.headers ?? [])
    // A static header here overrides every per-handler decision, which is how
    // the allowlist was defeated in the first place.
    expect(headers).not.toContain('Access-Control-Allow-Origin')
  })
})

// String extraction is OFF in ios-native/project.yml (Xcode no longer
// rewrites Localizable.xcstrings on build), so nothing adds a new key to the
// catalog by itself any more. A key missing from the catalog still renders
// its English default — so a forgotten Italian string is invisible in an
// English build and only shows up as English text in an Italian classroom.
//
// This walks every AppText("…") and String(appLocalized: "…") key literal in
// ios-native/MyBookLab/**/*.swift and checks that the catalog has it with a
// non-empty Italian value. Interpolated keys (AppText("Updated \(n)×")) are
// matched against the catalog's format form ("Updated %lld×").
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'ios-native/MyBookLab'
// iCloud sync copies ("Foo 2.swift") are excluded from the build too.
const SYNC_COPY = / \d+\.swift$/

function swiftFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) swiftFiles(p, out)
    else if (p.endsWith('.swift') && !SYNC_COPY.test(p)) out.push(p)
  }
  return out
}

// Reads the Swift string literal starting at src[i] === '"', honouring
// escapes and \( … ) interpolations (which may themselves hold strings).
// Returns { raw, parts } where parts alternates text and null (an
// interpolation), or null for a multi-line/raw literal we don't parse.
function readLiteral(src, i) {
  if (src[i] !== '"' || src.startsWith('"""', i)) return null
  const parts = ['']
  let j = i + 1
  while (j < src.length) {
    const c = src[j]
    if (c === '"') return { parts, end: j + 1 }
    if (c === '\n') return null
    if (c === '\\') {
      const n = src[j + 1]
      if (n === '(') {
        // Skip to the matching paren, stepping over nested string literals.
        let depth = 1
        let k = j + 2
        while (k < src.length && depth) {
          if (src[k] === '"') {
            const inner = readLiteral(src, k)
            if (!inner) return null
            k = inner.end
            continue
          }
          if (src[k] === '(') depth++
          else if (src[k] === ')') depth--
          k++
        }
        parts.push(null, '')
        j = k
        continue
      }
      const esc = { n: '\n', t: '\t', '"': '"', "'": "'", '\\': '\\', 0: '\0' }[n]
      if (esc !== undefined) parts[parts.length - 1] += esc
      else if (n === 'u') {
        const m = src.slice(j).match(/^\\u\{([0-9a-fA-F]+)\}/)
        if (!m) return null
        parts[parts.length - 1] += String.fromCodePoint(parseInt(m[1], 16))
        j += m[0].length
        continue
      } else return null
      j += 2
      continue
    }
    parts[parts.length - 1] += c
    j++
  }
  return null
}

function keyUses() {
  const uses = []
  const re = /\b(AppText\(|String\(appLocalized:)\s*/g
  for (const file of swiftFiles(ROOT)) {
    const src = readFileSync(file, 'utf8')
    // The AppText function definitions themselves are not uses.
    if (file.endsWith('AppLanguage.swift')) continue
    let m
    while ((m = re.exec(src))) {
      const at = m.index + m[0].length
      if (src[at] !== '"') continue // a variable, not a literal key
      const lit = readLiteral(src, at)
      if (!lit) continue
      const line = src.slice(0, m.index).split('\n').length
      uses.push({ file, line, parts: lit.parts })
    }
  }
  return uses
}

const catalog = JSON.parse(readFileSync(`${ROOT}/Localizable.xcstrings`, 'utf8')).strings
const keys = Object.keys(catalog)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// %@, %lld, %d, %f, %.1f, positional %1$@ …
const FORMAT = '%(?:\\d+\\$)?[-+ #0]*\\d*(?:\\.\\d+)?(?:ll|l|h)?[@dDuUxXoOfFeEgGcCsSaA]'

function catalogKeyFor(parts) {
  if (parts.length === 1) return catalog[parts[0]] ? parts[0] : null
  const re = new RegExp(`^${parts.map((p) => (p === null ? FORMAT : esc(p))).join('')}$`)
  return keys.find((k) => re.test(k)) ?? null
}

const itValue = (entry) =>
  entry?.localizations?.it?.stringUnit?.value ??
  // Plural / device variations: any non-empty Italian variant counts.
  JSON.stringify(entry?.localizations?.it?.variations ?? '').match(/"value":"([^"]+)"/)?.[1]

describe('iOS string catalog covers every key in code (extraction is off)', () => {
  const uses = keyUses()

  it('finds the keys (sanity: the scanner works)', () => {
    expect(uses.length).toBeGreaterThan(500)
    expect(uses.some((u) => u.parts[0] === 'school.grading.levels.wow')).toBe(true)
  })

  it('every AppText / String(appLocalized:) key literal is in Localizable.xcstrings with an Italian value', () => {
    const missing = []
    const noItalian = []
    for (const u of uses) {
      const key = catalogKeyFor(u.parts)
      const where = `${u.file}:${u.line} ${u.parts.map((p) => p ?? '\\(…)').join('')}`
      if (!key) missing.push(where)
      else if (!itValue(catalog[key])?.trim()) noItalian.push(where)
    }
    expect(missing, `missing from the catalog:\n${missing.join('\n')}`).toEqual([])
    expect(noItalian, `no Italian value:\n${noItalian.join('\n')}`).toEqual([])
  })
})

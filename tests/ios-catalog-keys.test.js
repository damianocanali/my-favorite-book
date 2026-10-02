// String extraction is OFF in ios-native/project.yml (Xcode no longer
// rewrites Localizable.xcstrings on build), so nothing adds a new key to the
// catalog by itself any more. A key missing from the catalog still renders
// its English default — so a forgotten Italian string is invisible in an
// English build and only shows up as English text in an Italian classroom.
//
// This walks every localized key literal in ios-native/MyBookLab/**/*.swift —
// AppText("…"), String(appLocalized: "…"), and the SwiftUI initialisers that
// take a LocalizedStringKey literal (Text, Label, Button, TextField, Toggle,
// .navigationTitle, .accessibilityLabel; never `verbatim:`) when the literal
// has a letter in it — and checks that the catalog has it with a non-empty
// Italian value that isn't just the English copied over (multi-word strings;
// brand names and the like are allowlisted). Interpolated keys
// (AppText("Updated \(n)×")) are matched against the catalog's format form
// ("Updated %lld×"). A literal the scanner can't read (multi-line, raw, an
// unknown escape) is a FAILURE, never silently skipped.
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

const CALLS = [
  'AppText\\(', 'String\\(appLocalized:',
  '\\bText\\(', '\\bLabel\\(', '\\bButton\\(', '\\bTextField\\(', '\\bToggle\\(',
  '\\.navigationTitle\\(', '\\.accessibilityLabel\\(',
]
const HAS_LETTER = /\p{L}/u

function keyUses() {
  const uses = []
  const unreadable = []
  const re = new RegExp(`(?:${CALLS.join('|')})\\s*`, 'g')
  for (const file of swiftFiles(ROOT)) {
    const src = readFileSync(file, 'utf8')
    // The AppText function definitions themselves are not uses.
    if (file.endsWith('AppLanguage.swift')) continue
    let m
    while ((m = re.exec(src))) {
      const at = m.index + m[0].length
      // A variable, `verbatim:`, a closure label… — not a literal key.
      if (src[at] !== '"' && !src.startsWith('#"', at)) continue
      const line = src.slice(0, m.index).split('\n').length
      // Skip comments: the scan is textual.
      const lineStart = src.lastIndexOf('\n', m.index) + 1
      if (/^\s*\/\//.test(src.slice(lineStart, m.index))) continue
      const lit = src[at] === '"' ? readLiteral(src, at) : null
      if (!lit) {
        unreadable.push(`${file}:${line}`)
        continue
      }
      const isAppText = m[0].startsWith('AppText') || m[0].startsWith('String')
      if (!isAppText && !lit.parts.some((p) => p && HAS_LETTER.test(p))) continue
      uses.push({ file, line, parts: lit.parts })
    }
  }
  return { uses, unreadable }
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

const enValue = (key, entry) => entry?.localizations?.en?.stringUnit?.value ?? key

// Multi-word strings whose Italian is legitimately the English text.
const SAME_IN_ITALIAN = new Set([
  'My Book Lab', // the app's name
  'Story Buddy', // the helper's name, kept in Italian too (as on the web)
  'avatar_style.pixel.label', // "Pixel Art" is the Italian term too
  // Catalogue characters keep the same given name in both languages, and
  // "Doc" / "Chef" read the same in Italian (src/i18n/locales/*/content.json).
  'content.characters.doctor.name',
  'content.characters.chef.name',
])

const itValue = (entry) =>
  entry?.localizations?.it?.stringUnit?.value ??
  // Plural / device variations: any non-empty Italian variant counts.
  JSON.stringify(entry?.localizations?.it?.variations ?? '').match(/"value":"([^"]+)"/)?.[1]

describe('iOS string catalog covers every key in code (extraction is off)', () => {
  const { uses, unreadable } = keyUses()

  it('every literal at a localized call site is one the scanner can read', () => {
    expect(unreadable, `unreadable literals (rewrite as a one-line literal, or extend the scanner):\n${unreadable.join('\n')}`).toEqual([])
  })

  it('finds the keys (sanity: the scanner works)', () => {
    expect(uses.length).toBeGreaterThan(500)
    expect(uses.some((u) => u.parts[0] === 'school.grading.levels.wow')).toBe(true)
    // SwiftUI literal sites are scanned too (e.g. the replace-draft dialog's Cancel).
    expect(uses.filter((u) => /StudentAssignmentsView/.test(u.file) && u.parts[0] === 'Cancel').length).toBeGreaterThan(0)
  })

  it('every localized key literal (AppText, String(appLocalized:), SwiftUI initialisers) is in the catalog with a real Italian value', () => {
    const missing = []
    const noItalian = []
    const copied = []
    for (const u of uses) {
      const key = catalogKeyFor(u.parts)
      const where = `${u.file}:${u.line} ${u.parts.map((p) => p ?? '\\(…)').join('')}`
      if (!key) { missing.push(where); continue }
      const it = itValue(catalog[key])?.trim()
      if (!it) { noItalian.push(where); continue }
      const en = enValue(key, catalog[key]).trim()
      if (it === en && /\p{L}+\s+\p{L}+/u.test(en) && !SAME_IN_ITALIAN.has(key)) copied.push(`${where}  (it = en: "${en}")`)
    }
    expect(missing, `missing from the catalog:\n${missing.join('\n')}`).toEqual([])
    expect(noItalian, `no Italian value:\n${noItalian.join('\n')}`).toEqual([])
    expect([...new Set(copied)], `Italian is the English copied over (translate, or allowlist in SAME_IN_ITALIAN):\n${[...new Set(copied)].join('\n')}`).toEqual([])
  })
})

// Stage 4, App Store 3.1.3: the iPad teacher area shows plan STATUS and
// seats, never a price. Every string a teacher screen uses (English and
// Italian catalog values, plurals included) and every literal in those
// files is checked for a currency sign or the word "price".
describe('no prices in the iOS teacher area (App Store 3.1.3)', () => {
  const { uses } = keyUses()
  const TEACHER_FILE = /(Views\/Teacher\/|Models\/TeacherModels\.swift|Stores\/TeacherStore\.swift)/
  const PRICEY = /[$€£]|\bprice|\bprezz|\bpricing\b|\bcost[is]?\b|\bcosto\b/i
  const strip = (s) => s.replace(new RegExp(FORMAT, 'g'), '')
  const values = (entry) => {
    const out = []
    for (const lang of ['en', 'it']) {
      const loc = entry?.localizations?.[lang]
      if (loc?.stringUnit?.value) out.push(loc.stringUnit.value)
      const m = JSON.stringify(loc?.variations ?? {}).matchAll(/"value":"([^"]*)"/g)
      for (const [, v] of m) out.push(v)
    }
    return out
  }

  it('scans the teacher files', () => {
    expect(uses.filter((u) => TEACHER_FILE.test(u.file)).length).toBeGreaterThan(150)
  })

  it('no catalog value used by a teacher screen mentions a price or a currency', () => {
    const bad = []
    for (const u of uses.filter((x) => TEACHER_FILE.test(x.file))) {
      const key = catalogKeyFor(u.parts)
      if (!key) continue
      for (const v of [enValue(key, catalog[key]), ...values(catalog[key])]) {
        if (PRICEY.test(strip(v))) bad.push(`${u.file}:${u.line} ${key} → "${v}"`)
      }
    }
    expect([...new Set(bad)]).toEqual([])
  })

  it('no string literal in the teacher files carries a currency amount', () => {
    const bad = []
    for (const file of swiftFiles(ROOT).filter((f) => TEACHER_FILE.test(f))) {
      const src = readFileSync(file, 'utf8')
      for (const [lit] of src.matchAll(/"(?:[^"\\\n]|\\.)*"/g)) {
        const text = lit.replace(/\\\([^)]*\)/g, '')
        if (/[$€£]\s?\d|\d\s?[$€£]|\bprice|\bprezz/i.test(text)) bad.push(`${file}: ${lit}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('the plan card says where to manage the plan as plain text, never a link', () => {
    const src = readFileSync(`${ROOT}/Views/Teacher/TeacherComponents.swift`, 'utf8')
    const card = src.slice(src.indexOf('struct TeacherPlanCard'), src.indexOf('struct TeacherVerificationCard'))
    expect(card).toMatch(/Text\(verbatim: String\(appLocalized: TeacherCopy\.planManageOnWeb\)\)/)
    expect(card).not.toMatch(/\bLink\(|openURL|URL\(string/)
  })
})

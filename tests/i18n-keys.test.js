// Two failure modes this catches, both invisible at build time:
//
//  1. A t('ns:some.key') call whose key was never added to the catalogue.
//     i18next renders the raw key string, so the UI shows "auth:sign_in.title"
//     to a user and nothing throws.
//  2. An Italian catalogue that has drifted from English — a missing key
//     (silently falls back to English forever) or a mismatched {{placeholder}}
//     (renders the literal braces).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const SRC = 'src'
const LOCALES = 'src/i18n/locales'

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (['.js', '.jsx'].includes(extname(p))) out.push(p)
  }
  return out
}

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else out[key] = v
  }
  return out
}

function loadLocale(locale) {
  const out = {}
  for (const f of readdirSync(join(LOCALES, locale))) {
    if (extname(f) !== '.json') continue
    const ns = f.replace(/\.json$/, '')
    out[ns] = flatten(JSON.parse(readFileSync(join(LOCALES, locale, f), 'utf8')))
  }
  return out
}

const en = loadLocale('en')
const it = loadLocale('it')

// i18next resolves `t('key', {count})` against key_one / key_other rather than
// `key` itself, so a plural key is present if either suffixed form exists.
function has(cat, ns, key) {
  const flat = cat[ns]
  if (!flat) return false
  return key in flat || `${key}_one` in flat || `${key}_other` in flat
}

describe('every t() key exists in the English catalogue', () => {
  const files = walk(SRC)
  // t('ns:a.b') and <Trans i18nKey="ns:a.b">. Only namespaced keys — a bare
  // t('x') would resolve against defaultNS and is not used in this codebase.
  const CALL = /\bt\(\s*['"]([a-z_]+):([a-zA-Z0-9_.]+)['"]/g
  const TRANS = /i18nKey=\s*['"]([a-z_]+):([a-zA-Z0-9_.]+)['"]/g

  const missing = []
  for (const file of files) {
    if (file.includes('/i18n/locales/')) continue
    const src = readFileSync(file, 'utf8')
    for (const re of [CALL, TRANS]) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(src))) {
        const [, ns, key] = m
        if (!has(en, ns, key)) missing.push(`${file}: ${ns}:${key}`)
      }
    }
  }

  it('has no unresolved keys', () => {
    expect(missing, `\n${missing.join('\n')}\n`).toEqual([])
  })
})

describe('Italian catalogue parity', () => {
  const namespaces = Object.keys(en)

  it('every namespace that has Italian has no extra keys', () => {
    const extra = []
    for (const ns of namespaces) {
      for (const key of Object.keys(it[ns] ?? {})) {
        if (!(key in (en[ns] ?? {}))) extra.push(`${ns}:${key}`)
      }
    }
    expect(extra, `Italian keys with no English source:\n${extra.join('\n')}`).toEqual([])
  })

  it('interpolation placeholders match between locales', () => {
    const mismatched = []
    const vars = (s) => (String(s).match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? []).sort().join(',')
    for (const ns of namespaces) {
      for (const [key, value] of Object.entries(en[ns] ?? {})) {
        const itValue = it[ns]?.[key]
        if (itValue == null) continue // untranslated yet — falls back to English
        if (vars(value) !== vars(itValue)) {
          mismatched.push(`${ns}:${key}\n  en: ${vars(value) || '(none)'}\n  it: ${vars(itValue) || '(none)'}`)
        }
      }
    }
    expect(mismatched, `\n${mismatched.join('\n')}\n`).toEqual([])
  })

  it('load-bearing trailing spaces survive translation', () => {
    // Sentence starters are concatenated onto what the child types next, so a
    // trimmed trailing space glues the starter to their first word.
    const offenders = []
    for (const ns of Object.keys(en)) {
      for (const [key, value] of Object.entries(en[ns])) {
        if (typeof value !== 'string' || !value.endsWith(' ')) continue
        const itValue = it[ns]?.[key]
        if (typeof itValue === 'string' && !itValue.endsWith(' ')) {
          offenders.push(`${ns}:${key}`)
        }
      }
    }
    expect(offenders, `Italian lost a load-bearing trailing space:\n${offenders.join('\n')}`).toEqual([])
  })
})

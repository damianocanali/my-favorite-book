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

// This repo lives in an iCloud-synced folder, which resolves a sync collision by
// leaving a copy named "Component 2.jsx" beside the original. Those copies are
// untracked and never imported, but this walk reads the filesystem rather than
// the git index, so without this filter a stale copy of a deleted component
// fails the suite for keys no shipping file references. Match the trailing
// " <digit>" that iCloud (and Finder's duplicate action) append.
const SYNC_COPY = / \d+\.[a-z]+$/

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (['.js', '.jsx'].includes(extname(p)) && !SYNC_COPY.test(p)) out.push(p)
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
// NOT named `it` — that is vitest's test function, and inside a test body the
// import wins, so `itLocale[ns]` silently resolves to undefined on a function object
// and every parity assertion passes vacuously.
const itLocale = loadLocale('it')

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
      for (const key of Object.keys(itLocale[ns] ?? {})) {
        if (!(key in (en[ns] ?? {}))) extra.push(`${ns}:${key}`)
      }
    }
    expect(extra, `Italian keys with no English source:\n${extra.join('\n')}`).toEqual([])
  })

  it('Italian covers every English key', () => {
    // Italian is complete, so a gap is now a real regression rather than
    // work-in-progress. A missing key silently renders English forever —
    // it looks fine in review and wrong to the user.
    const missing = []
    for (const ns of namespaces) {
      for (const key of Object.keys(en[ns] ?? {})) {
        if (!(key in (itLocale[ns] ?? {}))) missing.push(`${ns}:${key}`)
      }
    }
    expect(missing, `Italian is missing:\n${missing.join('\n')}`).toEqual([])
  })

  it('no Italian value is left as the English source', () => {
    // Catches copy-paste leftovers. Skips values that are legitimately
    // identical in both languages: brand names, vendor names, emails, and
    // short tokens like "OK" / "Email" that Italian genuinely shares.
    const KEEP = /^(My Book Lab|Story Buddy|mybooklab\.app|Supabase|Together AI|Anthropic|OpenAI|Stripe|RevenueCat|Apple|Lulu|OK|Email|PDF|AI)$/
    const suspicious = []
    for (const ns of namespaces) {
      for (const [key, value] of Object.entries(en[ns] ?? {})) {
        const itValue = itLocale[ns]?.[key]
        if (typeof value !== 'string' || typeof itValue !== 'string') continue
        if (value.length < 12) continue
        if (KEEP.test(value.trim())) continue
        // A value that is only placeholders, tags and punctuation has no words
        // to translate — "{{question}} = ?", "© {{year}} My Book Lab",
        // "{{emoji}} {{name}}". Identical is correct for these.
        const words = value
          .replace(/\{\{[^}]*\}\}/g, ' ')
          .replace(/<[^>]*>/g, ' ')
          // Brand and vendor names are deliberately identical in both
          // languages, so they don't count as translatable words.
          .replace(/My Book Lab|Story Buddy|mybooklab\.app|Supabase|Together AI|Anthropic|OpenAI|Stripe|RevenueCat|Apple|Lulu/g, ' ')
          .replace(/[^\p{L}]+/gu, ' ')
          .trim()
        if (words.length < 6) continue
        if (value === itValue) suspicious.push(`${ns}:${key} — "${value.slice(0, 60)}"`)
      }
    }
    expect(suspicious, `Italian identical to English:\n${suspicious.join('\n')}`).toEqual([])
  })

  it('interpolation placeholders match between locales', () => {
    const mismatched = []
    const vars = (s) => (String(s).match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? []).sort().join(',')
    for (const ns of namespaces) {
      for (const [key, value] of Object.entries(en[ns] ?? {})) {
        const itValue = itLocale[ns]?.[key]
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
        const itValue = itLocale[ns]?.[key]
        if (typeof itValue === 'string' && !itValue.endsWith(' ')) {
          offenders.push(`${ns}:${key}`)
        }
      }
    }
    expect(offenders, `Italian lost a load-bearing trailing space:\n${offenders.join('\n')}`).toEqual([])
  })
})

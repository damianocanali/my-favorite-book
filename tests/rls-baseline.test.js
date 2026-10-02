// Review §7 item 24: every table the repo creates has RLS enabled, and the
// committed schema baseline is current. Runs in CI (.github/workflows/ci.yml).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

const DIR = 'supabase-migrations'
const sources = [
  ...readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort().map((f) => [`${DIR}/${f}`, readFileSync(`${DIR}/${f}`, 'utf8')]),
  ['supabase/dashboard-tables.sql', readFileSync('supabase/dashboard-tables.sql', 'utf8')],
]
// Comments out, so a commented-out statement never counts either way.
const strip = (sql) => sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
const name = (raw) => raw.replace(/"/g, '').replace(/^public\./i, '').toLowerCase()

const created = []
const rlsOn = new Set()
const rlsOff = []
for (const [file, sql] of sources) {
  const s = strip(sql)
  for (const m of s.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/gi)) {
    const t = name(m[1])
    if (!t.includes('.')) created.push([t, file])
  }
  for (const m of s.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)\s+enable\s+row\s+level\s+security/gi)) rlsOn.add(name(m[1]))
  for (const m of s.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?([\w."]+)\s+disable\s+row\s+level\s+security/gi)) rlsOff.push([name(m[1]), file])
}

describe('RLS on every public table', () => {
  it('finds the tables', () => {
    expect(created.length).toBeGreaterThan(20)
  })
  it.each(created)('%s (%s) has "enable row level security"', (table) => {
    expect(rlsOn.has(table), `${table} is created without RLS`).toBe(true)
  })
  it('nothing ever disables RLS', () => {
    expect(rlsOff).toEqual([])
  })
})

describe('supabase/schema-baseline.sql', () => {
  it('includes every migration — run `node scripts/schema-baseline.mjs` after adding one', () => {
    const baseline = readFileSync('supabase/schema-baseline.sql', 'utf8')
    for (const f of readdirSync(DIR).filter((x) => /^\d{3}_.*\.sql$/.test(x))) {
      expect(baseline, f).toContain(`-- ════════ ${DIR}/${f} ════════`)
    }
    expect(baseline).toContain('TO BE REPLACED by a real `supabase db dump --schema-only`')
  })
})

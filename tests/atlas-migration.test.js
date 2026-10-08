import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sql = readFileSync('supabase-migrations/035_atlas_referrals.sql', 'utf8').replace(/--[^\n]*/g, '')

describe('035_atlas_referrals.sql', () => {
  it.each(['atlas_referrals', 'atlas_referral_codes'])('%s: RLS on, no policies, grants revoked', (t) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`))
    expect(sql).toMatch(new RegExp(`revoke all on public\\.${t} from anon, authenticated`))
  })
  it('creates no policy and grants nothing', () => {
    expect(sql).not.toMatch(/create\s+policy/i)
    expect(sql).not.toMatch(/\bgrant\b/i)
  })
  it('one row per account; detachable on purge (set null, reported rows only); nonce unique', () => {
    expect(sql).toMatch(/user_id\s+uuid unique references auth\.users\(id\) on delete set null/)
    expect(sql).toMatch(/check \(user_id is not null or reported_at is not null\)/)
    expect(sql).toMatch(/unique \(nonce\)/)
    expect(sql).toMatch(/redeemed_by\s+uuid references auth\.users\(id\) on delete cascade/)
  })
  it('status vocabularies match lib/atlas/report.js', () => {
    expect(sql).toContain("('pending','reporting','reported','failed_final','config_error')")
    expect(sql).toContain("('recorded','already_redeemed')")
    expect(sql).toMatch(/last_error\s+text check \(char_length\(last_error\) <= 300\)/)
  })
})

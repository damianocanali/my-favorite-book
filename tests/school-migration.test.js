// Static guards on the schools migration. We cannot run Postgres in CI, so
// these pin the properties that matter most if someone edits the SQL later:
// every new table is closed to the client keys, the RPCs cannot be called by
// them, and the secret never has a client-readable path.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SQL = readFileSync('supabase-migrations/018_schools_core.sql', 'utf8')
const NEW_TABLES = ['class_licenses', 'class_students', 'student_sign_in_attempts', 'class_checkins', 'class_help_requests']
const RPCS = ['school_record_attempt', 'school_sign_in_state', 'school_bump_image', 'school_sign_out_user']

describe('018_schools_core.sql', () => {
  it.each(NEW_TABLES)('%s is created with RLS enabled', (t) => {
    expect(SQL).toMatch(new RegExp(`create table if not exists public\\.${t}\\b`, 'i'))
    expect(SQL).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, 'i'))
  })

  it('creates no RLS policies at all (service role only)', () => {
    expect(SQL).not.toMatch(/create policy/i)
  })

  it.each(RPCS)('%s is revoked from public, anon and authenticated', (fn) => {
    expect(SQL).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`, 'i'))
    expect(SQL).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role`, 'i'))
  })

  it('every security definer function pins search_path', () => {
    const defs = SQL.match(/security definer[\s\S]*?\$\$/gi) ?? []
    expect(defs.length).toBe(RPCS.length)
    for (const d of defs) expect(d).toMatch(/set search_path = public/i)
  })

  it('makes the classroom owner FK restrictive and the legacy code FK follow renames', () => {
    expect(SQL).toMatch(/classrooms_owner_user_id_fkey[\s\S]*on delete restrict/i)
    expect(SQL).toMatch(/submissions_classroom_code_fkey[\s\S]*on update cascade on delete cascade/i)
  })

  it('caps class size at 35', () => {
    expect(SQL).toMatch(/seats between 1 and 35/i)
  })
})

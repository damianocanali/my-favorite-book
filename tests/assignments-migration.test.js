// Static guards on the assignments migration (same approach as
// tests/school-migration.test.js: no Postgres in CI, so pin the properties
// that matter if someone edits the SQL later).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SQL = readFileSync('supabase-migrations/019_assignments.sql', 'utf8')
const NEW_TABLES = ['assignments', 'class_submissions', 'submission_feedback']
const RPCS = ['school_submit', 'school_delete_assignment']

// The body of one `create table` statement, up to its closing `);`.
function tableBody(name) {
  const m = SQL.match(new RegExp(`create table if not exists public\\.${name}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'))
  return m ? m[1] : ''
}

describe('019_assignments.sql', () => {
  it.each(NEW_TABLES)('%s is created with RLS enabled', (t) => {
    expect(SQL).toMatch(new RegExp(`create table if not exists public\\.${t}\\b`, 'i'))
    expect(SQL).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, 'i'))
  })

  it('creates no RLS policies at all (service role only)', () => {
    expect(SQL).not.toMatch(/create policy/i)
  })

  it.each(RPCS)('%s is revoked from public, anon and authenticated and granted to service_role only', (fn) => {
    expect(SQL).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`, 'i'))
    expect(SQL).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role`, 'i'))
  })

  it('every security definer function pins search_path', () => {
    const defs = SQL.match(/security definer[\s\S]*?\$\$/gi) ?? []
    expect(defs.length).toBe(RPCS.length)
    for (const d of defs) expect(d).toMatch(/set search_path = public/i)
  })

  it('assignments: cascade from classrooms, length checks, status list, allow_late default true', () => {
    const b = tableBody('assignments')
    expect(b).toMatch(/classroom_id uuid not null references public\.classrooms\(id\) on delete cascade/i)
    expect(b).toMatch(/title text not null check \(char_length\(title\) between 1 and 80\)/i)
    expect(b).toMatch(/prompt text not null check \(char_length\(prompt\) between 1 and 1000\)/i)
    expect(b).toMatch(/status text not null default 'draft' check \(status in \('draft','published','closed'\)\)/i)
    expect(b).toMatch(/allow_late boolean not null default true/i)
    expect(SQL).toMatch(/on public\.assignments \(classroom_id, created_at desc\)/i)
  })

  it('class_submissions: every FK cascades, and one row per (assignment, student)', () => {
    const b = tableBody('class_submissions')
    expect(b).toMatch(/classroom_id uuid not null references public\.classrooms\(id\) on delete cascade/i)
    expect(b).toMatch(/assignment_id uuid not null references public\.assignments\(id\) on delete cascade/i)
    expect(b).toMatch(/student_id uuid not null references public\.class_students\(id\) on delete cascade/i)
    expect(b).toMatch(/user_id uuid not null references auth\.users\(id\) on delete cascade/i)
    expect(b).toMatch(/book_snapshot jsonb not null/i)
    expect(b).toMatch(/version int not null default 1/i)
    expect(b).toMatch(/unique \(assignment_id, student_id\)/i)
    expect(SQL).toMatch(/on public\.class_submissions \(classroom_id, submitted_at desc\)/i)
  })

  it('submission_feedback: cascades from its submission, author set null, sticker list, comment-or-sticker', () => {
    const b = tableBody('submission_feedback')
    expect(b).toMatch(/submission_id uuid not null references public\.class_submissions\(id\) on delete cascade/i)
    expect(b).toMatch(/author_user_id uuid references auth\.users\(id\) on delete set null/i)
    expect(b).toMatch(/comment text check \(char_length\(comment\) <= 500\)/i)
    expect(b).toMatch(/sticker text check \(sticker in \('star','rocket','heart','wow','keep_going','rainbow'\)\)/i)
    expect(b).toMatch(/check \(comment is not null or sticker is not null\)/i)
    expect(SQL).toMatch(/on public\.submission_feedback \(submission_id, created_at desc\)/i)
  })

  it('nothing new can block an account or class purge: no RESTRICT / NO ACTION foreign keys', () => {
    expect(SQL).not.toMatch(/on delete restrict/i)
    const refs = SQL.match(/references [^\n,]+/gi) ?? []
    expect(refs.length).toBeGreaterThan(0)
    for (const r of refs) expect(r).toMatch(/on delete (cascade|set null)/i)
  })

  it('school_submit upserts on (assignment_id, student_id) and bumps version atomically', () => {
    expect(SQL).toMatch(/on conflict \(assignment_id, student_id\) do update set/i)
    expect(SQL).toMatch(/version = class_submissions\.version \+ 1/i)
    expect(SQL).toMatch(/submitted_at = now\(\)/i)
  })

  it('school_submit re-checks the assignment under a share lock with the DB clock', () => {
    expect(SQL).toMatch(/select status, due_at, allow_late into a\s+from assignments where id = p_assignment_id and classroom_id = p_classroom_id\s+for share/i)
    expect(SQL).toMatch(/raise exception 'assignment_not_found'/i)
    expect(SQL).toMatch(/raise exception 'assignment_closed'/i)
    expect(SQL).toMatch(/not a\.allow_late and a\.due_at is not null and now\(\) > a\.due_at then\s+raise exception 'past_due'/i)
  })

  it('school_delete_assignment locks the row and refuses when anyone has handed in', () => {
    expect(SQL).toMatch(/from assignments where id = p_assignment_id and classroom_id = p_classroom_id\s+for update/i)
    expect(SQL).toMatch(/if exists \(select 1 from class_submissions where assignment_id = p_assignment_id\) then\s+raise exception 'has_submissions'/i)
    expect(SQL).toMatch(/delete from assignments where id = p_assignment_id/i)
  })

  it('indexes class_submissions by student and by user', () => {
    expect(SQL).toMatch(/create index if not exists \w+ on public\.class_submissions \(student_id\)/i)
    expect(SQL).toMatch(/create index if not exists \w+ on public\.class_submissions \(user_id\)/i)
  })

  it('is idempotent (if not exists / or replace everywhere)', () => {
    expect(SQL).not.toMatch(/create table (?!if not exists)/i)
    expect(SQL).not.toMatch(/create index (?!if not exists)/i)
    expect(SQL).not.toMatch(/create function/i)
  })
})

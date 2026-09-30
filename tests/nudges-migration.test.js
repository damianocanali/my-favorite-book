// Static guards on the nudges migration (same approach as
// tests/notifications-migration.test.js: no Postgres in CI, so pin the
// properties that matter if someone edits the SQL later).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SQL = readFileSync('supabase-migrations/021_nudges.sql', 'utf8')

function tableBody(name) {
  const m = SQL.match(new RegExp(`create table if not exists public\\.${name}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'))
  return m ? m[1] : ''
}

describe('021_nudges.sql', () => {
  it('class_nudges is created idempotently with RLS on, no policies, client keys revoked', () => {
    expect(SQL).toMatch(/create table if not exists public\.class_nudges\b/i)
    expect(SQL).toMatch(/alter table public\.class_nudges enable row level security/i)
    expect(SQL).toMatch(/revoke all on public\.class_nudges from anon, authenticated/i)
    expect(SQL).not.toMatch(/create policy/i)
    expect(SQL).not.toMatch(/create (unique )?index (?!if not exists)/i)
  })

  it('columns: cascades, lengths, preset list, both checks', () => {
    const b = tableBody('class_nudges')
    expect(b).toMatch(/classroom_id uuid not null references public\.classrooms\(id\) on delete cascade/i)
    expect(b).toMatch(/student_id uuid not null references public\.class_students\(id\) on delete cascade/i)
    expect(b).toMatch(/teacher_user_id uuid references auth\.users\(id\) on delete set null/i)
    expect(b).toMatch(/teacher_name text not null default '' check \(char_length\(teacher_name\) <= 60\)/i)
    expect(b).toMatch(/preset text check \(preset in \('story_waiting','one_more_page','cant_wait','hand_in'\)\)/i)
    expect(b).toMatch(/message text check \(char_length\(message\) <= 140\)/i)
    // CASCADE, not SET NULL: SET NULL on a hand_in row would violate the
    // check below and block deleting the assignment.
    expect(b).toMatch(/assignment_id uuid references public\.assignments\(id\) on delete cascade/i)
    expect(b).toMatch(/seen_at timestamptz/i)
    expect(b).toMatch(/check \(preset is not null or message is not null\)/i)
    expect(b).toMatch(/check \(preset <> 'hand_in' or assignment_id is not null\)/i)
  })

  it('one unread nudge per child is enforced by a partial unique index', () => {
    expect(SQL).toMatch(/create unique index if not exists \w+ on public\.class_nudges \(student_id\) where seen_at is null/i)
    expect(SQL).toMatch(/on public\.class_nudges \(student_id, created_at desc\)/i)
  })

  it('the daily-cap counter is added to class_students idempotently', () => {
    expect(SQL).toMatch(/alter table public\.class_students add column if not exists nudges_day date/i)
    expect(SQL).toMatch(/alter table public\.class_students add column if not exists nudges_today int not null default 0/i)
  })

  it('school_send_nudge: security definer, pinned search_path, locks the student, service role only', () => {
    const defs = SQL.match(/security definer[\s\S]*?\$\$/gi) ?? []
    expect(defs.length).toBe(1)
    expect(defs[0]).toMatch(/set search_path = public/i)
    expect(SQL).toMatch(/from class_students[\s\S]*?for update;/i)
    expect(SQL).toMatch(/raise exception 'daily_cap'/)
    expect(SQL).toMatch(/raise exception 'student_not_found'/)
    expect(SQL).toMatch(/delete from class_nudges where student_id = p_student_id and seen_at is null/i)
    expect(SQL).toMatch(/revoke all on function public\.school_send_nudge\([^)]*\) from public, anon, authenticated/i)
    expect(SQL).toMatch(/grant execute on function public\.school_send_nudge\([^)]*\) to service_role/i)
  })
})

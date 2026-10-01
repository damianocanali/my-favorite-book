// Static guards on the grading migration (same approach as
// tests/nudges-migration.test.js: no Postgres in CI, so pin the properties
// that matter if someone edits the SQL later).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { LEVELS, TIPS_MAX, TIP_TEXT_MAX, TIP_KEYS } from '../lib/school/grading.js'

const SQL = readFileSync('supabase-migrations/022_grading.sql', 'utf8')
const SQL019 = readFileSync('supabase-migrations/019_assignments.sql', 'utf8')

function tableBody(name) {
  const m = SQL.match(new RegExp(`create table if not exists public\\.${name}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'))
  return m ? m[1] : ''
}
function fnBody(name) {
  const m = SQL.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`, 'i'))
  return m ? m[1] : ''
}

describe('022_grading.sql', () => {
  it('submission_grades: idempotent, RLS on, no policies, client keys revoked', () => {
    expect(SQL).toMatch(/create table if not exists public\.submission_grades\b/i)
    expect(SQL).toMatch(/alter table public\.submission_grades enable row level security/i)
    expect(SQL).toMatch(/revoke all on public\.submission_grades from anon, authenticated/i)
    expect(SQL).not.toMatch(/create policy/i)
    expect(SQL).not.toMatch(/create (unique )?index (?!if not exists)/i)
    expect(SQL).not.toMatch(/add column (?!if not exists)/i)
  })

  it('columns: cascades with the hand-in, one grade per version, level list matches lib', () => {
    const b = tableBody('submission_grades')
    expect(b).toMatch(/submission_id uuid not null references public\.class_submissions\(id\) on delete cascade/i)
    expect(b).toMatch(/author_user_id uuid references auth\.users\(id\) on delete set null/i)
    expect(b).toMatch(/unique \(submission_id, version\)/i)
    expect(b).toMatch(/returned boolean not null default false/i)
    expect(b).toMatch(/check \(public\.school_valid_tips\(tips\)\)/i)
    const levels = b.match(/level text not null check \(level in \(([^)]*)\)\)/i)
    expect(levels).not.toBeNull()
    expect(levels[1].split(',').map((s) => s.trim().replace(/'/g, ''))).toEqual(LEVELS)
    // Every FK either cascades or sets null: the purge order never changes.
    for (const ref of b.match(/references [^\n,]*/gi)) expect(ref).toMatch(/on delete (cascade|set null)/i)
  })

  it('the tips check mirrors lib: ≤3, {key} in key shape or {text} 1–140, CASE-guarded', () => {
    const f = fnBody('school_valid_tips')
    expect(SQL).toMatch(/function public\.school_valid_tips\(t jsonb\)\s*returns boolean language sql immutable set search_path = public/i)
    expect(f).toContain(`jsonb_array_length(t) <= ${TIPS_MAX}`)
    expect(f).toContain(`between 1 and ${TIP_TEXT_MAX}`)
    expect(f).toMatch(/case when jsonb_typeof\(e\) <> 'object' then false/i)
    const re = new RegExp(f.match(/~ '([^']+)'/)[1])
    for (const k of TIP_KEYS) expect(k).toMatch(re)
    expect(Math.max(...TIP_KEYS.map((k) => k.length))).toBeLessThanOrEqual(40)
  })

  it('returned_at lives on the hand-in, added idempotently', () => {
    expect(SQL).toMatch(/alter table public\.class_submissions add column if not exists returned_at timestamptz/i)
  })

  it('school_grade_submission: definer, pinned path, locks the hand-in, checks version and resubmittability', () => {
    expect(SQL).toMatch(/function public\.school_grade_submission\([\s\S]*?\)\s*returns jsonb language plpgsql security definer set search_path = public as \$\$/i)
    const f = fnBody('school_grade_submission')
    expect(f).toMatch(/from class_submissions\s+where id = p_submission_id and classroom_id = p_classroom_id\s+for update;/i)
    expect(f).toMatch(/raise exception 'submission_not_found'/)
    expect(f).toMatch(/if s\.version <> p_version then raise exception 'version_changed'/)
    // Same "can hand in again" rule as school_submit.
    expect(f).toMatch(/a\.status <> 'published'/)
    expect(f).toMatch(/not a\.allow_late and a\.due_at is not null and now\(\) > a\.due_at/)
    expect(f).toMatch(/raise exception 'cannot_return'/)
    expect(f).toMatch(/on conflict \(submission_id, version\) do update set/i)
    expect(f).toMatch(/seen_at = null/)
    expect(f).toMatch(/set returned_at = case when coalesce\(p_returned, false\) then now\(\) else null end/i)
    expect(f).toMatch(/insert into submission_feedback/i)
  })

  it('school_submit still matches 019 except that handing in again clears returned_at', () => {
    const now = fnBody('school_submit')
    const before = SQL019.match(/create or replace function public\.school_submit\([\s\S]*?\$\$([\s\S]*?)\$\$;/i)[1]
    expect(now).toMatch(/submitted_at = now\(\),\s*returned_at = null/)
    expect(now.replace(/,\s*returned_at = null/, '')).toBe(before)
  })

  it('every function is service-role only', () => {
    const sigs = [
      'school_valid_tips(jsonb)',
      'school_grade_submission(uuid, uuid, int, uuid, text, jsonb, boolean, text, text)',
      'school_submit(uuid, uuid, uuid, uuid, text, text, jsonb)',
    ]
    for (const sig of sigs) {
      const esc = sig.replace(/[()]/g, '\\$&')
      expect(SQL).toMatch(new RegExp(`revoke all on function public\\.${esc} from public, anon, authenticated;`, 'i'))
      expect(SQL).toMatch(new RegExp(`grant execute on function public\\.${esc} to service_role;`, 'i'))
    }
    const defs = SQL.match(/security definer[\s\S]*?\$\$/gi) ?? []
    expect(defs.length).toBe(2)
    for (const d of defs) expect(d).toMatch(/set search_path = public/i)
  })
})

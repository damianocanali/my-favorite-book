// Static guards on 023_worksheets.sql (same approach as
// tests/grading-migration.test.js: no Postgres in CI, so pin the properties
// that matter if someone edits the SQL later).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { WORKSHEET_TEMPLATES, PROMPT_TEXT_MAX, ACROSTIC_WORD_MAX, boxIds } from '../lib/school/worksheets.js'

const SQL = readFileSync('supabase-migrations/023_worksheets.sql', 'utf8')
const SQL022 = readFileSync('supabase-migrations/022_grading.sql', 'utf8')

const fnBody = (sql, name) => {
  const m = sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`, 'i'))
  return m ? m[1] : ''
}

describe('023_worksheets.sql', () => {
  it('idempotent, no new tables or policies, nothing granted to client roles', () => {
    expect(SQL).not.toMatch(/create table/i)
    expect(SQL).not.toMatch(/create policy/i)
    expect(SQL).not.toMatch(/add column (?!if not exists)/i)
    expect(SQL).not.toMatch(/grant [^;]* to (anon|authenticated|public)/i)
    expect(SQL).toMatch(/drop trigger if exists assignments_kind_locked on public\.assignments;/)
    // Constraints are added only when missing.
    expect(SQL.match(/add constraint/gi)).toHaveLength(2)
    expect(SQL.match(/if not exists \(select 1 from pg_constraint where conname = /gi)).toHaveLength(2)
  })

  it('assignments get kind (book default) and a worksheet that only a worksheet carries', () => {
    expect(SQL).toMatch(/alter table public\.assignments add column if not exists kind text not null default 'book';/)
    expect(SQL).toMatch(/alter table public\.assignments add column if not exists worksheet jsonb;/)
    expect(SQL).toMatch(/check \(kind in \('book', 'worksheet'\)\)/)
    expect(SQL).toMatch(/check \(\(kind = 'book' and worksheet is null\)\s+or \(kind = 'worksheet' and public\.school_valid_worksheet\(worksheet\)\)\)/)
  })

  it('the worksheet check mirrors lib: id shapes, 1-12 prompts of 1-300 chars, optional 2-12 letter word, CASE-guarded', () => {
    const f = fnBody(SQL, 'school_valid_worksheet')
    expect(SQL).toMatch(/function public\.school_valid_worksheet\(w jsonb\)\s*returns boolean language sql immutable set search_path = public/i)
    expect(f).toContain(`between 1 and ${PROMPT_TEXT_MAX}`)
    expect(f).toContain(`{2,${ACROSTIC_WORD_MAX}}`)
    expect(f).toMatch(/case when coalesce\(jsonb_typeof\(w\), ''\) <> 'object' then false/)
    expect(f).toMatch(/case when jsonb_typeof\(w->'prompts'\) <> 'object' then false/)
    const idRe = new RegExp(f.match(/\(w->>'templateId'\) ~ '([^']+)'/)[1])
    for (const t of WORKSHEET_TEMPLATES) {
      expect(t.id).toMatch(idRe)
      for (const b of boxIds(t)) expect(b).toMatch(idRe)
      expect(boxIds(t).length).toBeLessThanOrEqual(12)
    }
    expect(f).toMatch(/k not in \('templateId', 'prompts', 'word'\)/)
  })

  it('kind can never change after creation', () => {
    expect(SQL).toMatch(/if new\.kind is distinct from old\.kind then raise exception 'kind_locked'/)
    expect(SQL).toMatch(/create trigger assignments_kind_locked before update of kind on public\.assignments\s+for each row execute function public\.school_assignment_kind_locked\(\);/)
  })

  it('school_submit keeps 019/022 exactly, plus the kind check read under the same lock', () => {
    const now = fnBody(SQL, 'school_submit')
    const before = fnBody(SQL022, 'school_submit')
    expect(now).toMatch(/select status, due_at, allow_late, kind into a\s+from assignments where id = p_assignment_id and classroom_id = p_classroom_id\s+for share;/)
    expect(now).toMatch(/raise exception 'wrong_kind'/)
    // 022's behaviour, still there: closed / draft / past_due, was_returned
    // read FOR UPDATE, returned_at cleared, version bumped.
    expect(now).toMatch(/returned_at = null/)
    expect(now).toMatch(/version = class_submissions\.version \+ 1/)
    expect(now).toMatch(/'was_returned', was_returned/)
    const stripped = now
      .replace('select status, due_at, allow_late, kind into a', 'select status, due_at, allow_late into a')
      .replace(/\n  if \(a\.kind = 'worksheet'\)[\s\S]*?raise exception 'wrong_kind';\n  end if;/, '')
    expect(stripped).toBe(before)
    // Same signature: replaced in place, never a second overload.
    expect(SQL).toMatch(/create or replace function public\.school_submit\(\s*p_classroom_id uuid, p_assignment_id uuid, p_student_id uuid, p_user_id uuid,\s*p_book_id text, p_book_title text, p_book_snapshot jsonb\s*\)/)
  })

  it('every function is service-role only; the definer pins its search path', () => {
    for (const sig of ['school_valid_worksheet(jsonb)', 'school_submit(uuid, uuid, uuid, uuid, text, text, jsonb)']) {
      const esc = sig.replace(/[()]/g, '\\$&')
      expect(SQL).toMatch(new RegExp(`revoke all on function public\\.${esc} from public, anon, authenticated;`, 'i'))
      expect(SQL).toMatch(new RegExp(`grant execute on function public\\.${esc} to service_role;`, 'i'))
    }
    expect(SQL).toMatch(/revoke all on function public\.school_assignment_kind_locked\(\) from public, anon, authenticated;/)
    const defs = SQL.match(/security definer[\s\S]*?\$\$/gi) ?? []
    expect(defs.length).toBe(1)
    for (const d of defs) expect(d).toMatch(/set search_path = public/i)
  })
})

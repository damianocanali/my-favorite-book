// Static guards on migration 024 (no Postgres in CI — same approach as
// tests/grading-migration.test.js): pin the properties that matter if
// someone edits the SQL later.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ABOUT_MAX, NOTE_MAX, PRINT_STATUSES, SHIPPING_LEVELS } from '../lib/school/writingYear.js'

const SQL = readFileSync('supabase-migrations/024_writing_year.sql', 'utf8')
const DELETE_USER = readFileSync('lib/deleteUser.js', 'utf8')
const TABLES = ['writing_year_items', 'writing_year_meta', 'class_print_requests', 'class_print_request_children']

function tableBody(name) {
  const m = SQL.match(new RegExp(`create table if not exists public\\.${name}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'))
  return m ? m[1] : ''
}
function fnBody(name) {
  const m = SQL.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`, 'i'))
  return m ? m[1] : ''
}

describe('024_writing_year.sql', () => {
  it('every table: idempotent, RLS on, no policies, client keys revoked', () => {
    for (const t of TABLES) {
      expect(SQL).toMatch(new RegExp(`create table if not exists public\\.${t}\\b`, 'i'))
      expect(SQL).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, 'i'))
      expect(SQL).toMatch(new RegExp(`revoke all on public\\.${t} from anon, authenticated`, 'i'))
    }
    expect(SQL).not.toMatch(/create policy/i)
    expect(SQL).not.toMatch(/grant [^;]* to (anon|authenticated)/i)
    expect(SQL).not.toMatch(/create (unique )?index (?!if not exists)/i)
  })

  it('every FK cascades or sets null, so the purge order never changes', () => {
    for (const t of TABLES) {
      for (const ref of tableBody(t).match(/references [^\n,]*/gi) ?? []) {
        expect(ref).toMatch(/on delete (cascade|set null)/i)
      }
    }
    // A child's pieces and meta go with their class_students row (which
    // cascades from their auth user) and a hand-in piece with its hand-in.
    const items = tableBody('writing_year_items')
    expect(items).toMatch(/student_id uuid not null references public\.class_students\(id\) on delete cascade/i)
    expect(items).toMatch(/submission_id uuid references public\.class_submissions\(id\) on delete cascade/i)
    expect(tableBody('writing_year_meta')).toMatch(/student_id uuid primary key references public\.class_students\(id\) on delete cascade/i)
    expect(tableBody('class_print_request_children')).toMatch(/student_id uuid not null references public\.class_students\(id\) on delete cascade/i)
    expect(tableBody('class_print_requests')).toMatch(/requested_by uuid references auth\.users\(id\) on delete set null/i)
  })

  it('purgeUser removes the rendered Writing Year PDFs before the auth delete', () => {
    const purge = DELETE_USER.indexOf('purgeWritingYearPdfs(userId')
    const authDelete = DELETE_USER.indexOf('/auth/v1/admin/users/')
    expect(purge).toBeGreaterThan(0)
    expect(purge).toBeLessThan(authDelete)
  })

  it('text limits match lib', () => {
    const meta = tableBody('writing_year_meta')
    for (const f of ['about_favorite', 'about_best_sentence', 'about_learned']) {
      expect(meta).toMatch(new RegExp(`${f} text not null default '' check \\(char_length\\(${f}\\) <= ${ABOUT_MAX}\\)`))
    }
    expect(meta).toContain(`char_length(teacher_note) <= ${NOTE_MAX}`)
  })

  it('print statuses match lib; one live request per LICENSE TERM (R3), race-safe in the index', () => {
    const b = tableBody('class_print_requests')
    const m = b.match(/check \(status in \(([^)]*)\)\)/i)
    expect(m[1].split(',').map((s) => s.trim().replace(/'/g, ''))).toEqual(PRINT_STATUSES)
    expect(b).toMatch(/license_id uuid not null references public\.class_licenses\(id\) on delete cascade/i)
    expect(b).toMatch(/term_start timestamptz not null/i)
    expect(SQL).toMatch(/create unique index if not exists class_print_requests_live_uniq\s+on public\.class_print_requests \(license_id, term_start\) where status <> 'canceled'/i)
    expect(b).toMatch(/submit_claimed_at timestamptz/i)
    expect(b).toMatch(/books_frozen_at timestamptz/i)
    expect(b).toMatch(/pdfs_purged_at timestamptz/i)
    const levels = b.match(/shipping_level text check \(shipping_level in \(([^)]*)\)\)/i)
    expect(levels[1].split(',').map((s) => s.trim().replace(/'/g, ''))).toEqual(SHIPPING_LEVELS)
    // The RPC ties the request to the license read under the lock.
    const f = fnBody('school_create_class_print')
    expect(f).toMatch(/select id, status, starts_at, expires_at into lic from class_licenses where classroom_id = p_classroom_id for share/)
    expect(f).toMatch(/values \(p_classroom_id, p_requested_by, lic\.id, lic\.starts_at,/)
  })

  it('a hand-in piece freezes the version chosen; books are written per child (2 MB cap each)', () => {
    expect(tableBody('writing_year_items')).toMatch(/snapshot_version int check \(snapshot_version >= 1\)/i)
    expect(fnBody('school_wy_add_item')).toMatch(/sub_snapshot := sub\.book_snapshot;\s+sub_version := sub\.version;/)
    expect(tableBody('class_print_request_children')).toMatch(/book jsonb not null default '\{\}'::jsonb check \(jsonb_typeof\(book\) = 'object' and octet_length\(book::text\) <= 2000000\)/i)
  })

  it('pieces: one per hand-in/book per child, deferred position order, only suggestions wait', () => {
    expect(SQL).toMatch(/writing_year_items_sub_uniq\s+on public\.writing_year_items \(student_id, submission_id\)/i)
    expect(SQL).toMatch(/writing_year_items_book_uniq\s+on public\.writing_year_items \(student_id, book_id\)/i)
    expect(SQL).toMatch(/unique \(student_id, position\) deferrable initially deferred/i)
    expect(tableBody('writing_year_items')).toMatch(/check \(approved or added_by = 'child_suggested'\)/i)
  })

  it('RPCs: definer, pinned search_path, service role only', () => {
    for (const fn of ['school_wy_add_item', 'school_wy_reorder', 'school_create_class_print']) {
      expect(SQL).toMatch(new RegExp(`function public\\.${fn}\\([\\s\\S]*?\\)\\s*returns \\w+ language plpgsql security definer set search_path = public as \\$\\$`, 'i'))
      expect(SQL).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`, 'i'))
      expect(SQL).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role`, 'i'))
    }
  })

  it('add/reorder serialise per child; add checks class, grade and caps', () => {
    const add = fnBody('school_wy_add_item')
    expect(add).toMatch(/pg_advisory_xact_lock\(hashtextextended\('writing_year:' \|\| sid::text, 0\)\)/)
    expect(add).toMatch(/where id = p_submission_id and classroom_id = p_classroom_id/)
    expect(add).toContain("raise exception 'not_graded'")
    expect(add).toContain("raise exception 'too_many_items'")
    expect(add).toContain("raise exception 'too_many_pending'")
    const re = fnBody('school_wy_reorder')
    expect(re).toMatch(/pg_advisory_xact_lock\(hashtextextended\('writing_year:' \|\| p_student_id::text, 0\)\)/)
    expect(re).toContain("raise exception 'order_mismatch'")
  })

  it('create: re-checks the paid license under a lock (R1) and maps the unique index (R3)', () => {
    const f = fnBody('school_create_class_print')
    expect(f).toMatch(/from class_licenses where classroom_id = p_classroom_id for share/)
    expect(f).toMatch(/lic\.status not in \('active','grace','comped'\)/)
    expect(f).toContain("raise exception 'license_not_paid'")
    expect(f).toMatch(/exception when unique_violation then\s+raise exception 'already_requested'/)
    expect(f).toContain("raise exception 'children_changed'")
  })
})

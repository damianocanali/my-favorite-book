// Static guards on the notifications migration (same approach as
// tests/assignments-migration.test.js: no Postgres in CI, so pin the
// properties that matter if someone edits the SQL later).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SQL = readFileSync('supabase-migrations/020_notifications.sql', 'utf8')
const TABLES = ['teacher_notifications', 'push_subscriptions', 'device_tokens', 'teacher_settings']

function tableBody(name) {
  const m = SQL.match(new RegExp(`create table if not exists public\\.${name}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'))
  return m ? m[1] : ''
}

describe('020_notifications.sql', () => {
  it.each(TABLES)('%s is created idempotently with RLS enabled', (t) => {
    expect(SQL).toMatch(new RegExp(`create table if not exists public\\.${t}\\b`, 'i'))
    expect(SQL).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, 'i'))
  })

  it('creates no RLS policies (service role only) and no bare create index', () => {
    expect(SQL).not.toMatch(/create policy/i)
    expect(SQL).not.toMatch(/create (unique )?index (?!if not exists)/i)
  })

  it('teacher_notifications: owner cascade, class cascade, kind list, payload default, dedup key, index', () => {
    const b = tableBody('teacher_notifications')
    expect(b).toMatch(/teacher_user_id uuid not null references auth\.users\(id\) on delete cascade/i)
    expect(b).toMatch(/classroom_id uuid references public\.classrooms\(id\) on delete cascade/i)
    expect(b).toMatch(/kind text not null check \(kind in \('hand_in','hand_in_late','resubmit','all_handed_in','help_book','help_grownup'\)\)/i)
    expect(b).toMatch(/payload jsonb not null default '\{\}'/i)
    expect(b).toMatch(/read_at timestamptz/i)
    expect(b).toMatch(/dedup_key text unique/i)
    expect(SQL).toMatch(/on public\.teacher_notifications \(teacher_user_id, created_at desc\)/i)
  })

  it('push_subscriptions: user cascade, unique endpoint, keys not null', () => {
    const b = tableBody('push_subscriptions')
    expect(b).toMatch(/user_id uuid not null references auth\.users\(id\) on delete cascade/i)
    expect(b).toMatch(/endpoint text unique not null/i)
    expect(b).toMatch(/p256dh text not null/i)
    expect(b).toMatch(/auth text not null/i)
    expect(b).toMatch(/last_used_at timestamptz/i)
  })

  it('device_tokens: user cascade, unique token, platform and env checks', () => {
    const b = tableBody('device_tokens')
    expect(b).toMatch(/user_id uuid not null references auth\.users\(id\) on delete cascade/i)
    expect(b).toMatch(/token text unique not null/i)
    expect(b).toMatch(/platform text not null default 'ios' check \(platform in \('ios'\)\)/i)
    expect(b).toMatch(/env text not null default 'production' check \(env in \('production','sandbox'\)\)/i)
  })

  it('teacher_settings: pk cascades from the user, summary/urgent defaults, last_summary_at added idempotently', () => {
    const b = tableBody('teacher_settings')
    expect(b).toMatch(/user_id uuid primary key references auth\.users\(id\) on delete cascade/i)
    expect(b).toMatch(/summary text not null default 'daily' check \(summary in \('daily','weekly','off'\)\)/i)
    expect(b).toMatch(/push_urgent boolean not null default true/i)
    expect(b).toMatch(/email_urgent boolean not null default true/i)
    expect(SQL).toMatch(/alter table public\.teacher_settings add column if not exists last_summary_at timestamptz/i)
  })

  it('every table revokes the client keys explicitly', () => {
    for (const t of TABLES) {
      expect(SQL).toMatch(new RegExp(`revoke all on public\\.${t} from anon, authenticated`, 'i'))
    }
  })
})

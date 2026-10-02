-- Hardening sprint B: owner/admin access log (privacy review §4.11, §7 item 16).
--
-- Every use of an OWNER_USER_ID-gated endpoint (api/admin/*) writes one row:
-- who, what, which record, why, when. It is the evidence that access to
-- student records (e.g. a child's Writing Year PDF during print QA) was
-- deliberate and bounded — SOC 2 CC6/CC7, NDPA Article V.
--
-- Same rules as 018–024: written and read ONLY by api/ with the service-role
-- key. RLS is on with no policies and the client roles' grants are revoked,
-- so the anon and authenticated keys (which ship to browsers) can read
-- nothing.
--
-- `actor` deliberately has NO foreign key to auth.users: the log must
-- outlive the account that wrote it (an owner account deletion must not
-- erase the record of what that account looked at).
--
-- `detail` carries ids and counts only — never a child's name, text or
-- feelings.
--
-- Apply BEFORE deploying the code that writes it (the writes are best-effort
-- for read actions and fail-closed for the bulk picture reset, see
-- api/_adminLog.js). Idempotent: safe to re-run.

create table if not exists public.admin_access_log (
  id bigint generated always as identity primary key,
  actor uuid not null,
  action text not null check (char_length(action) between 1 and 80),
  target_table text check (target_table is null or char_length(target_table) <= 80),
  target_id text check (target_id is null or char_length(target_id) <= 200),
  reason text check (reason is null or char_length(reason) <= 500),
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists admin_access_log_at_idx on public.admin_access_log (at desc);
create index if not exists admin_access_log_target_idx on public.admin_access_log (target_table, target_id);

alter table public.admin_access_log enable row level security;
revoke all on public.admin_access_log from anon, authenticated;

-- Append-only in practice: the API only ever INSERTs and SELECTs. (The
-- service role bypasses RLS and grants; a trigger forbidding UPDATE/DELETE
-- would also block legitimate retention pruning, so it is a policy, not a
-- constraint. Retention: keep at least 1 year — see the IR runbook.)
comment on table public.admin_access_log is
  'Owner/admin access to user and student records. Service-role only. Insert-only by convention; keep >= 1 year.';

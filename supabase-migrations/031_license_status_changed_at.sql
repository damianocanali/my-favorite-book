-- License lifecycle dating (review fix I3/I4, lib/school/lifecycle.js).
--
-- * status_changed_at: when the license last changed status. A lapsed or
--   canceled license is dated from this, not from updated_at (which moves
--   on any edit, e.g. images_used). Existing rows start at now(), so no
--   license already lapsed/canceled can be purged sooner than 90 days after
--   this migration — and only after the full 30 + 7 day warning schedule.
-- * The lapse warnings (028) are cleared whenever the status or the expiry
--   changes: a renewal (or any re-lapse) restarts the schedule from zero,
--   and the nightly query can select "needs a warning" with plain
--   IS NULL filters.
-- * Indexes for the nightly selection.
--
-- Apply BEFORE deploying the code that uses it. Idempotent.

alter table public.class_licenses
  add column if not exists status_changed_at timestamptz not null default now();

create or replace function public.class_licenses_lifecycle_stamps()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  if new.status is distinct from old.status or new.expires_at is distinct from old.expires_at then
    new.purge_warning_30_at := null;
    new.purge_warning_7_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.class_licenses_lifecycle_stamps() from public, anon, authenticated;

drop trigger if exists class_licenses_lifecycle_stamps on public.class_licenses;
create trigger class_licenses_lifecycle_stamps
  before update on public.class_licenses
  for each row execute function public.class_licenses_lifecycle_stamps();

create index if not exists class_licenses_ended_idx
  on public.class_licenses (status_changed_at)
  where classroom_id is not null and status in ('lapsed','canceled');
create index if not exists class_licenses_expiring_idx
  on public.class_licenses (expires_at)
  where classroom_id is not null and status in ('trial','active','pending_payment');

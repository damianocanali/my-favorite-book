-- Vendor-side deletion retries (privacy review §4.6 / §7.23).
--
-- lib/deleteUser.js purgeUser deletes the account's Stripe Customer and
-- RevenueCat subscriber (lib/vendorDeletion.js). A failed call never blocks
-- the purge; it lands here and api/cron/retention.js retries it nightly,
-- deleting the row on success. After 8 attempts a row stays for a human.
--
-- external_id is the vendor's own id only: a Stripe customer id (cus_…) or
-- the RevenueCat app_user_id (the deleted Supabase user's UUID). No names,
-- no emails. Deliberately no FK to auth.users: the account is gone.
--
-- Service role only: RLS on, no policies, client grants revoked.
-- Apply BEFORE deploying the code that uses it. Idempotent.

create table if not exists public.vendor_deletion_queue (
  id bigint generated always as identity primary key,
  vendor text not null check (vendor in ('stripe','revenuecat')),
  external_id text not null check (char_length(external_id) between 1 and 255),
  attempts int not null default 1 check (attempts >= 0),
  last_status int,
  last_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (vendor, external_id)
);
alter table public.vendor_deletion_queue enable row level security;
revoke all on public.vendor_deletion_queue from anon, authenticated;

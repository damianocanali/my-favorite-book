-- Atlas Mind Academy referrals (lib/atlas/*, api/referral/*).
--
-- atlas_referrals: ONE row per My Book Lab account that arrived with a valid
-- Atlas referral token. The first successful paid payment is reported to
-- Atlas once (POST /api/referral/redeemed); a refund of that payment is
-- reported once (POST /api/referral/reversed).
--
--   report_status  pending      attached; once external_ref is set a payment
--                               was seen and the row is due a report
--                  reporting    claimed by one worker (single winner:
--                               PATCH ... where report_status = 'pending')
--                  reported     Atlas answered recorded / already_redeemed
--                  failed_final 400 from Atlas, too many retries, or refunded
--                               before it was ever reported
--                  config_error 401 from Atlas (our callback secret is wrong)
--
-- atlas_referral_codes: the 8-character code a family sees on the web so the
-- iOS app (which can't read the web cookie) can claim the same token.
--
-- Neither table is reachable with the client keys: RLS on, NO policies,
-- grants revoked. All access is the service role from api/referral/*, the
-- Stripe / RevenueCat webhooks and the retention cron. Nothing personal is
-- stored: atlas_uid is Atlas's opaque id, the token carries no PII.
--
-- Account deletion (lib/deleteUser.js purgeAtlasReferral): rows that were
-- never reported, or whose reversal is settled, are DELETED. A row that was
-- reported to Atlas and not reversed is DETACHED instead (user_id = null,
-- detached_at set) so a refund issued after the account is gone can still
-- be reversed — it keeps only the token Atlas issued, the opaque payment
-- refs and timestamps, nothing personal. user_id is `on delete set null`
-- as a backstop for that path. Codes redeemed by the account cascade.
--
-- Write-only here: NOT applied. Apply after 034. Idempotent: safe to re-run.

create table if not exists public.atlas_referrals (
  id                        uuid primary key default gen_random_uuid(),
  -- Null only for a row detached by an account purge (see above).
  user_id                   uuid unique references auth.users(id) on delete set null,
  detached_at               timestamptz,
  token                     text not null check (char_length(token) <= 2048),
  nonce                     text not null,
  atlas_uid                 text not null check (char_length(atlas_uid) <= 200),
  token_iat                 timestamptz,
  token_exp                 timestamptz not null,
  captured_at               timestamptz not null default now(),
  attached_at               timestamptz not null default now(),
  -- Set when the first paid payment is seen (Stripe subscription id, or the
  -- App Store original_transaction_id). Null = nothing to report yet.
  external_ref              text check (char_length(external_ref) <= 200),
  -- The specific payment (Stripe invoice id / store transaction id), so a
  -- refund can be matched to the FIRST paid payment and nothing later.
  payment_ref               text check (char_length(payment_ref) <= 200),
  paid_at                   timestamptz,
  report_status             text not null default 'pending'
                              check (report_status in ('pending','reporting','reported','failed_final','config_error')),
  report_attempts           int not null default 0,
  next_attempt_at           timestamptz,
  last_error                text check (char_length(last_error) <= 300),
  reported_at               timestamptz,
  reported_status           text check (reported_status in ('recorded','already_redeemed')),
  reversal_status           text check (reversal_status in ('pending','reversing','reversed','not_billable','failed_final','config_error')),
  reversal_attempts         int not null default 0,
  reversal_next_attempt_at  timestamptz,
  reversed_at               timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint atlas_referrals_nonce_key unique (nonce),
  constraint atlas_referrals_detached_reported check (user_id is not null or reported_at is not null)
);

create index if not exists atlas_referrals_payment_ref_idx
  on public.atlas_referrals (payment_ref) where payment_ref is not null;

create index if not exists atlas_referrals_due_idx
  on public.atlas_referrals (next_attempt_at)
  where report_status = 'pending' and external_ref is not null;
create index if not exists atlas_referrals_external_ref_idx
  on public.atlas_referrals (external_ref) where external_ref is not null;
create index if not exists atlas_referrals_reversal_due_idx
  on public.atlas_referrals (reversal_next_attempt_at) where reversal_status = 'pending';

alter table public.atlas_referrals enable row level security;
revoke all on public.atlas_referrals from anon, authenticated;

create table if not exists public.atlas_referral_codes (
  code         text primary key check (code ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$'),
  token        text not null check (char_length(token) <= 2048),
  nonce        text not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  redeemed_at  timestamptz,
  redeemed_by  uuid references auth.users(id) on delete cascade,
  constraint atlas_referral_codes_nonce_key unique (nonce)
);

create index if not exists atlas_referral_codes_expires_idx on public.atlas_referral_codes (expires_at);

alter table public.atlas_referral_codes enable row level security;
revoke all on public.atlas_referral_codes from anon, authenticated;

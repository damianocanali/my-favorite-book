-- supabase-migrations/007_usage_log.sql
-- Records every paid AI provider call so the owner can audit costs without
-- depending on provider admin APIs (which often require admin-level keys
-- separate from the regular API key the app uses).

create table if not exists usage_log (
  id              bigserial primary key,
  user_id         uuid references auth.users(id) on delete set null,
  service         text not null check (service in ('anthropic', 'together')),
  feature         text not null,            -- 'story_buddy' / 'generate_image' / 'generate_avatar' / 'pdf_upscale'
  model           text not null,            -- e.g. 'claude-haiku-4-5-20251001', 'FLUX.1-schnell'
  input_tokens    int,                      -- null for image endpoints
  output_tokens   int,                      -- null for image endpoints
  images          int,                      -- null for chat endpoints
  cost_cents      int not null default 0,   -- our estimate in USD cents (uses hardcoded rates; treat as approximate)
  created_at      timestamptz not null default now()
);

create index if not exists idx_usage_log_created_at
  on usage_log(created_at desc);

create index if not exists idx_usage_log_service_created
  on usage_log(service, created_at desc);

create index if not exists idx_usage_log_user_created
  on usage_log(user_id, created_at desc);

-- Service-role only (writes happen from API endpoints with service key).
-- No client-side reads — owner-only reads go through /api/admin/usage which
-- itself service-role queries with an owner-uuid auth check.
alter table usage_log enable row level security;

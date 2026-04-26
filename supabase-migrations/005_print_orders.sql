-- supabase-migrations/005_print_orders.sql
-- Run in Supabase SQL editor. Idempotent (uses IF NOT EXISTS / CREATE OR REPLACE).

create table if not exists print_orders (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  book_id                  text not null,
  book_snapshot            jsonb not null,
  format                   text not null check (format in ('hardcover','softcover')),
  quantity                 int  not null default 1 check (quantity between 1 and 10),
  unit_price_cents         int  not null check (unit_price_cents >= 0),
  shipping_cents           int  not null check (shipping_cents >= 0),
  tax_cents                int  not null default 0 check (tax_cents >= 0),
  total_cents              int  not null check (total_cents >= 0),

  ship_name                text not null,
  ship_address_line1       text not null,
  ship_address_line2       text,
  ship_city                text not null,
  ship_state               text not null,
  ship_postal_code         text not null,
  ship_country             text not null default 'US',
  ship_email               text not null,
  ship_phone               text,

  stripe_payment_intent_id text unique,
  stripe_charge_id         text,

  lulu_order_id            text unique,
  lulu_tracking_url        text,
  lulu_carrier             text,
  lulu_tracking_number     text,

  interior_pdf_url         text,
  cover_pdf_url            text,

  status                   text not null default 'pending'
                           check (status in ('pending','paid','pdf_ready','submitted','in_production','shipped','delivered','failed','refunded')),
  status_message           text,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

create index if not exists idx_print_orders_user
  on print_orders(user_id, created_at desc);

create index if not exists idx_print_orders_active
  on print_orders(status)
  where status in ('paid','pdf_ready','submitted','in_production','shipped');

-- Auto-bump updated_at
create or replace function set_updated_at_now() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_print_orders_updated_at on print_orders;
create trigger trg_print_orders_updated_at
  before update on print_orders
  for each row execute function set_updated_at_now();

-- RLS: server-side only via service role; client-side cannot write, but can read own rows.
alter table print_orders enable row level security;

drop policy if exists "Users read own print orders" on print_orders;
create policy "Users read own print orders"
  on print_orders for select
  using (auth.uid() = user_id);

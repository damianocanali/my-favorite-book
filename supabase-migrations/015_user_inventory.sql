-- Run this in Supabase Dashboard > SQL Editor.
--
-- Cross-device inventory. The avatar and any purchased art styles /
-- avatar items lived only in UserDefaults (iOS) and localStorage (web),
-- so the same account looked different on each device and clearing
-- browser data appeared to erase purchases.
--
-- Ownership is also made authoritative here. /api/spend-coins only ever
-- received an amount; the client then marked the item owned locally, so
-- anything could be granted for free by editing local storage. The spend
-- and the grant now happen together, in one transaction, server-side.

create table if not exists user_inventory (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  avatar_url   text,
  owned_styles text[] not null default '{}',
  owned_items  text[] not null default '{}',
  updated_at   timestamptz not null default now()
);

alter table user_inventory enable row level security;

drop policy if exists "Users read own inventory" on user_inventory;
create policy "Users read own inventory"
  on user_inventory for select
  using (auth.uid() = user_id);

drop policy if exists "Users create own inventory" on user_inventory;
create policy "Users create own inventory"
  on user_inventory for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own inventory" on user_inventory;
create policy "Users update own inventory"
  on user_inventory for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Column privileges are what keep ownership honest: a client may set its
-- own avatar, but owned_styles / owned_items are writable only by the
-- service role (via the RPC below). RLS alone cannot restrict columns.
revoke all on user_inventory from anon, authenticated;
grant select on user_inventory to authenticated;
grant insert (user_id, avatar_url) on user_inventory to authenticated;
grant update (avatar_url) on user_inventory to authenticated;

-- ── RPC: spend coins AND record what was bought, atomically ────────────────
-- Returns the new balance, or NULL when the user can't afford it (so the
-- caller can answer 402 exactly as before). p_kind is 'style' or 'item';
-- pass NULL to spend without granting anything.
create or replace function spend_coins_for(
  p_user_id uuid,
  p_amount int,
  p_kind text default null,
  p_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  update user_coins
    set balance = balance - p_amount,
        updated_at = now()
    where user_id = p_user_id
      and balance >= p_amount
    returning balance into new_balance;

  -- Not enough coins: change nothing and let the caller report it.
  if new_balance is null then
    return null;
  end if;

  if p_kind is not null and p_id is not null then
    insert into user_inventory (user_id, updated_at)
      values (p_user_id, now())
      on conflict (user_id) do nothing;

    if p_kind = 'style' then
      update user_inventory
        set owned_styles = (
              select array(select distinct unnest(owned_styles || array[p_id]))
            ),
            updated_at = now()
        where user_id = p_user_id;
    elsif p_kind = 'item' then
      update user_inventory
        set owned_items = (
              select array(select distinct unnest(owned_items || array[p_id]))
            ),
            updated_at = now()
        where user_id = p_user_id;
    else
      raise exception 'unknown kind %', p_kind;
    end if;
  end if;

  return new_balance;
end;
$$;

revoke all on function spend_coins_for(uuid, int, text, text) from public;
revoke all on function spend_coins_for(uuid, int, text, text) from anon, authenticated;

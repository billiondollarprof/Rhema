-- =============================================================================
-- 20261116072103_price_list.sql
--
-- What this is: the hospital's price list. The card fee, the consultation
-- fee and a price for each lab test. The admin sets them; the Front Desk
-- sees them filled in when it takes a payment, and can still change the
-- amount for one patient.
--
-- Why: Settings, part 1 (Anthony, 2026-11-16, requests 197 and 201: "you
-- can always go ahead with the settings the way you have described it, one
-- at a time"). Prices were typed from memory at every payment.
--
-- Rules:
--   - Everybody signed in and active reads the list (it holds no patient).
--   - Only an admin (can_admin) sets or removes a price, and only through
--     set_price, which the database checks. Nobody writes the table by hand.
--   - Every change goes in the activity log (the trigger write_activity).
--   - A price is between 1 and 99,999,999.99 naira.
--
-- Never: hold anything about a patient. Never let anybody but an admin
-- change a price.
-- =============================================================================


-- ===== 1. The table =====
create table public.price_list (
  id         bigint generated always as identity primary key,
  -- card: the registration card. consultation: seeing a doctor. lab_test:
  -- one lab test, named in item.
  kind       text not null check (kind in ('card', 'consultation', 'lab_test')),
  item       text not null check (length(trim(item)) between 2 and 120),
  amount     numeric(12, 2) not null check (amount > 0 and amount < 100000000),
  updated_by uuid references public.staff (id),
  updated_at timestamptz not null default now()
);

-- One price per thing, whatever the capital letters.
create unique index price_list_item_key on public.price_list (kind, lower(trim(item)));

revoke all on public.price_list from anon, authenticated;
alter table public.price_list enable row level security;

grant select on public.price_list to authenticated;

create policy price_list_read on public.price_list
  for select to authenticated
  using ((select private.is_active_staff()));

create trigger price_list_activity after insert or update on public.price_list
  for each row execute function private.write_activity();


-- ===== 2. Set or remove a price (admin only) =====
-- A null or zero amount removes the price.
create function private.set_price(p_kind text, p_item text, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not (select private.is_admin()) then
    raise exception 'Only an admin sets prices.' using errcode = '42501';
  end if;
  if p_kind not in ('card', 'consultation', 'lab_test') then
    raise exception 'Unknown kind of price.';
  end if;
  if p_item is null or length(trim(p_item)) < 2 then
    raise exception 'Name the thing the price is for.';
  end if;

  if p_amount is null or p_amount = 0 then
    -- Removing is logged too: the row is changed first, then deleted.
    insert into public.activity_log (actor_id, action, table_name, record_id, changed_fields)
    select me, 'delete', 'price_list', id::text, array['amount']
    from public.price_list where kind = p_kind and lower(trim(item)) = lower(trim(p_item));
    delete from public.price_list where kind = p_kind and lower(trim(item)) = lower(trim(p_item));
    return;
  end if;

  insert into public.price_list (kind, item, amount, updated_by)
  values (p_kind, trim(p_item), round(p_amount, 2), me)
  on conflict (kind, lower(trim(item))) do update
    set amount = excluded.amount, updated_by = me, updated_at = now()
    where public.price_list.amount is distinct from excluded.amount;
end;
$$;

revoke execute on function private.set_price(text, text, numeric) from public, anon;
grant  execute on function private.set_price(text, text, numeric) to authenticated;

create function public.set_price(p_kind text, p_item text, p_amount numeric)
returns void language sql security invoker set search_path = ''
as $$ select private.set_price(p_kind, p_item, p_amount); $$;

revoke execute on function public.set_price(text, text, numeric) from public, anon;
grant  execute on function public.set_price(text, text, numeric) to authenticated;

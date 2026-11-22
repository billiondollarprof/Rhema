-- =============================================================================
-- 20261122154048_standard_prices_by_doctors.sql
--
-- What this is: a doctor or the matron can make the prices they typed the
-- hospital's standard prices, so they fill in for everybody next time. The
-- price list now holds drugs as well as card fees, consultation and lab
-- tests. The admin can set drug prices on the Prices tab too.
--
-- Why: Anthony, 2026-11-22 (request 236): "if the doctor or matron enters a
-- price for medicine or test or any procedure, once they press save, show
-- them a dialogue button to make the price a standard price... it sticks.
-- Can also decide to edit the price... put a new standard price." His yes to
-- "Make these the standard prices?" after sending.
--
-- Rules:
--   - make_standard_prices(prices): a doctor or the matron (sets_prices), or
--     an admin. Drugs and lab tests only. Each above 0 and below 100,000,000.
--     A price already the same is left alone (no empty change in the log).
--   - Every change goes in the activity log (the price_list trigger).
--   - Reading the list does not change: everybody signed in reads it.
--
-- Never: let anybody else change a standard price.
-- =============================================================================


-- ===== 1. Drugs on the price list =====
alter table public.price_list drop constraint price_list_kind_check;
alter table public.price_list
  add constraint price_list_kind_check check (kind in ('card', 'consultation', 'lab_test', 'drug'));


-- ===== 2. The admin can set drug prices too =====
create or replace function private.set_price(p_kind text, p_item text, p_amount numeric)
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
  -- Drugs too, since 2026-11-22 (request 235).
  if p_kind not in ('card', 'consultation', 'lab_test', 'drug') then
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


-- ===== 3. A doctor or the matron makes their prices standard =====
-- prices: [{kind: 'drug' or 'lab_test', item, amount}]. Answers how many changed.
create function private.make_standard_prices(prices jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  changed integer;
begin
  if not ((select private.sets_prices()) or (select private.is_admin())) then
    raise exception 'Only a doctor, the matron or an admin sets standard prices' using errcode = '42501';
  end if;
  if jsonb_typeof(prices) <> 'array' or jsonb_array_length(prices) not between 1 and 40 then
    raise exception 'Choose between 1 and 40 prices' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(prices) price
    where coalesce(price ->> 'kind', '') not in ('drug', 'lab_test')
       or length(trim(coalesce(price ->> 'item', ''))) not between 2 and 120
       or coalesce((price ->> 'amount')::numeric, 0) <= 0
       or (price ->> 'amount')::numeric >= 100000000
  ) then
    raise exception 'Each price needs a drug or test and an amount above 0' using errcode = '22023';
  end if;

  insert into public.price_list (kind, item, amount, updated_by)
  select price ->> 'kind', trim(price ->> 'item'), round((price ->> 'amount')::numeric, 2), me
  from jsonb_array_elements(prices) price
  on conflict (kind, lower(trim(item))) do update
    set amount = excluded.amount, updated_by = me, updated_at = now()
    where public.price_list.amount is distinct from excluded.amount;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function private.make_standard_prices(jsonb) from public, anon;
grant  execute on function private.make_standard_prices(jsonb) to authenticated;

create function public.make_standard_prices(prices jsonb)
returns integer
language sql
set search_path = ''
as $$ select private.make_standard_prices(prices); $$;

revoke execute on function public.make_standard_prices(jsonb) from public, anon;
grant  execute on function public.make_standard_prices(jsonb) to authenticated;

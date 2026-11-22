-- =============================================================================
-- Undo 20261122204301_bills.sql: bills, bill lines and their functions go,
-- and "procedure" leaves the price list and each person's own prices.
--
-- On live this loses every bill and every procedure price: it needs
-- Anthony's explicit yes in writing first. Payments already taken for bills
-- stay (they are in payments and payment_lines).
--
-- The payment kind "bill" stays: Postgres cannot take a value out of a list
-- of choices, and nothing uses it once the functions are gone.
-- =============================================================================

drop function public.add_bill(bigint, jsonb, text);
drop function private.add_bill(bigint, jsonb, text);
drop function public.pay_bill(bigint, public.payment_mode);
drop function private.pay_bill(bigint, public.payment_mode);
drop function public.void_bill(bigint);
drop function private.void_bill(bigint);

drop table public.bill_lines;
drop table public.bills;

delete from public.price_list where kind = 'procedure';
alter table public.price_list drop constraint price_list_kind_check;
alter table public.price_list
  add constraint price_list_kind_check check (kind in ('card', 'consultation', 'lab_test', 'drug'));

delete from public.my_prices where kind = 'procedure';
alter table public.my_prices drop constraint my_prices_kind_check;
alter table public.my_prices
  add constraint my_prices_kind_check check (kind in ('drug', 'lab_test'));

-- The two price functions as 20261122154048 left them.
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
  -- Drugs too, since 2026-11-22 (request 235),.
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

create or replace function private.make_standard_prices(prices jsonb)
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

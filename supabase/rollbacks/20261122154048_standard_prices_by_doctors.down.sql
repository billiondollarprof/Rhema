-- =============================================================================
-- Undo 20261122154048_standard_prices_by_doctors.sql: only the admin sets
-- prices again, and drug prices leave the list.
-- =============================================================================

drop function public.make_standard_prices(jsonb);
drop function private.make_standard_prices(jsonb);

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

delete from public.price_list where kind = 'drug';
alter table public.price_list drop constraint price_list_kind_check;
alter table public.price_list
  add constraint price_list_kind_check check (kind in ('card', 'consultation', 'lab_test'));

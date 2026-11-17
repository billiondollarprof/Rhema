-- =============================================================================
-- Undo 20261117003602_flow_priority_not_given_sample_expiry.sql: back to
-- how it was before (priority, not given, sample taken and expiry removed,
-- move_patient and move_stock as they were).
-- =============================================================================

-- ===== 6. move_stock without the expiry date =====
drop function public.move_stock(bigint, numeric, text, text, date);
drop function private.move_stock(bigint, numeric, text, text, date);
create function private.move_stock(medicine bigint, amount numeric, why text, move_note text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_count numeric;
begin
  if not (select private.is_pharmacist()) then
    raise exception 'Only the Pharmacy changes stock' using errcode = '42501';
  end if;
  if why not in ('restock', 'correction', 'expired', 'damaged') or amount is null or amount = 0 then
    raise exception 'Check the number and the reason' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('stock:' || medicine::text));
  if exists (
    select 1 from public.stock_moves
    where medicine_id = medicine and moved_by = (select auth.uid()) and change = amount
      and reason = why and moved_at > now() - interval '30 seconds'
  ) then
    raise exception 'already moved' using errcode = '23505';
  end if;
  update public.medicine_list set in_stock = coalesce(in_stock, 0) + amount
  where id = medicine
  returning in_stock into now_count;
  if not found then
    raise exception 'No such medicine' using errcode = '22023';
  end if;
  insert into public.stock_moves (medicine_id, change, reason, note)
  values (medicine, amount, why, nullif(left(trim(move_note), 300), ''));
  return now_count;
end;
$$;
revoke execute on function private.move_stock(bigint, numeric, text, text) from public, anon;
grant  execute on function private.move_stock(bigint, numeric, text, text) to authenticated;
create function public.move_stock(medicine bigint, amount numeric, why text, move_note text)
returns numeric language sql security invoker set search_path = ''
as $$ select private.move_stock(medicine, amount, why, move_note); $$;
revoke execute on function public.move_stock(bigint, numeric, text, text) from public, anon;
grant  execute on function public.move_stock(bigint, numeric, text, text) to authenticated;
alter table public.stock_moves drop column expiry_date;

-- ===== 4. Sample taken =====
drop function public.mark_sample_taken(bigint);
drop function private.mark_sample_taken(bigint);
drop index public.lab_requests_sample_taken_by_idx;
alter table public.lab_requests drop column sample_taken_by, drop column sample_taken_at;

-- ===== 2. Not given =====
alter table public.medications_given drop column not_given_reason;

-- ===== 1. Priority =====
create or replace function private.move_patient(entry bigint, room bigint, note text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.queue_entries;
  new_entry bigint;
begin
  if not private.has_permission('patients') then
    raise exception 'Only staff who send patients to rooms can move them' using errcode = '42501';
  end if;
  if not exists (select 1 from public.rooms where id = room and is_active) then
    raise exception 'No such room' using errcode = '22023';
  end if;
  select * into found from public.queue_entries where id = entry;
  if found.id is null then
    raise exception 'No such visit' using errcode = '22023';
  end if;
  -- Two taps at the same moment wait here for each other.
  perform pg_advisory_xact_lock(hashtext('move:' || found.patient_id::text));
  -- Already moved there (the second tap): answer that visit.
  select id into new_entry from public.queue_entries
   where patient_id = found.patient_id and status <> 'done' and room_id = room;
  if new_entry is not null then
    return new_entry;
  end if;
  update public.queue_entries
     set status = 'done', finished_at = now(), finish_reason = 'moved'
   where patient_id = found.patient_id and status <> 'done';
  insert into public.queue_entries (patient_id, room_id, status, note, sent_by)
  values (found.patient_id, room, 'waiting', nullif(trim(note), ''), (select auth.uid()))
  returning id into new_entry;
  return new_entry;
end;
$$;
drop function public.set_priority(bigint, text);
drop function private.set_priority(bigint, text);
alter table public.queue_entries drop column priority;

-- =============================================================================
-- 20261117003602_flow_priority_not_given_sample_expiry.sql
--
-- What this is: four small additions from comparing the hospital's flow
-- with OpenMRS, Bahmni and Epic (request 219c, Anthony 2026-11-17: "we add
-- all of them, run the SQLs at once").
--   1. Priority in the queue: Emergency, Urgent or Normal (Normal unless
--      somebody says otherwise). A moved patient keeps their priority.
--   2. Not given, with a reason: a dose that was due and not given is
--      written down, never left blank.
--   4. Sample taken: the Laboratory taps it, and the doctor sees the test is
--      in progress.
--   6. Expiry date on new stock: the Pharmacy types it when stock arrives
--      (optional), and the list warns before it expires.
-- (Numbers 3 and 5 need no database change.)
--
-- Rules:
--   - Additive: new columns with safe defaults; old rows read as before.
--   - move_stock gains an expiry date; the old four-part version is
--     replaced, so it is dropped and made again with the same checks.
--   - The double tap guards already cover medications_given and stock.
--
-- Never: let anybody without the Front Desk's patients permission change a
-- priority, or anybody but the Laboratory mark a sample, or anybody but the
-- Pharmacy move stock.
-- =============================================================================


-- ===== 1a. Priority on every visit =====
alter table public.queue_entries
  add column priority text not null default 'normal'
    check (priority in ('emergency', 'urgent', 'normal'));

-- ===== 1b. Change the priority of a visit still open =====
-- Answers 'done', or 'closed' when the visit has ended.
create function private.set_priority(entry bigint, level text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.has_permission('patients')) then
    raise exception 'Only staff who send patients to rooms set a priority' using errcode = '42501';
  end if;
  if level not in ('emergency', 'urgent', 'normal') then
    raise exception 'Emergency, urgent or normal' using errcode = '22023';
  end if;
  update public.queue_entries set priority = level
  where id = entry and status <> 'done';
  if not found then
    return 'closed';
  end if;
  return 'done';
end;
$$;

revoke execute on function private.set_priority(bigint, text) from public, anon;
grant  execute on function private.set_priority(bigint, text) to authenticated;

create function public.set_priority(entry bigint, level text)
returns text language sql security invoker set search_path = ''
as $$ select private.set_priority(entry, level); $$;

revoke execute on function public.set_priority(bigint, text) from public, anon;
grant  execute on function public.set_priority(bigint, text) to authenticated;

-- ===== 1c. A moved patient keeps their priority =====
-- The same function as 20261104061952_visit_endings.sql, with one change:
-- the new visit carries the old visit's priority.
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
  insert into public.queue_entries (patient_id, room_id, status, note, sent_by, priority)
  values (found.patient_id, room, 'waiting', nullif(trim(note), ''), (select auth.uid()), found.priority)
  returning id into new_entry;
  return new_entry;
end;
$$;


-- ===== 2. Not given, with a reason =====
-- A row with a reason is a dose that was due and not given. The dose may be
-- empty then.
alter table public.medications_given
  add column not_given_reason text
    check (not_given_reason is null or length(trim(not_given_reason)) between 2 and 120);


-- ===== 4a. Sample taken =====
alter table public.lab_requests
  add column sample_taken_at timestamptz,
  add column sample_taken_by uuid references public.staff (id);

create index lab_requests_sample_taken_by_idx on public.lab_requests (sample_taken_by);

-- ===== 4b. The Laboratory marks the sample taken =====
-- Answers 'done', 'already' (a second tap), or 'not_paid'.
create function private.mark_sample_taken(request bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.lab_requests;
begin
  if not (select private.has_permission('lab')) then
    raise exception 'Only the Laboratory marks a sample' using errcode = '42501';
  end if;
  select * into wanted from public.lab_requests where id = request for update;
  if not found or wanted.status <> 'awaiting_test' then
    return 'not_paid';
  end if;
  if wanted.sample_taken_at is not null then
    return 'already';
  end if;
  update public.lab_requests
  set sample_taken_at = now(), sample_taken_by = (select auth.uid())
  where id = request;
  return 'done';
end;
$$;

revoke execute on function private.mark_sample_taken(bigint) from public, anon;
grant  execute on function private.mark_sample_taken(bigint) to authenticated;

create function public.mark_sample_taken(request bigint)
returns text language sql security invoker set search_path = ''
as $$ select private.mark_sample_taken(request); $$;

revoke execute on function public.mark_sample_taken(bigint) from public, anon;
grant  execute on function public.mark_sample_taken(bigint) to authenticated;


-- ===== 6a. An expiry date on new stock =====
alter table public.stock_moves
  add column expiry_date date
    check (expiry_date is null or reason = 'restock');

-- ===== 6b. move_stock, with the expiry date =====
-- The same checks as 20261116145838 (Pharmacy only; a known reason; the
-- same change twice within 30 seconds refused), plus the expiry date for a
-- restock. The four-part version is replaced by this one.
drop function public.move_stock(bigint, numeric, text, text);
drop function private.move_stock(bigint, numeric, text, text);

create function private.move_stock(medicine bigint, amount numeric, why text, move_note text, expires date default null)
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
  if expires is not null and why <> 'restock' then
    raise exception 'An expiry date goes with new stock only' using errcode = '22023';
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
  insert into public.stock_moves (medicine_id, change, reason, note, expiry_date)
  values (medicine, amount, why, nullif(left(trim(move_note), 300), ''), expires);
  return now_count;
end;
$$;

revoke execute on function private.move_stock(bigint, numeric, text, text, date) from public, anon;
grant  execute on function private.move_stock(bigint, numeric, text, text, date) to authenticated;

create function public.move_stock(medicine bigint, amount numeric, why text, move_note text, expires date default null)
returns numeric language sql security invoker set search_path = ''
as $$ select private.move_stock(medicine, amount, why, move_note, expires); $$;

revoke execute on function public.move_stock(bigint, numeric, text, text, date) from public, anon;
grant  execute on function public.move_stock(bigint, numeric, text, text, date) to authenticated;

-- =============================================================================
-- Undo 20261120130854_give_and_test_before_payment.sql: one waiting for
-- payment at the Front Desk is again not given or tested until it is paid.
-- =============================================================================

create or replace function private.dispense_prescription(prescription bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.prescriptions;
  item record;
  line_id bigint;
  how_many numeric;
begin
  if not (select private.has_permission('pharmacy')) then
    raise exception 'Only the Pharmacy can dispense' using errcode = '42501';
  end if;
  select * into wanted from public.prescriptions where id = prescription for update;
  if not found then
    raise exception 'No such prescription' using errcode = '22023';
  end if;
  if wanted.status = 'dispensed' then
    return 'already_dispensed';
  end if;
  if wanted.status = 'awaiting_payment' then
    return 'not_paid';
  end if;
  if wanted.status = 'voided' then
    raise exception 'This prescription was cancelled' using errcode = '22023';
  end if;

  update public.prescriptions
  set status = 'dispensed', dispensed_at = now(), dispensed_by = (select auth.uid())
  where id = prescription;

  -- Into the current medications, written in the prescribing doctor's name.
  insert into public.patient_medications (patient_id, medicine, dose, how_often, added_by)
  select wanted.patient_id,
         left(i.drug || coalesce(' ' || i.strength, ''), 160),
         left(i.dose, 120),
         left(i.how_often || coalesce(', ' || i.days || ' days', ''), 120),
         wanted.prescribed_by
  from public.prescription_items i
  where i.prescription_id = prescription;

  -- Out of stock: counted lines only (2026-11-16).
  for item in
    select drug, strength, quantity from public.prescription_items where prescription_id = prescription
  loop
    how_many := nullif(substring(coalesce(item.quantity, '') from '^\s*([0-9]+(?:\.[0-9]+)?)'), '')::numeric;
    if how_many is null or how_many <= 0 then
      continue;
    end if;
    select id into line_id from public.medicine_list
    where lower(trim(name)) = lower(trim(item.drug))
      and lower(coalesce(trim(strength), '')) = lower(coalesce(trim(item.strength), ''))
      and status = 'standard' and in_stock is not null
    limit 1;
    if line_id is null then
      continue;
    end if;
    perform pg_advisory_xact_lock(hashtext('stock:' || line_id::text));
    update public.medicine_list set in_stock = in_stock - how_many where id = line_id;
    insert into public.stock_moves (medicine_id, change, reason, prescription_id)
    values (line_id, -how_many, 'dispensed', prescription);
  end loop;
  return 'dispensed';
end;
$$;


create or replace function private.record_lab_results(request bigint, patient bigint, items jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.lab_requests;
  for_patient bigint := patient;
  item jsonb;
  missing integer;
begin
  if not (select private.has_permission('lab')) then
    raise exception 'Only the Laboratory can record results' using errcode = '42501';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 20 then
    raise exception 'Type between 1 and 20 results' using errcode = '22023';
  end if;

  if request is not null then
    select * into wanted from public.lab_requests where id = request for update;
    if not found then
      raise exception 'No such lab request' using errcode = '22023';
    end if;
    if wanted.status = 'completed' then
      return 'already_done';
    end if;
    if wanted.status = 'awaiting_payment' then
      return 'not_paid';
    end if;
    if wanted.status = 'voided' then
      raise exception 'This request was cancelled' using errcode = '22023';
    end if;
    -- Every test on the request needs its details (2026-11-16).
    select count(*) into missing
    from unnest(wanted.tests) as asked(test)
    where not exists (
      select 1 from jsonb_array_elements(items) given
      where lower(trim(given ->> 'test')) = lower(trim(asked.test))
        and (length(trim(coalesce(given ->> 'result', ''))) > 0 or given ->> 'file_key' is not null)
    );
    if missing > 0 then
      return 'missing_tests';
    end if;
    for_patient := wanted.patient_id;
  else
    if not exists (select 1 from public.patients where id = for_patient and voided_at is null) then
      raise exception 'No such patient' using errcode = '22023';
    end if;
    -- A walk in result typed twice within 30 seconds is a double tap.
    perform pg_advisory_xact_lock(hashtext('lab-walkin:' || (select auth.uid())::text || ':' || for_patient::text));
    if exists (
      select 1 from public.lab_results
      where recorded_by = (select auth.uid())
        and patient_id = for_patient
        and request_id is null
        and recorded_at > now() - interval '30 seconds'
    ) then
      return 'already_done';
    end if;
  end if;

  for item in select value from jsonb_array_elements(items) loop
    insert into public.lab_results (patient_id, request_id, test, result, file_key, file_name, file_type, file_size)
    values (
      for_patient, request,
      trim(item ->> 'test'), trim(item ->> 'result'),
      item ->> 'file_key', item ->> 'file_name', item ->> 'file_type',
      (item ->> 'file_size')::integer
    );
  end loop;

  if request is not null then
    update public.lab_requests
    set status = 'completed', completed_at = now(), completed_by = (select auth.uid())
    where id = request;
  end if;
  return 'saved';
end;
$$;


create or replace function private.mark_sample_taken(request bigint)
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


create or replace function private.add_lab_result(request bigint, item jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.lab_requests;
begin
  if not (select private.has_permission('lab')) then
    raise exception 'Only the Laboratory adds results' using errcode = '42501';
  end if;
  select * into wanted from public.lab_requests where id = request for update;
  if not found or wanted.status not in ('awaiting_test', 'completed') then
    return 'not_paid';
  end if;
  if length(trim(coalesce(item ->> 'result', ''))) = 0 and item ->> 'file_key' is null then
    return 'missing_tests';
  end if;
  perform pg_advisory_xact_lock(hashtext('lab-add:' || request::text));
  if exists (
    select 1 from public.lab_results
    where request_id = request and recorded_by = (select auth.uid())
      and lower(test) = lower(trim(item ->> 'test')) and result = trim(item ->> 'result')
      and recorded_at > now() - interval '30 seconds'
  ) then
    return 'already_done';
  end if;
  insert into public.lab_results (patient_id, request_id, test, result, file_key, file_name, file_type, file_size)
  values (wanted.patient_id, request, trim(item ->> 'test'), trim(item ->> 'result'),
          item ->> 'file_key', item ->> 'file_name', item ->> 'file_type', (item ->> 'file_size')::integer);
  update public.lab_requests
  set status = 'completed', completed_at = coalesce(completed_at, now()),
      completed_by = coalesce(completed_by, (select auth.uid()))
  where id = request and status = 'awaiting_test';
  return 'saved';
end;
$$;


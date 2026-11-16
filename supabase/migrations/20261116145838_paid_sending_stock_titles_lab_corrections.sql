-- =============================================================================
-- 20261116145838_paid_sending_stock_titles_lab_corrections.sql
--
-- What this is, four parts (Anthony, 2026-11-16, requests 213 and 214):
--   1. Send what the Front Desk was paid for: lab tests to the Laboratory,
--      drugs to the Pharmacy ("if front desk takes a payment, they will now
--      have to send to lab, same with medicine/pharmacy payment").
--   2. Pharmacy stock: a unit for each medicine line, how many are in stock,
--      a low level, restocking, and the count dropping as drugs are
--      dispensed. Only for lines where the Pharmacy has set a stock.
--   3. A title on nursing and consultation notes.
--   4. Lab corrections: the Laboratory sees every result on a paid request,
--      adds a missed result, cancels a wrong one with a reason; and Result
--      ready is refused unless every test on the request has its details.
--
-- Rules:
--   - Only the Front Desk (can_take_payment) sends a payment on, once, and
--     only for a payment of that kind for that patient.
--   - Only the Pharmacy changes a unit, a low level or a stock count.
--   - Stock can go below 0 (the shelf count is sometimes behind); the
--     screens warn (his words: "show warning when it's at zero and allow
--     anyway... until the restock").
--   - Only the Laboratory adds or cancels lab results, and only on a request
--     the Front Desk has confirmed paid (or sent straight to the lab).
--   - The same action twice within 30 seconds is refused; stock and money
--     use a lock so two taps at the same moment cannot both pass.
--
-- Never: let anybody but the Pharmacy change a stock count; let a lab
-- result be deleted (a wrong one is cancelled with a reason and stays).
-- =============================================================================


-- ===== 1a. The Front Desk sends paid lab tests to the Laboratory =====
-- doctor: who wrote the paper, if the Front Desk chose one; that person is
-- told when the results are ready. Otherwise the Front Desk is the asker.
create function private.send_paid_to_lab(payment bigint, wanted text[], doctor uuid, send_note text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid public.payments;
  clean text[];
  asker uuid := coalesce(doctor, (select auth.uid()));
begin
  if not (select private.can_take_payment()) then
    raise exception 'Only the Front Desk sends a payment on' using errcode = '42501';
  end if;
  select * into paid from public.payments where id = payment for update;
  if not found or paid.voided_at is not null or paid.purpose <> 'lab_test' then
    raise exception 'That is not a lab test payment' using errcode = '22023';
  end if;
  if doctor is not null and not exists (
    select 1 from public.staff where id = doctor and is_active and can_medical
  ) then
    raise exception 'Choose a doctor or nurse' using errcode = '22023';
  end if;
  if exists (select 1 from public.lab_requests where payment_id = payment) then
    return 'already_sent';
  end if;
  select array_agg(test order by first_at) into clean
  from (
    select trim(item) as test, min(position) as first_at
    from unnest(wanted) with ordinality as given(item, position)
    where length(trim(item)) between 2 and 80
    group by trim(item)
  ) tidy;
  if clean is null or cardinality(clean) > 20 then
    raise exception 'Choose between 1 and 20 tests' using errcode = '22023';
  end if;
  insert into public.lab_requests (patient_id, tests, note, requested_by, status, payment_id)
  values (paid.patient_id, clean,
          left(coalesce(nullif(trim(send_note), ''), 'Paid at the Front Desk, from the doctor''s paper'), 500),
          asker, 'awaiting_test', payment);
  return 'sent';
end;
$$;


-- ===== 1b. The Front Desk sends paid drugs to the Pharmacy =====
-- items: [{drug, strength, quantity}].
create function private.send_paid_to_pharmacy(payment bigint, items jsonb, doctor uuid, send_note text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid public.payments;
  new_id bigint;
begin
  if not (select private.can_take_payment()) then
    raise exception 'Only the Front Desk sends a payment on' using errcode = '42501';
  end if;
  select * into paid from public.payments where id = payment for update;
  if not found or paid.voided_at is not null or paid.purpose <> 'drugs' then
    raise exception 'That is not a drug payment' using errcode = '22023';
  end if;
  if doctor is not null and not exists (
    select 1 from public.staff where id = doctor and is_active and can_medical
  ) then
    raise exception 'Choose a doctor or nurse' using errcode = '22023';
  end if;
  if exists (select 1 from public.prescriptions where payment_id = payment) then
    return 'already_sent';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 20 then
    raise exception 'Add between 1 and 20 drugs' using errcode = '22023';
  end if;
  insert into public.prescriptions (patient_id, note, prescribed_by, status, payment_id)
  values (paid.patient_id,
          left(coalesce(nullif(trim(send_note), ''), 'Paid at the Front Desk, from the doctor''s paper'), 500),
          coalesce(doctor, (select auth.uid())), 'awaiting_dispense', payment)
  returning id into new_id;
  insert into public.prescription_items (prescription_id, drug, strength, quantity)
  select new_id, left(trim(item ->> 'drug'), 160), nullif(left(trim(item ->> 'strength'), 60), ''),
         nullif(left(trim(item ->> 'quantity'), 60), '')
  from jsonb_array_elements(items) item
  where length(trim(item ->> 'drug')) >= 2;
  return 'sent';
end;
$$;

revoke execute on function private.send_paid_to_lab(bigint, text[], uuid, text) from public, anon;
revoke execute on function private.send_paid_to_pharmacy(bigint, jsonb, uuid, text) from public, anon;
grant  execute on function private.send_paid_to_lab(bigint, text[], uuid, text) to authenticated;
grant  execute on function private.send_paid_to_pharmacy(bigint, jsonb, uuid, text) to authenticated;

create function public.send_paid_to_lab(payment bigint, wanted text[], doctor uuid, send_note text)
returns text language sql security invoker set search_path = ''
as $$ select private.send_paid_to_lab(payment, wanted, doctor, send_note); $$;
create function public.send_paid_to_pharmacy(payment bigint, items jsonb, doctor uuid, send_note text)
returns text language sql security invoker set search_path = ''
as $$ select private.send_paid_to_pharmacy(payment, items, doctor, send_note); $$;

revoke execute on function public.send_paid_to_lab(bigint, text[], uuid, text) from public, anon;
revoke execute on function public.send_paid_to_pharmacy(bigint, jsonb, uuid, text) from public, anon;
grant  execute on function public.send_paid_to_lab(bigint, text[], uuid, text) to authenticated;
grant  execute on function public.send_paid_to_pharmacy(bigint, jsonb, uuid, text) to authenticated;


-- ===== 2a. Stock on each medicine line =====
-- in_stock null: the Pharmacy does not count this line (nothing is required
-- and nothing warns). A number: counted.
alter table public.medicine_list
  add column unit      text check (unit is null or length(trim(unit)) between 1 and 30),
  add column in_stock  numeric(12, 2),
  add column low_level numeric(12, 2) check (low_level is null or low_level >= 0);

create table public.stock_moves (
  id             bigint generated always as identity primary key,
  medicine_id    bigint not null references public.medicine_list (id),
  change         numeric(12, 2) not null check (change <> 0),
  reason         text not null check (reason in ('restock', 'dispensed', 'correction', 'expired', 'damaged')),
  note           text check (note is null or length(note) <= 300),
  prescription_id bigint references public.prescriptions (id),
  moved_by       uuid not null default auth.uid() references public.staff (id),
  moved_at       timestamptz not null default now()
);
create index stock_moves_medicine_idx on public.stock_moves (medicine_id, moved_at desc);

revoke all on public.stock_moves from anon, authenticated;
alter table public.stock_moves enable row level security;
grant select on public.stock_moves to authenticated;
create policy stock_moves_read on public.stock_moves
  for select to authenticated
  using ((select private.is_pharmacist()));

create trigger stock_moves_activity after insert on public.stock_moves
  for each row execute function private.write_activity();


-- ===== 2b. The Pharmacy sets a line's unit and low level =====
create function private.set_stock_settings(medicine bigint, new_unit text, new_low numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_pharmacist()) then
    raise exception 'Only the Pharmacy sets stock' using errcode = '42501';
  end if;
  update public.medicine_list
  set unit = nullif(trim(new_unit), ''), low_level = new_low
  where id = medicine;
  if not found then
    raise exception 'No such medicine' using errcode = '22023';
  end if;
end;
$$;


-- ===== 2c. The Pharmacy restocks or corrects the count =====
-- Answers the new count. The same change twice within 30 seconds is refused.
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

revoke execute on function private.set_stock_settings(bigint, text, numeric) from public, anon;
revoke execute on function private.move_stock(bigint, numeric, text, text) from public, anon;
grant  execute on function private.set_stock_settings(bigint, text, numeric) to authenticated;
grant  execute on function private.move_stock(bigint, numeric, text, text) to authenticated;

create function public.set_stock_settings(medicine bigint, new_unit text, new_low numeric)
returns void language sql security invoker set search_path = ''
as $$ select private.set_stock_settings(medicine, new_unit, new_low); $$;
create function public.move_stock(medicine bigint, amount numeric, why text, move_note text)
returns numeric language sql security invoker set search_path = ''
as $$ select private.move_stock(medicine, amount, why, move_note); $$;

revoke execute on function public.set_stock_settings(bigint, text, numeric) from public, anon;
revoke execute on function public.move_stock(bigint, numeric, text, text) from public, anon;
grant  execute on function public.set_stock_settings(bigint, text, numeric) to authenticated;
grant  execute on function public.move_stock(bigint, numeric, text, text) to authenticated;


-- ===== 2d. Dispensing takes the drugs out of stock =====
-- The same function as before (20261031151251_pharmacy.sql, section 8), with
-- one addition at the end: each item whose line is counted, and whose
-- quantity starts with a number ("10", "2 sachets"), lowers the count.
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


-- ===== 3. A title on nursing and consultation notes =====
alter table public.nursing_notes
  add column title text check (title is null or length(trim(title)) between 1 and 120);
alter table public.consultation_notes
  add column title text check (title is null or length(trim(title)) between 1 and 120);


-- ===== 4a. The Laboratory sees every result on a paid request =====
-- Laboratory staff by ROLE, not the lab permission: doctors hold that too,
-- and a doctor reads results only through the opened record, which is
-- logged (test 009).
create policy lab_results_read_by_lab on public.lab_results
  for select to authenticated
  using (
    exists (
      select 1 from public.staff
      where id = (select auth.uid()) and is_active and role = 'laboratory'
    )
    and request_id is not null
    and exists (
      select 1 from public.lab_requests r
      where r.id = request_id and r.status in ('awaiting_test', 'completed')
    )
  );


-- ===== 4b. Result ready only when every test has its details =====
-- The same function as before (20261030164236_laboratory.sql, section 7),
-- with one addition: on a request, every test on it needs a result line
-- with words or a file. Answers missing_tests otherwise, and saves nothing.
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


-- ===== 4c. The Laboratory adds a result it missed, on a paid request =====
create function private.add_lab_result(request bigint, item jsonb)
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


-- ===== 4d. The Laboratory cancels a wrong result, with a reason =====
create function private.cancel_lab_result(result_id bigint, why text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.has_permission('lab')) then
    raise exception 'Only the Laboratory cancels results' using errcode = '42501';
  end if;
  if length(trim(coalesce(why, ''))) < 2 then
    raise exception 'Give a short reason' using errcode = '22023';
  end if;
  update public.lab_results
  set voided_at = now(), voided_by = (select auth.uid()), void_reason = left(trim(why), 300)
  where id = result_id and voided_at is null and request_id is not null;
  if not found then
    return 'not_found';
  end if;
  return 'cancelled';
end;
$$;

revoke execute on function private.add_lab_result(bigint, jsonb) from public, anon;
revoke execute on function private.cancel_lab_result(bigint, text) from public, anon;
grant  execute on function private.add_lab_result(bigint, jsonb) to authenticated;
grant  execute on function private.cancel_lab_result(bigint, text) to authenticated;

create function public.add_lab_result(request bigint, item jsonb)
returns text language sql security invoker set search_path = ''
as $$ select private.add_lab_result(request, item); $$;
create function public.cancel_lab_result(result_id bigint, why text)
returns text language sql security invoker set search_path = ''
as $$ select private.cancel_lab_result(result_id, why); $$;

revoke execute on function public.add_lab_result(bigint, jsonb) from public, anon;
revoke execute on function public.cancel_lab_result(bigint, text) from public, anon;
grant  execute on function public.add_lab_result(bigint, jsonb) to authenticated;
grant  execute on function public.cancel_lab_result(bigint, text) to authenticated;

-- =============================================================================
-- 20261031151251_pharmacy.sql
--
-- What this is: the Pharmacy, and prices typed per line (request 123).
--   1. A doctor writes a prescription: one line per drug (name, strength,
--      dose, how often, how many days, quantity, a note), and sends it to
--      the Front Desk for payment or straight to the Pharmacy.
--   2. The Front Desk types a price for each drug; the database adds them
--      up and records one payment (purpose: drugs) with its lines.
--   3. The Pharmacy taps Dispensed. The drugs join the patient's current
--      medications at once.
--   4. Lab tests get the same: a price per test, added up by the database
--      (pay_lab_request_lines). The old one amount way stays, unused, so
--      nothing that works today breaks.
--
-- Why: Anthony, 2026-10-31: "do pharmacy with drug payments now." "Let the
-- app always work out the total, the front desk and the lab, they should be
-- able to type in their price." "It's a hospital, so the doctor
-- prescribes." No stock counting ("no need"). No alert when dispensed (he
-- did not ask for one; request 58, no alert spam).
--
-- Rules:
--   - Only a doctor prescribes. Only the Front Desk (or an admin) takes
--     money. Only somebody with the Pharmacy tick dispenses.
--   - Nobody writes these tables directly; every change goes through the
--     functions below, which check who is asking.
--   - The Front Desk and the Pharmacy see the drug lines (they need them to
--     charge and to dispense), never the rest of the medical record.
--   - A prescription is paid once and dispensed once, checked under a lock.
--   - The total is always worked out by the database from the lines.
--
-- Never: let the typed total and the lines disagree, or delete anything.
-- =============================================================================


-- ===== 1. Choices and who is a doctor =====

create type public.prescription_status as enum
  ('awaiting_payment', 'awaiting_dispense', 'dispensed', 'voided');

create function private.is_doctor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff
    where id = (select auth.uid()) and is_active and role = 'doctor' and can_medical
  );
$$;

revoke execute on function private.is_doctor() from public, anon;
grant  execute on function private.is_doctor() to authenticated;


-- ===== 2. The tables =====

-- The lines of a payment: what each part was for, and its price.
create table public.payment_lines (
  id          bigint generated always as identity primary key,
  payment_id  bigint not null references public.payments (id),
  label       text not null check (length(trim(label)) between 1 and 160),
  amount      numeric(12, 2) not null check (amount > 0 and amount < 100000000)
);
create index payment_lines_payment_idx on public.payment_lines (payment_id);

create table public.prescriptions (
  id              bigint generated always as identity primary key,
  patient_id      bigint not null references public.patients (id),
  note            text check (note is null or length(note) <= 500),
  prescribed_by   uuid not null default auth.uid() references public.staff (id),
  prescribed_at   timestamptz not null default now(),
  status          public.prescription_status not null,
  payment_id      bigint references public.payments (id),
  dispensed_at    timestamptz,
  dispensed_by    uuid references public.staff (id)
);
create index prescriptions_patient_idx    on public.prescriptions (patient_id, prescribed_at desc);
create index prescriptions_status_idx     on public.prescriptions (status, prescribed_at);
create index prescriptions_prescriber_idx on public.prescriptions (prescribed_by);

create table public.prescription_items (
  id               bigint generated always as identity primary key,
  prescription_id  bigint not null references public.prescriptions (id),
  drug             text not null check (length(trim(drug)) between 2 and 160),
  strength         text check (strength is null or length(strength) <= 60),
  dose             text check (dose is null or length(dose) <= 120),
  how_often        text check (how_often is null or length(how_often) <= 120),
  days             integer check (days is null or days between 1 and 365),
  quantity         text check (quantity is null or length(quantity) <= 60),
  note             text check (note is null or length(note) <= 300)
);
create index prescription_items_prescription_idx on public.prescription_items (prescription_id);

-- Supabase gives every new table full rights. Take them all away, then give
-- back reading only. Every write goes through the functions below.
revoke all on public.payment_lines, public.prescriptions, public.prescription_items from anon, authenticated;
alter table public.payment_lines      enable row level security;
alter table public.prescriptions      enable row level security;
alter table public.prescription_items enable row level security;
grant select on public.payment_lines, public.prescriptions, public.prescription_items to authenticated;

create trigger payment_lines_activity      after insert or update on public.payment_lines      for each row execute function private.write_activity();
create trigger prescriptions_activity      after insert or update on public.prescriptions      for each row execute function private.write_activity();
create trigger prescription_items_activity after insert or update on public.prescription_items for each row execute function private.write_activity();


-- ===== 3. Who reads which rows =====

-- Payment lines: the same people as payments (the Front Desk and admins).
create policy payment_lines_read on public.payment_lines
  for select to authenticated
  using ((select private.can_take_payment()));

-- Prescriptions: the open record, the doctor who wrote it, the Pharmacy
-- (to dispense) and the Front Desk (to charge).
create function private.can_see_prescription(patient bigint, writer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_use_record(patient)
      or (writer = (select auth.uid()) and private.is_active_staff())
      or private.has_permission('pharmacy')
      or private.can_take_payment();
$$;
revoke execute on function private.can_see_prescription(bigint, uuid) from public, anon;
grant  execute on function private.can_see_prescription(bigint, uuid) to authenticated;

create policy prescriptions_read on public.prescriptions
  for select to authenticated
  using (private.can_see_prescription(patient_id, prescribed_by));

create policy prescription_items_read on public.prescription_items
  for select to authenticated
  using (exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id and private.can_see_prescription(p.patient_id, p.prescribed_by)
  ));


-- ===== 4. Prices typed per line: the payment and its lines =====
-- lines: [{"label": "...", "amount": 1500}], 1 to 40 of them. Answers the
-- new payment's id. The total is the sum of the lines, always.

create function private.record_payment_lines(
  patient bigint,
  what public.payment_purpose,
  lines jsonb,
  paid_by public.payment_mode
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  total numeric(12, 2);
  new_payment bigint;
begin
  if jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) not between 1 and 40 then
    raise exception 'Type a price for each line' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(lines) line
    where coalesce((line ->> 'amount')::numeric, 0) <= 0
       or coalesce((line ->> 'amount')::numeric, 0) >= 100000000
       or length(trim(coalesce(line ->> 'label', ''))) = 0
  ) then
    raise exception 'Every line needs a name and a price above 0' using errcode = '22023';
  end if;

  select sum(round((line ->> 'amount')::numeric, 2)) into total from jsonb_array_elements(lines) line;

  insert into public.payments (patient_id, amount, purpose, mode, description)
  values (patient, total, what, paid_by,
          left((select string_agg(trim(line ->> 'label'), ', ') from jsonb_array_elements(lines) line), 300))
  returning id into new_payment;

  insert into public.payment_lines (payment_id, label, amount)
  select new_payment, trim(line ->> 'label'), round((line ->> 'amount')::numeric, 2)
  from jsonb_array_elements(lines) line;

  return new_payment;
end;
$$;
revoke execute on function private.record_payment_lines(bigint, public.payment_purpose, jsonb, public.payment_mode)
  from public, anon, authenticated;


-- ===== 5. Lab tests: a price per test =====
-- The same as pay_lab_request, with one price per test. Answers: paid, or
-- already_paid.

create function private.pay_lab_request_lines(request bigint, lines jsonb, paid_by public.payment_mode)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.lab_requests;
  new_payment bigint;
begin
  if not (select private.can_take_payment()) then
    raise exception 'Only the Front Desk can record payments' using errcode = '42501';
  end if;
  select * into wanted from public.lab_requests where id = request for update;
  if not found then
    raise exception 'No such lab request' using errcode = '22023';
  end if;
  if wanted.status <> 'awaiting_payment' then
    return 'already_paid';
  end if;

  new_payment := private.record_payment_lines(wanted.patient_id, 'lab_test', lines, paid_by);
  update public.lab_requests set status = 'awaiting_test', payment_id = new_payment where id = request;
  return 'paid';
end;
$$;


-- ===== 6. A doctor prescribes =====
-- items: [{"drug", "strength", "dose", "how_often", "days", "quantity",
-- "note"}], 1 to 20 drugs. Answers: sent, or already_sent (the same drugs
-- for the same patient by the same doctor within 30 seconds).

create function private.prescribe(patient bigint, items jsonb, prescription_note text, send_to text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
  drugs text;
begin
  if not (select private.is_doctor()) then
    raise exception 'Only a doctor can prescribe' using errcode = '42501';
  end if;
  if send_to not in ('front_desk', 'pharmacy') then
    raise exception 'Send it to the Front Desk or the Pharmacy' using errcode = '22023';
  end if;
  if not exists (select 1 from public.patients where id = patient and voided_at is null) then
    raise exception 'No such patient' using errcode = '22023';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 20 then
    raise exception 'Add between 1 and 20 drugs' using errcode = '22023';
  end if;

  -- Two taps at the same moment wait here for each other.
  perform pg_advisory_xact_lock(hashtext('prescribe:' || (select auth.uid())::text || ':' || patient::text));
  select string_agg(lower(trim(item ->> 'drug')), '|' order by lower(trim(item ->> 'drug')))
  into drugs from jsonb_array_elements(items) item;
  if exists (
    select 1 from public.prescriptions p
    where p.prescribed_by = (select auth.uid())
      and p.patient_id = patient
      and p.prescribed_at > now() - interval '30 seconds'
      and (select string_agg(lower(i.drug), '|' order by lower(i.drug))
           from public.prescription_items i where i.prescription_id = p.id) = drugs
  ) then
    return 'already_sent';
  end if;

  insert into public.prescriptions (patient_id, note, status)
  values (patient, nullif(trim(prescription_note), ''),
          case send_to when 'front_desk' then 'awaiting_payment'::public.prescription_status
                       else 'awaiting_dispense'::public.prescription_status end)
  returning id into new_id;

  insert into public.prescription_items (prescription_id, drug, strength, dose, how_often, days, quantity, note)
  select new_id, trim(item ->> 'drug'),
         nullif(trim(item ->> 'strength'), ''), nullif(trim(item ->> 'dose'), ''),
         nullif(trim(item ->> 'how_often'), ''), (item ->> 'days')::integer,
         nullif(trim(item ->> 'quantity'), ''), nullif(trim(item ->> 'note'), '')
  from jsonb_array_elements(items) item;
  return 'sent';
end;
$$;


-- ===== 7. The Front Desk takes payment for the drugs =====
-- lines: one price per drug. Answers: paid, or already_paid.

create function private.pay_prescription(prescription bigint, lines jsonb, paid_by public.payment_mode)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.prescriptions;
  new_payment bigint;
begin
  if not (select private.can_take_payment()) then
    raise exception 'Only the Front Desk can record payments' using errcode = '42501';
  end if;
  select * into wanted from public.prescriptions where id = prescription for update;
  if not found then
    raise exception 'No such prescription' using errcode = '22023';
  end if;
  if wanted.status <> 'awaiting_payment' then
    return 'already_paid';
  end if;

  new_payment := private.record_payment_lines(wanted.patient_id, 'drugs', lines, paid_by);
  update public.prescriptions set status = 'awaiting_dispense', payment_id = new_payment where id = prescription;
  return 'paid';
end;
$$;


-- ===== 8. The Pharmacy dispenses =====
-- The drugs join the patient's current medications. Answers: dispensed,
-- already_dispensed, or not_paid.

create function private.dispense_prescription(prescription bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.prescriptions;
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
  return 'dispensed';
end;
$$;


-- ===== 9. What the app may call =====

revoke execute on function private.pay_lab_request_lines(bigint, jsonb, public.payment_mode)   from public, anon;
revoke execute on function private.prescribe(bigint, jsonb, text, text)                        from public, anon;
revoke execute on function private.pay_prescription(bigint, jsonb, public.payment_mode)         from public, anon;
revoke execute on function private.dispense_prescription(bigint)                               from public, anon;
grant  execute on function private.pay_lab_request_lines(bigint, jsonb, public.payment_mode)   to authenticated;
grant  execute on function private.prescribe(bigint, jsonb, text, text)                        to authenticated;
grant  execute on function private.pay_prescription(bigint, jsonb, public.payment_mode)         to authenticated;
grant  execute on function private.dispense_prescription(bigint)                               to authenticated;

create function public.pay_lab_request_lines(request bigint, lines jsonb, paid_by public.payment_mode)
returns text language sql security invoker set search_path = ''
as $$ select private.pay_lab_request_lines(request, lines, paid_by); $$;

create function public.prescribe(patient bigint, items jsonb, prescription_note text, send_to text)
returns text language sql security invoker set search_path = ''
as $$ select private.prescribe(patient, items, prescription_note, send_to); $$;

create function public.pay_prescription(prescription bigint, lines jsonb, paid_by public.payment_mode)
returns text language sql security invoker set search_path = ''
as $$ select private.pay_prescription(prescription, lines, paid_by); $$;

create function public.dispense_prescription(prescription bigint)
returns text language sql security invoker set search_path = ''
as $$ select private.dispense_prescription(prescription); $$;

revoke execute on function public.pay_lab_request_lines(bigint, jsonb, public.payment_mode)   from public, anon;
revoke execute on function public.prescribe(bigint, jsonb, text, text)                        from public, anon;
revoke execute on function public.pay_prescription(bigint, jsonb, public.payment_mode)         from public, anon;
revoke execute on function public.dispense_prescription(bigint)                               from public, anon;
grant  execute on function public.pay_lab_request_lines(bigint, jsonb, public.payment_mode)   to authenticated;
grant  execute on function public.prescribe(bigint, jsonb, text, text)                        to authenticated;
grant  execute on function public.pay_prescription(bigint, jsonb, public.payment_mode)         to authenticated;
grant  execute on function public.dispense_prescription(bigint)                               to authenticated;

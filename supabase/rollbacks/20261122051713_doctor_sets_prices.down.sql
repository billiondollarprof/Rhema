-- =============================================================================
-- Undo 20261122051713_doctor_sets_prices.sql: no prices from the doctor; the
-- Front Desk types every price again.
-- =============================================================================

create or replace function private.pay_prescription(prescription bigint, lines jsonb, paid_by public.payment_mode)
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
  if wanted.payment_id is not null or wanted.status = 'voided' then
    return 'already_paid';
  end if;
  new_payment := private.record_payment_lines(wanted.patient_id, 'drugs', lines, paid_by);
  if wanted.status = 'awaiting_payment' then
    -- Waiting for payment: now the Pharmacy may dispense.
    update public.prescriptions set status = 'awaiting_dispense', payment_id = new_payment
    where id = prescription;
  else
    -- Sent straight to the Pharmacy: only the money is recorded.
    update public.prescriptions set payment_id = new_payment where id = prescription;
  end if;
  return 'paid';
end;
$$;

create or replace function private.pay_lab_request_lines(request bigint, lines jsonb, paid_by public.payment_mode)
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
  if wanted.payment_id is not null or wanted.status = 'voided' then
    return 'already_paid';
  end if;
  new_payment := private.record_payment_lines(wanted.patient_id, 'lab_test', lines, paid_by);
  if wanted.status = 'awaiting_payment' then
    -- Waiting for payment: now the Lab may take the sample.
    update public.lab_requests set status = 'awaiting_test', payment_id = new_payment where id = request;
  else
    -- Sent straight to the Lab: only the money is recorded.
    update public.lab_requests set payment_id = new_payment where id = request;
  end if;
  return 'paid';
end;
$$;

create or replace function private.prescribe(patient bigint, items jsonb, prescription_note text, send_to text)
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

create or replace function private.pay_lab_request(request bigint, amount_paid numeric, paid_by public.payment_mode)
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
  if amount_paid is null or amount_paid <= 0 or amount_paid >= 100000000 then
    raise exception 'Type the amount paid in naira' using errcode = '22023';
  end if;

  select * into wanted from public.lab_requests where id = request for update;
  if not found then
    raise exception 'No such lab request' using errcode = '22023';
  end if;
  if wanted.status <> 'awaiting_payment' then
    return 'already_paid';
  end if;

  insert into public.payments (patient_id, amount, purpose, mode, description)
  values (wanted.patient_id, round(amount_paid, 2), 'lab_test', paid_by,
          'Lab: ' || array_to_string(wanted.tests, ', '))
  returning id into new_payment;

  update public.lab_requests
  set status = 'awaiting_test', payment_id = new_payment
  where id = request;
  return 'paid';
end;
$$;

drop function public.request_lab(bigint, text[], text, text, jsonb);
drop function private.request_lab(bigint, text[], text, text, jsonb);
drop function private.check_set_prices(jsonb, jsonb);
drop function private.sets_prices();
drop table public.my_prices;
alter table public.lab_requests drop column prices;
alter table public.prescription_items drop column price;

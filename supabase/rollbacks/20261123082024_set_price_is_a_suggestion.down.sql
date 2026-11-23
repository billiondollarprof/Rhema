-- =============================================================================
-- Undo 20261123082024_set_price_is_a_suggestion.sql: the Front Desk pays
-- the doctor's prices again, and a bill is paid at its own amounts.
-- Loses no data.
-- =============================================================================

drop function public.pay_bill(bigint, jsonb, public.payment_mode);
drop function private.pay_bill(bigint, jsonb, public.payment_mode);

create function private.check_set_prices(set_prices jsonb, lines jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if exists (
    select 1 from jsonb_array_elements(set_prices) wanted
    where not exists (
      select 1 from jsonb_array_elements(lines) line
      where lower(trim(line ->> 'label')) = lower(trim(wanted ->> 'label'))
        and round((line ->> 'amount')::numeric, 2) = round((wanted ->> 'amount')::numeric, 2)
    )
  ) then
    raise exception 'price_changed: the doctor set this price' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function private.check_set_prices(jsonb, jsonb) from public, anon, authenticated;

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
  -- The prices the doctor set are not changed at the Front Desk (request 235).
  perform private.check_set_prices(
    (select coalesce(jsonb_agg(jsonb_build_object(
       'label', concat_ws(' ', i.drug, i.strength), 'amount', i.price)), '[]'::jsonb)
     from public.prescription_items i
     where i.prescription_id = prescription and i.price is not null),
    lines);
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
  -- The prices the doctor set are not changed at the Front Desk (request 235).
  perform private.check_set_prices(
    (select coalesce(jsonb_agg(jsonb_build_object('label', price.key, 'amount', price.value)), '[]'::jsonb)
     from jsonb_each(coalesce(wanted.prices, '{}'::jsonb)) price),
    lines);
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
  -- A request the doctor priced is paid line by line, at the doctor's prices
  -- (pay_lab_request_lines), never as one typed total (request 235).
  if wanted.prices is not null and wanted.prices <> '{}'::jsonb then
    raise exception 'price_changed: the doctor set this price' using errcode = '22023';
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

create function private.pay_bill(bill bigint, paid_by public.payment_mode)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.bills;
  new_payment bigint;
begin
  if not (select private.can_take_payment()) then
    raise exception 'Only the Front Desk can record payments' using errcode = '42501';
  end if;
  -- Locked until this payment is saved, so two desks cannot both pay it.
  select * into wanted from public.bills where id = bill for update;
  if not found then
    raise exception 'No such bill' using errcode = '22023';
  end if;
  if wanted.status = 'voided' then
    return 'voided';
  end if;
  if wanted.status = 'paid' then
    return 'already_paid';
  end if;

  new_payment := private.record_payment_lines(
    wanted.patient_id,
    'bill'::public.payment_purpose,
    (select jsonb_agg(jsonb_build_object('label', l.item, 'amount', l.amount) order by l.id)
     from public.bill_lines l where l.bill_id = bill),
    paid_by);
  update public.bills set status = 'paid', payment_id = new_payment where id = bill;
  return 'paid';
end;
$$;

revoke execute on function private.pay_bill(bigint, public.payment_mode) from public, anon;
grant  execute on function private.pay_bill(bigint, public.payment_mode) to authenticated;

create function public.pay_bill(bill bigint, paid_by public.payment_mode)
returns text
language sql
set search_path = ''
as $$ select private.pay_bill(bill, paid_by); $$;

revoke execute on function public.pay_bill(bigint, public.payment_mode) from public, anon;
grant  execute on function public.pay_bill(bigint, public.payment_mode) to authenticated;

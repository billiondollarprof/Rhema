-- =============================================================================
-- 20261123082024_set_price_is_a_suggestion.sql
--
-- What this is: a price set by a doctor, the matron (or, later, the lab) is
-- a suggestion. The Front Desk sees it filled in and can change it before
-- taking payment, for drugs, lab tests and bills.
--
-- Why: Anthony, 2026-11-22 (request 239): "the front desk should not wait.
-- most times the front desk already knows the price, and the front desk can
-- also edit the price set by the doctor. A set price only acts as a
-- suggestion not a blocker or a must." His yes to the batch: "Yes".
-- This reverses the rule of 20261122051713 ("The front desk cannot change
-- the price").
--
-- Rules:
--   - Paying drugs and lab tests no longer checks the amounts against the
--     doctor's prices. The one-total lab payment takes a priced request too.
--   - Paying a bill takes the lines the Front Desk typed, like drugs and
--     tests. The bill's own lines stay as the doctor wrote them.
--   - Unchanged: only the Front Desk takes payment; each thing is paid once
--     (the row is locked while it is paid); every payment and its lines are
--     in the activity log, so a changed price can always be traced.
--
-- Never: let anybody but the Front Desk take payment, or pay one thing twice.
-- =============================================================================


-- ===== 1. Drugs and lab tests: the doctor's prices are a suggestion =====
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


-- ===== 2. The one-total lab payment takes a priced request too =====
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


-- ===== 3. Paying a bill: the amounts the Front Desk typed =====
-- The old payment took the amounts from the bill; it goes.
drop function public.pay_bill(bigint, public.payment_mode);
drop function private.pay_bill(bigint, public.payment_mode);

-- lines: [{label, amount}]. Answers paid, already_paid or voided.
create function private.pay_bill(bill bigint, lines jsonb, paid_by public.payment_mode)
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

  -- The lines are checked (a name, an amount above 0) and added up here.
  new_payment := private.record_payment_lines(wanted.patient_id, 'bill'::public.payment_purpose, lines, paid_by);
  update public.bills set status = 'paid', payment_id = new_payment where id = bill;
  return 'paid';
end;
$$;

revoke execute on function private.pay_bill(bigint, jsonb, public.payment_mode) from public, anon;
grant  execute on function private.pay_bill(bigint, jsonb, public.payment_mode) to authenticated;

create function public.pay_bill(bill bigint, lines jsonb, paid_by public.payment_mode)
returns text
language sql
set search_path = ''
as $$ select private.pay_bill(bill, lines, paid_by); $$;

revoke execute on function public.pay_bill(bigint, jsonb, public.payment_mode) from public, anon;
grant  execute on function public.pay_bill(bigint, jsonb, public.payment_mode) to authenticated;


-- ===== 4. The price check is no longer used =====
drop function private.check_set_prices(jsonb, jsonb);

-- =============================================================================
-- 20261118170917_pay_whatever_is_unpaid.sql
--
-- What this is: the Front Desk can take payment for any prescription or lab
-- test that has not been paid, however it was sent. One sent straight to the
-- Pharmacy or the Lab, even one already given or tested, stays unpaid until
-- the Front Desk takes the money, and paying it never changes its status.
--
-- Why: Anthony, 2026-11-18 (request 227k): "Even if the drug is dispensed,
-- it should also show that they have not made payment for it until the
-- front desk marks it as payment has been made or takes payment for it...
-- Anything awaiting payment will always show." Before, one sent straight to
-- the Pharmacy could only be paid if the doctor also sent it to the Front
-- Desk (request 130c), and a lab test sent straight to the Lab never.
--
-- Rules:
--   - Only the Front Desk (or an admin) takes money, as before.
--   - Paid once: a second payment answers 'already_paid'.
--   - Waiting for payment: paying releases it (to dispense, to test), as
--     before. Sent straight through: paying only records the money.
--   - A cancelled (voided) one is never paid.
--   - Who sees what does not change: the Front Desk already sees the drug
--     lines and the tests, never the rest of the record.
--
-- Never: take money twice, or let paying undo a dispense or a result.
-- =============================================================================


-- ===== 1. Prescriptions: any one not paid and not cancelled =====
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


-- ===== 2. Lab tests: any request not paid and not cancelled =====
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

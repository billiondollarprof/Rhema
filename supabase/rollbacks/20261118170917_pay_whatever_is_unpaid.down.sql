-- =============================================================================
-- Undo 20261118170917_pay_whatever_is_unpaid.sql: puts back the two payment
-- functions as they were (straight to the Pharmacy: paid only when also sent
-- to the Front Desk; straight to the Lab: never paid).
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
  if wanted.payment_id is not null then
    return 'already_paid';
  end if;
  if wanted.status = 'awaiting_payment' then
    new_payment := private.record_payment_lines(wanted.patient_id, 'drugs', lines, paid_by);
    update public.prescriptions set status = 'awaiting_dispense', payment_id = new_payment where id = prescription;
    return 'paid';
  end if;
  if wanted.also_sent and wanted.status in ('awaiting_dispense', 'dispensed') then
    new_payment := private.record_payment_lines(wanted.patient_id, 'drugs', lines, paid_by);
    update public.prescriptions set payment_id = new_payment where id = prescription;
    return 'paid';
  end if;
  return 'already_paid';
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
  if wanted.status <> 'awaiting_payment' then
    return 'already_paid';
  end if;

  new_payment := private.record_payment_lines(wanted.patient_id, 'lab_test', lines, paid_by);
  update public.lab_requests set status = 'awaiting_test', payment_id = new_payment where id = request;
  return 'paid';
end;
$$;

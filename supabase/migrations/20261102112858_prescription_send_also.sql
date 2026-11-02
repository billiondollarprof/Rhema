-- =============================================================================
-- prescription_send_also: after a doctor sends a prescription to the Front
-- Desk or straight to the Pharmacy, "Send also to" shows it to the other one
-- as well (request 130c).
--
-- Why: Anthony, 2026-11-02: "a softer button... by the side of back to the
-- record... send also to front desk... So in case they want to just
-- quickly send to both pharmacy and front desk."
--
-- What it means:
--   - Sent to the Front Desk, also to the Pharmacy: the Pharmacy sees it
--     and can get the drugs ready, but still cannot dispense until it is
--     paid (as before).
--   - Sent straight to the Pharmacy, also to the Front Desk: the Front Desk
--     sees it and takes payment once. The Pharmacy may dispense as before,
--     without waiting.
--
-- Rules: only the doctor who wrote it sends it also; once is enough;
-- payment is still taken once only.
--
-- Never: let the Pharmacy dispense a prescription sent to the Front Desk
-- before it is paid.
-- =============================================================================


-- ===== 1. The mark =====

alter table public.prescriptions
  add column also_sent boolean not null default false;


-- ===== 2. Send also =====
-- Answers 'sent' or 'already_sent'.

create function private.send_prescription_also(prescription bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.prescriptions;
begin
  select * into wanted from public.prescriptions where id = prescription for update;
  if wanted.id is null or wanted.prescribed_by is distinct from auth.uid() or not private.is_doctor() then
    raise exception 'Only the doctor who wrote it can send it' using errcode = '42501';
  end if;
  if wanted.status = 'voided' then
    raise exception 'This prescription was cancelled' using errcode = '22023';
  end if;
  if wanted.also_sent then
    return 'already_sent';
  end if;
  update public.prescriptions set also_sent = true where id = prescription;
  return 'sent';
end;
$$;

revoke execute on function private.send_prescription_also(bigint) from public, anon;
grant  execute on function private.send_prescription_also(bigint) to authenticated;

create function public.send_prescription_also(prescription bigint)
returns text
language sql
security invoker
set search_path = ''
as $$ select private.send_prescription_also(prescription) $$;

revoke execute on function public.send_prescription_also(bigint) from public, anon;
grant  execute on function public.send_prescription_also(bigint) to authenticated;


-- ===== 3. Payment, now also for one sent straight to the Pharmacy =====
-- Same as before, plus: a prescription that went straight to the Pharmacy
-- and was also sent to the Front Desk may be paid once, whatever its
-- status, without changing that status.

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

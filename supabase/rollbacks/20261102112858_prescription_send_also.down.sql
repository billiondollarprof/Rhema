-- =============================================================================
-- Undo for prescription_send_also: payment back to how it was (Front Desk
-- list only), and the "sent also" mark and its function removed.
-- =============================================================================

drop function if exists public.send_prescription_also(bigint);
drop function if exists private.send_prescription_also(bigint);

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
  if wanted.status <> 'awaiting_payment' then
    return 'already_paid';
  end if;

  new_payment := private.record_payment_lines(wanted.patient_id, 'drugs', lines, paid_by);
  update public.prescriptions set status = 'awaiting_dispense', payment_id = new_payment where id = prescription;
  return 'paid';
end;
$$;

alter table public.prescriptions drop column if exists also_sent;

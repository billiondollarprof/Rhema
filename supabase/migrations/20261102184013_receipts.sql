-- =============================================================================
-- receipts: every payment gets a receipt number, and the Front Desk can take
-- any other payment (card, consultation, scan, admission...) with a price
-- per line (request 123, part 2, "other payments with printable receipts").
--
-- Why: Anthony, 2026-10-31: "other payments with printable receipts... the
-- receipts, you can also either print it or send to email." 2026-11-02:
-- "they can print receipts anyhow many times they want... if the patient
-- pay extra money, it updates automatically and they can still print it
-- again."
--
-- Rules:
--   - A receipt number (RCT-000001) is given by the database to every
--     payment, old and new, never typed, never changed.
--   - take_payment: the Front Desk or an admin; one price per line, the
--     database adds them up; the same payment by the same person for the
--     same patient within 3 minutes is taken once (money: CLAUDE.md 10).
--   - Who can read payments stays as it is: the Front Desk and admins.
--
-- Never: take the same money twice, or let a receipt number change.
-- =============================================================================


-- ===== 1. Receipt numbers =====

create sequence private.receipt_number_seq;

alter table public.payments add column receipt_number text unique;

-- Payments made before this get numbers now, in the order they were taken.
update public.payments p
   set receipt_number = 'RCT-' || lpad(nextval('private.receipt_number_seq')::text, 6, '0')
  from (select id from public.payments order by received_at, id) ordered
 where p.id = ordered.id and p.receipt_number is null;

alter table public.payments alter column receipt_number set not null;

create function private.protect_receipt_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.receipt_number := 'RCT-' || lpad(nextval('private.receipt_number_seq')::text, 6, '0');
  elsif new.receipt_number is distinct from old.receipt_number then
    raise exception 'A receipt number cannot be changed';
  end if;
  return new;
end;
$$;

revoke execute on function private.protect_receipt_number() from public, anon, authenticated;

create trigger payments_protect_receipt_number
  before insert or update on public.payments
  for each row execute function private.protect_receipt_number();


-- ===== 2. Take any other payment =====
-- Answers the new payment's id, or the id of the same payment taken in the
-- last 3 minutes (a double tap or a slow network sending twice).

create function private.take_payment(
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
  wanted text;
  earlier bigint;
begin
  if not (select private.can_take_payment()) then
    raise exception 'Only the Front Desk can record payments' using errcode = '42501';
  end if;
  if not exists (select 1 from public.patients where id = patient and voided_at is null) then
    raise exception 'No such patient' using errcode = '22023';
  end if;
  if jsonb_typeof(lines) <> 'array' then
    raise exception 'Type a price for each line' using errcode = '22023';
  end if;

  -- Two taps at the same moment wait here for each other.
  perform pg_advisory_xact_lock(hashtext('take_payment:' || auth.uid()::text || ':' || patient));

  -- The same lines, purpose and mode for this patient by this person in the
  -- last 3 minutes: that payment, not a second one.
  select coalesce(sum(round((line ->> 'amount')::numeric, 2)), 0) into total
  from jsonb_array_elements(lines) line;
  select string_agg(trim(line ->> 'label') || '=' || round((line ->> 'amount')::numeric, 2), '|' order by trim(line ->> 'label'))
    into wanted from jsonb_array_elements(lines) line;
  select p.id into earlier
  from public.payments p
  where p.patient_id = patient
    and p.received_by = auth.uid()
    and p.purpose = what
    and p.mode = paid_by
    -- (The lines below already compare every amount; this is a quick
    -- first filter on the total.)
    and p.amount = total
    and p.voided_at is null
    and p.received_at > now() - interval '3 minutes'
    and (select string_agg(l.label || '=' || l.amount, '|' order by l.label)
           from public.payment_lines l where l.payment_id = p.id) = wanted
  order by p.received_at desc
  limit 1;
  if earlier is not null then
    return earlier;
  end if;

  return private.record_payment_lines(patient, what, lines, paid_by);
end;
$$;

revoke execute on function private.take_payment(bigint, public.payment_purpose, jsonb, public.payment_mode) from public, anon;
grant  execute on function private.take_payment(bigint, public.payment_purpose, jsonb, public.payment_mode) to authenticated;

create function public.take_payment(
  patient bigint,
  what public.payment_purpose,
  lines jsonb,
  paid_by public.payment_mode
)
returns bigint
language sql
security invoker
set search_path = ''
as $$ select private.take_payment(patient, what, lines, paid_by) $$;

revoke execute on function public.take_payment(bigint, public.payment_purpose, jsonb, public.payment_mode) from public, anon;
grant  execute on function public.take_payment(bigint, public.payment_purpose, jsonb, public.payment_mode) to authenticated;

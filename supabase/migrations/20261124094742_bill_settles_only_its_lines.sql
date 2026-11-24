-- =============================================================================
-- 20261124094742_bill_settles_only_its_lines.sql
--
-- What this is: an inpatient's bill settles only what is on it. The stay's
-- prescriptions are covered only when the bill has a Take Home Drugs line,
-- its lab tests only with a Laboratory tests line, and its doses given only
-- with a Medicines given line. What is left off stays for the next bill (or
-- is paid on its own at the Front Desk).
--
-- Why: Anthony, 2026-11-24 (request 245): "the receipt must not contain what
-- does not have an amount. If a line is not selected, it should not appear
-- on the receipt. Only what was selected while prep[ar]ing the bill shows on
-- the receipt." Until now sending a bill settled every drug and test of the
-- stay, so those lines could not be left off.
--
-- Rules: the same as 20261123215523 add_bill, with the three checks above.
--
-- Never: settle a prescription, a lab test or a dose that is not charged on
-- the bill.
-- =============================================================================


-- ===== 1. Add a bill: settle only the stay's lines that are on it =====
create or replace function private.add_bill(patient bigint, lines jsonb, bill_note text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  total numeric(12, 2);
  new_bill bigint;
  stay public.admissions;
  -- Which of the stay's lines the doctor kept on this bill (request 245).
  has_medicines boolean;
  has_take_home boolean;
  has_labs boolean;
begin
  if not (select private.sets_prices()) then
    raise exception 'Only a doctor or the matron adds a bill' using errcode = '42501';
  end if;
  if jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) not between 1 and 40 then
    raise exception 'Add between 1 and 40 lines' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(lines) line
    where coalesce(line ->> 'kind', '') not in (
            'professional_fee', 'nursing_fee', 'procedure_surgery', 'anaesthetics', 'oxygen',
            'phototherapy', 'blood_transfusion', 'delivery', 'episiotomy_repair',
            'bed_regular', 'bed_private', 'bed_vip', 'orals', 'injectable',
            'infusion_cannulation', 'consumables', 'antibiotics', 'take_home_drugs', 'others',
            'medicines_given', 'lab_tests',
            'procedure', 'operation', 'bed', 'consultation', 'dressing', 'catheter', 'other')
       or length(trim(coalesce(line ->> 'item', ''))) not between 2 and 120
       or coalesce((line ->> 'amount')::numeric, 0) <= 0
       or (line ->> 'amount')::numeric >= 100000000
  ) then
    raise exception 'Each line needs a kind, a name and an amount above 0' using errcode = '22023';
  end if;
  if bill_note is not null and length(bill_note) > 500 then
    raise exception 'The note is too long' using errcode = '22023';
  end if;
  if not exists (select 1 from public.patients where id = patient and voided_at is null) then
    raise exception 'No such patient' using errcode = '22023';
  end if;

  select sum(round((line ->> 'amount')::numeric, 2)) into total from jsonb_array_elements(lines) line;

  -- Two taps at the same moment wait here for each other; the second finds
  -- the first and is refused.
  perform pg_advisory_xact_lock(hashtext('bill:' || me::text || ':' || patient::text));
  if exists (
    select 1 from public.bills b
    where b.created_by = me
      and b.patient_id = patient
      and b.created_at > now() - interval '30 seconds'
      and (select sum(l.amount) from public.bill_lines l where l.bill_id = b.id) = total
  ) then
    return 'already_sent';
  end if;

  select * into stay from public.admissions where patient_id = patient and discharged_at is null;
  select bool_or(line ->> 'kind' = 'medicines_given'),
         bool_or(line ->> 'kind' = 'take_home_drugs'),
         bool_or(line ->> 'kind' = 'lab_tests')
    into has_medicines, has_take_home, has_labs
  from jsonb_array_elements(lines) line;

  insert into public.bills (patient_id, note, created_by, admission_id, medicines_until,
                            covers_prescriptions, covers_labs)
  values (
    patient, nullif(trim(bill_note), ''), me, stay.id,
    -- Only with a Medicines given line: else the doses stay for the next bill.
    case when stay.id is not null and has_medicines then now() end,
    -- An inpatient's prescriptions and lab tests of this stay, not on a bill yet.
    coalesce((select array_agg(p.id) from public.prescriptions p
              where stay.id is not null and has_take_home and p.patient_id = patient and p.status <> 'voided'
                and p.prescribed_at >= stay.admitted_at
                and not exists (select 1 from public.bills b
                                where b.patient_id = patient and b.status <> 'voided'
                                  and p.id = any (b.covers_prescriptions))), '{}'),
    coalesce((select array_agg(r.id) from public.lab_requests r
              where stay.id is not null and has_labs and r.patient_id = patient and r.status <> 'voided'
                and r.requested_at >= stay.admitted_at
                and not exists (select 1 from public.bills b
                                where b.patient_id = patient and b.status <> 'voided'
                                  and r.id = any (b.covers_labs))), '{}')
  )
  returning id into new_bill;

  insert into public.bill_lines (bill_id, kind, item, amount)
  select new_bill, line ->> 'kind', trim(line ->> 'item'), round((line ->> 'amount')::numeric, 2)
  from jsonb_array_elements(lines) line;

  -- This person's price for next time (request 235); not for the lines
  -- worked out from the stay.
  insert into public.my_prices (staff_id, kind, item, amount)
  select me, 'procedure', lower(trim(line ->> 'item')), round((line ->> 'amount')::numeric, 2)
  from jsonb_array_elements(lines) line
  where line ->> 'kind' not in ('medicines_given', 'lab_tests', 'take_home_drugs')
  on conflict (staff_id, kind, item) do update set amount = excluded.amount, updated_at = now();

  return 'sent';
end;
$$;


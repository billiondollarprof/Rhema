-- =============================================================================
-- Undo 20261123215523_inpatient_bill.sql: admissions, chart dispenses, the
-- bill statement and the chart prices go; bills go back to their first
-- kinds; the Pharmacy's list and paying a bill go back to before.
--
-- On live this loses every admission, every chart dispense, the chart's days,
-- doses and dose prices, and the stay on each bill: it needs Anthony's
-- explicit yes in writing first. Bills made with the new kinds stop the
-- undo (the old kinds check would refuse them); they must be dealt with by
-- hand first, with his yes.
--
-- The payment kind "deposit" stays: Postgres cannot take a value out of a
-- list of choices.
-- =============================================================================

drop function public.bill_statement(bigint);
drop function private.bill_statement(bigint);

drop function public.dispense_chart(bigint, integer);
drop function private.dispense_chart(bigint, integer);
drop table public.chart_dispenses;

drop trigger patient_medications_dose_price on public.patient_medications;
drop function private.check_dose_price();
alter table public.patient_medications drop column days, drop column doses, drop column dose_price;

drop index public.bills_admission_idx;
alter table public.bills
  drop column admission_id, drop column medicines_until,
  drop column covers_prescriptions, drop column covers_labs;

alter table public.bill_lines drop constraint bill_lines_kind_check;
alter table public.bill_lines add constraint bill_lines_kind_check
  check (kind in ('procedure', 'operation', 'bed', 'consultation', 'dressing', 'catheter', 'other'));

drop function public.admit_patient(bigint);
drop function private.admit_patient(bigint);
drop function public.discharge_patient(bigint);
drop function private.discharge_patient(bigint);
drop table public.admissions;
drop function private.can_admit();
drop function private.can_discharge();

-- The Pharmacy's list, as 20261112113500 left it.
create or replace function private.patient_medicines_for_pharmacy(p_patient bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found jsonb;
begin
  if not (select private.is_pharmacist()) then
    raise exception 'Only the Pharmacy can look at a patient''s medicines here' using errcode = '42501';
  end if;
  if not exists (select 1 from public.patients where id = p_patient and voided_at is null) then
    raise exception 'No such patient' using errcode = '22023';
  end if;

  -- Written down first: a look at the record is always logged.
  insert into public.activity_log (actor_id, action, table_name, record_id, patient_id)
  values ((select auth.uid()), 'read', 'patient_medications', p_patient::text, p_patient);

  select coalesce(jsonb_agg(row_to_json(line) order by line.rank, line.started desc), '[]'::jsonb)
  into found
  from (
    select
      m.id,
      m.medicine,
      m.dose,
      m.how_often,
      m.status,
      m.created_at as started,
      adder.full_name as added_by,
      last.new_status as last_change,
      last.reason as last_reason,
      last.changed_at as last_changed_at,
      case m.status when 'active' then 0 when 'suspended' then 1 else 2 end as rank
    from public.patient_medications m
    left join public.staff adder on adder.id = m.added_by
    left join lateral (
      select l.new_status, l.reason, l.changed_at
      from public.medication_status_log l
      where l.medication_id = m.id and l.old_status is not null
      order by l.changed_at desc
      limit 1
    ) last on true
    where m.patient_id = p_patient and m.voided_at is null
  ) line;

  return found;
end;
$$;

-- Adding a bill, as 20261122204301 left it.
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
begin
  if not (select private.sets_prices()) then
    raise exception 'Only a doctor or the matron adds a bill' using errcode = '42501';
  end if;
  if jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) not between 1 and 20 then
    raise exception 'Add between 1 and 20 lines' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(lines) line
    where coalesce(line ->> 'kind', '') not in
            ('procedure', 'operation', 'bed', 'consultation', 'dressing', 'catheter', 'other')
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

  insert into public.bills (patient_id, note, created_by)
  values (patient, nullif(trim(bill_note), ''), me)
  returning id into new_bill;

  insert into public.bill_lines (bill_id, kind, item, amount)
  select new_bill, line ->> 'kind', trim(line ->> 'item'), round((line ->> 'amount')::numeric, 2)
  from jsonb_array_elements(lines) line;

  -- This person's price for next time (request 235).
  insert into public.my_prices (staff_id, kind, item, amount)
  select me, 'procedure', lower(trim(line ->> 'item')), round((line ->> 'amount')::numeric, 2)
  from jsonb_array_elements(lines) line
  on conflict (staff_id, kind, item) do update set amount = excluded.amount, updated_at = now();

  return 'sent';
end;
$$;

-- Paying a bill, as 20261123082024 left it.
create or replace function private.pay_bill(bill bigint, lines jsonb, paid_by public.payment_mode)
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

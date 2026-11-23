-- =============================================================================
-- 20261123215523_inpatient_bill.sql
--
-- What this is: inpatients and their bill.
--   A. Admit and discharge (admissions).
--   B. "Deposit" as a kind of payment.
--   C. The medicine chart: days, doses and a price per dose; the Pharmacy
--      dispenses from the chart (chart_dispenses) and sees doses given,
--      dispensed and left.
--   D. The bill: the hospital's Discharge / Billing Form lines; a bill tied
--      to the stay; the bill statement (everything charged and paid since
--      admission, and the balance); paying a bill also settles the unpaid
--      prescriptions and lab tests it covered.
--
-- Why: the director and Anthony, 2026-11-23 (requests 240 and 242). His yes
-- to the 13 points: "Yes". In his words: "every medicine in medicine chart
-- that has been given would appear automatically in the bill... with the
-- prices that the doctor used to input when he was charting"; "any deposit
-- they are making as they are staying is counting towards their stay as
-- against the services they are receiving... pay the balance difference";
-- "people that can tap admit are the doctor, the matron, the front desk";
-- the chart the Epic and Bahmni way: "a very nice and easy flow... go on
-- with it"; the Pharmacy "just see the chart... They don't need the full
-- medical record"; "the receipt should not be naming the name of medicine
-- or name of test".
--
-- Rules:
--   - Admit: a doctor or anybody in a consulting room (private.is_doctor),
--     the matron, or the Front Desk. Discharge: a doctor or anybody in a
--     consulting room, or the matron. One open stay per patient.
--   - Everybody signed in reads admissions (the Inpatient mark).
--   - A price per dose on the chart: only the people who set prices
--     (private.sets_prices). A medicine from a dispensed prescription has
--     none, so it is never billed twice.
--   - Chart dispenses: the Pharmacy writes them, through dispense_chart; the
--     record and the Pharmacy read them. 30 seconds double tap guard.
--   - The bill statement: the people who set prices, the Front Desk and the
--     admin. Each look is written to the activity log.
--   - Paying a bill: unchanged (the Front Desk, once), and the unpaid
--     prescriptions and lab tests it covered take the same payment.
--
-- Never: let anybody but the Pharmacy write a chart dispense, let anybody
-- but a price setter put a price on a chart medicine, or charge a covered
-- prescription or lab test twice.
-- =============================================================================


-- ===== 1. Who may admit, and who may discharge =====
create function private.can_admit()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_doctor())
      or (select private.is_front_desk())
      or exists (select 1 from public.staff
                 where id = (select auth.uid()) and is_active and role = 'matron');
$$;

create function private.can_discharge()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.is_doctor())
      or exists (select 1 from public.staff
                 where id = (select auth.uid()) and is_active and role = 'matron');
$$;

revoke execute on function private.can_admit()     from public, anon;
revoke execute on function private.can_discharge() from public, anon;
grant  execute on function private.can_admit()     to authenticated;
grant  execute on function private.can_discharge() to authenticated;


-- ===== 2. Admissions =====
create table public.admissions (
  id             bigint generated always as identity primary key,
  patient_id     bigint not null references public.patients (id),
  admitted_at    timestamptz not null default now(),
  admitted_by    uuid not null default auth.uid() references public.staff (id),
  discharged_at  timestamptz,
  discharged_by  uuid references public.staff (id)
);

-- One open stay per patient.
create unique index admissions_one_open on public.admissions (patient_id) where discharged_at is null;
create index admissions_patient_idx on public.admissions (patient_id, admitted_at desc);

revoke all on public.admissions from anon, authenticated;
alter table public.admissions enable row level security;
grant select on public.admissions to authenticated;

create policy admissions_read on public.admissions
  for select to authenticated
  using ((select private.is_active_staff()));

create trigger admissions_activity
  after insert or update on public.admissions
  for each row execute function private.write_activity();

-- Admit: answers admitted, or already_admitted.
create function private.admit_patient(patient bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.can_admit()) then
    raise exception 'Only a doctor, the matron or the Front Desk admits a patient' using errcode = '42501';
  end if;
  if not exists (select 1 from public.patients where id = patient and voided_at is null) then
    raise exception 'No such patient' using errcode = '22023';
  end if;
  -- Two taps at the same moment wait here; the second finds the first.
  perform pg_advisory_xact_lock(hashtext('admit:' || patient::text));
  if exists (select 1 from public.admissions where patient_id = patient and discharged_at is null) then
    return 'already_admitted';
  end if;
  insert into public.admissions (patient_id) values (patient);
  return 'admitted';
end;
$$;

-- Discharge: answers discharged, or not_admitted.
create function private.discharge_patient(patient bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.can_discharge()) then
    raise exception 'Only a doctor or the matron discharges a patient' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('admit:' || patient::text));
  update public.admissions
     set discharged_at = now(), discharged_by = (select auth.uid())
   where patient_id = patient and discharged_at is null;
  if not found then
    return 'not_admitted';
  end if;
  return 'discharged';
end;
$$;

revoke execute on function private.admit_patient(bigint)     from public, anon;
revoke execute on function private.discharge_patient(bigint) from public, anon;
grant  execute on function private.admit_patient(bigint)     to authenticated;
grant  execute on function private.discharge_patient(bigint) to authenticated;

create function public.admit_patient(patient bigint)
returns text language sql set search_path = ''
as $$ select private.admit_patient(patient); $$;
create function public.discharge_patient(patient bigint)
returns text language sql set search_path = ''
as $$ select private.discharge_patient(patient); $$;

revoke execute on function public.admit_patient(bigint)     from public, anon;
revoke execute on function public.discharge_patient(bigint) from public, anon;
grant  execute on function public.admit_patient(bigint)     to authenticated;
grant  execute on function public.discharge_patient(bigint) to authenticated;


-- ===== 3. Deposit, a kind of payment =====
-- Not used in this file, so it may be added inside the same transaction.
alter type public.payment_purpose add value if not exists 'deposit';


-- ===== 4. The chart: days, doses and a price per dose =====
alter table public.patient_medications
  add column days       integer check (days is null or days between 1 and 365),
  add column doses      integer check (doses is null or doses between 1 and 1000),
  add column dose_price numeric(12, 2) check (dose_price is null or (dose_price > 0 and dose_price < 100000000));

-- Only a price setter puts a price on, or changes it. Functions that copy a
-- dispensed prescription onto the chart never set one.
create function private.check_dose_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.dose_price is distinct from (case when tg_op = 'UPDATE' then old.dose_price end)
     and not (select private.sets_prices()) then
    raise exception 'Only a doctor or the matron sets the price of a dose' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.check_dose_price() from public, anon, authenticated;

create trigger patient_medications_dose_price
  before insert or update on public.patient_medications
  for each row execute function private.check_dose_price();


-- ===== 5. The Pharmacy dispenses from the chart =====
create table public.chart_dispenses (
  id             bigint generated always as identity primary key,
  medication_id  bigint not null references public.patient_medications (id),
  patient_id     bigint not null references public.patients (id),
  doses          integer not null check (doses between 1 and 1000),
  dispensed_by   uuid not null default auth.uid() references public.staff (id),
  dispensed_at   timestamptz not null default now()
);

create index chart_dispenses_medication_idx on public.chart_dispenses (medication_id);
create index chart_dispenses_patient_idx    on public.chart_dispenses (patient_id, dispensed_at desc);

revoke all on public.chart_dispenses from anon, authenticated;
alter table public.chart_dispenses enable row level security;
grant select on public.chart_dispenses to authenticated;

create policy chart_dispenses_read on public.chart_dispenses
  for select to authenticated
  using (private.can_use_record(patient_id) or (select private.is_pharmacist()));

create trigger chart_dispenses_activity
  after insert or update on public.chart_dispenses
  for each row execute function private.write_activity();

-- Answers dispensed, or already_dispensed (the same, a moment ago).
create function private.dispense_chart(medication bigint, how_many integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted public.patient_medications;
begin
  if not (select private.is_pharmacist()) then
    raise exception 'Only the Pharmacy dispenses' using errcode = '42501';
  end if;
  if how_many is null or how_many not between 1 and 1000 then
    raise exception 'Dispense between 1 and 1000 doses' using errcode = '22023';
  end if;
  select * into wanted from public.patient_medications where id = medication and voided_at is null;
  if not found then
    raise exception 'No such medicine on the chart' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('chart-dispense:' || medication::text));
  if exists (
    select 1 from public.chart_dispenses
    where medication_id = medication
      and dispensed_by = (select auth.uid())
      and doses = how_many
      and dispensed_at > now() - interval '30 seconds'
  ) then
    return 'already_dispensed';
  end if;
  insert into public.chart_dispenses (medication_id, patient_id, doses)
  values (medication, wanted.patient_id, how_many);
  return 'dispensed';
end;
$$;

revoke execute on function private.dispense_chart(bigint, integer) from public, anon;
grant  execute on function private.dispense_chart(bigint, integer) to authenticated;

create function public.dispense_chart(medication bigint, how_many integer)
returns text language sql set search_path = ''
as $$ select private.dispense_chart(medication, how_many); $$;

revoke execute on function public.dispense_chart(bigint, integer) from public, anon;
grant  execute on function public.dispense_chart(bigint, integer) to authenticated;


-- ===== 6. What the Pharmacy sees: also doses, given, dispensed =====
-- The same as 20261112113500, with doses, doses given and doses dispensed.
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
      m.doses,
      -- Doses the nurses gave (a dose marked not given does not count).
      (select count(*) from public.medications_given g
        where g.medication_id = m.id and g.voided_at is null and g.not_given_reason is null) as given,
      (select coalesce(sum(d.doses), 0) from public.chart_dispenses d
        where d.medication_id = m.id) as dispensed,
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


-- ===== 7. The bill: the form's lines, tied to the stay =====
alter table public.bill_lines drop constraint bill_lines_kind_check;
alter table public.bill_lines add constraint bill_lines_kind_check check (kind in (
  -- The hospital's Discharge / Billing Form (2026-11-23).
  'professional_fee', 'nursing_fee', 'procedure_surgery', 'anaesthetics', 'oxygen',
  'phototherapy', 'blood_transfusion', 'delivery', 'episiotomy_repair',
  'bed_regular', 'bed_private', 'bed_vip', 'orals', 'injectable',
  'infusion_cannulation', 'consumables', 'antibiotics', 'take_home_drugs', 'others',
  -- Worked out from the stay.
  'medicines_given', 'lab_tests',
  -- The first kinds (20261122204301), kept for the bills already made.
  'procedure', 'operation', 'bed', 'consultation', 'dressing', 'catheter', 'other'));

alter table public.bills
  add column admission_id      bigint references public.admissions (id),
  -- Doses given up to this moment are on this bill; the next bill counts after it.
  add column medicines_until   timestamptz,
  -- The unpaid prescriptions and lab tests this bill covers.
  add column covers_prescriptions bigint[] not null default '{}',
  add column covers_labs          bigint[] not null default '{}';

create index bills_admission_idx on public.bills (admission_id);


-- ===== 8. Add a bill: the new kinds, and the stay =====
-- The same as 20261122204301, with the form's kinds, and for an inpatient:
-- the stay, the moment for medicines, and the prescriptions and lab tests
-- of the stay not on a bill yet.
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

  insert into public.bills (patient_id, note, created_by, admission_id, medicines_until,
                            covers_prescriptions, covers_labs)
  values (
    patient, nullif(trim(bill_note), ''), me, stay.id,
    case when stay.id is not null then now() end,
    -- An inpatient's prescriptions and lab tests of this stay, not on a bill yet.
    coalesce((select array_agg(p.id) from public.prescriptions p
              where stay.id is not null and p.patient_id = patient and p.status <> 'voided'
                and p.prescribed_at >= stay.admitted_at
                and not exists (select 1 from public.bills b
                                where b.patient_id = patient and b.status <> 'voided'
                                  and p.id = any (b.covers_prescriptions))), '{}'),
    coalesce((select array_agg(r.id) from public.lab_requests r
              where stay.id is not null and r.patient_id = patient and r.status <> 'voided'
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


-- ===== 9. Paying a bill also settles what it covered =====
-- The same as 20261123082024, and then the unpaid prescriptions and lab
-- tests the bill covered take this payment, so they are never charged again.
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

  -- Covered and still unpaid: paid now. Waiting for payment moves on, as
  -- pay_prescription and pay_lab_request_lines do.
  update public.prescriptions
     set payment_id = new_payment,
         status = case when status = 'awaiting_payment' then 'awaiting_dispense'::public.prescription_status else status end
   where id = any (wanted.covers_prescriptions) and payment_id is null and status <> 'voided';
  update public.lab_requests
     set payment_id = new_payment,
         status = case when status = 'awaiting_payment' then 'awaiting_test'::public.lab_status else status end
   where id = any (wanted.covers_labs) and payment_id is null and status <> 'voided';
  return 'paid';
end;
$$;


-- ===== 10. The bill statement =====
-- For an inpatient: the medicines given since the last bill (each with
-- doses given and the price of a dose), the prescriptions and lab tests of
-- the stay not on a bill yet (paid or not, with amounts), the bills of the
-- stay, what was paid since admission, and the balance. For an outpatient:
-- {"admitted": false}.
create function private.bill_statement(patient bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  stay public.admissions;
  since timestamptz;
  medicines jsonb;
  prescriptions jsonb;
  labs jsonb;
  bills jsonb;
  billed numeric(12, 2);
  deposits numeric(12, 2);
  bills_paid numeric(12, 2);
  paid_apart numeric(12, 2);
begin
  if not ((select private.sets_prices()) or (select private.can_take_payment())) then
    raise exception 'Only the doctor, the matron, the Front Desk or the admin sees the bill' using errcode = '42501';
  end if;
  -- A look at what the patient took is written down, as every look is.
  insert into public.activity_log (actor_id, action, table_name, record_id, patient_id)
  values ((select auth.uid()), 'read', 'bill_statement', patient::text, patient);

  select * into stay from public.admissions where patient_id = patient and discharged_at is null;
  if not found then
    return jsonb_build_object('admitted', false);
  end if;

  -- Medicines: doses given after the last bill of this stay (or admission).
  select coalesce(max(medicines_until), stay.admitted_at) into since
  from public.bills where admission_id = stay.id and status <> 'voided';

  select coalesce(jsonb_agg(jsonb_build_object(
           'medicine', m.medicine, 'doses', counted.n, 'dose_price', m.dose_price,
           'amount', counted.n * m.dose_price) order by m.medicine), '[]'::jsonb)
  into medicines
  from public.patient_medications m
  join lateral (
    select count(*) as n from public.medications_given g
    where g.medication_id = m.id and g.voided_at is null and g.not_given_reason is null
      and g.given_at > since
  ) counted on counted.n > 0
  where m.patient_id = patient and m.voided_at is null and m.dose_price is not null;

  -- Prescriptions of the stay not on a bill: the payment if paid, else the
  -- doctor's prices.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'at', p.prescribed_at, 'paid', p.payment_id is not null,
           'drugs', (select string_agg(concat_ws(' ', i.drug, i.strength), ', ')
                     from public.prescription_items i where i.prescription_id = p.id),
           'amount', coalesce((select pay.amount from public.payments pay
                               where pay.id = p.payment_id and pay.voided_at is null),
                              (select sum(i.price) from public.prescription_items i
                               where i.prescription_id = p.id)))
         order by p.prescribed_at), '[]'::jsonb)
  into prescriptions
  from public.prescriptions p
  where p.patient_id = patient and p.status <> 'voided' and p.prescribed_at >= stay.admitted_at
    and not exists (select 1 from public.bills b
                    where b.patient_id = patient and b.status <> 'voided'
                      and p.id = any (b.covers_prescriptions));

  -- Lab tests of the stay not on a bill, the same way.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'at', r.requested_at, 'paid', r.payment_id is not null,
           'tests', array_to_string(r.tests, ', '),
           'amount', coalesce((select pay.amount from public.payments pay
                               where pay.id = r.payment_id and pay.voided_at is null),
                              (select sum(price.value::numeric)
                               from jsonb_each_text(coalesce(r.prices, '{}'::jsonb)) price)))
         order by r.requested_at), '[]'::jsonb)
  into labs
  from public.lab_requests r
  where r.patient_id = patient and r.status <> 'voided' and r.requested_at >= stay.admitted_at
    and not exists (select 1 from public.bills b
                    where b.patient_id = patient and b.status <> 'voided'
                      and r.id = any (b.covers_labs));

  -- The bills of this stay.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id, 'at', b.created_at, 'status', b.status,
           'total', (select sum(l.amount) from public.bill_lines l where l.bill_id = b.id))
         order by b.created_at), '[]'::jsonb),
         coalesce(sum((select sum(l.amount) from public.bill_lines l where l.bill_id = b.id)), 0)
  into bills, billed
  from public.bills b
  where b.admission_id = stay.id and b.status <> 'voided';

  -- Paid since admission: deposits, bills, and covered prescriptions and lab
  -- tests paid on their own (a bill's own payment is counted once, as a bill).
  select coalesce(sum(amount), 0) into deposits
  from public.payments
  where patient_id = patient and purpose = 'deposit' and voided_at is null
    and received_at >= stay.admitted_at;

  select coalesce(sum(pay.amount), 0) into bills_paid
  from public.bills b join public.payments pay on pay.id = b.payment_id
  where b.admission_id = stay.id and b.status = 'paid' and pay.voided_at is null;

  select coalesce(sum(pay.amount), 0) into paid_apart
  from public.payments pay
  where pay.voided_at is null and pay.purpose <> 'bill'
    and (pay.id in (select p.payment_id from public.prescriptions p, public.bills b
                    where b.admission_id = stay.id and b.status <> 'voided'
                      and p.id = any (b.covers_prescriptions))
      or pay.id in (select r.payment_id from public.lab_requests r, public.bills b
                    where b.admission_id = stay.id and b.status <> 'voided'
                      and r.id = any (b.covers_labs)));

  return jsonb_build_object(
    'admitted', true,
    'admission_id', stay.id,
    'admitted_at', stay.admitted_at,
    'medicines', medicines,
    'prescriptions', prescriptions,
    'labs', labs,
    'bills', bills,
    'billed', billed,
    'deposits', deposits,
    'paid', deposits + bills_paid + paid_apart,
    'balance', billed - (deposits + bills_paid + paid_apart)
  );
end;
$$;

revoke execute on function private.bill_statement(bigint) from public, anon;
grant  execute on function private.bill_statement(bigint) to authenticated;

create function public.bill_statement(patient bigint)
returns jsonb language sql set search_path = ''
as $$ select private.bill_statement(patient); $$;

revoke execute on function public.bill_statement(bigint) from public, anon;
grant  execute on function public.bill_statement(bigint) to authenticated;

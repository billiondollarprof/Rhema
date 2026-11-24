-- =============================================================================
-- 074_chart_prices_returns_admitted_on.sql: tests for request 247 and the
-- bill (2026-11-24).
--
-- What this proves:
--   1. The Front Desk sets the day a stay began; not in the future, not by a
--      nurse in a ward, not for a patient not admitted.
--   2. A dispensed prescription's chart line is marked, and its doses are
--      never on Medicines given.
--   3. Medicines given prices a dose from the chart, else the drug's
--      standard price, else none.
--   4. The Pharmacy records doses returned; never more than it holds; once
--      per double tap; a nurse cannot. Its chart shows dispensed, returned,
--      route and the last dose given.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into public.rooms (name, kind) values ('T74 Ward', 'nursing');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000741', 't074-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000742', 't074-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000743', 't074-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000744', 't074-pharmacy@test.rhema'),
  ('00000000-0000-0000-0000-000000000745', 't074-nurse2@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000741', 'T74 Doctor',   't074-doctor@test.rhema',   'doctor',     true),
  ('00000000-0000-0000-0000-000000000742', 'T74 Nurse',    't074-nurse@test.rhema',    'nurse',      true),
  ('00000000-0000-0000-0000-000000000743', 'T74 Desk',     't074-desk@test.rhema',     'front_desk', false),
  ('00000000-0000-0000-0000-000000000744', 'T74 Pharmacy', 't074-pharmacy@test.rhema', 'pharmacy',   false),
  ('00000000-0000-0000-0000-000000000745', 'T74 Nurse 2',  't074-nurse2@test.rhema',   'nurse',      true);
update public.staff set can_medical = false
 where id in ('00000000-0000-0000-0000-000000000743', '00000000-0000-0000-0000-000000000744');
update public.staff set room_id = (select id from public.rooms where name = 'T74 Ward')
 where id = '00000000-0000-0000-0000-000000000742';
insert into public.patients (full_name, date_of_birth, sex, created_by) values
  ('T74 Patient', '1980-04-04', 'male', '00000000-0000-0000-0000-000000000743'),
  ('T74 Outpatient', '1981-04-04', 'female', '00000000-0000-0000-0000-000000000743');
create temporary table t74 as select id as patient from public.patients where full_name = 'T74 Patient';
grant select on t74 to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000743"}', true);
set local role authenticated;
select public.admit_patient((select patient from t74));
reset role;


-- ===== 1. Admitted on =====
do $$
declare
  patient bigint := (select patient from t74);
  outpatient bigint := (select id from public.patients where full_name = 'T74 Outpatient');
  five_days_ago date := (now() at time zone 'Africa/Lagos')::date - 5;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000743"}', true);
  set local role authenticated;
  if public.set_admitted_on(patient, five_days_ago) <> 'saved' then
    raise exception 'FAIL 1: the Front Desk could not set the admission day';
  end if;
  begin
    perform public.set_admitted_on(patient, (now() at time zone 'Africa/Lagos')::date + 1);
    raise exception 'FAIL 1: a day in the future was saved';
  exception when invalid_parameter_value then null;
  end;
  if public.set_admitted_on(outpatient, five_days_ago) <> 'not_admitted' then
    raise exception 'FAIL 1: a patient not admitted got an admission day';
  end if;
  reset role;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000742"}', true);
  set local role authenticated;
  begin
    perform public.set_admitted_on(patient, five_days_ago);
    reset role;
    raise exception 'FAIL 1: a nurse in a ward set the admission day';
  exception when insufficient_privilege then
    reset role;
  end;
  if (select (admitted_at at time zone 'Africa/Lagos')::date from public.admissions
      where patient_id = patient and discharged_at is null) <> five_days_ago then
    raise exception 'FAIL 1: the stay does not begin on the day chosen';
  end if;
end $$;
\echo 'PASS 1: the Front Desk sets the day a stay began; not in the future; not a ward nurse'


-- ===== 2 and 3. The chart and Medicines given =====
-- A standard price for one drug; three chart medicines: one priced on the
-- chart, one with only a standard price, one with no price at all; and a
-- prescription the Pharmacy dispenses (its chart line comes by itself).
insert into public.price_list (kind, item, amount, updated_by)
values ('drug', 'T74 Paracetamol 1 g', 100, '00000000-0000-0000-0000-000000000741');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000741"}', true);
set local role authenticated;
select public.open_record((select patient from t74));
insert into public.patient_medications (patient_id, medicine, route, dose_price)
select patient, 'T74 Ceftriaxone 1 g', 'IV', 2500 from t74;
insert into public.patient_medications (patient_id, medicine)
select patient, 'T74 Paracetamol 1 g' from t74;
insert into public.patient_medications (patient_id, medicine)
select patient, 'T74 Unpriced drug' from t74;
select public.prescribe((select patient from t74), '[{"drug": "T74 Amoxicillin", "strength": "500 mg", "price": 1500}]', 'T74 rx', 'pharmacy');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000744"}', true);
set local role authenticated;
select public.dispense_prescription((select id from public.prescriptions where note = 'T74 rx'));
reset role;
-- One dose of each given (by different nurses: the double tap guard).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000742"}', true);
insert into public.medications_given (patient_id, medication_id, medicine, given_by, given_at)
select patient, m.id, m.medicine, '00000000-0000-0000-0000-000000000742', now() - interval '1 hour'
from t74, public.patient_medications m where m.patient_id = t74.patient and m.medicine like 'T74 %';
do $$
declare
  s jsonb;
  rx_line bigint := (select id from public.patient_medications where medicine like 'T74 Amoxicillin%');
begin
  if (select prescription_id from public.patient_medications where id = rx_line)
     is distinct from (select id from public.prescriptions where note = 'T74 rx') then
    raise exception 'FAIL 2: the prescription''s chart line is not marked';
  end if;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000741"}', true);
  set local role authenticated;
  s := public.bill_statement((select patient from t74));
  reset role;
  if exists (select 1 from jsonb_array_elements(s -> 'medicines') one where one ->> 'medicine' like 'T74 Amoxicillin%') then
    raise exception 'FAIL 2: a dispensed prescription''s medicine is on Medicines given';
  end if;
  if (select (one ->> 'amount')::numeric from jsonb_array_elements(s -> 'medicines') one
      where one ->> 'medicine' = 'T74 Ceftriaxone 1 g') is distinct from 2500
     or (select (one ->> 'amount')::numeric from jsonb_array_elements(s -> 'medicines') one
         where one ->> 'medicine' = 'T74 Paracetamol 1 g') is distinct from 100
     or (select one -> 'amount' from jsonb_array_elements(s -> 'medicines') one
         where one ->> 'medicine' = 'T74 Unpriced drug') is distinct from 'null'::jsonb then
    raise exception 'FAIL 3: the medicines are not priced from the chart, the standard, or left unpriced: %', s -> 'medicines';
  end if;
end $$;
\echo 'PASS 2 and 3: prescriptions stay off Medicines given; doses are priced from the chart, else the standard'


-- ===== 4. Returned to the store, and the Pharmacy's chart =====
do $$
declare
  med bigint := (select id from public.patient_medications where medicine = 'T74 Ceftriaxone 1 g');
  line jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000744"}', true);
  set local role authenticated;
  perform public.dispense_chart(med, 4);
  if public.return_to_store(med, 5) <> 'too_many' then
    raise exception 'FAIL 4: more was returned than went out';
  end if;
  if public.return_to_store(med, 2) <> 'returned' or public.return_to_store(med, 2) <> 'already_returned' then
    raise exception 'FAIL 4: a return was not saved, or saved twice on a double tap';
  end if;
  select value into line from jsonb_array_elements(public.patient_medicines_for_pharmacy((select patient from t74)))
  where value ->> 'medicine' = 'T74 Ceftriaxone 1 g';
  reset role;
  if (line ->> 'dispensed')::int <> 4 or (line ->> 'returned')::int <> 2 or line ->> 'route' <> 'IV'
     or line ->> 'last_given_at' is null then
    raise exception 'FAIL 4: the Pharmacy''s chart is wrong: %', line;
  end if;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000745"}', true);
  set local role authenticated;
  begin
    perform public.return_to_store(med, 1);
    reset role;
    raise exception 'FAIL 4: a nurse recorded a return';
  exception when insufficient_privilege then
    reset role;
  end;
end $$;
\echo 'PASS 4: the Pharmacy records returns within what it gave out; its chart shows them'

rollback;

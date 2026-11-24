-- =============================================================================
-- 072_bill_settles_only_its_lines.sql: tests for request 245 (2026-11-24).
--
-- What this proves, for an inpatient:
--   1. A bill without the stay's lines settles nothing of the stay: the
--      doses, the prescription and the lab test stay for the next bill.
--   2. A bill with Take Home Drugs only covers the prescription, not the lab
--      test, and leaves the doses for later.
--   3. A bill with Medicines given and Laboratory tests covers those.
--   4. Discharge with nothing owed settles the stay's unpaid bills, and the
--      prescription they covered takes the deposit as its payment.
--   5. Discharge with money owed leaves the bill to pay.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000721', 't072-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000722', 't072-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000723', 't072-desk@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000721', 'T72 Doctor', 't072-doctor@test.rhema', 'doctor',     true),
  ('00000000-0000-0000-0000-000000000722', 'T72 Nurse',  't072-nurse@test.rhema',  'nurse',      true),
  ('00000000-0000-0000-0000-000000000723', 'T72 Desk',   't072-desk@test.rhema',   'front_desk', false);
update public.staff set can_medical = false where id = '00000000-0000-0000-0000-000000000723';
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T72 Patient', '1982-02-02', 'male', '00000000-0000-0000-0000-000000000723');
create temporary table t72 as select id as patient from public.patients where full_name = 'T72 Patient';
grant select on t72 to authenticated;

-- Admitted 2 days ago; a priced chart medicine with a dose given; a take
-- home prescription and a lab test, both unpaid.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000723"}', true);
set local role authenticated;
select public.admit_patient((select patient from t72));
reset role;
update public.admissions set admitted_at = now() - interval '2 days' where patient_id = (select patient from t72);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721"}', true);
set local role authenticated;
select public.open_record((select patient from t72));
insert into public.patient_medications (patient_id, medicine, dose_price)
select patient, 'T72 Ceftriaxone', 2500 from t72;
select public.prescribe((select patient from t72), '[{"drug": "T72 Amoxicillin", "price": 1500}]', 'T72 take home', 'front_desk');
select public.request_lab((select patient from t72), array['Widal'], 'T72 lab', 'both', '{"Widal": 3000}');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000722"}', true);
insert into public.medications_given (patient_id, medication_id, medicine, given_by, given_at)
select patient, (select id from public.patient_medications where medicine = 'T72 Ceftriaxone'),
       'T72 Ceftriaxone', '00000000-0000-0000-0000-000000000722', now() - interval '1 hour'
from t72;


-- ===== 1. A bill without the stay's lines settles nothing of the stay =====
do $$
declare s jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721"}', true);
  set local role authenticated;
  perform public.add_bill((select patient from t72),
    '[{"kind": "professional_fee", "item": "Professional Fee", "amount": 20000}]', 'T72 fee only');
  s := public.bill_statement((select patient from t72));
  reset role;
  if cardinality((select covers_prescriptions from public.bills where note = 'T72 fee only')) <> 0
     or cardinality((select covers_labs from public.bills where note = 'T72 fee only')) <> 0
     or (select medicines_until from public.bills where note = 'T72 fee only') is not null then
    raise exception 'FAIL 1: a bill without the stay''s lines settled some of the stay';
  end if;
  if jsonb_array_length(s -> 'medicines') <> 1 or jsonb_array_length(s -> 'prescriptions') <> 1
     or jsonb_array_length(s -> 'labs') <> 1 then
    raise exception 'FAIL 1: the stay''s doses, drug or test left the statement: %', s;
  end if;
end $$;
\echo 'PASS 1: a bill without the stay''s lines leaves them for the next bill'


-- ===== 2. Take Home Drugs only =====
do $$
declare s jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721"}', true);
  set local role authenticated;
  perform public.add_bill((select patient from t72),
    '[{"kind": "take_home_drugs", "item": "Take Home Drugs", "amount": 1500}]', 'T72 drugs');
  s := public.bill_statement((select patient from t72));
  reset role;
  if cardinality((select covers_prescriptions from public.bills where note = 'T72 drugs')) <> 1
     or cardinality((select covers_labs from public.bills where note = 'T72 drugs')) <> 0
     or (select medicines_until from public.bills where note = 'T72 drugs') is not null then
    raise exception 'FAIL 2: Take Home Drugs settled more, or less, than the prescription';
  end if;
  if jsonb_array_length(s -> 'medicines') <> 1 or jsonb_array_length(s -> 'prescriptions') <> 0
     or jsonb_array_length(s -> 'labs') <> 1 then
    raise exception 'FAIL 2: the statement after Take Home Drugs is wrong: %', s;
  end if;
end $$;
\echo 'PASS 2: a Take Home Drugs line settles the prescription only'


-- ===== 3. Medicines given and Laboratory tests =====
do $$
declare s jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721"}', true);
  set local role authenticated;
  perform public.add_bill((select patient from t72),
    '[{"kind": "medicines_given", "item": "Medicines given", "amount": 2500},
      {"kind": "lab_tests", "item": "Laboratory tests", "amount": 3000}]', 'T72 rest');
  s := public.bill_statement((select patient from t72));
  reset role;
  if cardinality((select covers_labs from public.bills where note = 'T72 rest')) <> 1
     or (select medicines_until from public.bills where note = 'T72 rest') is null then
    raise exception 'FAIL 3: Medicines given or Laboratory tests settled nothing';
  end if;
  if jsonb_array_length(s -> 'medicines') <> 0 or jsonb_array_length(s -> 'labs') <> 0 then
    raise exception 'FAIL 3: the statement still shows what the bill settled: %', s;
  end if;
end $$;
\echo 'PASS 3: Medicines given and Laboratory tests settle the doses and the test'


-- ===== 4. Discharge with nothing owed settles =====
-- A deposit of 100,000 covers the bills above (20,000 + 1,500 + 5,500).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000723"}', true);
set local role authenticated;
select public.take_payment((select patient from t72), 'deposit', '[{"label": "Deposit", "amount": 100000}]', 'cash');
reset role;
do $$
declare
  take_home bigint := (select id from public.prescriptions where note = 'T72 take home');
  deposit bigint := (select id from public.payments where purpose = 'deposit'
                     and patient_id = (select patient from t72));
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721"}', true);
  set local role authenticated;
  if public.discharge_patient((select patient from t72)) <> 'discharged' then
    raise exception 'FAIL 4: the doctor could not discharge';
  end if;
  reset role;
  if exists (select 1 from public.bills b join public.admissions a on a.id = b.admission_id
             where a.patient_id = (select patient from t72) and b.status = 'awaiting_payment') then
    raise exception 'FAIL 4: a bill still waits after a discharge with nothing owed';
  end if;
  if (select payment_id from public.prescriptions where id = take_home) is distinct from deposit
     or (select status from public.prescriptions where id = take_home) <> 'awaiting_dispense' then
    raise exception 'FAIL 4: the covered prescription was not settled by the deposit';
  end if;
end $$;
\echo 'PASS 4: discharge with nothing owed settles the stay''s bills by the deposit'


-- ===== 5. Discharge with money owed leaves the bill to pay =====
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T72 Owing', '1983-03-03', 'female', '00000000-0000-0000-0000-000000000723');
do $$
declare owing bigint := (select id from public.patients where full_name = 'T72 Owing');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000723"}', true);
  set local role authenticated;
  perform public.admit_patient(owing);
  perform public.take_payment(owing, 'deposit', '[{"label": "Deposit", "amount": 5000}]', 'cash');
  reset role;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000721"}', true);
  set local role authenticated;
  perform public.add_bill(owing, '[{"kind": "bed_regular", "item": "Bed space: Regular", "amount": 20000}]', 'T72 owing bill');
  if public.discharge_patient(owing) <> 'discharged' then
    raise exception 'FAIL 5: the doctor could not discharge a patient who owes';
  end if;
  reset role;
  if (select status from public.bills where note = 'T72 owing bill') <> 'awaiting_payment' then
    raise exception 'FAIL 5: a bill was settled while money was owed';
  end if;
end $$;
\echo 'PASS 5: discharge with money owed leaves the bill to pay'

rollback;

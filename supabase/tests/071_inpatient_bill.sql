-- =============================================================================
-- 071_inpatient_bill.sql: tests for inpatient_bill (requests 240 and 242,
-- 2026-11-23).
--
-- What this proves:
--   1. The Front Desk admits; the same again is already_admitted; a nurse
--      cannot admit; everybody reads the stay (not a deactivated person);
--      the Front Desk cannot discharge.
--   2. The Front Desk takes a deposit.
--   3. A doctor charts a medicine with a price per dose; a nurse cannot put
--      a price on one, but charts one without.
--   4. The Pharmacy dispenses from the chart (once per double tap) and sees
--      doses, given and dispensed; a nurse cannot dispense.
--   5. The statement: medicines given × price, the prescription and lab test
--      of the stay, the deposit, and the balance; a nurse cannot see it.
--   6. A bill covers the stay's prescription and lab test; the balance is
--      what is left; paying it settles the unpaid prescription too.
--   7. A dose after the bill starts the next bill's medicines.
--   8. The matron discharges; then the statement says not admitted; the
--      matron admits again.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000711', 't071-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000712', 't071-matron@test.rhema'),
  ('00000000-0000-0000-0000-000000000713', 't071-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000714', 't071-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000715', 't071-pharmacy@test.rhema'),
  ('00000000-0000-0000-0000-000000000716', 't071-nurse2@test.rhema'),
  ('00000000-0000-0000-0000-000000000717', 't071-gone@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000711', 'T71 Doctor',   't071-doctor@test.rhema',   'doctor',     true),
  ('00000000-0000-0000-0000-000000000712', 'T71 Matron',   't071-matron@test.rhema',   'matron',     true),
  ('00000000-0000-0000-0000-000000000713', 'T71 Nurse',    't071-nurse@test.rhema',    'nurse',      true),
  ('00000000-0000-0000-0000-000000000714', 'T71 Desk',     't071-desk@test.rhema',     'front_desk', false),
  ('00000000-0000-0000-0000-000000000715', 'T71 Pharmacy', 't071-pharmacy@test.rhema', 'pharmacy',   false),
  ('00000000-0000-0000-0000-000000000716', 'T71 Nurse 2',  't071-nurse2@test.rhema',   'nurse',      true),
  ('00000000-0000-0000-0000-000000000717', 'T71 Gone',     't071-gone@test.rhema',     'nurse',      true);
update public.staff set is_active = false where id = '00000000-0000-0000-0000-000000000717';
update public.staff set can_medical = false
 where id in ('00000000-0000-0000-0000-000000000714', '00000000-0000-0000-0000-000000000715');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T71 Patient', '1985-05-05', 'female', '00000000-0000-0000-0000-000000000714');
create temporary table t71 as select id as patient from public.patients where full_name = 'T71 Patient';
grant select on t71 to authenticated;


-- ===== 1. Admit =====
do $$
declare patient bigint := (select patient from t71);
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000713"}', true);
  set local role authenticated;
  begin
    perform public.admit_patient(patient);
    reset role;
    raise exception 'FAIL 1: a nurse in a ward admitted a patient';
  exception when insufficient_privilege then
    reset role;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000714"}', true);
  set local role authenticated;
  if public.admit_patient(patient) <> 'admitted' or public.admit_patient(patient) <> 'already_admitted' then
    raise exception 'FAIL 1: the Front Desk could not admit, or admitted twice';
  end if;
  begin
    perform public.discharge_patient(patient);
    reset role;
    raise exception 'FAIL 1: the Front Desk discharged a patient';
  exception when insufficient_privilege then
    reset role;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000715"}', true);
  set local role authenticated;
  if (select count(*) from public.admissions where patient_id = patient and discharged_at is null) <> 1 then
    raise exception 'FAIL 1: the Pharmacy cannot see the stay';
  end if;
  reset role;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000717"}', true);
  set local role authenticated;
  if (select count(*) from public.admissions) <> 0 then
    reset role;
    raise exception 'FAIL 1: a deactivated person reads admissions';
  end if;
  reset role;
end $$;
\echo 'PASS 1: the Front Desk admits once; a nurse cannot; everybody sees it; only a doctor or the matron discharges'
-- The stay began 2 days ago, so the doses below (an hour ago) fall inside it.
update public.admissions set admitted_at = now() - interval '2 days'
 where patient_id = (select patient from t71);


-- ===== 2. A deposit =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000714"}', true);
set local role authenticated;
select public.take_payment((select patient from t71), 'deposit',
  '[{"label": "Admission deposit", "amount": 50000}]', 'transfer');
reset role;
do $$
begin
  if (select count(*) from public.payments where purpose = 'deposit' and amount = 50000) <> 1 then
    raise exception 'FAIL 2: the deposit was not taken';
  end if;
end $$;
\echo 'PASS 2: the Front Desk takes a deposit'


-- ===== 3. The chart: a price per dose, by a price setter only =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000711"}', true);
set local role authenticated;
select public.open_record((select patient from t71));
insert into public.patient_medications (patient_id, medicine, dose, how_often, days, doses, dose_price)
select patient, 'T71 Ceftriaxone 1 g injection', '1 g', 'Twice daily', 3, 6, 2500 from t71;
reset role;
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000713"}', true);
  set local role authenticated;
  perform public.open_record((select patient from t71));
  begin
    insert into public.patient_medications (patient_id, medicine, dose_price)
    select patient, 'T71 Priced by a nurse', 100 from t71;
    reset role;
    raise exception 'FAIL 3: a nurse put a price on a chart medicine';
  exception when insufficient_privilege then
    reset role;
  end;
  set local role authenticated;
  begin
    update public.patient_medications set dose_price = 1 where medicine = 'T71 Ceftriaxone 1 g injection';
    reset role;
    raise exception 'FAIL 3: a nurse changed the price of a dose';
  exception when insufficient_privilege then
    reset role;
  end;
  set local role authenticated;
  insert into public.patient_medications (patient_id, medicine, dose, how_often)
  select patient, 'T71 Paracetamol 1 g', '1 g', 'Every 8 hours' from t71;
  reset role;
end $$;
\echo 'PASS 3: a doctor prices a dose on the chart; a nurse cannot, and charts without a price'


-- ===== 4. The Pharmacy dispenses from the chart =====
-- Three doses given and one not given. Each by a different person: the
-- double tap guard on doses given (20261102124032) refuses the same person
-- twice in one moment, and this test runs in one moment.
insert into public.medications_given (patient_id, medication_id, medicine, given_by, given_at)
select patient, (select id from public.patient_medications where medicine = 'T71 Ceftriaxone 1 g injection'),
       'T71 Ceftriaxone 1 g injection', who::uuid, now() - interval '1 hour'
from t71, unnest(array['00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-000000000712',
                       '00000000-0000-0000-0000-000000000713']) who;
insert into public.medications_given (patient_id, medication_id, medicine, given_by, not_given_reason)
select patient, (select id from public.patient_medications where medicine = 'T71 Ceftriaxone 1 g injection'),
       'T71 Ceftriaxone 1 g injection', '00000000-0000-0000-0000-000000000716', 'Vomited'
from t71;
do $$
declare
  med bigint := (select id from public.patient_medications where medicine = 'T71 Ceftriaxone 1 g injection');
  line jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000713"}', true);
  set local role authenticated;
  begin
    perform public.dispense_chart(med, 6);
    reset role;
    raise exception 'FAIL 4: a nurse dispensed';
  exception when insufficient_privilege then
    reset role;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000715"}', true);
  set local role authenticated;
  if public.dispense_chart(med, 6) <> 'dispensed' or public.dispense_chart(med, 6) <> 'already_dispensed' then
    raise exception 'FAIL 4: the Pharmacy could not dispense, or dispensed twice on a double tap';
  end if;
  select value into line from jsonb_array_elements(public.patient_medicines_for_pharmacy((select patient from t71)))
  where value ->> 'medicine' = 'T71 Ceftriaxone 1 g injection';
  reset role;
  if (line ->> 'doses')::int <> 6 or (line ->> 'given')::int <> 3 or (line ->> 'dispensed')::int <> 6 then
    raise exception 'FAIL 4: the Pharmacy does not see doses 6, given 3, dispensed 6: %', line;
  end if;
  if line ? 'dose_price' then
    raise exception 'FAIL 4: the Pharmacy sees more than it needs';
  end if;
end $$;
\echo 'PASS 4: the Pharmacy dispenses from the chart once, and sees doses, given and dispensed'


-- ===== 5. The statement =====
-- During the stay: a take home prescription (unpaid) and a lab test paid on its own.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000711"}', true);
set local role authenticated;
select public.prescribe((select patient from t71),
  '[{"drug": "T71 Amoxicillin", "strength": "500 mg capsule", "price": 1500}]', 'T71 take home', 'front_desk');
select public.request_lab((select patient from t71), array['Widal'], 'T71 lab', 'both', '{"Widal": 3000}');
-- And one from before the stay: never on this stay's statement or bill.
select public.prescribe((select patient from t71),
  '[{"drug": "T71 Old drug", "price": 900}]', 'T71 before the stay', 'front_desk');
reset role;
update public.prescriptions set prescribed_at = now() - interval '3 days' where note = 'T71 before the stay';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000714"}', true);
set local role authenticated;
select public.pay_lab_request_lines((select id from public.lab_requests where note = 'T71 lab'),
  '[{"label": "Widal", "amount": 3000}]', 'cash');
reset role;
do $$
declare s jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000713"}', true);
  set local role authenticated;
  begin
    perform public.bill_statement((select patient from t71));
    reset role;
    raise exception 'FAIL 5: a nurse in a ward saw the bill statement';
  exception when insufficient_privilege then
    reset role;
  end;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000711"}', true);
  set local role authenticated;
  s := public.bill_statement((select patient from t71));
  reset role;
  if not (s ->> 'admitted')::boolean
     or jsonb_array_length(s -> 'medicines') <> 1
     or (s -> 'medicines' -> 0 ->> 'doses')::int <> 3
     or (s -> 'medicines' -> 0 ->> 'amount')::numeric <> 7500
     or jsonb_array_length(s -> 'prescriptions') <> 1
     or (s -> 'prescriptions' -> 0 ->> 'amount')::numeric <> 1500
     or (s -> 'prescriptions' -> 0 ->> 'paid')::boolean
     or (s -> 'labs' -> 0 ->> 'amount')::numeric <> 3000
     or not (s -> 'labs' -> 0 ->> 'paid')::boolean
     or (s ->> 'deposits')::numeric <> 50000
     or (s ->> 'balance')::numeric <> -50000 then
    raise exception 'FAIL 5: the statement is wrong: %', s;
  end if;
  if not exists (select 1 from public.activity_log where table_name = 'bill_statement'
                 and patient_id = (select patient from t71)) then
    raise exception 'FAIL 5: a look at the statement is not in the activity log';
  end if;
end $$;
\echo 'PASS 5: the statement shows medicines given x price, the stay''s prescription and lab test, the deposit'


-- ===== 6. The bill, the balance, and paying it =====
do $$
declare
  s jsonb;
  wanted bigint;
  take_home bigint := (select id from public.prescriptions where note = 'T71 take home');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000711"}', true);
  set local role authenticated;
  if public.add_bill((select patient from t71),
       '[{"kind": "professional_fee", "item": "Professional Fee", "amount": 20000},
         {"kind": "medicines_given", "item": "Medicines given", "amount": 7500},
         {"kind": "take_home_drugs", "item": "Take Home Drugs", "amount": 1500},
         {"kind": "lab_tests", "item": "Laboratory tests", "amount": 3000},
         {"kind": "bed_vip", "item": "Bed space: VIP", "amount": 30000}]', 'T71 discharge') <> 'sent' then
    raise exception 'FAIL 6: the bill was not sent';
  end if;
  s := public.bill_statement((select patient from t71));
  reset role;
  wanted := (select id from public.bills where note = 'T71 discharge');
  if (select admission_id from public.bills where id = wanted) is null
     or not take_home = any ((select covers_prescriptions from public.bills where id = wanted)::bigint[])
     or cardinality((select covers_labs from public.bills where id = wanted)) <> 1
     or cardinality((select covers_prescriptions from public.bills where id = wanted)) <> 1 then
    raise exception 'FAIL 6: the bill is not tied to the stay, or does not cover the prescription and lab test';
  end if;
  if (s ->> 'billed')::numeric <> 62000 or (s ->> 'paid')::numeric <> 53000 or (s ->> 'balance')::numeric <> 9000
     or jsonb_array_length(s -> 'medicines') <> 0 or jsonb_array_length(s -> 'prescriptions') <> 0 then
    raise exception 'FAIL 6: after the bill, the statement is wrong: %', s;
  end if;
  -- The Front Desk takes the balance.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000714"}', true);
  set local role authenticated;
  if public.pay_bill(wanted, '[{"label": "Balance", "amount": 9000}]', 'pos') <> 'paid' then
    raise exception 'FAIL 6: the Front Desk could not take the balance';
  end if;
  s := public.bill_statement((select patient from t71));
  reset role;
  if (s ->> 'balance')::numeric <> 0 or (s ->> 'paid')::numeric <> 62000 then
    raise exception 'FAIL 6: after paying, the balance is not 0: %', s;
  end if;
  if (select status from public.prescriptions where id = take_home) <> 'awaiting_dispense'
     or (select payment_id from public.prescriptions where id = take_home)
        <> (select payment_id from public.bills where id = wanted) then
    raise exception 'FAIL 6: the covered prescription was not settled by the bill';
  end if;
end $$;
\echo 'PASS 6: the bill covers the stay; the balance is what is left; paying settles the take home drugs'


-- ===== 7. A dose after the bill is on the next one =====
-- Signed by the nurse who gave it (the sheet's signer is the person signed in).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000716"}', true);
insert into public.medications_given (patient_id, medication_id, medicine, given_by, given_at)
select patient, (select id from public.patient_medications where medicine = 'T71 Ceftriaxone 1 g injection'),
       'T71 Ceftriaxone 1 g injection', '00000000-0000-0000-0000-000000000716', now() + interval '1 minute'
from t71;
do $$
declare s jsonb;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000712"}', true);
  set local role authenticated;
  s := public.bill_statement((select patient from t71));
  reset role;
  if jsonb_array_length(s -> 'medicines') <> 1 or (s -> 'medicines' -> 0 ->> 'doses')::int <> 1 then
    raise exception 'FAIL 7: the dose after the bill is not on the next one: %', s;
  end if;
end $$;
\echo 'PASS 7: a dose after the bill counts on the next bill only'


-- ===== 8. The matron discharges =====
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000712"}', true);
  set local role authenticated;
  if public.discharge_patient((select patient from t71)) <> 'discharged'
     or public.discharge_patient((select patient from t71)) <> 'not_admitted'
     or (public.bill_statement((select patient from t71)) ->> 'admitted')::boolean then
    raise exception 'FAIL 8: the matron could not discharge, or the patient still shows admitted';
  end if;
  -- And the matron admits too (a new stay, say for a delivery).
  if public.admit_patient((select patient from t71)) <> 'admitted' then
    raise exception 'FAIL 8: the matron could not admit';
  end if;
  reset role;
end $$;
\echo 'PASS 8: the matron discharges, and admits again'

rollback;

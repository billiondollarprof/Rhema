-- =============================================================================
-- 010_pharmacy.sql: tests for the Pharmacy and prices per line (request 123).
--
-- What this is: proves the whole path. A doctor prescribes; the Front Desk
-- types a price per drug and the database adds them up; the Pharmacy
-- dispenses and the drugs join the current medications; lab tests take a
-- price per test the same way. Also: only the right people, nothing twice,
-- nothing written by hand, nothing for somebody not signed in.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: a doctor, a nurse, a front desk, a pharmacist, a lab person, a patient =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'rx-doctor@test.rhema'),
  ('00000000-0000-0000-0000-0000000000f2', 'rx-nurse@test.rhema'),
  ('00000000-0000-0000-0000-0000000000f3', 'rx-desk@test.rhema'),
  ('00000000-0000-0000-0000-0000000000f4', 'rx-pharmacy@test.rhema'),
  ('00000000-0000-0000-0000-0000000000f5', 'rx-lab@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000f1', 'Rx Doctor',   'rx-doctor@test.rhema',   'doctor'),
  ('00000000-0000-0000-0000-0000000000f2', 'Rx Nurse',    'rx-nurse@test.rhema',    'nurse'),
  ('00000000-0000-0000-0000-0000000000f3', 'Rx Desk',     'rx-desk@test.rhema',     'front_desk'),
  ('00000000-0000-0000-0000-0000000000f4', 'Rx Pharmacy', 'rx-pharmacy@test.rhema', 'pharmacy'),
  ('00000000-0000-0000-0000-0000000000f5', 'Rx Lab',      'rx-lab@test.rhema',      'laboratory');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('Rx Made Up', '1985-05-05', 'female', '00000000-0000-0000-0000-0000000000f3');

create temporary table t (patient bigint);
insert into t select id from public.patients where full_name = 'Rx Made Up';
grant select on t to authenticated;

-- ===== 1. Only a doctor prescribes; a double tap sends one =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2"}', true);
set local role authenticated;
do $$
begin
  perform public.prescribe((select patient from t), '[{"drug": "Paracetamol"}]'::jsonb, null, 'front_desk');
  raise exception 'FAIL 1: a nurse prescribed';
exception when insufficient_privilege then
  null;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1"}', true);
set local role authenticated;
do $$
declare
  items jsonb := '[{"drug": "Paracetamol", "strength": "500 mg", "dose": "2 tablets", "how_often": "Three times daily", "days": 5, "quantity": "30 tablets"},
                   {"drug": "Amoxicillin", "strength": "500 mg", "dose": "1 capsule", "how_often": "Three times daily", "days": 7, "quantity": "21 capsules"}]';
begin
  if public.prescribe((select patient from t), items, 'After food', 'front_desk') <> 'sent' then
    raise exception 'FAIL 1: the prescription was not sent';
  end if;
  if public.prescribe((select patient from t), items, 'After food', 'front_desk') <> 'already_sent' then
    raise exception 'FAIL 1: a double tap made a second prescription';
  end if;
  begin
    perform public.prescribe((select patient from t), items, null, 'laboratory');
    raise exception 'FAIL 1: a prescription went somewhere other than the Front Desk or the Pharmacy';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.prescriptions) <> 1 or (select count(*) from public.prescription_items) <> 2 then
    raise exception 'FAIL 1: expected one prescription with two drugs';
  end if;
  if (select status from public.prescriptions) <> 'awaiting_payment' then
    raise exception 'FAIL 1: a prescription to the Front Desk must wait for payment';
  end if;
end $$;
\echo 'PASS 1: only a doctor prescribes; one per double tap'


-- ===== 2. The Pharmacy cannot dispense before payment =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f4"}', true);
set local role authenticated;
do $$
begin
  if public.dispense_prescription((select id from public.prescriptions)) <> 'not_paid' then
    raise exception 'FAIL 2: drugs were dispensed before payment';
  end if;
end $$;
reset role;
\echo 'PASS 2: no dispensing before payment'


-- ===== 3. The Front Desk types a price per drug; the database adds them up =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1"}', true);
set local role authenticated;
do $$
begin
  perform public.pay_prescription((select id from public.prescriptions),
    '[{"label": "Paracetamol", "amount": 500}]'::jsonb, 'cash');
  raise exception 'FAIL 3: a doctor took payment';
exception when insufficient_privilege then
  null;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.pay_prescription((select id from public.prescriptions),
      '[{"label": "Paracetamol", "amount": 0}]'::jsonb, 'cash');
    raise exception 'FAIL 3: a price of 0 was accepted';
  exception when invalid_parameter_value then null;
  end;
  if public.pay_prescription((select id from public.prescriptions),
       '[{"label": "Paracetamol 500 mg", "amount": 1200.50}, {"label": "Amoxicillin 500 mg", "amount": 3500}]'::jsonb,
       'pos') <> 'paid' then
    raise exception 'FAIL 3: the payment was not recorded';
  end if;
  if public.pay_prescription((select id from public.prescriptions),
       '[{"label": "Paracetamol", "amount": 1}]'::jsonb, 'cash') <> 'already_paid' then
    raise exception 'FAIL 3: the same prescription was paid twice';
  end if;
  if (select amount from public.payments) <> 4700.50 then
    raise exception 'FAIL 3: the total is not the sum of the lines';
  end if;
  if (select count(*) from public.payment_lines) <> 2 then
    raise exception 'FAIL 3: expected two payment lines';
  end if;
  if (select purpose from public.payments) <> 'drugs' or (select mode from public.payments) <> 'pos' then
    raise exception 'FAIL 3: the payment was not kept as drugs by POS';
  end if;
end $$;
reset role;
\echo 'PASS 3: Front Desk only, once, the total is the sum of the lines'


-- ===== 4. Only the Pharmacy tick dispenses; the drugs join the medications =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f5"}', true);
set local role authenticated;
do $$
begin
  perform public.dispense_prescription((select id from public.prescriptions));
  raise exception 'FAIL 4: the lab dispensed drugs';
exception when insufficient_privilege then
  null;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f4"}', true);
set local role authenticated;
do $$
begin
  if public.dispense_prescription((select id from public.prescriptions)) <> 'dispensed' then
    raise exception 'FAIL 4: the drugs were not dispensed';
  end if;
  if public.dispense_prescription((select id from public.prescriptions)) <> 'already_dispensed' then
    raise exception 'FAIL 4: the same prescription was dispensed twice';
  end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.patient_medications where patient_id = (select patient from t) and status = 'active') <> 2 then
    raise exception 'FAIL 4: the drugs did not join the current medications';
  end if;
  if (select added_by from public.patient_medications limit 1) <> '00000000-0000-0000-0000-0000000000f1' then
    raise exception 'FAIL 4: the medicines are not in the prescribing doctor''s name';
  end if;
  if not exists (select 1 from public.patient_medications where medicine = 'Paracetamol 500 mg'
                 and how_often = 'Three times daily, 5 days') then
    raise exception 'FAIL 4: the medicine line is not as prescribed';
  end if;
end $$;
\echo 'PASS 4: Pharmacy only, once; the drugs join the current medications'


-- ===== 5. Who sees prescriptions and payments =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f5"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.prescriptions) <> 0 or (select count(*) from public.prescription_items) <> 0 then
    raise exception 'FAIL 5: the lab can see prescriptions';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f4"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.prescription_items) <> 2 then
    raise exception 'FAIL 5: the Pharmacy cannot see the drugs to dispense';
  end if;
  if (select count(*) from public.payment_lines) <> 0 then
    raise exception 'FAIL 5: the Pharmacy can see payment lines';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.prescriptions) <> 0 then
    raise exception 'FAIL 5: a nurse saw a prescription without opening the record';
  end if;
end $$;
select public.open_record((select patient from t));
do $$
begin
  if (select count(*) from public.prescriptions) <> 1 then
    raise exception 'FAIL 5: the opened record does not show the prescription';
  end if;
end $$;
reset role;
\echo 'PASS 5: prescriptions to the record, the Pharmacy and the Front Desk only'


-- ===== 6. Lab tests take a price per test too =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1"}', true);
set local role authenticated;
select public.request_lab((select patient from t), array['Malaria test', 'Urinalysis'], null, 'front_desk');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3"}', true);
set local role authenticated;
do $$
declare
  request bigint := (select id from public.lab_requests order by id desc limit 1);
begin
  if public.pay_lab_request_lines(request,
       '[{"label": "Malaria test", "amount": 2000}, {"label": "Urinalysis", "amount": 1500}]'::jsonb,
       'transfer') <> 'paid' then
    raise exception 'FAIL 6: the lab payment was not recorded';
  end if;
  if public.pay_lab_request_lines(request, '[{"label": "Malaria test", "amount": 1}]'::jsonb, 'cash') <> 'already_paid' then
    raise exception 'FAIL 6: a lab request was paid twice';
  end if;
  if (select amount from public.payments where purpose = 'lab_test') <> 3500 then
    raise exception 'FAIL 6: the lab total is not the sum of the tests';
  end if;
  if (select status from public.lab_requests where id = request) <> 'awaiting_test' then
    raise exception 'FAIL 6: a paid lab request must wait for its test';
  end if;
end $$;
reset role;
\echo 'PASS 6: lab tests take a price per test, added up by the database'


-- ===== 7. Nobody writes the tables by hand; nothing for somebody not signed in =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.prescriptions (patient_id, status) select patient, 'awaiting_dispense' from t;
    raise exception 'FAIL 7: a prescription was written by hand';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.prescriptions set status = 'dispensed';
    raise exception 'FAIL 7: a prescription was changed by hand';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role anon;
do $$
begin
  perform public.prescribe(1, '[{"drug": "Paracetamol"}]'::jsonb, null, 'pharmacy');
  raise exception 'FAIL 7: anon prescribed';
exception when insufficient_privilege then
  null;
end $$;
reset role;
\echo 'PASS 7: nothing by hand; nothing for somebody not signed in'

rollback;

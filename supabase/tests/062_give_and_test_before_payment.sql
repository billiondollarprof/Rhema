-- =============================================================================
-- 062_give_and_test_before_payment.sql: tests for give_and_test_before_payment
-- (request 232, 2026-11-20).
--
-- What this proves:
--   1. The Pharmacy dispenses a prescription still waiting for payment; it
--      stays owed (no payment) and the Front Desk then takes the money.
--   2. The Laboratory takes the sample and enters the result of a test still
--      waiting for payment; it stays owed; the Front Desk then takes it.
--   3. A cancelled one is still refused; nobody else can dispense or test.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000621', 't062-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000622', 't062-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000623', 't062-pharmacy@test.rhema'),
  ('00000000-0000-0000-0000-000000000624', 't062-lab@test.rhema'),
  ('00000000-0000-0000-0000-000000000625', 't062-nurse@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000621', 'T62 Desk',     't062-desk@test.rhema',     'front_desk'),
  ('00000000-0000-0000-0000-000000000622', 'T62 Doctor',   't062-doctor@test.rhema',   'doctor'),
  ('00000000-0000-0000-0000-000000000623', 'T62 Pharmacy', 't062-pharmacy@test.rhema', 'pharmacy'),
  ('00000000-0000-0000-0000-000000000624', 'T62 Lab',      't062-lab@test.rhema',      'laboratory'),
  ('00000000-0000-0000-0000-000000000625', 'T62 Nurse',    't062-nurse@test.rhema',    'nurse');
update public.staff set can_pharmacy = true where id = '00000000-0000-0000-0000-000000000623';
update public.staff set can_lab = true      where id = '00000000-0000-0000-0000-000000000624';
update public.staff set can_pharmacy = false, can_lab = false where id = '00000000-0000-0000-0000-000000000625';
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T62 Patient', '1985-05-05', 'female', '00000000-0000-0000-0000-000000000621');

-- Sent to the Front Desk first: waiting for payment.
insert into public.prescriptions (patient_id, note, prescribed_by, status)
select id, 'T62 waiting', '00000000-0000-0000-0000-000000000622', 'awaiting_payment'
from public.patients where full_name = 'T62 Patient';
insert into public.prescriptions (patient_id, note, prescribed_by, status)
select id, 'T62 cancelled', '00000000-0000-0000-0000-000000000622', 'voided'
from public.patients where full_name = 'T62 Patient';
insert into public.prescription_items (prescription_id, drug)
select id, 'Ceftriaxone' from public.prescriptions where note like 'T62 %';
insert into public.lab_requests (patient_id, tests, note, requested_by, status)
select id, array['Malaria parasite'], 'T62 lab waiting', '00000000-0000-0000-0000-000000000622', 'awaiting_payment'
from public.patients where full_name = 'T62 Patient';
insert into public.lab_requests (patient_id, tests, note, requested_by, status)
select id, array['Widal'], 'T62 lab add', '00000000-0000-0000-0000-000000000622', 'awaiting_payment'
from public.patients where full_name = 'T62 Patient';


-- ===== 1. Dispensed before payment, paid after =====
do $$
declare wanted bigint := (select id from public.prescriptions where note = 'T62 waiting');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000623"}', true);
  set local role authenticated;
  if public.dispense_prescription(wanted) <> 'dispensed' then
    raise exception 'FAIL 1: the Pharmacy could not dispense before payment';
  end if;
  reset role;
  if (select status from public.prescriptions where id = wanted) <> 'dispensed'
     or (select payment_id from public.prescriptions where id = wanted) is not null then
    raise exception 'FAIL 1: not dispensed, or marked paid without money';
  end if;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000621"}', true);
  set local role authenticated;
  if public.pay_prescription(wanted, '[{"label": "Ceftriaxone", "amount": 1500}]', 'cash') <> 'paid' then
    raise exception 'FAIL 1: the Front Desk could not take the money after';
  end if;
  reset role;
  if (select status from public.prescriptions where id = wanted) <> 'dispensed'
     or (select payment_id from public.prescriptions where id = wanted) is null then
    raise exception 'FAIL 1: paying after changed the dispense, or did not record the money';
  end if;
end $$;
\echo 'PASS 1: dispensed before payment, owed, then paid'


-- ===== 2. Tested before payment, paid after =====
do $$
declare wanted bigint := (select id from public.lab_requests where note = 'T62 lab waiting');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000624"}', true);
  set local role authenticated;
  if public.mark_sample_taken(wanted) <> 'done' then
    raise exception 'FAIL 2: the Lab could not take the sample before payment';
  end if;
  if public.record_lab_results(wanted, null, '[{"test": "Malaria parasite", "result": "Not seen"}]') <> 'saved' then
    raise exception 'FAIL 2: the Lab could not enter the result before payment';
  end if;
  reset role;
  if (select status from public.lab_requests where id = wanted) <> 'completed'
     or (select payment_id from public.lab_requests where id = wanted) is not null then
    raise exception 'FAIL 2: not completed, or marked paid without money';
  end if;
  -- A missed result added before payment too.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000624"}', true);
  set local role authenticated;
  if public.add_lab_result((select id from public.lab_requests where note = 'T62 lab add'),
       '{"test": "Widal", "result": "1:80"}') = 'not_paid' then
    raise exception 'FAIL 2: a result could not be added before payment';
  end if;
  reset role;
  if (select status from public.lab_requests where note = 'T62 lab add') <> 'completed' then
    raise exception 'FAIL 2: the test with an added result is not finished';
  end if;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000621"}', true);
  set local role authenticated;
  if public.pay_lab_request_lines(wanted, '[{"label": "Malaria parasite", "amount": 2000}]', 'pos') <> 'paid' then
    raise exception 'FAIL 2: the Front Desk could not take the money after';
  end if;
  reset role;
  if (select status from public.lab_requests where id = wanted) <> 'completed' then
    raise exception 'FAIL 2: paying after changed the result';
  end if;
end $$;
\echo 'PASS 2: tested before payment, owed, then paid'


-- ===== 3. Still refused: a cancelled one, and anybody else =====
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000623"}', true);
  set local role authenticated;
  begin
    perform public.dispense_prescription((select id from public.prescriptions where note = 'T62 cancelled'));
    raise exception 'FAIL 3: a cancelled prescription was dispensed';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000625"}', true);
  set local role authenticated;
  begin
    perform public.mark_sample_taken((select id from public.lab_requests where note = 'T62 lab waiting'));
    raise exception 'FAIL 3: a nurse marked a sample';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;
\echo 'PASS 3: a cancelled one and anybody else are still refused'

rollback;

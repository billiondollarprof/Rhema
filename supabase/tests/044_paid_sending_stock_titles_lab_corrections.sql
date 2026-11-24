-- =============================================================================
-- tests for paid_sending_stock_titles_lab_corrections (requests 213, 214).
--
-- What this proves: the Front Desk sends a paid lab payment to the Lab once,
-- and a paid drug payment to the Pharmacy once, never another kind of
-- payment, and a nurse cannot; the Pharmacy alone sets units and moves
-- stock; dispensing lowers only counted lines, even below 0; notes take a
-- title; a test now and another later (since 20261124172347); the Lab adds
-- a missed result and cancels a wrong one; the Lab sees every result on a
-- paid request.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000441', 't044-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000442', 't044-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000443', 't044-pharm@test.rhema'),
  ('00000000-0000-0000-0000-000000000444', 't044-lab1@test.rhema'),
  ('00000000-0000-0000-0000-000000000445', 't044-lab2@test.rhema'),
  ('00000000-0000-0000-0000-000000000446', 't044-nurse@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000441', 'T44 Desk',   't044-desk@test.rhema',   'front_desk'),
  ('00000000-0000-0000-0000-000000000442', 'T44 Doctor', 't044-doctor@test.rhema', 'doctor'),
  ('00000000-0000-0000-0000-000000000443', 'T44 Pharm',  't044-pharm@test.rhema',  'pharmacy'),
  ('00000000-0000-0000-0000-000000000444', 'T44 Lab1',   't044-lab1@test.rhema',   'laboratory'),
  ('00000000-0000-0000-0000-000000000445', 'T44 Lab2',   't044-lab2@test.rhema',   'laboratory'),
  ('00000000-0000-0000-0000-000000000446', 'T44 Nurse',  't044-nurse@test.rhema',  'nurse');

create temporary table t44 (name text primary key, id bigint);
grant all on t44 to authenticated;

-- A patient and two payments, by the Front Desk.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000441"}', true);
set local role authenticated;
insert into public.patients (full_name, date_of_birth, sex) values ('T44 Patient', '1990-01-01', 'female');
insert into t44 select 'patient', id from public.patients where full_name = 'T44 Patient';
insert into t44 select 'lab_pay', public.take_payment((select id from t44 where name = 'patient'), 'lab_test',
  '[{"label":"PCV","amount":1000},{"label":"Widal Test","amount":2000}]', 'cash');
insert into t44 select 'drug_pay', public.take_payment((select id from t44 where name = 'patient'), 'drugs',
  '[{"label":"Paracetamol 500 mg tablet","amount":500}]', 'cash');
insert into t44 select 'card_pay', public.take_payment((select id from t44 where name = 'patient'), 'consultation',
  '[{"label":"Consultation","amount":3000}]', 'pos');
reset role;


-- ===== 1. Paid lab tests go to the Lab, once, with the doctor as the asker =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000441"}', true);
set local role authenticated;
do $$
begin
  if public.send_paid_to_lab((select id from t44 where name = 'lab_pay'), array['PCV', 'Widal Test'],
       '00000000-0000-0000-0000-000000000442', null) <> 'sent' then
    raise exception 'FAIL 1: paid lab tests were not sent';
  end if;
  if public.send_paid_to_lab((select id from t44 where name = 'lab_pay'), array['PCV'], null, null) <> 'already_sent' then
    raise exception 'FAIL 1: one payment was sent to the Lab twice';
  end if;
  begin
    perform public.send_paid_to_lab((select id from t44 where name = 'card_pay'), array['PCV'], null, null);
    raise exception 'FAIL 1: a consultation payment was sent to the Lab';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
do $$
begin
  if not exists (
    select 1 from public.lab_requests
    where payment_id = (select id from t44 where name = 'lab_pay') and status = 'awaiting_test'
      and requested_by = '00000000-0000-0000-0000-000000000442' and tests = array['PCV', 'Widal Test']
  ) then
    raise exception 'FAIL 1: the Lab request is not paid, waiting, and asked by the doctor';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000446"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.send_paid_to_lab((select id from t44 where name = 'lab_pay'), array['PCV'], null, null);
    raise exception 'FAIL 1: a nurse sent a payment on';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 1: paid lab tests go to the Lab once, as the doctor''s request'


-- ===== 2. Paid drugs go to the Pharmacy, once =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000441"}', true);
set local role authenticated;
do $$
begin
  if public.send_paid_to_pharmacy((select id from t44 where name = 'drug_pay'),
       '[{"drug":"Paracetamol","strength":"500 mg tablet","quantity":"10"},{"drug":"Amoxicillin","strength":"500 mg capsule","quantity":"2 capsules"}]', null, null) <> 'sent' then
    raise exception 'FAIL 2: paid drugs were not sent';
  end if;
  if public.send_paid_to_pharmacy((select id from t44 where name = 'drug_pay'),
       '[{"drug":"Paracetamol","quantity":"10"}]', null, null) <> 'already_sent' then
    raise exception 'FAIL 2: one payment was sent to the Pharmacy twice';
  end if;
end $$;
reset role;
insert into t44 select 'rx', id from public.prescriptions where payment_id = (select id from t44 where name = 'drug_pay');
do $$
begin
  if (select status from public.prescriptions where id = (select id from t44 where name = 'rx')) <> 'awaiting_dispense' then
    raise exception 'FAIL 2: the drugs are not waiting to be dispensed';
  end if;
end $$;
\echo 'PASS 2: paid drugs go to the Pharmacy once, ready to dispense'


-- ===== 3. Stock: the Pharmacy alone; dispensing lowers counted lines =====
insert into t44 select 'para', id from public.medicine_list
  where name = 'Paracetamol' and strength = '500 mg tablet' and status = 'standard' limit 1;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000446"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.move_stock((select id from t44 where name = 'para'), 100, 'restock', null);
    raise exception 'FAIL 3: a nurse changed the stock';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000443"}', true);
set local role authenticated;
select public.set_stock_settings((select id from t44 where name = 'para'), 'tablet', 20);
do $$
begin
  if public.move_stock((select id from t44 where name = 'para'), 5, 'restock', 'first count') <> 5 then
    raise exception 'FAIL 3: the restock count is wrong';
  end if;
  begin
    perform public.move_stock((select id from t44 where name = 'para'), 5, 'restock', null);
    raise exception 'FAIL 3: the same restock twice in 30 seconds was saved';
  exception when unique_violation then null;
  end;
  if public.dispense_prescription((select id from t44 where name = 'rx')) <> 'dispensed' then
    raise exception 'FAIL 3: the prescription was not dispensed';
  end if;
end $$;
reset role;
do $$
begin
  if (select in_stock from public.medicine_list where id = (select id from t44 where name = 'para')) <> -5 then
    raise exception 'FAIL 3: dispensing 10 from 5 did not leave -5';
  end if;
  if (select unit from public.medicine_list where id = (select id from t44 where name = 'para')) <> 'tablet' then
    raise exception 'FAIL 3: the unit was not kept';
  end if;
  if (select count(*) from public.stock_moves where medicine_id = (select id from t44 where name = 'para')) <> 2 then
    raise exception 'FAIL 3: the stock moves are not all recorded';
  end if;
  if exists (select 1 from public.medicine_list where in_stock is not null and id <> (select id from t44 where name = 'para')) then
    raise exception 'FAIL 3: a line nobody counted got a stock';
  end if;
  if exists (
    select 1 from public.stock_moves m join public.medicine_list l on l.id = m.medicine_id
    where l.name = 'Amoxicillin'
  ) then
    raise exception 'FAIL 3: a line nobody counted got a stock move';
  end if;
end $$;
\echo 'PASS 3: only the Pharmacy moves stock; dispensing lowers counted lines, even below 0'


-- ===== 4. Notes take a title =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000446"}', true);
set local role authenticated;
select public.open_record((select id from t44 where name = 'patient'));
insert into public.nursing_notes (patient_id, title, note)
values ((select id from t44 where name = 'patient'), 'Night check', 'Slept well, no fever');
reset role;
do $$
begin
  if (select title from public.nursing_notes where note = 'Slept well, no fever') <> 'Night check' then
    raise exception 'FAIL 4: the note title was not kept';
  end if;
  begin
    insert into public.nursing_notes (patient_id, title, note)
    values ((select id from t44 where name = 'patient'), repeat('x', 121), 'Too long a title');
    raise exception 'FAIL 4: a title over 120 letters was saved';
  exception when check_violation then null;
  end;
end $$;
\echo 'PASS 4: notes take a title'


-- ===== 5. One test now, the other later (since 20261124172347, request 240h:
-- "send the results without sending everything... the other one... pending") =====
insert into t44 select 'req', id from public.lab_requests where payment_id = (select id from t44 where name = 'lab_pay');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000444"}', true);
set local role authenticated;
do $$
begin
  if public.record_lab_results((select id from t44 where name = 'req'), null,
       '[{"test":"PCV","result":"PCV: 34 %"},{"test":"Widal Test","result":"   "}]') <> 'saved' then
    raise exception 'FAIL 5: the test that is ready was not saved';
  end if;
  if (select status from public.lab_requests where id = (select id from t44 where name = 'req')) <> 'awaiting_test' then
    raise exception 'FAIL 5: the request closed with a test still pending';
  end if;
  if public.record_lab_results((select id from t44 where name = 'req'), null,
       '[{"test":"Widal Test","result":"S. typhi D, O antigen: 1/80"}]') <> 'saved' then
    raise exception 'FAIL 5: the pending test was not saved later';
  end if;
  if (select status from public.lab_requests where id = (select id from t44 where name = 'req')) <> 'completed' then
    raise exception 'FAIL 5: the request did not complete with every test';
  end if;
end $$;
reset role;
\echo 'PASS 5: one test now, the other later; complete when every test has one'


-- ===== 6. Another lab scientist sees, adds and cancels =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000445"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.lab_results where request_id = (select id from t44 where name = 'req')) <> 2 then
    raise exception 'FAIL 6: another lab scientist cannot see the results of a paid request';
  end if;
  if public.add_lab_result((select id from t44 where name = 'req'), '{"test":"PCV","result":"PCV: 36 %"}') <> 'saved' then
    raise exception 'FAIL 6: a corrected result could not be added';
  end if;
  if public.cancel_lab_result((select id from public.lab_results where result = 'PCV: 34 %'), 'Wrong sample read') <> 'cancelled' then
    raise exception 'FAIL 6: a wrong result could not be cancelled';
  end if;
  begin
    perform public.cancel_lab_result((select id from public.lab_results where result = 'PCV: 36 %'), ' ');
    raise exception 'FAIL 6: a result was cancelled without a reason';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
do $$
begin
  if (select void_reason from public.lab_results where result = 'PCV: 34 %') <> 'Wrong sample read' then
    raise exception 'FAIL 6: the cancelled result lost its reason';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000441"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.lab_results) then
    raise exception 'FAIL 6: the Front Desk can read lab results';
  end if;
  begin
    perform public.add_lab_result((select id from t44 where name = 'req'), '{"test":"PCV","result":"x"}');
    raise exception 'FAIL 6: the Front Desk added a lab result';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 6: the Lab sees, adds and cancels results on paid requests; nobody else'

rollback;

-- =============================================================================
-- 013_prescription_send_also.sql: tests for "Send also to" (request 130c).
--
-- What this is: proves only the doctor who wrote a prescription can send it
-- also, once; the Pharmacy still cannot dispense an unpaid one; one sent
-- straight to the Pharmacy can be paid once at the Front Desk without
-- changing its status; and nothing for somebody not signed in.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'sa-doctor@test.rhema'),
  ('00000000-0000-0000-0000-0000000000d2', 'sa-doctor2@test.rhema'),
  ('00000000-0000-0000-0000-0000000000d3', 'sa-desk@test.rhema'),
  ('00000000-0000-0000-0000-0000000000d4', 'sa-pharmacy@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'Sa Doctor',   'sa-doctor@test.rhema',   'doctor'),
  ('00000000-0000-0000-0000-0000000000d2', 'Sa Doctor2',  'sa-doctor2@test.rhema',  'doctor'),
  ('00000000-0000-0000-0000-0000000000d3', 'Sa Desk',     'sa-desk@test.rhema',     'front_desk'),
  ('00000000-0000-0000-0000-0000000000d4', 'Sa Pharmacy', 'sa-pharmacy@test.rhema', 'pharmacy');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('Sa Made Up', '1985-05-05', 'female', '00000000-0000-0000-0000-0000000000d3');

create temporary table t (to_desk bigint, to_pharmacy bigint);
grant select, insert, update on t to authenticated;
insert into t values (null, null);

-- The doctor sends one to the Front Desk and one straight to the Pharmacy.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1"}', true);
set local role authenticated;
select public.prescribe((select id from public.patients where full_name = 'Sa Made Up'),
  '[{"drug": "Paracetamol"}]'::jsonb, null, 'front_desk');
select public.prescribe((select id from public.patients where full_name = 'Sa Made Up'),
  '[{"drug": "Amoxicillin"}]'::jsonb, null, 'pharmacy');
reset role;
update t set to_desk = (select id from public.prescriptions where status = 'awaiting_payment'),
             to_pharmacy = (select id from public.prescriptions where status = 'awaiting_dispense');


-- ===== 1. Only the doctor who wrote it sends it also, once =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2"}', true);
set local role authenticated;
do $$
begin
  perform public.send_prescription_also((select to_desk from t));
  raise exception 'FAIL 1: another doctor sent it also';
exception when insufficient_privilege then null;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3"}', true);
set local role authenticated;
do $$
begin
  perform public.send_prescription_also((select to_desk from t));
  raise exception 'FAIL 1: the Front Desk sent it also';
exception when insufficient_privilege then null;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1"}', true);
set local role authenticated;
do $$
begin
  if public.send_prescription_also((select to_desk from t)) <> 'sent' then
    raise exception 'FAIL 1: the doctor could not send it also';
  end if;
  if public.send_prescription_also((select to_desk from t)) <> 'already_sent' then
    raise exception 'FAIL 1: it was sent also twice';
  end if;
  perform public.send_prescription_also((select to_pharmacy from t));
end $$;
reset role;
\echo 'PASS 1: only the doctor who wrote it sends it also, once'


-- ===== 2. The Pharmacy still cannot dispense an unpaid one =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4"}', true);
set local role authenticated;
do $$
begin
  if public.dispense_prescription((select to_desk from t)) <> 'not_paid' then
    raise exception 'FAIL 2: the Pharmacy dispensed before payment';
  end if;
  if public.dispense_prescription((select to_pharmacy from t)) <> 'dispensed' then
    raise exception 'FAIL 2: one sent straight to the Pharmacy could not be dispensed';
  end if;
end $$;
reset role;
\echo 'PASS 2: no dispensing before payment; straight to the Pharmacy still dispenses'


-- ===== 3. One sent straight to the Pharmacy is paid once, status kept =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3"}', true);
set local role authenticated;
do $$
declare
  line jsonb := '[{"label": "Amoxicillin", "amount": 3500}]';
begin
  if public.pay_prescription((select to_pharmacy from t), line, 'cash') <> 'paid' then
    raise exception 'FAIL 3: the Front Desk could not take payment';
  end if;
  if public.pay_prescription((select to_pharmacy from t), line, 'cash') <> 'already_paid' then
    raise exception 'FAIL 3: payment was taken twice';
  end if;
  if public.pay_prescription((select to_desk from t), '[{"label": "Paracetamol", "amount": 500}]', 'pos') <> 'paid' then
    raise exception 'FAIL 3: the ordinary payment stopped working';
  end if;
end $$;
reset role;
do $$
begin
  if (select status from public.prescriptions where id = (select to_pharmacy from t)) <> 'dispensed' then
    raise exception 'FAIL 3: paying changed a dispensed prescription';
  end if;
  if (select count(*) from public.payments where purpose = 'drugs') <> 2 then
    raise exception 'FAIL 3: expected exactly two drug payments';
  end if;
  if (select status from public.prescriptions where id = (select to_desk from t)) <> 'awaiting_dispense' then
    raise exception 'FAIL 3: paying did not release it to the Pharmacy';
  end if;
end $$;
\echo 'PASS 3: paid once at the Front Desk; status kept; ordinary payment unchanged'


-- ===== 4. Not sent also, straight to the Pharmacy: nothing to pay =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1"}', true);
set local role authenticated;
select public.prescribe((select id from public.patients where full_name = 'Sa Made Up'),
  '[{"drug": "Ibuprofen"}]'::jsonb, null, 'pharmacy');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3"}', true);
set local role authenticated;
do $$
begin
  if public.pay_prescription((select max(id) from public.prescriptions), '[{"label": "Ibuprofen", "amount": 800}]', 'cash') <> 'already_paid' then
    raise exception 'FAIL 4: a prescription never sent to the Front Desk was paid';
  end if;
end $$;
reset role;
\echo 'PASS 4: nothing to pay unless it was sent to the Front Desk'


-- ===== 5. Nothing for somebody not signed in =====
do $$
begin
  if has_function_privilege('anon', 'public.send_prescription_also(bigint)', 'execute') then
    raise exception 'FAIL 5: somebody not signed in may send prescriptions';
  end if;
end $$;
\echo 'PASS 5: nothing for somebody not signed in'

rollback;

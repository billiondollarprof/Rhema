-- =============================================================================
-- tests for pay_whatever_is_unpaid (request 227k, 2026-11-18).
--
-- What this proves:
--   1. A prescription sent straight to the Pharmacy, never sent to the Front
--      Desk, already dispensed: the Front Desk takes payment once, and it
--      stays dispensed.
--   2. A prescription waiting for payment: paying still releases it.
--   3. A lab test sent straight to the Lab: paid once, status kept.
--   4. A cancelled one is never paid; only the Front Desk takes money.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000511', 't051-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000512', 't051-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000513', 't051-pharmacy@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000511', 'T51 Doctor',   't051-doctor@test.rhema',   'doctor'),
  ('00000000-0000-0000-0000-000000000512', 'T51 Desk',     't051-desk@test.rhema',     'front_desk'),
  ('00000000-0000-0000-0000-000000000513', 'T51 Pharmacy', 't051-pharmacy@test.rhema', 'pharmacy');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T51 Made Up', '1990-01-01', 'female', '00000000-0000-0000-0000-000000000512');

create temporary table t051 (patient bigint, straight bigint, waiting bigint, lab bigint);
insert into t051 (patient) select id from public.patients where full_name = 'T51 Made Up';
grant all on t051 to authenticated;

-- The doctor sends one straight to the Pharmacy, one to the Front Desk, and
-- a lab test straight to the Lab.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000511"}', true);
set local role authenticated;
select public.prescribe((select patient from t051), '[{"drug": "Ibuprofen"}]'::jsonb, null, 'pharmacy');
select public.prescribe((select patient from t051), '[{"drug": "Paracetamol"}]'::jsonb, null, 'front_desk');
select public.request_lab((select patient from t051), array['Malaria test'], null, 'laboratory');
reset role;
update t051 set
  straight = (select id from public.prescriptions where status = 'awaiting_dispense' order by id desc limit 1),
  waiting  = (select id from public.prescriptions where status = 'awaiting_payment' order by id desc limit 1),
  lab      = (select id from public.lab_requests order by id desc limit 1);

-- The Pharmacy gives the straight one before anybody pays.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000513"}', true);
set local role authenticated;
select public.dispense_prescription((select straight from t051));
reset role;


-- ===== 1. Straight to the Pharmacy, already given: paid once, still given =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000512"}', true);
set local role authenticated;
do $$
begin
  if public.pay_prescription((select straight from t051), '[{"label": "Ibuprofen", "amount": 800}]', 'cash') <> 'paid' then
    raise exception 'FAIL 1: the Front Desk could not take payment for a drug already given';
  end if;
  if public.pay_prescription((select straight from t051), '[{"label": "Ibuprofen", "amount": 800}]', 'cash') <> 'already_paid' then
    raise exception 'FAIL 1: payment was taken twice';
  end if;
end $$;
reset role;
do $$
begin
  if (select status from public.prescriptions where id = (select straight from t051)) <> 'dispensed' then
    raise exception 'FAIL 1: paying changed a dispensed prescription';
  end if;
  if (select payment_id from public.prescriptions where id = (select straight from t051)) is null then
    raise exception 'FAIL 1: the payment was not linked to the prescription';
  end if;
end $$;
\echo 'PASS 1: straight to the Pharmacy, already given, paid once'


-- ===== 2. Waiting for payment: paying still releases it =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000512"}', true);
set local role authenticated;
select public.pay_prescription((select waiting from t051), '[{"label": "Paracetamol", "amount": 500}]', 'pos');
reset role;
do $$
begin
  if (select status from public.prescriptions where id = (select waiting from t051)) <> 'awaiting_dispense' then
    raise exception 'FAIL 2: paying did not release it to the Pharmacy';
  end if;
end $$;
\echo 'PASS 2: waiting for payment, then released'


-- ===== 3. Straight to the Lab: paid once, status kept =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000512"}', true);
set local role authenticated;
do $$
begin
  if public.pay_lab_request_lines((select lab from t051), '[{"label": "Malaria test", "amount": 2000}]'::jsonb, 'cash') <> 'paid' then
    raise exception 'FAIL 3: the Front Desk could not take payment for a test sent straight to the Lab';
  end if;
  if public.pay_lab_request_lines((select lab from t051), '[{"label": "Malaria test", "amount": 1}]'::jsonb, 'cash') <> 'already_paid' then
    raise exception 'FAIL 3: a lab test was paid twice';
  end if;
end $$;
reset role;
do $$
begin
  if (select status from public.lab_requests where id = (select lab from t051)) <> 'awaiting_test' then
    raise exception 'FAIL 3: paying changed the status of a test sent straight to the Lab';
  end if;
  if (select count(*) from public.payments p
      join public.patients pt on pt.id = p.patient_id
      where pt.full_name = 'T51 Made Up') <> 3 then
    raise exception 'FAIL 3: expected exactly three payments';
  end if;
end $$;
\echo 'PASS 3: straight to the Lab, paid once'


-- ===== 4. Never a cancelled one; only the Front Desk takes money =====
update public.prescriptions set status = 'voided', payment_id = null where id = (select waiting from t051);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000512"}', true);
set local role authenticated;
do $$
begin
  if public.pay_prescription((select waiting from t051), '[{"label": "Paracetamol", "amount": 500}]', 'cash') <> 'already_paid' then
    raise exception 'FAIL 4: a cancelled prescription was paid';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000513"}', true);
set local role authenticated;
do $$
begin
  perform public.pay_prescription((select straight from t051), '[{"label": "x", "amount": 1}]', 'cash');
  raise exception 'FAIL 4: the Pharmacy took a payment';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 4: never a cancelled one; only the Front Desk takes money'

rollback;

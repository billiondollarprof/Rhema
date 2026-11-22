-- =============================================================================
-- 066_doctor_sets_prices.sql: tests for doctor_sets_prices (request 235,
-- part 2, 2026-11-22).
--
-- What this proves:
--   1. A doctor prescribes with a price on one drug: it is kept, and kept as
--      that doctor's own price for next time.
--   2. The Front Desk cannot pay a different amount for the priced drug; it
--      pays the doctor's price and types the other.
--   3. A doctor and the matron put prices on a lab request; a nurse cannot.
--   4. The Front Desk cannot change a lab price the doctor set.
--   5. Each person reads only their own prices.
--   6. A price of 0, or for a test not asked for, is refused.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000661', 't066-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000662', 't066-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000663', 't066-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000664', 't066-matron@test.rhema'),
  ('00000000-0000-0000-0000-000000000665', 't066-doctor2@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000661', 'T66 Doctor',   't066-doctor@test.rhema',  'doctor',     true),
  ('00000000-0000-0000-0000-000000000662', 'T66 Desk',     't066-desk@test.rhema',    'front_desk', false),
  ('00000000-0000-0000-0000-000000000663', 'T66 Nurse',    't066-nurse@test.rhema',   'nurse',      true),
  ('00000000-0000-0000-0000-000000000664', 'T66 Matron',   't066-matron@test.rhema',  'matron',     true),
  ('00000000-0000-0000-0000-000000000665', 'T66 Doctor 2', 't066-doctor2@test.rhema', 'doctor',     true);
update public.staff set can_medical = false where id = '00000000-0000-0000-0000-000000000662';
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T66 Patient', '1965-06-06', 'female', '00000000-0000-0000-0000-000000000662');


-- ===== 1. Prescribe with a price =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000661"}', true);
set local role authenticated;
select public.prescribe((select id from public.patients where full_name = 'T66 Patient'),
  '[{"drug": "Ceftriaxone", "strength": "1 g injection", "price": 2500},
    {"drug": "Paracetamol", "strength": "500 mg tablet"}]', 'T66 note', 'front_desk');
reset role;
do $$
begin
  if (select price from public.prescription_items where drug = 'Ceftriaxone') <> 2500
     or (select price from public.prescription_items where drug = 'Paracetamol') is not null then
    raise exception 'FAIL 1: the doctor''s price was not kept, or one was made up';
  end if;
  if (select amount from public.my_prices where staff_id = '00000000-0000-0000-0000-000000000661'
      and kind = 'drug' and item = 'ceftriaxone 1 g injection') <> 2500 then
    raise exception 'FAIL 1: the doctor''s price was not kept for next time';
  end if;
end $$;
\echo 'PASS 1: the doctor''s price is kept, and kept for next time'


-- ===== 2. The Front Desk pays the doctor's price =====
do $$
declare wanted bigint := (select id from public.prescriptions where note = 'T66 note');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000662"}', true);
  set local role authenticated;
  begin
    perform public.pay_prescription(wanted,
      '[{"label": "Ceftriaxone 1 g injection", "amount": 2000}, {"label": "Paracetamol 500 mg tablet", "amount": 300}]', 'cash');
    raise exception 'FAIL 2: the Front Desk changed the doctor''s price';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.pay_prescription(wanted, '[{"label": "Paracetamol 500 mg tablet", "amount": 300}]', 'cash');
    raise exception 'FAIL 2: the Front Desk left out the drug the doctor priced';
  exception when invalid_parameter_value then null;
  end;
  if public.pay_prescription(wanted,
       '[{"label": "Ceftriaxone 1 g injection", "amount": 2500}, {"label": "Paracetamol 500 mg tablet", "amount": 300}]', 'cash') <> 'paid' then
    raise exception 'FAIL 2: the Front Desk could not pay the doctor''s price';
  end if;
  reset role;
  if (select amount from public.payments p join public.prescriptions r on r.payment_id = p.id where r.id = wanted) <> 2800 then
    raise exception 'FAIL 2: the total is not the doctor''s price plus the other';
  end if;
end $$;
\echo 'PASS 2: the Front Desk pays the doctor''s price, and types the rest'


-- ===== 3. Prices on a lab request: a doctor and the matron, not a nurse =====
do $$
declare patient bigint := (select id from public.patients where full_name = 'T66 Patient');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000661"}', true);
  set local role authenticated;
  perform public.request_lab(patient, array['Widal', 'Full Blood Count'], 'T66 lab doctor', 'both',
    '{"Widal": 3000}');
  reset role;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000664"}', true);
  set local role authenticated;
  perform public.request_lab(patient, array['Urinalysis'], 'T66 lab matron', 'front_desk', '{"Urinalysis": 1500}');
  reset role;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000663"}', true);
  set local role authenticated;
  begin
    perform public.request_lab(patient, array['Genotype'], 'T66 lab nurse', 'both', '{"Genotype": 5000}');
    reset role;
    raise exception 'FAIL 3: a nurse set a price';
  exception when insufficient_privilege then
    reset role;
  end;
  set local role authenticated;
  perform public.request_lab(patient, array['Genotype'], 'T66 lab nurse plain', 'both', null);
  reset role;
  if (select prices ->> 'Widal' from public.lab_requests where note = 'T66 lab doctor') <> '3000.00'
     or (select prices ->> 'Urinalysis' from public.lab_requests where note = 'T66 lab matron') <> '1500.00'
     or not exists (select 1 from public.lab_requests where note = 'T66 lab nurse plain') then
    raise exception 'FAIL 3: the lab prices were not kept, or a nurse could not request without one';
  end if;
end $$;
\echo 'PASS 3: a doctor and the matron price lab tests; a nurse requests without prices'


-- ===== 4. The Front Desk cannot change a lab price =====
do $$
declare wanted bigint := (select id from public.lab_requests where note = 'T66 lab doctor');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000662"}', true);
  set local role authenticated;
  begin
    perform public.pay_lab_request_lines(wanted,
      '[{"label": "Widal", "amount": 2000}, {"label": "Full Blood Count", "amount": 4000}]', 'cash');
    raise exception 'FAIL 4: the Front Desk changed the doctor''s lab price';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.pay_lab_request(wanted, 100, 'cash');
    raise exception 'FAIL 4: the Front Desk paid a priced request as one typed total';
  exception when invalid_parameter_value then null;
  end;
  if public.pay_lab_request_lines(wanted,
       '[{"label": "Widal", "amount": 3000}, {"label": "Full Blood Count", "amount": 4000}]', 'pos') <> 'paid' then
    raise exception 'FAIL 4: the Front Desk could not pay the doctor''s lab price';
  end if;
  reset role;
end $$;
\echo 'PASS 4: the Front Desk pays the doctor''s lab price'


-- ===== 5. Only my own prices =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000665"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.my_prices) <> 0 then
    raise exception 'FAIL 5: a doctor reads another doctor''s prices';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000661"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.my_prices) <> 2 then
    raise exception 'FAIL 5: the doctor does not read their own prices';
  end if;
end $$;
reset role;
\echo 'PASS 5: each person reads only their own prices'


-- ===== 6. Bad prices are refused =====
do $$
declare patient bigint := (select id from public.patients where full_name = 'T66 Patient');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000661"}', true);
  set local role authenticated;
  begin
    perform public.prescribe(patient, '[{"drug": "Amoxicillin", "price": 0}]', 'T66 zero', 'front_desk');
    raise exception 'FAIL 6: a price of 0 was kept';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.request_lab(patient, array['Widal'], 'T66 wrong test', 'both', '{"Malaria": 1000}');
    raise exception 'FAIL 6: a price for a test not asked for was kept';
  exception when invalid_parameter_value then null;
  end;
  reset role;
end $$;
\echo 'PASS 6: a price of 0, or for a test not asked for, is refused'

rollback;

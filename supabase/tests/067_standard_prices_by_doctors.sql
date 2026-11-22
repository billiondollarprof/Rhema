-- =============================================================================
-- 067_standard_prices_by_doctors.sql: tests for standard_prices_by_doctors
-- (request 236, 2026-11-22).
--
-- What this proves:
--   1. A doctor makes a drug and a lab test price standard; everybody reads
--      them; a second time with a new price changes it.
--   2. The matron and the admin can too; a nurse, the Front Desk and the
--      Pharmacy cannot.
--   3. A bad kind, a missing name or a price of 0 is refused.
--   4. The admin sets a drug price on the Prices tab.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000671', 't067-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000672', 't067-matron@test.rhema'),
  ('00000000-0000-0000-0000-000000000673', 't067-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000674', 't067-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000675', 't067-pharmacy@test.rhema'),
  ('00000000-0000-0000-0000-000000000676', 't067-admin@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000671', 'T67 Doctor',   't067-doctor@test.rhema',   'doctor',     true),
  ('00000000-0000-0000-0000-000000000672', 'T67 Matron',   't067-matron@test.rhema',   'matron',     true),
  ('00000000-0000-0000-0000-000000000673', 'T67 Nurse',    't067-nurse@test.rhema',    'nurse',      true),
  ('00000000-0000-0000-0000-000000000674', 'T67 Desk',     't067-desk@test.rhema',     'front_desk', false),
  ('00000000-0000-0000-0000-000000000675', 'T67 Pharmacy', 't067-pharmacy@test.rhema', 'pharmacy',   false),
  ('00000000-0000-0000-0000-000000000676', 'T67 Admin',    't067-admin@test.rhema',    'admin',      false);
update public.staff set can_medical = false
 where id in ('00000000-0000-0000-0000-000000000674', '00000000-0000-0000-0000-000000000675',
              '00000000-0000-0000-0000-000000000676');
update public.staff set can_admin = true where id = '00000000-0000-0000-0000-000000000676';


-- ===== 1. A doctor makes prices standard, then changes one =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000671"}', true);
set local role authenticated;
select public.make_standard_prices('[{"kind": "drug", "item": "T67 Ceftriaxone 1 g injection", "amount": 2500},
                                     {"kind": "lab_test", "item": "T67 Widal", "amount": 3000}]');
select public.make_standard_prices('[{"kind": "drug", "item": "t67 ceftriaxone 1 g injection ", "amount": 2700}]');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000674"}', true);
set local role authenticated;
do $$
begin
  if (select amount from public.price_list where kind = 'drug' and item = 'T67 Ceftriaxone 1 g injection') <> 2700
     or (select amount from public.price_list where kind = 'lab_test' and item = 'T67 Widal') <> 3000
     or (select count(*) from public.price_list where lower(item) like 't67 ceftriaxone%') <> 1 then
    raise exception 'FAIL 1: the standard prices were not saved, changed, or are not read by the Front Desk';
  end if;
end $$;
reset role;
\echo 'PASS 1: a doctor makes prices standard and changes one; everybody reads them'


-- ===== 2. The matron and the admin can; others cannot =====
do $$
declare who text;
begin
  foreach who in array array['000000000672', '000000000676'] loop
    perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-' || who || '"}', true);
    set local role authenticated;
    perform public.make_standard_prices('[{"kind": "lab_test", "item": "T67 Urinalysis", "amount": 1500}]');
    reset role;
  end loop;
  foreach who in array array['000000000673', '000000000674', '000000000675'] loop
    perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-' || who || '"}', true);
    set local role authenticated;
    begin
      perform public.make_standard_prices('[{"kind": "drug", "item": "T67 Not Allowed", "amount": 100}]');
      reset role;
      raise exception 'FAIL 2: % set a standard price', who;
    exception when insufficient_privilege then
      reset role;
    end;
  end loop;
  if not exists (select 1 from public.price_list where item = 'T67 Urinalysis') then
    raise exception 'FAIL 2: the matron or the admin could not set a standard price';
  end if;
end $$;
\echo 'PASS 2: the matron and the admin can; a nurse, the Front Desk and the Pharmacy cannot'


-- ===== 3. Bad prices are refused =====
do $$
declare bad text;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000671"}', true);
  foreach bad in array array[
    '[{"kind": "card", "item": "T67 Card", "amount": 1000}]',
    '[{"kind": "drug", "item": " ", "amount": 1000}]',
    '[{"kind": "drug", "item": "T67 Zero", "amount": 0}]',
    '[]'
  ] loop
    set local role authenticated;
    begin
      perform public.make_standard_prices(bad::jsonb);
      reset role;
      raise exception 'FAIL 3: this was saved: %', bad;
    exception when invalid_parameter_value then
      reset role;
    end;
  end loop;
end $$;
\echo 'PASS 3: a wrong kind, no name, a price of 0 or nothing at all is refused'


-- ===== 4. The admin sets a drug price on the Prices tab =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000676"}', true);
set local role authenticated;
select public.set_price('drug', 'T67 Paracetamol 500 mg tablet', 300);
reset role;
do $$
begin
  if (select amount from public.price_list where kind = 'drug' and item = 'T67 Paracetamol 500 mg tablet') <> 300 then
    raise exception 'FAIL 4: the admin could not set a drug price';
  end if;
end $$;
\echo 'PASS 4: the admin sets a drug price'

rollback;

-- =============================================================================
-- tests for antenatal_details_into_booking (request 227g, 2026-11-19).
--
-- What this proves:
--   1. The Front Desk saves an antenatal patient's card details into the
--      booking, reads them back, and changes one without losing the rest;
--      the save is in the activity log.
--   2. Not for a patient who is not antenatal; not for the Pharmacy.
--   3. The Front Desk still cannot read the booking itself (only these nine
--      details through the function).
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000531', 't053-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000532', 't053-pharmacy@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000531', 'T53 Desk',     't053-desk@test.rhema',     'front_desk'),
  ('00000000-0000-0000-0000-000000000532', 'T53 Pharmacy', 't053-pharmacy@test.rhema', 'pharmacy');
insert into public.patients (full_name, date_of_birth, sex, category, created_by) values
  ('T53 Mother', '1993-03-03', 'female', 'antenatal',  '00000000-0000-0000-0000-000000000531'),
  ('T53 Other',  '1980-01-01', 'male',   'individual', '00000000-0000-0000-0000-000000000531');
create temporary table t053 (mother bigint, other bigint);
insert into t053 select
  (select id from public.patients where full_name = 'T53 Mother'),
  (select id from public.patients where full_name = 'T53 Other');
grant all on t053 to authenticated;


-- ===== 1. The Front Desk saves, reads back and changes =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000531"}', true);
set local role authenticated;
do $$
declare got jsonb;
begin
  if public.save_antenatal_details((select mother from t053), '{
      "client_marital_status": "Married", "client_religion": "Christian",
      "client_education": "Secondary (SSCE)", "client_occupation": "Trader",
      "kin_occupation": "Driver", "kin_religion": "Christian",
      "kin_education": "Primary", "kin_age": 41}'::jsonb) <> 'saved' then
    raise exception 'FAIL 1: the Front Desk could not save';
  end if;
  perform public.save_antenatal_details((select mother from t053), '{"client_occupation": "Tailor"}'::jsonb);
  perform public.save_antenatal_details((select mother from t053), '{"kin_age": 42}'::jsonb);
  got := public.antenatal_details((select mother from t053));
  if got ->> 'client_occupation' is distinct from 'Tailor'
     or got ->> 'client_religion' is distinct from 'Christian'
     or (got ->> 'kin_age')::int is distinct from 42 then
    raise exception 'FAIL 1: read back wrong: %', got;
  end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.activity_log where table_name = 'antenatal_bookings') then
    raise exception 'FAIL 1: the save was not written in the activity log';
  end if;
end $$;
\echo 'PASS 1: the Front Desk saves, reads back and changes one detail'


-- ===== 2. Not for somebody not antenatal; not for the Pharmacy =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000531"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.save_antenatal_details((select other from t053), '{"client_religion": "x"}'::jsonb);
    raise exception 'FAIL 2: details saved for a patient who is not antenatal';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000532"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.save_antenatal_details((select mother from t053), '{"client_religion": "x"}'::jsonb);
    raise exception 'FAIL 2: the Pharmacy saved antenatal details';
  exception when insufficient_privilege then null;
  end;
  if public.antenatal_details((select mother from t053)) is not null then
    raise exception 'FAIL 2: the Pharmacy read antenatal details';
  end if;
end $$;
reset role;
\echo 'PASS 2: not for somebody not antenatal; not for the Pharmacy'


-- ===== 3. The Front Desk cannot read the booking itself =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000531"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.antenatal_bookings) then
    raise exception 'FAIL 3: the Front Desk read the booking directly';
  end if;
end $$;
reset role;
\echo 'PASS 3: the booking itself stays medical only'

rollback;

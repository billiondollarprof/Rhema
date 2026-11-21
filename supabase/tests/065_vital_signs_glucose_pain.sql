-- =============================================================================
-- 065_vital_signs_glucose_pain.sql: tests for vital_signs_glucose_pain
-- (request 235, 2026-11-21).
--
-- What this proves:
--   1. A nurse saves a fasting glucose in mmol/L, a random one in mg/dL, and
--      a pain score alone.
--   2. A glucose without fasting or random, or without its unit, or out of
--      range, is refused; so is a pain score above 10.
--   3. A reading with nothing in it is still refused.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000651', 't065-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000652', 't065-desk@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000651', 'T65 Nurse', 't065-nurse@test.rhema', 'nurse',      true),
  ('00000000-0000-0000-0000-000000000652', 'T65 Desk',  't065-desk@test.rhema',  'front_desk', false);
update public.staff set can_medical = false where id = '00000000-0000-0000-0000-000000000652';
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T65 Patient', '1970-03-03', 'male', '00000000-0000-0000-0000-000000000652');
insert into public.record_openings (patient_id, staff_id)
select id, '00000000-0000-0000-0000-000000000651' from public.patients where full_name = 'T65 Patient';


-- ===== 1. Saved =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000651"}', true);
set local role authenticated;
insert into public.vital_signs (patient_id, blood_glucose, glucose_unit, glucose_when, recorded_by)
select id, 5.4, 'mmol/L', 'fasting', '00000000-0000-0000-0000-000000000651' from public.patients where full_name = 'T65 Patient';
insert into public.vital_signs (patient_id, blood_glucose, glucose_unit, glucose_when, pulse, recorded_by)
select id, 180, 'mg/dL', 'random', 88, '00000000-0000-0000-0000-000000000651' from public.patients where full_name = 'T65 Patient';
insert into public.vital_signs (patient_id, pain_score, recorded_by)
select id, 7, '00000000-0000-0000-0000-000000000651' from public.patients where full_name = 'T65 Patient';
reset role;
do $$
begin
  if (select count(*) from public.vital_signs v join public.patients p on p.id = v.patient_id
      where p.full_name = 'T65 Patient') <> 3 then
    raise exception 'FAIL 1: the glucose and pain readings were not all saved';
  end if;
end $$;
\echo 'PASS 1: fasting in mmol/L, random in mg/dL, and a pain score alone are saved'


-- ===== 2 and 3. Refused =====
do $$
declare
  patient bigint := (select id from public.patients where full_name = 'T65 Patient');
  bad text;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000651"}', true);
  foreach bad in array array[
    'blood_glucose, glucose_unit) values (%s, 6.1, ''mmol/L'')',
    'blood_glucose, glucose_when) values (%s, 6.1, ''random'')',
    'blood_glucose, glucose_unit, glucose_when) values (%s, 70, ''mmol/L'', ''random'')',
    'blood_glucose, glucose_unit, glucose_when) values (%s, 5, ''mg/dL'', ''fasting'')',
    'pain_score) values (%s, 11)',
    'glucose_unit, glucose_when) values (%s, ''mmol/L'', ''fasting'')'
  ] loop
    set local role authenticated;
    begin
      execute format('insert into public.vital_signs (recorded_by, patient_id, ' || bad,
                     '''00000000-0000-0000-0000-000000000651'', ' || patient);
      reset role;
      raise exception 'FAIL 2: this was saved: %', bad;
    exception when check_violation then
      reset role;
    end;
  end loop;
end $$;
\echo 'PASS 2: no glucose without fasting or random and its unit, nor out of range; pain at most 10'
do $$
declare patient bigint := (select id from public.patients where full_name = 'T65 Patient');
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000651"}', true);
  set local role authenticated;
  begin
    insert into public.vital_signs (patient_id, recorded_by)
    values (patient, '00000000-0000-0000-0000-000000000651');
    reset role;
    raise exception 'FAIL 3: an empty reading was saved';
  exception when check_violation then
    reset role;
  end;
end $$;
\echo 'PASS 3: a reading with nothing in it is still refused'

rollback;

-- =============================================================================
-- 019_profile_activity_log.sql: tests for profile_activity_log (request 138).
--
-- What this is: proves a doctor with the record open can save and change a
-- Profile (blood group, genotype), that each save is in the activity log
-- under the patient's number, that a table with an id still logs its id,
-- and that somebody without the record cannot save a Profile.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: a doctor, a lab person, one patient =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000191', 't019-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000192', 't019-lab@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000191', 'Test Doctor', 't019-doctor@test.rhema', 'doctor'),
  ('00000000-0000-0000-0000-000000000192', 'Test Lab',    't019-lab@test.rhema',    'laboratory');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('Profile Made Up', '1990-05-05', 'female', '00000000-0000-0000-0000-000000000191');
insert into public.record_openings (patient_id, staff_id)
select id, '00000000-0000-0000-0000-000000000191' from public.patients where full_name = 'Profile Made Up';


-- ===== 1. The doctor saves a Profile, then changes it =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000191"}', true);
set local role authenticated;
insert into public.medical_profiles (patient_id, blood_group, genotype)
select id, 'O+', 'AA' from public.patients where full_name = 'Profile Made Up';
update public.medical_profiles set genotype = 'AS'
 where patient_id = (select id from public.patients where full_name = 'Profile Made Up');
reset role;
do $$
declare
  patient bigint := (select id from public.patients where full_name = 'Profile Made Up');
begin
  if (select genotype from public.medical_profiles where patient_id = patient) <> 'AS' then
    raise exception 'FAIL 1: the Profile was not saved and changed';
  end if;
  if (select count(*) from public.activity_log
      where table_name = 'medical_profiles' and record_id = patient::text and patient_id = patient
        and actor_id = '00000000-0000-0000-0000-000000000191') <> 2 then
    raise exception 'FAIL 1: the Profile save and change are not both in the activity log';
  end if;
  if not exists (select 1 from public.activity_log
                 where table_name = 'medical_profiles' and action = 'update'
                   and changed_fields = array['genotype']) then
    raise exception 'FAIL 1: the log does not say the genotype changed';
  end if;
end $$;
\echo 'PASS 1: a doctor saves and changes a Profile; both are logged under the patient'


-- ===== 2. A table with an id still logs its own id =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000191"}', true);
set local role authenticated;
insert into public.allergies (patient_id, allergen)
select id, 'Penicillin' from public.patients where full_name = 'Profile Made Up';
reset role;
do $$
begin
  if not exists (select 1 from public.activity_log a join public.allergies x on a.record_id = x.id::text
                 where a.table_name = 'allergies' and x.allergen = 'Penicillin') then
    raise exception 'FAIL 2: an allergy is no longer logged by its own id';
  end if;
end $$;
\echo 'PASS 2: other tables still log their own id'


-- ===== 3. Somebody without the record cannot save a Profile =====
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('Profile Other', '1991-06-06', 'male', '00000000-0000-0000-0000-000000000191');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000192"}', true);
set local role authenticated;
do $$
begin
  insert into public.medical_profiles (patient_id, blood_group)
  select id, 'A+' from public.patients where full_name = 'Profile Other';
  raise exception 'FAIL 3: somebody without the record saved a Profile';
exception when insufficient_privilege or check_violation then null;
end $$;
reset role;
\echo 'PASS 3: without the record, no Profile is saved'

rollback;

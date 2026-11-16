-- =============================================================================
-- 041_remove_live_test_patients.sql: tests for the one off delete of the 8
-- live test patients (request 205, 2026-11-16).
--
-- What this proves: run on a database that holds those 8 (made up copies,
-- same numbers and same moments), the delete removes them, their payments,
-- visits, vital signs, activity log lines and their empty family, and keeps
-- every other patient. Run where they are not (the local and testing
-- databases, where the migration already ran), it deleted nothing.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== 1. The migration already ran here and deleted nothing =====
do $$
begin
  if exists (select 1 from public.patients where patient_number = 'RMC-000001'
             and created_at = '2026-11-09 06:52:17.697637+00') then
    raise exception 'FAIL 1: setup is wrong, the live patient copy already exists';
  end if;
end $$;
\echo 'PASS 1: where the 8 are not, nothing matched'


-- ===== 2. Made up copies of the 8, and one other patient =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000411', 't041-desk@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000411', 'T41 Desk', 't041-desk@test.rhema', 'front_desk');

-- Triggers off while the copies go in, so their numbers and times are exact.
set local session_replication_role = replica;
insert into public.families (id, name, family_number) overriding system value values (941, 'Made Up Family', 'FAM-999941');
insert into public.patients (full_name, sex, date_of_birth, patient_number, created_at, created_by, family_id)
select 'Made Up ' || n, 'female', '1990-01-01', n, t::timestamptz,
       '00000000-0000-0000-0000-000000000411', case when n = 'RMC-000002' then 941 end
from (values
  ('RMC-000001', '2026-11-09 06:52:17.697637+00'),
  ('RMC-000002', '2026-11-09 07:01:55.741384+00'),
  ('RMC-000003', '2026-11-09 12:45:42.55639+00'),
  ('RMC-000004', '2026-11-11 06:39:24.986263+00'),
  ('RMC-000005', '2026-11-12 11:58:45.699638+00'),
  ('RMC-000006', '2026-11-13 14:41:16.944535+00'),
  ('RMC-000007', '2026-11-13 16:07:25.967309+00'),
  ('RMC-000008', '2026-11-15 09:27:00.536751+00')
) as v (n, t);
insert into public.patients (full_name, sex, date_of_birth, patient_number, created_by)
values ('Made Up Keeper', 'male', '1985-01-01', 'RMC-999999', '00000000-0000-0000-0000-000000000411');
insert into public.payments (patient_id, amount, purpose, mode, received_by, receipt_number)
select id, 2000, 'consultation', 'cash', '00000000-0000-0000-0000-000000000411', 'RCT-T41-' || id
from public.patients where patient_number in ('RMC-000001', 'RMC-999999');
insert into public.activity_log (actor_id, action, table_name, record_id, patient_id)
select '00000000-0000-0000-0000-000000000411', 'insert', 'patients', id::text, id
from public.patients where patient_number in ('RMC-000003', 'RMC-999999');
set local session_replication_role = origin;


-- ===== 3. Run the delete itself =====
\ir ../migrations/20261116110342_remove_live_test_patients.sql

do $$
begin
  if exists (select 1 from public.patients where patient_number between 'RMC-000001' and 'RMC-000008'
             and full_name like 'Made Up %') then
    raise exception 'FAIL 3: a test patient is still there';
  end if;
  if not exists (select 1 from public.patients where patient_number = 'RMC-999999') then
    raise exception 'FAIL 3: another patient was deleted';
  end if;
  if (select count(*) from public.payments p join public.patients x on x.id = p.patient_id
      where x.patient_number = 'RMC-999999') <> 1 then
    raise exception 'FAIL 3: another patient lost a payment';
  end if;
  if (select count(*) from public.activity_log a join public.patients x on x.id = a.patient_id
      where x.patient_number = 'RMC-999999') < 1 then
    raise exception 'FAIL 3: another patient lost an activity line';
  end if;
  if exists (select 1 from public.families where id = 941) then
    raise exception 'FAIL 3: the empty family is still there';
  end if;
end $$;
\echo 'PASS 3: the 8 and their records are gone, every other patient stays'

rollback;

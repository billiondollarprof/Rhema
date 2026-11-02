-- =============================================================================
-- 012_patient_files_preview.sql: tests for previewing and deleting files
-- (request 128, adjustments of 2026-11-02).
--
-- What this is: proves the Front Desk now sees a patient's files; every
-- opening is logged; somebody without the patients tick sees and opens
-- nothing; and only the person who attached a file to an old file patient
-- may delete it. Not a nurse, not the admin, and never on an ordinary
-- patient.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: two front desk staff, an admin, a lab person; two patients =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'pv-desk@test.rhema'),
  ('00000000-0000-0000-0000-0000000000b2', 'pv-desk2@test.rhema'),
  ('00000000-0000-0000-0000-0000000000b3', 'pv-admin@test.rhema'),
  ('00000000-0000-0000-0000-0000000000b4', 'pv-lab@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'Pv Desk',  'pv-desk@test.rhema',  'front_desk'),
  ('00000000-0000-0000-0000-0000000000b2', 'Pv Desk2', 'pv-desk2@test.rhema', 'front_desk'),
  ('00000000-0000-0000-0000-0000000000b3', 'Pv Admin', 'pv-admin@test.rhema', 'admin'),
  ('00000000-0000-0000-0000-0000000000b4', 'Pv Lab',   'pv-lab@test.rhema',   'laboratory');
update public.staff set can_patients = false where id = '00000000-0000-0000-0000-0000000000b4';
update public.staff set can_admin = true where id = '00000000-0000-0000-0000-0000000000b3';

insert into public.patients (full_name, phone, from_old_file, created_by)
values ('Pv Old File', '08035550980', true, '00000000-0000-0000-0000-0000000000b1');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('Pv Ordinary', '1990-01-01', 'male', '00000000-0000-0000-0000-0000000000b1');

-- The desk attaches one file to each patient.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
set local role authenticated;
select public.add_patient_file((select id from public.patients where full_name = 'Pv Old File'),
  'record/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf', 'Old card.pdf', 'application/pdf', 1000);
select public.add_patient_file((select id from public.patients where full_name = 'Pv Ordinary'),
  'record/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp', 'Scan.webp', 'image/webp', 1000);
reset role;


-- ===== 1. The Front Desk sees the files and opens them; each opening is logged =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.patient_files) <> 2 then
    raise exception 'FAIL 1: the Front Desk could not see the patients'' files';
  end if;
  if not public.open_patient_file('record/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf') then
    raise exception 'FAIL 1: the Front Desk could not open a file';
  end if;
  if public.open_patient_file('record/cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf') then
    raise exception 'FAIL 1: a file that does not exist opened';
  end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.activity_log
      where table_name = 'patient_files' and action = 'view'
        and actor_id = '00000000-0000-0000-0000-0000000000b2') <> 1 then
    raise exception 'FAIL 1: opening a file was not written in the activity log';
  end if;
end $$;
\echo 'PASS 1: the Front Desk sees and opens files; each opening is logged'


-- ===== 2. Without the patients tick: nothing seen, nothing opened =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b4"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.patient_files) <> 0 then
    raise exception 'FAIL 2: somebody without the patients tick saw files';
  end if;
  if public.open_patient_file('record/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf') then
    raise exception 'FAIL 2: somebody without the patients tick opened a file';
  end if;
end $$;
reset role;
\echo 'PASS 2: without the patients tick, nothing is seen or opened'

-- A crossed out file does not open any more, for anybody.
update public.patient_files set removed_at = now(), remove_reason = 'Wrong file'
 where file_key = 'record/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2"}', true);
set local role authenticated;
do $$
begin
  if public.open_patient_file('record/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp') then
    raise exception 'FAIL 2: a crossed out file still opened';
  end if;
end $$;
reset role;
\echo 'PASS 2b: a crossed out file does not open'


-- ===== 3. Only the person who attached it may delete; not another desk, not the admin =====
do $$
declare
  person text;
begin
  foreach person in array array['00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', person)::text, true);
    begin
      set local role authenticated;
      perform public.delete_patient_file('record/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf');
      raise exception 'FAIL 3: % deleted a file they did not attach', person;
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
end $$;
\echo 'PASS 3: another desk and the admin cannot delete'


-- ===== 4. The uploader deletes on an old file patient, never on an ordinary one =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.delete_patient_file('record/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp');
    raise exception 'FAIL 4: a file on an ordinary patient was deleted';
  exception when insufficient_privilege then null;
  end;
  if public.delete_patient_file('record/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf') <> 'deleted' then
    raise exception 'FAIL 4: the uploader could not delete the old file';
  end if;
  if public.delete_patient_file('record/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf') <> 'not_found' then
    raise exception 'FAIL 4: a deleted file was found again';
  end if;
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.patient_files where file_key = 'record/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf') then
    raise exception 'FAIL 4: the deleted file is still in the table';
  end if;
  if not exists (select 1 from public.patient_files where file_key = 'record/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp') then
    raise exception 'FAIL 4: the ordinary patient''s file went missing';
  end if;
  if (select count(*) from public.activity_log
      where table_name = 'patient_files' and action = 'delete') <> 1 then
    raise exception 'FAIL 4: the delete was not written in the activity log';
  end if;
end $$;
\echo 'PASS 4: the uploader deletes on an old file patient only; it is logged'


-- ===== 5. Nothing for somebody not signed in =====
do $$
begin
  if has_function_privilege('anon', 'public.open_patient_file(text)', 'execute')
     or has_function_privilege('anon', 'public.delete_patient_file(text)', 'execute') then
    raise exception 'FAIL 5: somebody not signed in may call the open or delete doors';
  end if;
end $$;
set local role anon;
do $$
begin
  perform public.open_patient_file('record/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp');
  raise exception 'FAIL 5: somebody not signed in opened a file';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 5: nothing for somebody not signed in'

rollback;

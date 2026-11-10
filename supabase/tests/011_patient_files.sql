-- =============================================================================
-- 011_patient_files.sql: tests for files on the record and "Register from
-- old file" (request 128).
--
-- What this is: proves that a patient from an old file needs only a name
-- and a phone; that the Front Desk can attach but never read; that a nurse
-- reads only after opening the record; that the same file is not recorded
-- twice; that removing needs a reason and the record opened; and that
-- nothing is written by hand or by somebody not signed in.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: a front desk, a nurse, a lab person =====
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'pf-desk@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a2', 'pf-nurse@test.rhema'),
  ('00000000-0000-0000-0000-0000000000a3', 'pf-lab@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'Pf Desk',  'pf-desk@test.rhema',  'front_desk'),
  ('00000000-0000-0000-0000-0000000000a2', 'Pf Nurse', 'pf-nurse@test.rhema', 'nurse'),
  ('00000000-0000-0000-0000-0000000000a3', 'Pf Lab',   'pf-lab@test.rhema',   'laboratory');
-- The lab person may not register patients, for test 2.
update public.staff set can_patients = false where id = '00000000-0000-0000-0000-0000000000a3';

create temporary table t (patient bigint, file bigint);
grant select, insert, update on t to authenticated;


-- ===== 1. Register from old file: a name and a phone are enough =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
insert into public.patients (full_name, phone, from_old_file, created_by)
values ('Old File Made Up', '08035550990', true, '00000000-0000-0000-0000-0000000000a1');
insert into t select id from public.patients where full_name = 'Old File Made Up';
do $$
begin
  if (select patient_number from public.patients where id = (select patient from t)) !~ '^RMC-[0-9]{6}$' then
    raise exception 'FAIL 1: a patient from an old file did not get an RMC number';
  end if;
  -- Since 2026-11-10 (migration old_file_without_phone, test 027) an old
  -- file patient needs only a name, so no phone number is not refused.
  begin
    insert into public.patients (full_name, phone, created_by)
    values ('Ordinary No Birthday', '08035550991', '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL 1: an ordinary patient was saved without date of birth and sex';
  exception when check_violation or not_null_violation then null;
  end;
end $$;
reset role;
\echo 'PASS 1: an old file needs only a name; everybody else still needs more'


-- ===== 2. The Front Desk attaches; somebody who may not register cannot =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $$
begin
  if public.add_patient_file((select patient from t),
       'record/11111111-1111-4111-8111-111111111111.pdf', 'Old card.pdf', 'application/pdf', 120000) <> 'added' then
    raise exception 'FAIL 2: the Front Desk could not attach the old file';
  end if;
  if public.add_patient_file((select patient from t),
       'record/11111111-1111-4111-8111-111111111111.pdf', 'Old card.pdf', 'application/pdf', 120000) <> 'already_added' then
    raise exception 'FAIL 2: the same file was recorded twice';
  end if;
  begin
    perform public.add_patient_file((select patient from t),
       'lab/22222222-2222-4222-8222-222222222222.pdf', 'Wrong place.pdf', 'application/pdf', 100);
    raise exception 'FAIL 2: a file key outside record/ was accepted';
  exception when check_violation then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3"}', true);
set local role authenticated;
do $$
begin
  perform public.add_patient_file((select patient from t),
     'record/33333333-3333-4333-8333-333333333333.webp', 'Scan.webp', 'image/webp', 5000);
  raise exception 'FAIL 2: somebody who may not register patients attached a file';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 2: the Front Desk attaches, once; others without the right cannot'


-- ===== 3. Somebody without the patients tick or the record reads nothing =====
-- (Since 20261102 patient_files_preview, the Front Desk may see the files;
-- that is tested in 012. The Laboratory, with neither, still may not.)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.patient_files) <> 0 then
    raise exception 'FAIL 3: somebody without the patients tick read a patient''s files';
  end if;
end $$;
reset role;
\echo 'PASS 3: nobody without the patients tick or the record reads files'


-- ===== 4. A nurse with the record open reads the file =====
insert into public.record_openings (patient_id, staff_id)
values ((select patient from t), '00000000-0000-0000-0000-0000000000a2');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.patient_files) <> 1 then
    raise exception 'FAIL 4: a nurse with the record open could not read its file';
  end if;
end $$;
reset role;
\echo 'PASS 4: a nurse with the record open reads the file'
-- Note the file's number as the test runner, so somebody without the record below asks
-- for a real file it cannot see, not for nothing.
update t set file = (select min(id) from public.patient_files);


-- ===== 5. Removing needs the record open and a reason; nothing is deleted =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3"}', true);
set local role authenticated;
do $$
begin
  perform public.remove_patient_file((select file from t), 'Wrong patient');
  raise exception 'FAIL 5: somebody without the record removed a file';
exception when insufficient_privilege then null;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
set local role authenticated;
do $$
declare
  file bigint := (select file from t);
begin
  begin
    perform public.remove_patient_file(file, '  ');
    raise exception 'FAIL 5: a file was removed without a reason';
  exception when invalid_parameter_value then null;
  end;
  if public.remove_patient_file(file, 'Wrong patient') <> 'removed' then
    raise exception 'FAIL 5: the nurse could not remove the file';
  end if;
  if public.remove_patient_file(file, 'Wrong patient') <> 'already_removed' then
    raise exception 'FAIL 5: a file was removed twice';
  end if;
  if (select count(*) from public.patient_files where removed_at is not null) <> 1 then
    raise exception 'FAIL 5: the removed file is not kept in the history';
  end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.activity_log where table_name = 'patient_files') < 2 then
    raise exception 'FAIL 5: attaching and removing were not written in the activity log';
  end if;
end $$;
\echo 'PASS 5: removing needs the record and a reason; the file stays in the history'


-- ===== 6. Nothing by hand; nothing for somebody not signed in =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.patient_files (patient_id, file_key, file_name, file_type, file_size)
    values ((select patient from t), 'record/44444444-4444-4444-8444-444444444444.pdf', 'x.pdf', 'application/pdf', 10);
    raise exception 'FAIL 6: a file row was written by hand';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.patient_files set removed_at = null;
    raise exception 'FAIL 6: a file row was changed by hand';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  if has_function_privilege('anon', 'public.add_patient_file(bigint, text, text, text, integer)', 'execute')
     or has_function_privilege('anon', 'public.remove_patient_file(bigint, text)', 'execute') then
    raise exception 'FAIL 6: somebody not signed in may call the file doors';
  end if;
end $$;
set local role anon;
do $$
begin
  perform public.add_patient_file(1, 'record/55555555-5555-4555-8555-555555555555.pdf', 'x.pdf', 'application/pdf', 10);
  raise exception 'FAIL 6: somebody not signed in attached a file';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 6: nothing by hand; nothing for somebody not signed in'

rollback;

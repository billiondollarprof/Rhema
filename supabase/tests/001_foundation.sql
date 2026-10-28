-- =============================================================================
-- 001_foundation.sql: tests for the foundation migration.
--
-- What this is: one check per security rule. Each check acts as a made up
-- staff member (or as nobody) and proves the database allows or blocks the
-- right thing. If any check fails, the whole file stops with an error, and
-- CI goes red.
--
-- Everything runs inside one transaction that is rolled back at the end, so
-- running the tests never leaves anything behind.
--
-- The people here are made up. No real patient or staff data, ever.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

-- ===== Setup: four made up staff members =====================================
-- Done as the database owner, which is how the admin's first account is
-- created in real life too.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.rhema'),
  ('00000000-0000-0000-0000-00000000000f', 'desk@test.rhema'),
  ('00000000-0000-0000-0000-00000000000b', 'pharmacy@test.rhema'),
  ('00000000-0000-0000-0000-00000000000c', 'gone@test.rhema');

insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Test Admin',    'admin@test.rhema',    'admin'),
  ('00000000-0000-0000-0000-00000000000f', 'Test Desk',     'desk@test.rhema',     'front_desk'),
  ('00000000-0000-0000-0000-00000000000b', 'Test Pharmacy', 'pharmacy@test.rhema', 'pharmacy'),
  ('00000000-0000-0000-0000-00000000000c', 'Test Gone',     'gone@test.rhema',     'front_desk');

update public.staff set is_active = false where id = '00000000-0000-0000-0000-00000000000c';


-- ===== 1. Every table in public has RLS switched on ==========================
do $$
declare missing text;
begin
  select string_agg(c.relname, ', ') into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if missing is not null then
    raise exception 'FAIL 1: RLS is off on: %', missing;
  end if;
end $$;
\echo 'PASS 1: RLS is on for every table'


-- ===== 2. Starting permissions come from the role ============================
do $$
begin
  if not (select can_logs and can_medical from public.staff where email = 'admin@test.rhema') then
    raise exception 'FAIL 2: admin should start with logs and medical records';
  end if;
  if (select can_medical or can_logs from public.staff where email = 'desk@test.rhema') then
    raise exception 'FAIL 2: front desk should not start with medical records or logs';
  end if;
  if (select can_medical from public.staff where email = 'pharmacy@test.rhema') then
    raise exception 'FAIL 2: pharmacy should not start with medical records';
  end if;
end $$;
\echo 'PASS 2: starting permissions follow the role'


-- ===== 3. Front desk registers a patient and gets an RMC number ==============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f"}', true);
set local role authenticated;

insert into public.patients (full_name, date_of_birth, sex, phone)
values ('Ada Testpatient', '1990-05-01', 'female', '08035550126');

do $$
declare num text;
begin
  select patient_number into num from public.patients where full_name = 'Ada Testpatient';
  if num !~ '^RMC-[0-9]{6}$' then
    raise exception 'FAIL 3: patient number % is not in the RMC-000000 format', num;
  end if;
end $$;
reset role;
\echo 'PASS 3: front desk registered a patient with an RMC number'


-- ===== 4. Nobody can set or change a patient number by hand ==================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f"}', true);
set local role authenticated;
do $$
begin
  update public.patients set patient_number = 'RMC-999999' where full_name = 'Ada Testpatient';
  raise exception 'FAIL 4: a patient number was changed';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 4: patient numbers cannot be changed'


-- ===== 5. Nobody can delete a patient, not even the admin ====================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
set local role authenticated;
do $$
begin
  delete from public.patients where full_name = 'Ada Testpatient';
  raise exception 'FAIL 5: a patient was deleted';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 5: patients cannot be deleted'


-- ===== 6. People who are not signed in get nothing ===========================
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
begin
  perform 1 from public.patients;
  raise exception 'FAIL 6: anon could read patients';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 6: people who are not signed in cannot read patients'


-- ===== 7. A switched off staff member sees nothing ===========================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.patients) <> 0 then
    raise exception 'FAIL 7: a switched off staff member could see patients';
  end if;
  if (select count(*) from public.staff) <> 0 then
    raise exception 'FAIL 7: a switched off staff member could see staff';
  end if;
end $$;
reset role;
\echo 'PASS 7: switched off staff see nothing'


-- ===== 8. The activity log recorded the registration, with no patient details
do $$
declare entry record;
begin
  select * into entry from public.activity_log
  where table_name = 'patients' and action = 'insert'
  order by id desc limit 1;
  if entry is null then
    raise exception 'FAIL 8: the registration was not logged';
  end if;
  if entry.actor_id <> '00000000-0000-0000-0000-00000000000f' then
    raise exception 'FAIL 8: the log has the wrong person';
  end if;
  if entry.changed_fields is not null then
    raise exception 'FAIL 8: an insert should not list field values';
  end if;
end $$;
\echo 'PASS 8: the registration was logged against the right person'


-- ===== 9. An edit logs WHICH fields changed, never their values ==============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f"}', true);
set local role authenticated;
update public.patients set phone = '08035550127' where full_name = 'Ada Testpatient';
reset role;
do $$
declare entry record;
begin
  select * into entry from public.activity_log
  where table_name = 'patients' and action = 'update'
  order by id desc limit 1;
  if entry.changed_fields is distinct from array['phone'] then
    raise exception 'FAIL 9: expected changed_fields {phone}, got %', entry.changed_fields;
  end if;
end $$;
\echo 'PASS 9: edits log the field name only'


-- ===== 10. Only staff with the logs permission can read the log ==============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.activity_log) <> 0 then
    raise exception 'FAIL 10: front desk could read the activity log';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.activity_log) = 0 then
    raise exception 'FAIL 10: the admin could not read the activity log';
  end if;
end $$;
reset role;
\echo 'PASS 10: only the logs permission can read the log'


-- ===== 11. Nobody can change or delete a log line, the admin included ========
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
set local role authenticated;
do $$
begin
  update public.activity_log set action = 'nothing';
  raise exception 'FAIL 11: the admin changed a log line';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  delete from public.activity_log;
  raise exception 'FAIL 11: the admin deleted a log line';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 11: log lines cannot be changed or deleted'


-- ===== 12. Nobody can read a PIN, not even the admin =========================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
set local role authenticated;
do $$
begin
  perform pin_hash from public.staff;
  raise exception 'FAIL 12: a PIN column could be read';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 12: PINs cannot be read'


-- ===== 13. Only the admin can change staff ===================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f"}', true);
set local role authenticated;
update public.staff set can_logs = true where email = 'desk@test.rhema';
reset role;
do $$
begin
  if (select can_logs from public.staff where email = 'desk@test.rhema') then
    raise exception 'FAIL 13: front desk gave itself the logs permission';
  end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', true);
set local role authenticated;
update public.staff set room_id = (select id from public.rooms where name = 'Front Desk')
where email = 'desk@test.rhema';
reset role;
do $$
begin
  if (select room_id from public.staff where email = 'desk@test.rhema') is null then
    raise exception 'FAIL 13: the admin could not change a staff member';
  end if;
end $$;
\echo 'PASS 13: only the admin can change staff'


-- ===== 14. A bad phone number is refused =====================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f"}', true);
set local role authenticated;
do $$
begin
  insert into public.patients (full_name, date_of_birth, sex, phone)
  values ('Bad Phone', '1990-01-01', 'male', '12345');
  raise exception 'FAIL 14: a bad phone number was accepted';
exception when check_violation then null;
end $$;
reset role;
\echo 'PASS 14: bad phone numbers are refused'


-- ===== 15. Nobody can register a patient in someone else's name ==============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f"}', true);
set local role authenticated;
do $$
begin
  insert into public.patients (full_name, date_of_birth, sex, created_by)
  values ('Pretend Author', '1990-01-01', 'male', '00000000-0000-0000-0000-00000000000a');
  raise exception 'FAIL 15: a patient was registered in someone else''s name';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 15: registrations are always in the real author''s name'

rollback;
\echo 'ALL FOUNDATION TESTS PASSED'

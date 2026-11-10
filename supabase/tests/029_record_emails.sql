-- =============================================================================
-- 029_record_emails.sql: tests for the record email list.
--
-- What this is: proves only staff with the record open add a row, only in
-- their own name; a double tap saves once; the sender and a log reader see
-- it and nobody else; it is in the activity log; nobody changes or deletes.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000291', 't029-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000292', 't029-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000293', 't029-nurse2@test.rhema'),
  ('00000000-0000-0000-0000-000000000294', 't029-admin@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000291', 'T29 Nurse',  't029-nurse@test.rhema',  'nurse'),
  ('00000000-0000-0000-0000-000000000292', 'T29 Desk',   't029-desk@test.rhema',   'front_desk'),
  ('00000000-0000-0000-0000-000000000293', 'T29 Nurse2', 't029-nurse2@test.rhema', 'nurse'),
  ('00000000-0000-0000-0000-000000000294', 'T29 Admin',  't029-admin@test.rhema',  'admin');
insert into public.patients (full_name, date_of_birth, sex, email, created_by)
values ('T29 Patient', '1990-01-01', 'female', 'made.up@example.com', '00000000-0000-0000-0000-000000000292');
create temporary table t (patient bigint);
insert into t select id from public.patients where full_name = 'T29 Patient';
grant select on t to authenticated;


-- ===== 1. Nobody holds rights they should not have =====
do $$
begin
  if has_table_privilege('anon', 'public.record_emails', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception 'FAIL 1: the public has rights on record_emails';
  end if;
  if has_table_privilege('authenticated', 'public.record_emails', 'UPDATE, DELETE, TRUNCATE') then
    raise exception 'FAIL 1: signed in users can change or delete record_emails';
  end if;
end $$;
\echo 'PASS 1: nobody holds rights they should not have'


-- ===== 2. Before the record is open, nothing is written =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000291"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.record_emails (patient_id) select patient from t;
    raise exception 'FAIL 2: a send was logged without opening the record';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 2: nothing is logged before the record is opened'


-- ===== 3. With the record open, the send is logged, once, in the log =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000291"}', true);
set local role authenticated;
select public.open_record((select patient from t));
insert into public.record_emails (patient_id) select patient from t;
insert into public.record_emails (patient_id) select patient from t;
reset role;
do $$
begin
  if (select count(*) from public.record_emails) <> 1 then
    raise exception 'FAIL 3: a double tap was not saved once';
  end if;
  if not exists (select 1 from public.activity_log where table_name = 'record_emails') then
    raise exception 'FAIL 3: the send is not in the activity log';
  end if;
end $$;
\echo 'PASS 3: a send is logged once, and is in the activity log'


-- ===== 4. Never in another person's name =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000291"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.record_emails (patient_id, sent_by)
      select patient, '00000000-0000-0000-0000-000000000293' from t;
    raise exception 'FAIL 4: a send was logged in another person''s name';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 4: a send is only logged in the sender''s own name'


-- ===== 5. The Front Desk cannot send a record =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000292"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.open_record((select patient from t));
    insert into public.record_emails (patient_id) select patient from t;
    raise exception 'FAIL 5: the Front Desk logged a record email';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 5: the Front Desk cannot send a record'


-- ===== 6. Who reads the list =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000291"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.record_emails) <> 1 then
    raise exception 'FAIL 6: the sender cannot see their own send';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000293"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.record_emails) <> 0 then
    raise exception 'FAIL 6: another nurse can see somebody else''s send';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000294"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.record_emails) <> 1 then
    raise exception 'FAIL 6: the admin cannot read the log';
  end if;
end $$;
reset role;
\echo 'PASS 6: the sender and the admin read the list; another nurse does not'

rollback;

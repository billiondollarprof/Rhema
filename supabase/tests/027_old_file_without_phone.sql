-- =============================================================================
-- 027_old_file_without_phone.sql: tests for old file patients with no phone.
--
-- What this is: proves an old file patient can be saved with only a name,
-- and that a new patient still needs a date of birth and a sex.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000271', 't027-desk@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000271', 'Old File Desk', 't027-desk@test.rhema', 'front_desk');


-- ===== 1. An old file patient with only a name is saved =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000271"}', true);
set local role authenticated;
insert into public.patients (full_name, from_old_file, created_by)
values ('Old File Name Only', true, '00000000-0000-0000-0000-000000000271');
reset role;
do $$
begin
  if not exists (select 1 from public.patients where full_name = 'Old File Name Only' and phone is null) then
    raise exception 'FAIL 1: an old file patient with only a name was not saved';
  end if;
end $$;
\echo 'PASS 1: an old file patient with only a name is saved'


-- ===== 2. A new patient still needs a date of birth and a sex =====
do $$
begin
  begin
    insert into public.patients (full_name, phone, from_old_file, created_by)
    values ('New Without Details', '08031234567', false, '00000000-0000-0000-0000-000000000271');
    raise exception 'FAIL 2: a new patient was saved without a date of birth and sex';
  exception when check_violation then
    null;
  end;
end $$;
\echo 'PASS 2: a new patient still needs a date of birth and a sex'


-- ===== 3. A phone number that is there must still be 11 digits =====
do $$
begin
  begin
    insert into public.patients (full_name, phone, from_old_file, created_by)
    values ('Old File Bad Phone', '123', true, '00000000-0000-0000-0000-000000000271');
    raise exception 'FAIL 3: a wrong phone number was saved';
  exception when check_violation then
    null;
  end;
end $$;
\echo 'PASS 3: a wrong phone number is still refused'

-- ===== 4. A new patient with a date of birth but no sex, or the other way, is refused =====
do $$
begin
  begin
    insert into public.patients (full_name, phone, date_of_birth, from_old_file, created_by)
    values ('New No Sex', '08031234568', '1990-01-01', false, '00000000-0000-0000-0000-000000000271');
    raise exception 'FAIL 4: a new patient was saved without a sex';
  exception when check_violation then
    null;
  end;
  begin
    insert into public.patients (full_name, phone, sex, from_old_file, created_by)
    values ('New No Birthday', '08031234569', 'female', false, '00000000-0000-0000-0000-000000000271');
    raise exception 'FAIL 4: a new patient was saved without a date of birth';
  exception when check_violation then
    null;
  end;
end $$;
\echo 'PASS 4: a new patient needs both a date of birth and a sex'

rollback;

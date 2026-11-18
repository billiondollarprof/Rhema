-- =============================================================================
-- tests for antenatal_registration_details (request 227g, 2026-11-18).
--
-- What this proves:
--   1. The Front Desk registers an antenatal patient with the eight new
--      details, and changes them later.
--   2. A nurse cannot change them (the Front Desk rule still holds).
--   3. Too long a value, or an impossible age, is refused.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000521', 't052-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000522', 't052-nurse@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000521', 'T52 Desk',  't052-desk@test.rhema',  'front_desk'),
  ('00000000-0000-0000-0000-000000000522', 'T52 Nurse', 't052-nurse@test.rhema', 'nurse');


-- ===== 1. The Front Desk registers and changes them =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000521"}', true);
set local role authenticated;
insert into public.patients (full_name, date_of_birth, sex, category, created_by,
  marital_status, religion, education_level, occupation,
  next_of_kin_name, next_of_kin_occupation, next_of_kin_religion,
  next_of_kin_education_level, next_of_kin_age)
values ('T52 Made Up', '1991-02-02', 'female', 'antenatal', '00000000-0000-0000-0000-000000000521',
  'Married', 'Christian', 'Secondary', 'Trader',
  'T52 Husband', 'Driver', 'Christian', 'Primary', 40);
update public.patients set occupation = 'Teacher', next_of_kin_age = 41 where full_name = 'T52 Made Up';
reset role;
do $$
begin
  if (select occupation from public.patients where full_name = 'T52 Made Up') <> 'Teacher'
     or (select next_of_kin_age from public.patients where full_name = 'T52 Made Up') <> 41
     or (select religion from public.patients where full_name = 'T52 Made Up') <> 'Christian' then
    raise exception 'FAIL 1: the Front Desk could not save or change the antenatal details';
  end if;
end $$;
\echo 'PASS 1: the Front Desk saves and changes the antenatal details'


-- ===== 2. A nurse changes nothing =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000522"}', true);
set local role authenticated;
update public.patients set religion = 'Changed by nurse' where full_name = 'T52 Made Up';
reset role;
do $$
begin
  if (select religion from public.patients where full_name = 'T52 Made Up') <> 'Christian' then
    raise exception 'FAIL 2: a nurse changed an antenatal detail';
  end if;
end $$;
\echo 'PASS 2: a nurse changes nothing'


-- ===== 3. Too long, or an impossible age: refused =====
do $$
begin
  begin
    update public.patients set occupation = repeat('x', 81) where full_name = 'T52 Made Up';
    raise exception 'FAIL 3: an occupation of 81 letters was kept';
  exception when check_violation then null;
  end;
  begin
    update public.patients set next_of_kin_age = 200 where full_name = 'T52 Made Up';
    raise exception 'FAIL 3: an age of 200 was kept';
  exception when check_violation then null;
  end;
end $$;
\echo 'PASS 3: too long, or an impossible age, refused'

rollback;

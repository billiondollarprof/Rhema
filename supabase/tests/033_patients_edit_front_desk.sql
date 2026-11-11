-- =============================================================================
-- 033_patients_edit_front_desk.sql: tests for who may edit a patient.
--
-- What this is: proves only the Front Desk changes a patient's details, and
-- that everybody else's attempt changes nothing.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000331', 't033-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000332', 't033-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000333', 't033-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000334', 't033-pharmacy@test.rhema'),
  ('00000000-0000-0000-0000-000000000335', 't033-lab@test.rhema'),
  ('00000000-0000-0000-0000-000000000336', 't033-admin@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000331', 'T33 Desk',     't033-desk@test.rhema',     'front_desk'),
  ('00000000-0000-0000-0000-000000000332', 'T33 Nurse',    't033-nurse@test.rhema',    'nurse'),
  ('00000000-0000-0000-0000-000000000333', 'T33 Doctor',   't033-doctor@test.rhema',   'doctor'),
  ('00000000-0000-0000-0000-000000000334', 'T33 Pharmacy', 't033-pharmacy@test.rhema', 'pharmacy'),
  ('00000000-0000-0000-0000-000000000335', 'T33 Lab',      't033-lab@test.rhema',      'laboratory'),
  ('00000000-0000-0000-0000-000000000336', 'T33 Admin',    't033-admin@test.rhema',    'admin');
insert into public.patients (full_name, date_of_birth, sex, phone, created_by)
values ('T33 Patient', '1990-01-01', 'female', '08031234567', '00000000-0000-0000-0000-000000000331');


-- ===== 1. Everybody but the Front Desk changes nothing =====
do $$
declare
  who text;
  changed integer;
begin
  foreach who in array array['000000000332', '000000000333', '000000000334', '000000000335', '000000000336'] loop
    perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-' || who || '"}', true);
    set local role authenticated;
    update public.patients set phone = '08099999999' where full_name = 'T33 Patient';
    get diagnostics changed = row_count;
    reset role;
    if changed <> 0 then
      raise exception 'FAIL 1: somebody who is not the Front Desk changed a patient';
    end if;
  end loop;
  if (select phone from public.patients where full_name = 'T33 Patient') <> '08031234567' then
    raise exception 'FAIL 1: the patient''s phone number was changed';
  end if;
end $$;
\echo 'PASS 1: nobody but the Front Desk changes a patient'


-- ===== 2. The Front Desk can, and others can still read =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000331"}', true);
set local role authenticated;
update public.patients set phone = '08055555555' where full_name = 'T33 Patient';
reset role;
do $$
begin
  if (select phone from public.patients where full_name = 'T33 Patient') <> '08055555555' then
    raise exception 'FAIL 2: the Front Desk could not change a patient';
  end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000332"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.patients where full_name = 'T33 Patient') <> 1 then
    raise exception 'FAIL 2: a nurse can no longer find the patient';
  end if;
end $$;
reset role;
\echo 'PASS 2: the Front Desk changes a patient, and a nurse still finds them'

rollback;

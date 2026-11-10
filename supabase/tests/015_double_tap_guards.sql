-- =============================================================================
-- 015_double_tap_guards.sql: tests for the shared double tap guard (131).
--
-- What this is: proves a double tap saves one patient, one reading, one
-- note, one allergy, one dose, one medicine, one condition, one consultation;
-- that anything different, by somebody else, or after 30 seconds is kept.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'dt-desk@test.rhema'),
  ('00000000-0000-0000-0000-0000000000e2', 'dt-nurse@test.rhema'),
  ('00000000-0000-0000-0000-0000000000e3', 'dt-nurse2@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'Dt Desk',   'dt-desk@test.rhema',   'front_desk'),
  -- A doctor, because only a doctor writes a consultation note (2026-11-10).
  ('00000000-0000-0000-0000-0000000000e2', 'Dt Nurse',  'dt-nurse@test.rhema',  'doctor'),
  ('00000000-0000-0000-0000-0000000000e3', 'Dt Nurse2', 'dt-nurse2@test.rhema', 'nurse');


-- ===== 1. A patient registered twice at once is saved once =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1"}', true);
set local role authenticated;
insert into public.patients (full_name, date_of_birth, sex, phone, created_by)
values ('Dt Made Up', '1990-01-01', 'female', '08035550970', '00000000-0000-0000-0000-0000000000e1');
do $$
begin
  begin
    insert into public.patients (full_name, date_of_birth, sex, phone, created_by)
    values ('Dt Made Up', '1990-01-01', 'female', '08035550970', '00000000-0000-0000-0000-0000000000e1');
    raise exception 'FAIL 1: a double tap registered the patient twice';
  exception when unique_violation then
    if sqlerrm <> 'already registered' then raise; end if;
  end;
  -- Somebody else with a different name is registered as normal.
  insert into public.patients (full_name, date_of_birth, sex, created_by)
  values ('Dt Other', '1991-02-02', 'male', '00000000-0000-0000-0000-0000000000e1');
end $$;
reset role;
do $$
begin
  if (select count(*) from public.patients where full_name = 'Dt Made Up') <> 1 then
    raise exception 'FAIL 1: expected one Dt Made Up';
  end if;
  if (select count(*) from public.patients where full_name = 'Dt Other') <> 1 then
    raise exception 'FAIL 1: a different patient was refused';
  end if;
  -- The refused double tap used up no number: the next patient's number
  -- follows straight on.
  if substr((select patient_number from public.patients where full_name = 'Dt Other'), 5)::int
     <> substr((select patient_number from public.patients where full_name = 'Dt Made Up'), 5)::int + 1 then
    raise exception 'FAIL 1: a refused double tap used up a patient number';
  end if;
end $$;
\echo 'PASS 1: a double tap registers one patient; a different one is kept'

create temporary table t (patient bigint);
grant select on t to authenticated;
insert into t select id from public.patients where full_name = 'Dt Made Up';
insert into public.record_openings (patient_id, staff_id) values
  ((select patient from t), '00000000-0000-0000-0000-0000000000e2'),
  ((select patient from t), '00000000-0000-0000-0000-0000000000e3');


-- ===== 2. Every record entry, tapped twice, is saved once =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2"}', true);
set local role authenticated;
do $$
declare
  p bigint := (select patient from t);
  i int;
begin
  for i in 1..2 loop
    insert into public.vital_signs (patient_id, systolic, diastolic, pulse) values (p, 120, 80, 72);
    insert into public.nursing_notes (patient_id, note) values (p, 'Comfortable');
    insert into public.allergies (patient_id, allergen) values (p, 'Penicillin');
    insert into public.conditions (patient_id, name) values (p, 'Hypertension');
    insert into public.patient_medications (patient_id, medicine, dose) values (p, 'Metformin', '500 mg');
    insert into public.medications_given (patient_id, medicine, dose) values (p, 'Paracetamol', '1 g');
    insert into public.consultation_notes (patient_id, complaint) values (p, 'Headache');
  end loop;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.vital_signs) <> 1 then raise exception 'FAIL 2: vital signs saved twice'; end if;
  if (select count(*) from public.nursing_notes) <> 1 then raise exception 'FAIL 2: nursing note saved twice'; end if;
  if (select count(*) from public.allergies) <> 1 then raise exception 'FAIL 2: allergy saved twice'; end if;
  if (select count(*) from public.conditions) <> 1 then raise exception 'FAIL 2: condition saved twice'; end if;
  if (select count(*) from public.patient_medications) <> 1 then raise exception 'FAIL 2: medicine saved twice'; end if;
  if (select count(*) from public.medications_given) <> 1 then raise exception 'FAIL 2: dose saved twice'; end if;
  if (select count(*) from public.consultation_notes) <> 1 then raise exception 'FAIL 2: consultation saved twice'; end if;
end $$;
\echo 'PASS 2: every record entry tapped twice is saved once'


-- ===== 3. Different, by somebody else, or later: all kept =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2"}', true);
set local role authenticated;
insert into public.vital_signs (patient_id, systolic, diastolic, pulse) values ((select patient from t), 118, 79, 70);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e3"}', true);
set local role authenticated;
insert into public.nursing_notes (patient_id, note) values ((select patient from t), 'Comfortable');
reset role;
-- The first note is now a minute old.
update public.nursing_notes set created_at = now() - interval '1 minute'
where written_by = '00000000-0000-0000-0000-0000000000e2';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2"}', true);
set local role authenticated;
insert into public.nursing_notes (patient_id, note) values ((select patient from t), 'Comfortable');
reset role;
do $$
begin
  if (select count(*) from public.vital_signs) <> 2 then raise exception 'FAIL 3: a different reading was refused'; end if;
  if (select count(*) from public.nursing_notes) <> 3 then
    raise exception 'FAIL 3: a note by somebody else, or a minute later, was refused';
  end if;
end $$;
\echo 'PASS 3: different, by somebody else, or later: all kept'

rollback;

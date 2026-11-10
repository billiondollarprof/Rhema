-- =============================================================================
-- 028_doctor_notes_front_desk_registers_med_edit.sql: tests.
--
-- What this is: proves only somebody with a consulting room writes a consultation note, only the
-- Front Desk registers a patient, and a nurse may edit a current medicine
-- but not a stopped one.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000281', 't028-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000282', 't028-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000283', 't028-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000284', 't028-matron@test.rhema'),
  ('00000000-0000-0000-0000-000000000285', 't028-consult-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000286', 't028-roomless-doctor@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000281', 'T28 Desk',   't028-desk@test.rhema',   'front_desk'),
  ('00000000-0000-0000-0000-000000000282', 'T28 Doctor', 't028-doctor@test.rhema', 'doctor'),
  ('00000000-0000-0000-0000-000000000283', 'T28 Nurse',  't028-nurse@test.rhema',  'nurse'),
  ('00000000-0000-0000-0000-000000000284', 'T28 Matron', 't028-matron@test.rhema', 'matron'),
  ('00000000-0000-0000-0000-000000000285', 'T28 Consult Nurse', 't028-consult-nurse@test.rhema', 'nurse'),
  ('00000000-0000-0000-0000-000000000286', 'T28 Roomless Doctor', 't028-roomless-doctor@test.rhema', 'doctor');
-- Rooms: a doctor and a nurse in consulting rooms; a nurse in a nursing
-- station; the matron and one doctor with no room.
update public.staff set room_id = (select id from public.rooms where name = 'Consultant Room 1') where id = '00000000-0000-0000-0000-000000000282';
update public.staff set room_id = (select id from public.rooms where name = 'Consultant Room 2') where id = '00000000-0000-0000-0000-000000000285';
update public.staff set room_id = (select id from public.rooms where name = 'Nursing Station 1') where id = '00000000-0000-0000-0000-000000000283';
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T28 Patient', '1990-01-01', 'female', '00000000-0000-0000-0000-000000000281');
create temporary table t (patient bigint);
insert into t select id from public.patients where full_name = 'T28 Patient';
grant select on t to authenticated;


-- ===== 1. Only the Front Desk registers a patient =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000281"}', true);
set local role authenticated;
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T28 Registered By Desk', '1991-02-02', 'male', '00000000-0000-0000-0000-000000000281');
reset role;
do $$
declare who text;
begin
  foreach who in array array['000000000283', '000000000282', '000000000284'] loop
    perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-' || who || '"}', true);
    set local role authenticated;
    begin
      insert into public.patients (full_name, date_of_birth, sex, created_by)
      values ('T28 Should Not Exist', '1992-03-03', 'male', ('00000000-0000-0000-0000-' || who)::uuid);
      reset role;
      raise exception 'FAIL 1: a patient was registered by somebody who is not the Front Desk';
    exception when insufficient_privilege or check_violation then
      reset role;
    end;
  end loop;
end $$;
do $$
begin
  if not exists (select 1 from public.patients where full_name = 'T28 Registered By Desk') then
    raise exception 'FAIL 1: the Front Desk could not register a patient';
  end if;
end $$;
\echo 'PASS 1: only the Front Desk registers a patient'


-- ===== 2. Whoever has a consulting room writes a consultation note =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000282"}', true);
set local role authenticated;
select public.open_record((select patient from t));
insert into public.consultation_notes (patient_id, complaint, written_by)
  select patient, 'Headache for two days', '00000000-0000-0000-0000-000000000282' from t;
reset role;
-- A nurse with a consulting room writes one too.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000285"}', true);
set local role authenticated;
select public.open_record((select patient from t));
insert into public.consultation_notes (patient_id, complaint, written_by)
  select patient, 'Cough for a week', '00000000-0000-0000-0000-000000000285' from t;
reset role;
do $$
declare who text;
begin
  foreach who in array array['000000000283', '000000000284', '000000000286'] loop
    perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-' || who || '"}', true);
    set local role authenticated;
    perform public.open_record((select patient from t));
    begin
      insert into public.consultation_notes (patient_id, complaint, written_by)
        select patient, 'Not a doctor', ('00000000-0000-0000-0000-' || who)::uuid from t;
      reset role;
      raise exception 'FAIL 2: a consultation note was written by somebody with no consulting room';
    exception when insufficient_privilege or check_violation then
      reset role;
    end;
  end loop;
end $$;
\echo 'PASS 2: a doctor or nurse in a consulting room writes a note; nobody else does'


-- ===== 3. A nurse with no consulting room still reads notes, and cannot void them =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000283"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.consultation_notes) <> 2 then
    raise exception 'FAIL 3: the nurse cannot read the consultation note';
  end if;
  update public.consultation_notes
    set voided_at = now(), voided_by = '00000000-0000-0000-0000-000000000283', void_reason = 'try';
  if exists (select 1 from public.consultation_notes where voided_at is not null) then
    raise exception 'FAIL 3: a nurse voided a consultation note';
  end if;
end $$;
reset role;
\echo 'PASS 3: a nurse with no consulting room reads notes and cannot void them'


-- ===== 4. A nurse edits a current medicine, not a stopped one =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000283"}', true);
set local role authenticated;
insert into public.patient_medications (patient_id, medicine, dose, how_often, added_by)
  select patient, 'Paracetamol', '500 mg', 'Twice daily', '00000000-0000-0000-0000-000000000283' from t;
update public.patient_medications set dose = '1 g', how_often = 'Three times daily' where medicine = 'Paracetamol';
do $$
begin
  if not exists (select 1 from public.patient_medications where medicine = 'Paracetamol' and dose = '1 g' and how_often = 'Three times daily') then
    raise exception 'FAIL 4: the nurse could not edit a current medicine';
  end if;
end $$;
select public.change_medication_status((select id from public.patient_medications where medicine = 'Paracetamol'), 'stopped', 'Finished');
do $$
begin
  begin
    update public.patient_medications set dose = '2 g' where medicine = 'Paracetamol';
    raise exception 'FAIL 4: a stopped medicine was edited';
  exception when check_violation then null;
  end;
end $$;
reset role;
\echo 'PASS 4: a nurse edits a current medicine and not a stopped one'

-- ===== 5. A doctor cannot write a note in another person's name =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000282"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.consultation_notes (patient_id, complaint, written_by)
      select patient, 'In somebody else name', '00000000-0000-0000-0000-000000000283' from t;
    raise exception 'FAIL 5: a note was written in another person''s name';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;
reset role;
\echo 'PASS 5: a note is always in the writer''s own name'

-- ===== 6. A consulting room that is switched off gives no right to write =====
update public.rooms set is_active = false where name = 'Consultant Room 2';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000285"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.consultation_notes (patient_id, complaint, written_by)
      select patient, 'Room switched off', '00000000-0000-0000-0000-000000000285' from t;
    raise exception 'FAIL 6: a note was written from a consulting room that is switched off';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;
reset role;
\echo 'PASS 6: a switched off consulting room gives no right to write'

rollback;

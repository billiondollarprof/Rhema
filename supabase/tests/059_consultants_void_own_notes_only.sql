-- =============================================================================
-- 059_consultants_void_own_notes_only.sql: tests for
-- consultants_void_own_notes_only (request 229, 2026-11-20).
--
-- What this proves:
--   1. A consultant in another room reads the first consultant's note and
--      writes their own (the patient is carried on).
--   2. That consultant cannot void (or so correct) the first one's note.
--   3. Each consultant voids their own note.
--   4. A note typed by one and signed by another can be voided by either.
--   5. Nobody voids in another person's name.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000591', 't059-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000592', 't059-doctor1@test.rhema'),
  ('00000000-0000-0000-0000-000000000593', 't059-doctor2@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000591', 'T59 Desk',     't059-desk@test.rhema',    'front_desk'),
  ('00000000-0000-0000-0000-000000000592', 'T59 Doctor 1', 't059-doctor1@test.rhema', 'doctor'),
  ('00000000-0000-0000-0000-000000000593', 'T59 Doctor 2', 't059-doctor2@test.rhema', 'doctor');
update public.staff set room_id = (select id from public.rooms where name = 'Consultant Room 1')
 where id = '00000000-0000-0000-0000-000000000592';
update public.staff set room_id = (select id from public.rooms where name = 'Consultant Room 2')
 where id = '00000000-0000-0000-0000-000000000593';
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T59 Patient', '1990-01-01', 'female', '00000000-0000-0000-0000-000000000591');
insert into public.record_openings (patient_id, staff_id)
select p.id, s.id from public.patients p, public.staff s
where p.full_name = 'T59 Patient' and s.full_name in ('T59 Doctor 1', 'T59 Doctor 2');

-- Doctor 1 starts the patient.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000592"}', true);
set local role authenticated;
insert into public.consultation_notes (patient_id, complaint, written_by)
select id, 'T59 first visit', '00000000-0000-0000-0000-000000000592' from public.patients where full_name = 'T59 Patient';
reset role;


-- ===== 1. Doctor 2 reads it and carries on =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000593"}', true);
set local role authenticated;
insert into public.consultation_notes (patient_id, complaint, written_by)
select id, 'T59 follow up', '00000000-0000-0000-0000-000000000593' from public.patients where full_name = 'T59 Patient';
do $$
begin
  if (select count(*) from public.consultation_notes where complaint like 'T59 %') <> 2 then
    raise exception 'FAIL 1: doctor 2 does not see both notes';
  end if;
end $$;
reset role;
\echo 'PASS 1: another consultant reads the note and writes their own'


-- ===== 2. Doctor 2 cannot void doctor 1's note =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000593"}', true);
set local role authenticated;
update public.consultation_notes
   set voided_at = now(), voided_by = '00000000-0000-0000-0000-000000000593', void_reason = 'Entered by mistake'
 where complaint = 'T59 first visit';
reset role;
do $$
begin
  if (select voided_at from public.consultation_notes where complaint = 'T59 first visit') is not null then
    raise exception 'FAIL 2: a consultant voided another consultant''s note';
  end if;
end $$;
\echo 'PASS 2: a consultant cannot void another consultant''s note'


-- ===== 3. Each voids their own =====
do $$
declare
  who text;
  what text;
begin
  foreach who in array array['000000000592', '000000000593'] loop
    what := case who when '000000000592' then 'T59 first visit' else 'T59 follow up' end;
    perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-' || who || '"}', true);
    set local role authenticated;
    update public.consultation_notes
       set voided_at = now(), voided_by = ('00000000-0000-0000-0000-' || who)::uuid, void_reason = 'Duplicate'
     where complaint = what;
    reset role;
    if (select voided_at from public.consultation_notes where complaint = what) is null then
      raise exception 'FAIL 3: % could not void their own note', who;
    end if;
  end loop;
end $$;
\echo 'PASS 3: each consultant voids their own note'


-- ===== 4. Typed by doctor 2, signed by doctor 1: doctor 1 may void it =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000593"}', true);
set local role authenticated;
insert into public.consultation_notes (patient_id, complaint, written_by, signed_by)
select id, 'T59 signed by doctor 1', '00000000-0000-0000-0000-000000000593', '00000000-0000-0000-0000-000000000592'
from public.patients where full_name = 'T59 Patient';
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000592"}', true);
set local role authenticated;
update public.consultation_notes
   set voided_at = now(), voided_by = '00000000-0000-0000-0000-000000000592', void_reason = 'Duplicate'
 where complaint = 'T59 signed by doctor 1';
reset role;

-- And the doctor who typed it may void such a note too.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000593"}', true);
set local role authenticated;
insert into public.consultation_notes (patient_id, complaint, written_by, signed_by)
select id, 'T59 typed by doctor 2', '00000000-0000-0000-0000-000000000593', '00000000-0000-0000-0000-000000000592'
from public.patients where full_name = 'T59 Patient';
update public.consultation_notes
   set voided_at = now(), voided_by = '00000000-0000-0000-0000-000000000593', void_reason = 'Duplicate'
 where complaint = 'T59 typed by doctor 2';
reset role;
do $$
begin
  if (select voided_at from public.consultation_notes where complaint = 'T59 signed by doctor 1') is null
     or (select voided_at from public.consultation_notes where complaint = 'T59 typed by doctor 2') is null then
    raise exception 'FAIL 4: the doctor it was signed by, or who typed it, could not void it';
  end if;
end $$;
\echo 'PASS 4: the doctor a note is signed by, or who typed it, may void it'


-- ===== 5. Never in another person's name =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000592"}', true);
set local role authenticated;
insert into public.consultation_notes (patient_id, complaint, written_by)
select id, 'T59 second visit', '00000000-0000-0000-0000-000000000592' from public.patients where full_name = 'T59 Patient';
do $$
begin
  update public.consultation_notes
     set voided_at = now(), voided_by = '00000000-0000-0000-0000-000000000593', void_reason = 'Duplicate'
   where complaint = 'T59 second visit';
  raise exception 'FAIL 5: a note was voided in another person''s name';
exception when insufficient_privilege then null;
end $$;
reset role;
\echo 'PASS 5: nobody voids in another person''s name'

rollback;

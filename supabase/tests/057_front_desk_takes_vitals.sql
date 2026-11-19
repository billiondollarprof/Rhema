-- =============================================================================
-- 057_front_desk_takes_vitals.sql: tests for front_desk_takes_vitals
-- (request 228c, 2026-11-19).
--
-- What this proves:
--   1. The Front Desk adds a reading without opening the record; it is signed
--      by the Front Desk and written in the activity log.
--   2. The nurse with the record open sees the Front Desk's reading.
--   3. The Front Desk reads back only its own readings, and nothing else of
--      the record.
--   4. The Front Desk cannot save in another person's name, or sign as one.
--   5. The Front Desk cannot void a reading.
--   6. The Pharmacy and the Lab still cannot add readings; a nurse without
--      the record open still cannot; nobody signs as the Front Desk.
--   7. A double tap by the Front Desk saves one line.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000571', 't057-desk@test.rhema'),
  ('00000000-0000-0000-0000-000000000572', 't057-nurse@test.rhema'),
  ('00000000-0000-0000-0000-000000000573', 't057-pharmacy@test.rhema'),
  ('00000000-0000-0000-0000-000000000574', 't057-lab@test.rhema'),
  ('00000000-0000-0000-0000-000000000575', 't057-nurse2@test.rhema');
insert into public.staff (id, full_name, email, role, can_medical) values
  ('00000000-0000-0000-0000-000000000571', 'T57 Desk',     't057-desk@test.rhema',     'front_desk', false),
  ('00000000-0000-0000-0000-000000000572', 'T57 Nurse',    't057-nurse@test.rhema',    'nurse',      true),
  ('00000000-0000-0000-0000-000000000573', 'T57 Pharmacy', 't057-pharmacy@test.rhema', 'pharmacy',   false),
  ('00000000-0000-0000-0000-000000000574', 'T57 Lab',      't057-lab@test.rhema',      'laboratory', false),
  ('00000000-0000-0000-0000-000000000575', 'T57 Nurse Two','t057-nurse2@test.rhema',   'nurse',      true);
update public.staff set can_medical = false
 where id in ('00000000-0000-0000-0000-000000000571', '00000000-0000-0000-0000-000000000573',
              '00000000-0000-0000-0000-000000000574');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T57 Patient', '1990-01-01', 'female', '00000000-0000-0000-0000-000000000571');
-- Only the first nurse has the record open.
insert into public.record_openings (patient_id, staff_id)
select id, '00000000-0000-0000-0000-000000000572' from public.patients where full_name = 'T57 Patient';
insert into public.nursing_notes (patient_id, note, written_by)
select id, 'T57 a nursing note', '00000000-0000-0000-0000-000000000572'
from public.patients where full_name = 'T57 Patient';


-- ===== 1. The Front Desk adds a reading =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000571"}', true);
set local role authenticated;
insert into public.vital_signs (patient_id, temperature_c, pulse, systolic, diastolic, recorded_by)
select id, 36.9, 80, 120, 80, '00000000-0000-0000-0000-000000000571'
from public.patients where full_name = 'T57 Patient';
reset role;
do $$
declare
  line public.vital_signs;
begin
  select * into line from public.vital_signs
  where recorded_by = '00000000-0000-0000-0000-000000000571';
  if line.id is null then
    raise exception 'FAIL 1: the Front Desk could not add a reading';
  end if;
  if line.signed_by is distinct from '00000000-0000-0000-0000-000000000571' then
    raise exception 'FAIL 1: the reading is not signed by the Front Desk';
  end if;
  if not exists (select 1 from public.activity_log where table_name = 'vital_signs'
                 and record_id = line.id::text and actor_id = '00000000-0000-0000-0000-000000000571') then
    raise exception 'FAIL 1: the reading is not in the activity log';
  end if;
end $$;
\echo 'PASS 1: the Front Desk adds a reading, signed and logged'


-- ===== 2. The nurse with the record open sees it =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000572"}', true);
set local role authenticated;
insert into public.vital_signs (patient_id, spo2, recorded_by)
select id, 97, '00000000-0000-0000-0000-000000000572' from public.patients where full_name = 'T57 Patient';
do $$
begin
  if (select count(*) from public.vital_signs) <> 2 then
    raise exception 'FAIL 2: the nurse does not see both readings';
  end if;
end $$;
reset role;
\echo 'PASS 2: the nurse sees the Front Desk''s reading in the record'


-- ===== 3. The Front Desk reads only its own readings =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000571"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.vital_signs) <> 1 then
    raise exception 'FAIL 3: the Front Desk sees readings it did not take';
  end if;
  if (select count(*) from public.nursing_notes) <> 0 then
    raise exception 'FAIL 3: the Front Desk sees the nursing notes';
  end if;
end $$;
reset role;
\echo 'PASS 3: the Front Desk reads back only its own readings'


-- ===== 4. Not in another person's name, not signed as another =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000571"}', true);
set local role authenticated;
do $$
declare patient bigint := (select id from public.patients where full_name = 'T57 Patient');
begin
  begin
    insert into public.vital_signs (patient_id, pulse, recorded_by)
    values (patient, 90, '00000000-0000-0000-0000-000000000572');
    raise exception 'FAIL 4: the Front Desk saved a reading in the nurse''s name';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.vital_signs (patient_id, pulse, recorded_by, signed_by)
    values (patient, 91, '00000000-0000-0000-0000-000000000571', '00000000-0000-0000-0000-000000000572');
    raise exception 'FAIL 4: the Front Desk signed as the nurse';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
\echo 'PASS 4: the Front Desk saves and signs only as itself'


-- ===== 5. The Front Desk cannot void =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000571"}', true);
set local role authenticated;
update public.vital_signs
   set voided_at = now(), voided_by = '00000000-0000-0000-0000-000000000571', void_reason = 'T57'
 where recorded_by = '00000000-0000-0000-0000-000000000571';
reset role;
do $$
begin
  if exists (select 1 from public.vital_signs where voided_at is not null) then
    raise exception 'FAIL 5: the Front Desk voided a reading';
  end if;
end $$;
\echo 'PASS 5: the Front Desk cannot void a reading'


-- ===== 6. Everybody else as before =====
do $$
declare
  who text;
  patient bigint := (select id from public.patients where full_name = 'T57 Patient');
begin
  foreach who in array array['000000000573', '000000000574', '000000000575'] loop
    perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-' || who || '"}', true);
    set local role authenticated;
    begin
      insert into public.vital_signs (patient_id, pulse, recorded_by)
      values (patient, 70, ('00000000-0000-0000-0000-' || who)::uuid);
      reset role;
      raise exception 'FAIL 6: % added a reading', who;
    exception when insufficient_privilege then
      reset role;
    end;
  end loop;
  -- The nurse with the record open cannot sign in the Front Desk's name.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000572"}', true);
  set local role authenticated;
  begin
    insert into public.vital_signs (patient_id, pulse, recorded_by, signed_by)
    values (patient, 72, '00000000-0000-0000-0000-000000000572', '00000000-0000-0000-0000-000000000571');
    reset role;
    raise exception 'FAIL 6: the nurse signed as the Front Desk';
  exception when insufficient_privilege then
    reset role;
  end;
end $$;
\echo 'PASS 6: the Pharmacy, the Lab and a nurse without the record cannot add; nobody signs as the Front Desk'


-- ===== 7. A double tap saves one line =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000571"}', true);
set local role authenticated;
insert into public.vital_signs (patient_id, weight_kg, recorded_by)
select id, 64.5, '00000000-0000-0000-0000-000000000571' from public.patients where full_name = 'T57 Patient';
insert into public.vital_signs (patient_id, weight_kg, recorded_by)
select id, 64.5, '00000000-0000-0000-0000-000000000571' from public.patients where full_name = 'T57 Patient';
reset role;
do $$
begin
  if (select count(*) from public.vital_signs where weight_kg = 64.5) <> 1 then
    raise exception 'FAIL 7: a double tap saved two lines';
  end if;
end $$;
\echo 'PASS 7: a double tap by the Front Desk saves one line'

rollback;

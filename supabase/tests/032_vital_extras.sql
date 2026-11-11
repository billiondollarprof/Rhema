-- =============================================================================
-- 032_vital_extras.sql: tests for "Other" vital signs.
--
-- What this is: proves a measure is private to the person who typed it until
-- a second person types the same one, then standard for everybody; readings
-- need the record open, are in the writer's own name, saved once, voided
-- never deleted; and the Front Desk can do none of it.
--
-- Runs inside one transaction that is rolled back. Made up people only.
-- =============================================================================

\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000321', 't032-nurse1@test.rhema'),
  ('00000000-0000-0000-0000-000000000322', 't032-nurse2@test.rhema'),
  ('00000000-0000-0000-0000-000000000323', 't032-doctor@test.rhema'),
  ('00000000-0000-0000-0000-000000000324', 't032-desk@test.rhema');
insert into public.staff (id, full_name, email, role) values
  ('00000000-0000-0000-0000-000000000321', 'T32 Nurse1', 't032-nurse1@test.rhema', 'nurse'),
  ('00000000-0000-0000-0000-000000000322', 'T32 Nurse2', 't032-nurse2@test.rhema', 'nurse'),
  ('00000000-0000-0000-0000-000000000323', 'T32 Doctor', 't032-doctor@test.rhema', 'doctor'),
  ('00000000-0000-0000-0000-000000000324', 'T32 Desk',   't032-desk@test.rhema',   'front_desk');
insert into public.patients (full_name, date_of_birth, sex, created_by)
values ('T32 Patient', '1990-01-01', 'female', '00000000-0000-0000-0000-000000000324');
create temporary table t (patient bigint, measure bigint);
insert into t (patient) select id from public.patients where full_name = 'T32 Patient';
grant all on t to authenticated;


-- ===== 1. Rights =====
do $$
begin
  if has_table_privilege('anon', 'public.vital_extras', 'SELECT, INSERT, UPDATE, DELETE')
     or has_table_privilege('anon', 'public.vital_measures', 'SELECT, INSERT, UPDATE, DELETE')
     or has_table_privilege('anon', 'public.vital_measure_users', 'SELECT, INSERT, UPDATE, DELETE') then
    raise exception 'FAIL 1: the public has rights on the vital sign tables';
  end if;
  if has_table_privilege('authenticated', 'public.vital_measures', 'INSERT, UPDATE, DELETE')
     or has_table_privilege('authenticated', 'public.vital_measure_users', 'INSERT, UPDATE, DELETE')
     or has_table_privilege('authenticated', 'public.vital_extras', 'DELETE, TRUNCATE') then
    raise exception 'FAIL 1: signed in users write measures by hand or delete readings';
  end if;
end $$;
\echo 'PASS 1: nobody holds rights they should not have'


-- ===== 2. One nurse types a measure: it is hers alone =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000321"}', true);
set local role authenticated;
update t set measure = public.use_vital_measure('Blood sugar', 'mmol/L');
do $$
begin
  if not exists (select 1 from public.vital_measures where name = 'Blood sugar') then
    raise exception 'FAIL 2: the nurse cannot see her own measure';
  end if;
  if exists (select 1 from public.vital_measures where standard) then
    raise exception 'FAIL 2: a measure typed by one person is already standard';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000323"}', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.vital_measures where name = 'Blood sugar') then
    raise exception 'FAIL 2: another person can see a measure typed by one nurse';
  end if;
end $$;
reset role;
\echo 'PASS 2: a measure typed by one person is only theirs'


-- ===== 3. A second person types it (different spelling): standard for all =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000322"}', true);
set local role authenticated;
do $$
declare second bigint;
begin
  second := public.use_vital_measure('  blood -  SUGAR ', null);
  if second <> (select measure from t) then
    raise exception 'FAIL 3: the same measure in another spelling made a second measure';
  end if;
end $$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000323"}', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.vital_measures where name = 'Blood sugar' and standard) then
    raise exception 'FAIL 3: a measure two people typed is not standard for everybody';
  end if;
end $$;
reset role;
\echo 'PASS 3: when a second person types it, it becomes standard for everybody'


-- ===== 4. The same person twice does not make it standard =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000321"}', true);
set local role authenticated;
select public.use_vital_measure('Peak flow', 'L/min');
select public.use_vital_measure('peak flow', 'L/min');
do $$
begin
  if (select standard from public.vital_measures where name = 'Peak flow') then
    raise exception 'FAIL 4: one person typing it twice made it standard';
  end if;
end $$;
reset role;
\echo 'PASS 4: the same person twice does not make it standard'


-- ===== 5. Readings: record open, own name, once, voided never deleted =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000321"}', true);
set local role authenticated;
do $$
begin
  begin
    insert into public.vital_extras (patient_id, measure_id, name, unit, value)
      select patient, measure, 'Blood sugar', 'mmol/L', 5.4 from t;
    raise exception 'FAIL 5: a reading was saved without opening the record';
  exception when insufficient_privilege then null;
  end;
end $$;
select public.open_record((select patient from t));
insert into public.vital_extras (patient_id, measure_id, name, unit, value)
  select patient, measure, 'Blood sugar', 'mmol/L', 5.4 from t;
insert into public.vital_extras (patient_id, measure_id, name, unit, value)
  select patient, measure, 'Blood sugar', 'mmol/L', 5.4 from t;
do $$
begin
  if (select count(*) from public.vital_extras) <> 1 then
    raise exception 'FAIL 5: a double tap saved two readings';
  end if;
  begin
    insert into public.vital_extras (patient_id, measure_id, name, unit, value, recorded_by)
      select patient, measure, 'Blood sugar', 'mmol/L', 6.1, '00000000-0000-0000-0000-000000000322' from t;
    raise exception 'FAIL 5: a reading was written in another person''s name';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.vital_extras;
    raise exception 'FAIL 5: a reading was deleted';
  exception when insufficient_privilege then null;
  end;
  update public.vital_extras
    set voided_at = now(), voided_by = '00000000-0000-0000-0000-000000000321', void_reason = 'Typed by mistake';
  if not exists (select 1 from public.vital_extras where voided_at is not null) then
    raise exception 'FAIL 5: a reading could not be voided';
  end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.activity_log where table_name = 'vital_extras') then
    raise exception 'FAIL 5: the readings are not in the activity log';
  end if;
end $$;
\echo 'PASS 5: readings need the record open, are in the writer''s name, save once, are voided never deleted, and are logged'


-- ===== 6. Private lines and readings stay private =====
-- (made by the test as the owner of the database, then asked as other people)
create temporary table peak (id bigint);
grant select on peak to authenticated;
insert into peak select id from public.vital_measures where name = 'Peak flow';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000323"}', true);
set local role authenticated;
select public.open_record((select patient from t));
do $$
begin
  -- The doctor cannot see Peak flow, and a reading on it is refused.
  begin
    insert into public.vital_extras (patient_id, measure_id, name, unit, value)
      select t.patient, peak.id, 'Peak flow', 'L/min', 300 from t, peak;
    raise exception 'FAIL 6: a reading was saved on somebody else''s private measure';
  exception when insufficient_privilege then null;
  end;
  -- She can read the nurse's reading now, because she has opened the record.
  if (select count(*) from public.vital_extras) <> 1 then
    raise exception 'FAIL 6: a doctor with the record open cannot read the readings';
  end if;
end $$;
reset role;
-- A nurse who has NOT opened the record reads nothing.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000322"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.vital_extras) <> 0 then
    raise exception 'FAIL 6: readings can be read without opening the record';
  end if;
  -- Each person sees only their own "who uses which measure" lines.
  if (select count(*) from public.vital_measure_users) <> 1 then
    raise exception 'FAIL 6: a person can see other people''s measure lines';
  end if;
end $$;
reset role;
\echo 'PASS 6: private measures, readings and measure lines stay private'


-- ===== 7. The Front Desk cannot use any of it =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000324"}', true);
set local role authenticated;
do $$
begin
  begin
    perform public.use_vital_measure('Nope', 'x');
    raise exception 'FAIL 7: the Front Desk made a measure';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from public.vital_measures) <> 0 then
    raise exception 'FAIL 7: the Front Desk can read measures';
  end if;
end $$;
reset role;
\echo 'PASS 7: the Front Desk can do none of it'

rollback;
